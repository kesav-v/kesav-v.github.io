import { getAccessToken } from "../lib/spotifyAuth";
import {
  buildClipsFromPlaylist,
  buildPlaylistDescription,
  ClipExportItem,
  formatClipifyPlaylistName,
  isClipifyPlaylistName,
  ParsedPlaylistClip,
  PlaylistTrackForClips,
  validateClipExport,
} from "../lib/clipifyPlaylist";

export interface LikedTrack {
  id: string;
  uri: string;
  title: string;
  artists: string;
  album: string;
  addedAt: string;
  durationMs: number;
}

export interface LikedTracksProgress {
  loaded: number;
  total: number;
}

export interface SpotifyProfile {
  displayName: string;
  email: string | null;
  id: string;
}

export async function fetchSpotifyProfile(): Promise<SpotifyProfile> {
  const token = await getAccessToken();
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Failed to load Spotify profile.");
  }

  const data = await response.json();
  return {
    displayName: data.display_name ?? "Spotify user",
    email: data.email ?? null,
    id: data.id,
  };
}

interface SpotifySavedTrack {
  added_at: string;
  track: {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string };
  } | null;
}

interface SpotifySavedTracksResponse {
  items: SpotifySavedTrack[];
  next: string | null;
  total: number;
  offset: number;
}

export interface FetchLikedTracksOptions {
  onProgress?: (progress: LikedTracksProgress) => void;
  signal?: AbortSignal;
}

export async function fetchAllLikedTracks(
  options: FetchLikedTracksOptions | ((progress: LikedTracksProgress) => void) = {}
): Promise<LikedTrack[]> {
  const { onProgress, signal } =
    typeof options === "function"
      ? { onProgress: options, signal: undefined }
      : options;

  const tracks: LikedTrack[] = [];
  let url: string | null = "https://api.spotify.com/v1/me/tracks?limit=50";

  while (url) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const token = await getAccessToken();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });

    if (!response.ok) {
      throw new Error("Failed to load liked songs from Spotify.");
    }

    const data: SpotifySavedTracksResponse = await response.json();
    for (const item of data.items) {
      if (!item.track?.id) {
        continue;
      }
      tracks.push({
        id: item.track.id,
        uri: item.track.uri,
        title: item.track.name,
        artists: item.track.artists.map((artist) => artist.name).join(", "),
        album: item.track.album.name,
        addedAt: item.added_at.slice(0, 10),
        durationMs: item.track.duration_ms,
      });
    }

    const fetched = Math.min(data.offset + data.items.length, data.total);
    onProgress?.({ loaded: fetched, total: data.total });
    url = data.next;
  }

  return tracks;
}

export interface CreatedClipsPlaylist {
  id: string;
  url: string;
  name: string;
  clipCount: number;
}

async function spotifyRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

async function readSpotifyError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.error?.message === "string") {
      return data.error.message;
    }
  } catch {
    // ignore parse errors
  }
  return `Spotify API error (${response.status})`;
}

export async function createClipsPlaylist(
  items: ClipExportItem[],
  name?: string
): Promise<CreatedClipsPlaylist> {
  validateClipExport(items);

  const description = buildPlaylistDescription(items);
  const playlistName = formatClipifyPlaylistName(name);

  const createBody = {
    name: playlistName,
    public: false,
    collaborative: false,
  };

  let createResponse = await spotifyRequest(
    "https://api.spotify.com/v1/me/playlists",
    {
      method: "POST",
      body: JSON.stringify(createBody),
    }
  );

  if (!createResponse.ok) {
    const profile = await fetchSpotifyProfile();
    createResponse = await spotifyRequest(
      `https://api.spotify.com/v1/users/${profile.id}/playlists`,
      {
        method: "POST",
        body: JSON.stringify(createBody),
      }
    );
  }

  if (!createResponse.ok) {
    const message = await readSpotifyError(createResponse);
    if (createResponse.status === 403) {
      throw new Error(
        `Spotify denied playlist creation: ${message}. Reconnect to grant playlist permissions.`
      );
    }
    throw new Error(`Failed to create Spotify playlist: ${message}`);
  }

  const playlist = await createResponse.json();
  const playlistId = playlist.id as string;
  const playlistUrl = playlist.external_urls?.spotify as string;

  const updateResponse = await spotifyRequest(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    {
      method: "PUT",
      body: JSON.stringify({ description }),
    }
  );

  if (!updateResponse.ok) {
    const message = await readSpotifyError(updateResponse);
    throw new Error(`Failed to set clip timestamps on playlist: ${message}`);
  }

  const uris = items.map((item) => item.uri);
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    const addResponse = await spotifyRequest(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: "POST",
        body: JSON.stringify({ uris: chunk }),
      }
    );
    if (!addResponse.ok) {
      const message = await readSpotifyError(addResponse);
      throw new Error(`Failed to add clips to the Spotify playlist: ${message}`);
    }
  }

  return {
    id: playlistId,
    url: playlistUrl,
    name: playlistName,
    clipCount: items.length,
  };
}

export interface ClipifyPlaylistSummary {
  id: string;
  name: string;
  url: string;
  trackCount: number;
}

interface SpotifyPlaylistItem {
  id: string;
  name: string;
  description: string | null;
  external_urls: { spotify?: string };
  tracks: { total: number };
}

interface SpotifyPlaylistsResponse {
  items: SpotifyPlaylistItem[];
  next: string | null;
}

export async function fetchClipifyPlaylists(): Promise<ClipifyPlaylistSummary[]> {
  const playlists: ClipifyPlaylistSummary[] = [];
  let url: string | null =
    "https://api.spotify.com/v1/me/playlists?limit=50";

  while (url) {
    const response = await spotifyRequest(url);
    if (!response.ok) {
      const message = await readSpotifyError(response);
      if (response.status === 403) {
        throw new Error(
          `Spotify denied playlist access: ${message}. Reconnect to grant playlist read permissions.`
        );
      }
      throw new Error(`Failed to load playlists: ${message}`);
    }

    const data: SpotifyPlaylistsResponse = await response.json();
    for (const item of data.items) {
      if (!isClipifyPlaylistName(item.name)) {
        continue;
      }
      playlists.push({
        id: item.id,
        name: item.name,
        url: item.external_urls?.spotify ?? "",
        trackCount: item.tracks?.total ?? 0,
      });
    }
    url = data.next;
  }

  return playlists;
}

interface SpotifyPlaylistTrackItem {
  track: {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string };
  } | null;
}

interface SpotifyPlaylistTracksResponse {
  items: SpotifyPlaylistTrackItem[];
  next: string | null;
}

export async function fetchClipifyPlaylistClips(
  playlistId: string
): Promise<{ name: string; url: string; clips: ParsedPlaylistClip[] }> {
  const metaResponse = await spotifyRequest(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,description,external_urls`
  );
  if (!metaResponse.ok) {
    const message = await readSpotifyError(metaResponse);
    throw new Error(`Failed to load playlist: ${message}`);
  }

  const meta = await metaResponse.json();
  const description = (meta.description as string | null) ?? "";

  const trackItems: PlaylistTrackForClips[] = [];
  let tracksUrl: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,uri,name,duration_ms,artists(name),album(name))),next`;

  while (tracksUrl) {
    const response = await spotifyRequest(tracksUrl);
    if (!response.ok) {
      const message = await readSpotifyError(response);
      throw new Error(`Failed to load playlist tracks: ${message}`);
    }

    const data: SpotifyPlaylistTracksResponse = await response.json();
    for (const item of data.items) {
      if (!item.track?.id) {
        continue;
      }
      trackItems.push({
        id: item.track.id,
        uri: item.track.uri,
        title: item.track.name,
        artists: item.track.artists.map((artist) => artist.name).join(", "),
        album: item.track.album.name,
        durationMs: item.track.duration_ms,
      });
    }
    tracksUrl = data.next;
  }

  const clips = buildClipsFromPlaylist(trackItems, description);

  return {
    name: meta.name as string,
    url: (meta.external_urls?.spotify as string) ?? "",
    clips,
  };
}
