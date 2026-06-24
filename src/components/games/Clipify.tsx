import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAllLikedTracks, createClipsPlaylist, fetchClipifyPlaylists, fetchClipifyPlaylistClips, LikedTrack, ClipifyPlaylistSummary } from "../../api/spotify";
import { ClipExportItem, defaultClipifyPlaylistName, ParsedPlaylistClip, stripClipifyPlaylistPrefix } from "../../lib/clipifyPlaylist";
import { formatTime } from "../../lib/formatTime";
import {
  clearSpotifySession,
  ensureSpotifyDevSetup,
  getStoredAccessToken,
  startSpotifyLogin,
} from "../../lib/spotifyAuth";
import { consumeClipifyOAuthError } from "../SpotifyOAuthHandler";
import {
  destroySpotifyPlayer,
  getPlaybackState,
  pausePlayback,
  PlaybackState,
  playTrack,
  seekTo,
  subscribePlayback,
  subscribePlayerError,
  togglePlayback,
} from "../../lib/spotifyPlayer";
import "../../styles/Clipify.css";

type ClipifyView = "liked" | "playlists";

type ClipsByTrack = Record<string, { startMs: number; endMs: number }[]>;

const Clipify: React.FC = () => {
  const [tracks, setTracks] = useState<LikedTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [exportingPlaylist, setExportingPlaylist] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPlaylistName, setExportPlaylistName] = useState(defaultClipifyPlaylistName);
  const [exportedPlaylistUrl, setExportedPlaylistUrl] = useState<string | null>(null);
  const [pendingStartMs, setPendingStartMs] = useState<number | null>(null);
  const [markersByTrack, setMarkersByTrack] = useState<ClipsByTrack>({});
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const [view, setView] = useState<ClipifyView>("playlists");
  const [clipifyPlaylists, setClipifyPlaylists] = useState<ClipifyPlaylistSummary[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [expandedPlaylistIds, setExpandedPlaylistIds] = useState<
    Record<string, boolean>
  >({});
  const [clipsByPlaylistId, setClipsByPlaylistId] = useState<
    Record<string, { clips: ParsedPlaylistClip[] }>
  >({});
  const [clipsLoadingId, setClipsLoadingId] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<{
    startMs: number;
    endMs: number;
    key: string;
  } | null>(null);
  const [nowPlayingClip, setNowPlayingClip] = useState<ParsedPlaylistClip | null>(null);
  const isScrubbing = useRef(false);
  const activeClipRef = useRef(activeClip);
  const playbackRef = useRef(playback);
  activeClipRef.current = activeClip;
  playbackRef.current = playback;
  const loadGeneration = useRef(0);
  const loadAbort = useRef<AbortController | null>(null);
  const likedSongsLoadAttempted = useRef(false);
  const loadedPlaylistClips = useRef<Set<string>>(new Set());

  const activeTrack = tracks.find((track) => track.id === playback?.trackId);
  const displayTrack = activeTrack ?? nowPlayingClip;
  const clipBounds = activeClip;
  const displayPositionMs = scrubMs ?? playback?.positionMs ?? 0;
  const displayDurationMs = clipBounds
    ? clipBounds.endMs - clipBounds.startMs
    : playback?.durationMs ?? activeTrack?.durationMs ?? nowPlayingClip?.durationMs ?? 0;
  const scrubMin = clipBounds?.startMs ?? 0;
  const scrubMax = clipBounds
    ? clipBounds.endMs
    : playback?.durationMs ?? activeTrack?.durationMs ?? nowPlayingClip?.durationMs ?? 1;
  const scrubValue = clipBounds
    ? Math.min(Math.max(displayPositionMs, scrubMin), scrubMax)
    : Math.min(displayPositionMs, scrubMax || 0);
  const displayPositionLabel = clipBounds
    ? formatTime(Math.max(0, displayPositionMs - clipBounds.startMs))
    : formatTime(displayPositionMs);
  const displayDurationLabel = clipBounds
    ? formatTime(clipBounds.endMs - clipBounds.startMs)
    : formatTime(displayDurationMs);

  const playingTrackId = playback?.trackId ?? null;
  const isPlaybackActive = Boolean(loggedIn && playback && !playback.paused);

  const clipCount = useMemo(
    () =>
      Object.values(markersByTrack).reduce(
        (total, markers) => total + markers.length,
        0
      ),
    [markersByTrack]
  );

  const buildClipExportItems = useCallback((): ClipExportItem[] => {
    const items: ClipExportItem[] = [];
    for (const track of tracks) {
      const markers = markersByTrack[track.id] ?? [];
      for (const marker of markers) {
        items.push({
          uri: track.uri,
          startMs: marker.startMs,
          endMs: marker.endMs,
        });
      }
    }
    return items;
  }, [tracks, markersByTrack]);

  const loadClipifyPlaylists = useCallback(async () => {
    setPlaylistsLoading(true);
    setError(null);
    try {
      const playlists = await fetchClipifyPlaylists();
      setClipifyPlaylists(playlists);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load Clipify playlists."
      );
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  const loadPlaylistClips = useCallback(async (playlistId: string) => {
    if (loadedPlaylistClips.current.has(playlistId)) {
      return;
    }

    setClipsLoadingId(playlistId);
    setPlayError(null);
    try {
      const { clips } = await fetchClipifyPlaylistClips(playlistId);
      loadedPlaylistClips.current.add(playlistId);
      setClipsByPlaylistId((prev) => ({ ...prev, [playlistId]: { clips } }));
    } catch (err) {
      setPlayError(
        err instanceof Error ? err.message : "Failed to load playlist clips."
      );
    } finally {
      setClipsLoadingId((current) => (current === playlistId ? null : current));
    }
  }, []);

  const togglePlaylistExpanded = (playlistId: string) => {
    setExpandedPlaylistIds((prev) => {
      const willExpand = !prev[playlistId];
      if (willExpand) {
        loadPlaylistClips(playlistId).catch(() => undefined);
      }
      return { ...prev, [playlistId]: willExpand };
    });
  };

  const loadTracks = useCallback(async () => {
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    const generation = ++loadGeneration.current;

    setLoading(true);
    setLoadProgress(null);
    setError(null);
    try {
      const liked = await fetchAllLikedTracks({
        signal: controller.signal,
        onProgress: (progress) => {
          if (generation !== loadGeneration.current) {
            return;
          }
          setLoadProgress((prev) =>
            !prev || progress.loaded >= prev.loaded ? progress : prev
          );
        },
      });
      if (generation !== loadGeneration.current) {
        return;
      }
      setTracks(liked);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (generation !== loadGeneration.current) {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load liked songs.");
    } finally {
      if (generation === loadGeneration.current) {
        setLoading(false);
        setLoadProgress(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      return;
    }
    return subscribePlayerError((message) => {
      setPlayError(message || null);
    });
  }, [loggedIn]);

  useEffect(() => {
    ensureSpotifyDevSetup();

    let cancelled = false;

    async function init() {
      try {
        const oauthError = consumeClipifyOAuthError();
        if (oauthError) {
          setError(oauthError);
          setLoading(false);
          return;
        }
        if (cancelled) {
          return;
        }
        if (getStoredAccessToken()) {
          setLoggedIn(true);
          loadClipifyPlaylists().catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Spotify login failed."
          );
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      loadAbort.current?.abort();
      loadGeneration.current += 1;
    };
  }, [loadClipifyPlaylists]);

  useEffect(() => {
    if (!loggedIn) {
      return;
    }
    return subscribePlayback((state) => {
      if (!isScrubbing.current) {
        setPlayback(state);
        setScrubMs(null);
      }

      const clip = activeClipRef.current;
      if (
        clip &&
        state &&
        !state.paused &&
        state.trackId &&
        state.positionMs >= clip.endMs
      ) {
        pausePlayback().catch(() => undefined);
      }
    });
  }, [loggedIn]);

  useEffect(() => {
    if (!isPlaybackActive || !playingTrackId) {
      return;
    }

    const interval = window.setInterval(() => {
      if (isScrubbing.current) {
        return;
      }

      getPlaybackState()
        .then((state) => {
          if (!state || isScrubbing.current) {
            return;
          }

          setPlayback(state);

          const clip = activeClipRef.current;
          if (
            clip &&
            !state.paused &&
            state.positionMs >= clip.endMs
          ) {
            pausePlayback().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 100);

    return () => window.clearInterval(interval);
  }, [isPlaybackActive, playingTrackId]);

  useEffect(() => {
    return () => {
      destroySpotifyPlayer();
    };
  }, []);

  const handlePlayTrack = async (track: LikedTrack) => {
    setPlayError(null);
    const markers = markersByTrack[track.id] ?? [];
    const marker = markers.length === 1 ? markers[0] : null;
    const clipKey = marker ? `liked-${track.id}-0` : null;

    try {
      if (clipKey && activeClip?.key === clipKey && playback?.trackId === track.id) {
        if (!playback.paused) {
          await togglePlayback();
          return;
        }
        if ((playback.positionMs ?? 0) >= marker!.endMs - 50) {
          await playTrack(track.uri, { positionMs: marker!.startMs });
        } else {
          await togglePlayback();
        }
        const state = await getPlaybackState();
        setPlayback(state);
        return;
      }

      if (!clipKey && playback?.trackId === track.id) {
        await togglePlayback();
        return;
      }

      setNowPlayingClip(null);
      setPendingStartMs(null);

      if (marker && clipKey) {
        setActiveClip({
          startMs: marker.startMs,
          endMs: marker.endMs,
          key: clipKey,
        });
        await playTrack(track.uri, { positionMs: marker.startMs });
      } else {
        setActiveClip(null);
        await playTrack(track.uri);
      }

      const state = await getPlaybackState();
      setPlayback(state);
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : "Playback failed.");
    }
  };

  const handlePlayClip = async (
    clip: ParsedPlaylistClip,
    playlistId: string,
    index: number
  ) => {
    const clipKey = `${playlistId}-${index}`;
    setPlayError(null);
    try {
      if (activeClip?.key === clipKey && playback?.trackId === clip.id) {
        if (!playback.paused) {
          await togglePlayback();
          return;
        }
        if ((playback.positionMs ?? 0) >= clip.endMs - 50) {
          await playTrack(clip.uri, { positionMs: clip.startMs });
        } else {
          await togglePlayback();
        }
        const state = await getPlaybackState();
        setPlayback(state);
        return;
      }
      setActiveClip({
        startMs: clip.startMs,
        endMs: clip.endMs,
        key: clipKey,
      });
      setNowPlayingClip(clip);
      setPendingStartMs(null);
      await playTrack(clip.uri, { positionMs: clip.startMs });
      const state = await getPlaybackState();
      setPlayback(state);
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : "Playback failed.");
    }
  };

  const handleScrubChange = (value: number) => {
    isScrubbing.current = true;
    setScrubMs(value);
  };

  const handleScrubCommit = async (value: number) => {
    setPlayError(null);
    try {
      const seekMs = clipBounds
        ? Math.min(Math.max(value, clipBounds.startMs), clipBounds.endMs)
        : value;
      await seekTo(seekMs);
      const state = await getPlaybackState();
      setPlayback(state);
    } catch (err) {
      setPlayError(err instanceof Error ? err.message : "Seek failed.");
    } finally {
      isScrubbing.current = false;
      setScrubMs(null);
    }
  };

  const addMarkerAtCurrentTime = useCallback(async () => {
    if (!playback?.trackId) {
      return;
    }

    const state = await getPlaybackState();
    if (!state) {
      return;
    }

    const positionMs = state.positionMs;

    if (pendingStartMs === null) {
      setPendingStartMs(positionMs);
      return;
    }

    const startMs = Math.min(pendingStartMs, positionMs);
    const endMs = Math.max(pendingStartMs, positionMs);
    const trackId = state.trackId;

    setMarkersByTrack((prev) => ({
      ...prev,
      [trackId]: [...(prev[trackId] ?? []), { startMs, endMs }],
    }));
    setPendingStartMs(null);
  }, [playback?.trackId, pendingStartMs]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "m") {
        return;
      }
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      addMarkerAtCurrentTime();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addMarkerAtCurrentTime]);

  useEffect(() => {
    setPendingStartMs(null);
  }, [playback?.trackId]);

  const handleLogin = (forceConsent = false) => {
    setError(null);
    setPlayError(null);
    startSpotifyLogin({ forceConsent }).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not start login.");
    });
  };

  const handleReconnect = () => {
    destroySpotifyPlayer();
    clearSpotifySession();
    setPlayback(null);
    setPlayError(null);
    setExportedPlaylistUrl(null);
    handleLogin(true);
  };

  const handleExportPlaylist = async () => {
    setExportingPlaylist(true);
    setPlayError(null);
    setExportedPlaylistUrl(null);
    try {
      const playlist = await createClipsPlaylist(
        buildClipExportItems(),
        exportPlaylistName
      );
      setExportedPlaylistUrl(playlist.url);
      setExportPlaylistName(defaultClipifyPlaylistName());
      setShowExportModal(false);
      if (view === "playlists") {
        loadClipifyPlaylists().catch(() => undefined);
      }
    } catch (err) {
      setPlayError(
        err instanceof Error ? err.message : "Failed to export playlist."
      );
    } finally {
      setExportingPlaylist(false);
    }
  };

  const openExportModal = () => {
    setExportPlaylistName(defaultClipifyPlaylistName());
    setShowExportModal(true);
  };

  const closeExportModal = () => {
    if (!exportingPlaylist) {
      setShowExportModal(false);
    }
  };

  const handleLogout = () => {
    destroySpotifyPlayer();
    clearSpotifySession();
    setTracks([]);
    setLoggedIn(false);
    setPlayback(null);
    setPendingStartMs(null);
    setError(null);
    setPlayError(null);
    setView("playlists");
    likedSongsLoadAttempted.current = false;
    setClipifyPlaylists([]);
    setExpandedPlaylistIds({});
    setClipsByPlaylistId({});
    setClipsLoadingId(null);
    loadedPlaylistClips.current.clear();
    setActiveClip(null);
    setNowPlayingClip(null);
  };

  const isPlaying = (trackId: string) => {
    const markers = markersByTrack[trackId] ?? [];
    const clipKey = markers.length === 1 ? `liked-${trackId}-0` : null;
    if (clipKey && activeClip?.key === clipKey) {
      return playback?.trackId === trackId && !playback.paused;
    }
    return !activeClip && playback?.trackId === trackId && !playback.paused;
  };

  const isPlayingClip = (playlistId: string, index: number) => {
    const clipKey = `${playlistId}-${index}`;
    const clip = clipsByPlaylistId[playlistId]?.clips[index];
    return (
      activeClip?.key === clipKey &&
      playback?.trackId === clip?.id &&
      !playback?.paused
    );
  };

  useEffect(() => {
    if (!showExportModal) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exportingPlaylist) {
        setShowExportModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showExportModal, exportingPlaylist]);

  const handleViewChange = (nextView: ClipifyView) => {
    setView(nextView);
    if (
      nextView === "playlists" &&
      clipifyPlaylists.length === 0 &&
      !playlistsLoading
    ) {
      loadClipifyPlaylists().catch(() => undefined);
    }
    if (nextView === "liked" && !likedSongsLoadAttempted.current) {
      likedSongsLoadAttempted.current = true;
      loadTracks().catch(() => undefined);
    }
  };

  return (
    <div
      className={`section wiki-page clipify-page${
        loggedIn && displayTrack ? " clipify-page--has-player" : ""
      }`}
    >
      <header className="clipify-header">
        <Link to="/slop" className="rank-back-link">
          ← Slop
        </Link>
        <div className="clipify-header-row">
          <h1>Clipify</h1>
          <div className="clipify-header-actions">
            {loggedIn && clipCount > 0 && (
              <button
                type="button"
                className="clipify-btn clipify-btn--spotify clipify-header-export-btn"
                onClick={openExportModal}
              >
                Export {clipCount} clip{clipCount === 1 ? "" : "s"}
              </button>
            )}
            {loggedIn && (
              <button
                type="button"
                className="clipify-btn clipify-btn--secondary"
                onClick={handleLogout}
              >
                Log out
              </button>
            )}
          </div>
        </div>
      </header>

      {loggedIn && (
        <nav className="clipify-tabs" aria-label="Clipify views">
          <button
            type="button"
            className={`clipify-tab ${view === "liked" ? "clipify-tab--active" : ""}`}
            onClick={() => handleViewChange("liked")}
          >
            Liked songs
          </button>
          <button
            type="button"
            className={`clipify-tab ${view === "playlists" ? "clipify-tab--active" : ""}`}
            onClick={() => handleViewChange("playlists")}
          >
            Clipify playlists
          </button>
        </nav>
      )}

      {!loggedIn && !loading && (
        <div className="clipify-login">
          <p className="clipify-intro">
            Sign in with Spotify to browse Clipify playlists and mark clips.
          </p>
          <button
            type="button"
            className="clipify-btn clipify-btn--spotify"
            onClick={() => handleLogin(false)}
          >
            Log in with Spotify
          </button>
        </div>
      )}

      {loggedIn && view === "liked" && loading && (
        <div className="clipify-loading-wrap">
          <p className="clipify-loading">
            Loading your liked songs…
            {loadProgress && loadProgress.total > 0 && (
              <>
                {" "}
                {loadProgress.loaded} / {loadProgress.total}
              </>
            )}
          </p>
          <div
            className="clipify-load-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={loadProgress?.total ?? 100}
            aria-valuenow={loadProgress?.loaded ?? 0}
            aria-label="Loading liked songs"
          >
            <div
              className="clipify-load-progress-bar"
              style={{
                width:
                  loadProgress && loadProgress.total > 0
                    ? `${Math.min(
                        100,
                        (loadProgress.loaded / loadProgress.total) * 100
                      )}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      )}
      {error && <p className="wiki-error">{error}</p>}
      {exportedPlaylistUrl && (
        <p className="clipify-export-success">
          Playlist created with {clipCount} clip{clipCount === 1 ? "" : "s"}.{" "}
          <a href={exportedPlaylistUrl} target="_blank" rel="noopener noreferrer">
            Open in Spotify
          </a>
        </p>
      )}

      {playError && loggedIn && (
        <div className="clipify-play-error">
          <p className="wiki-error">{playError}</p>
          <button
            type="button"
            className="clipify-btn clipify-btn--secondary"
            onClick={handleReconnect}
          >
            Reconnect Spotify
          </button>
        </div>
      )}

      {loggedIn && view === "liked" && tracks.length > 0 && (
        <div className="clipify-table-wrap">
          <p className="clipify-count">{tracks.length} liked songs</p>
          <table className="clipify-table">
            <thead>
              <tr>
                <th>#</th>
                <th aria-label="Play" />
                <th>Title</th>
                <th>Artists</th>
                <th>Album</th>
                <th>Markers</th>
                <th>Liked</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, index) => {
                const markers = markersByTrack[track.id] ?? [];
                const playing = isPlaying(track.id);
                return (
                  <tr
                    key={track.id}
                    className={
                      playback?.trackId === track.id
                        ? "clipify-row--active"
                        : undefined
                    }
                  >
                    <td>{index + 1}</td>
                    <td>
                      <button
                        type="button"
                        className={`clipify-play-btn ${
                          playing ? "clipify-play-btn--active" : ""
                        }`}
                        onClick={() => handlePlayTrack(track)}
                        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
                        title={playing ? "Pause" : "Play"}
                      >
                        {playing ? "⏸" : "▶"}
                      </button>
                    </td>
                    <td className="clipify-title">{track.title}</td>
                    <td className="clipify-artists">{track.artists}</td>
                    <td>{track.album}</td>
                    <td className="clipify-markers">
                      {markers.length === 0 ? (
                        <span className="clipify-markers-empty">—</span>
                      ) : (
                        markers.map((marker, markerIndex) => (
                          <span
                            key={`${marker.startMs}-${marker.endMs}-${markerIndex}`}
                            className="clipify-marker-chip"
                          >
                            {formatTime(marker.startMs)}–{formatTime(marker.endMs)}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="clipify-date">{track.addedAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loggedIn && view === "playlists" && (
        <div className="clipify-playlists">
          <div className="clipify-playlists-toolbar">
            <p className="clipify-count">
              {playlistsLoading
                ? "Loading playlists…"
                : `${clipifyPlaylists.length} Clipify playlist${clipifyPlaylists.length === 1 ? "" : "s"}`}
            </p>
            <button
              type="button"
              className="clipify-btn clipify-btn--secondary"
              onClick={() => loadClipifyPlaylists()}
              disabled={playlistsLoading}
            >
              Refresh
            </button>
          </div>

          {!playlistsLoading && clipifyPlaylists.length === 0 && (
            <p className="clipify-empty">
              No Clipify playlists yet. Mark clips on liked songs and export a
              playlist — names start with <code>!!</code>.
            </p>
          )}

          {clipifyPlaylists.length > 0 && (
            <ul className="clipify-playlist-accordion">
              {clipifyPlaylists.map((playlist) => {
                const expanded = !!expandedPlaylistIds[playlist.id];
                const playlistClips = clipsByPlaylistId[playlist.id]?.clips ?? [];
                const loadingClips = clipsLoadingId === playlist.id;

                return (
                  <li
                    key={playlist.id}
                    className={`clipify-accordion-item${
                      expanded ? " clipify-accordion-item--expanded" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="clipify-accordion-header"
                      aria-expanded={expanded}
                      onClick={() => togglePlaylistExpanded(playlist.id)}
                    >
                      <span className="clipify-accordion-chevron" aria-hidden>
                        {expanded ? "▼" : "▶"}
                      </span>
                      <span className="clipify-playlist-item-name">
                        {stripClipifyPlaylistPrefix(playlist.name)}
                      </span>
                      <span className="clipify-playlist-item-meta">
                        {playlist.trackCount} clip
                        {playlist.trackCount === 1 ? "" : "s"}
                      </span>
                    </button>

                    {expanded && (
                      <div className="clipify-accordion-panel">
                        {loadingClips && (
                          <p className="clipify-loading">Loading clips…</p>
                        )}
                        {!loadingClips && playlistClips.length > 0 && (
                          <div className="clipify-table-wrap clipify-table-wrap--nested">
                            <table className="clipify-table">
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th aria-label="Play" />
                                  <th>Title</th>
                                  <th>Artists</th>
                                  <th>Album</th>
                                  <th>Clip</th>
                                </tr>
                              </thead>
                              <tbody>
                                {playlistClips.map((clip, index) => {
                                  const playing = isPlayingClip(playlist.id, index);
                                  const clipKey = `${playlist.id}-${index}`;
                                  return (
                                    <tr
                                      key={clipKey}
                                      className={
                                        activeClip?.key === clipKey
                                          ? "clipify-row--active"
                                          : undefined
                                      }
                                    >
                                      <td>{index + 1}</td>
                                      <td>
                                        <button
                                          type="button"
                                          className={`clipify-play-btn ${
                                            playing ? "clipify-play-btn--active" : ""
                                          }`}
                                          onClick={() =>
                                            handlePlayClip(clip, playlist.id, index)
                                          }
                                          aria-label={
                                            playing
                                              ? `Pause ${clip.title}`
                                              : `Play ${clip.title}`
                                          }
                                          title={playing ? "Pause" : "Play clip"}
                                        >
                                          {playing ? "⏸" : "▶"}
                                        </button>
                                      </td>
                                      <td className="clipify-title">{clip.title}</td>
                                      <td className="clipify-artists">{clip.artists}</td>
                                      <td>{clip.album}</td>
                                      <td className="clipify-markers">
                                        <span className="clipify-marker-chip">
                                          {formatTime(clip.startMs)}–
                                          {formatTime(clip.endMs)}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {!loadingClips &&
                          clipsByPlaylistId[playlist.id] &&
                          playlistClips.length === 0 && (
                            <p className="clipify-empty">No clips in this playlist.</p>
                          )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {loggedIn && view === "liked" && !loading && tracks.length === 0 && !error && (
        <p className="clipify-empty">No liked songs found.</p>
      )}

      {loggedIn && displayTrack && (
        <section className="clipify-now-playing" aria-label="Now playing">
          <div className="clipify-now-playing-info">
            <p className="clipify-now-playing-label">
              {clipBounds ? "Now playing clip" : "Now playing"}
            </p>
            <p className="clipify-now-playing-title">{displayTrack.title}</p>
            <p className="clipify-now-playing-artist">{displayTrack.artists}</p>
            {clipBounds && (
              <p className="clipify-now-playing-clip">
                Clip {formatTime(clipBounds.startMs)}–{formatTime(clipBounds.endMs)}
              </p>
            )}
          </div>
          <div className="clipify-now-playing-controls">
            <div className="clipify-scrubber">
              <span className="clipify-time">{displayPositionLabel}</span>
              <input
                type="range"
                className="clipify-scrubber-input"
                min={scrubMin}
                max={scrubMax || 1}
                value={scrubValue}
                onChange={(e) => handleScrubChange(Number(e.target.value))}
                onMouseUp={(e) =>
                  handleScrubCommit(Number((e.target as HTMLInputElement).value))
                }
                onTouchEnd={(e) =>
                  handleScrubCommit(
                    Number((e.target as HTMLInputElement).value)
                  )
                }
                aria-label="Seek"
              />
              <span className="clipify-time">{displayDurationLabel}</span>
            </div>
            {!clipBounds && (
              <p className="clipify-marker-hint">
                Press <kbd>M</kbd> to mark{" "}
                {pendingStartMs === null
                  ? "start"
                  : `end (start at ${formatTime(pendingStartMs)})`}
              </p>
            )}
          </div>
        </section>
      )}

      {showExportModal && (
        <div
          className="clipify-modal-overlay"
          onClick={closeExportModal}
          role="presentation"
        >
          <div
            className="clipify-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clipify-export-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="clipify-modal-header">
              <h2 id="clipify-export-modal-title">Export to Spotify</h2>
              <button
                type="button"
                className="clipify-modal-close"
                onClick={closeExportModal}
                disabled={exportingPlaylist}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form
              className="clipify-modal-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleExportPlaylist();
              }}
            >
              <p className="clipify-modal-description">
                Export {clipCount} clip{clipCount === 1 ? "" : "s"} to a new
                private Spotify playlist.
              </p>
              <label className="clipify-export-label">
                Playlist name
                <input
                  type="text"
                  className="clipify-export-input"
                  value={exportPlaylistName}
                  onChange={(event) => setExportPlaylistName(event.target.value)}
                  disabled={exportingPlaylist}
                  maxLength={98}
                  autoFocus
                />
              </label>
              <div className="clipify-modal-actions">
                <button
                  type="button"
                  className="clipify-btn clipify-btn--secondary"
                  onClick={closeExportModal}
                  disabled={exportingPlaylist}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="clipify-btn clipify-btn--spotify clipify-modal-submit"
                  disabled={exportingPlaylist}
                >
                  {exportingPlaylist ? "Creating playlist…" : "Create playlist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clipify;
