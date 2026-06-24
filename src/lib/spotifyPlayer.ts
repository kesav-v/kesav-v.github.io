import { clearSpotifySession, getAccessToken } from "./spotifyAuth";

export interface PlaybackState {
  trackId: string;
  positionMs: number;
  durationMs: number;
  paused: boolean;
}

const DEV_MODE_HINT =
  "If this app is in Development Mode, open your app in the Spotify Developer Dashboard → Users & Access and add the Spotify email for the account you're logging in with (can take a few minutes to apply).";

export function formatSpotifyPlaybackError(
  status: number,
  body: string,
  fallback: string
): string {
  const lower = body.toLowerCase();
  if (
    status === 403 &&
    (lower.includes("not approved") ||
      lower.includes("allowlist") ||
      lower.includes("user not in"))
  ) {
    return `Your account is not on this app's allowlist. ${DEV_MODE_HINT}`;
  }
  if (status === 403 && lower.includes("premium")) {
    return "Spotify Premium is required for in-browser playback.";
  }
  if (status === 404) {
    return "Spotify player device is not active. Wait a moment and try again, or use Reconnect below.";
  }
  return fallback;
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getCurrentState: () => Promise<SpotifyPlaybackState | null>;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  addListener: (event: string, callback: (data: unknown) => void) => void;
  removeListener: (event: string, callback: (data: unknown) => void) => void;
}

interface SpotifyPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      id: string;
      uri: string;
      name: string;
    };
  };
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let player: SpotifyPlayer | null = null;
let deviceId: string | null = null;
let initPromise: Promise<void> | null = null;
let stateListeners = new Set<(state: PlaybackState | null) => void>();
let errorListeners = new Set<(message: string) => void>();

function notifyListeners(state: PlaybackState | null): void {
  stateListeners.forEach((listener) => listener(state));
}

function notifyError(message: string): void {
  errorListeners.forEach((listener) => listener(message));
}

function mapState(raw: SpotifyPlaybackState | null): PlaybackState | null {
  if (!raw) {
    return null;
  }
  const track = raw.track_window.current_track;
  return {
    trackId: track.id,
    positionMs: raw.position,
    durationMs: raw.duration,
    paused: raw.paused,
  };
}

function resetPlayer(): void {
  player?.disconnect();
  player = null;
  deviceId = null;
  initPromise = null;
  notifyListeners(null);
}

function handleAuthFailure(message: string): void {
  resetPlayer();
  notifyError(message);
}

function loadSpotifySdk(): Promise<void> {
  if (window.Spotify) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );
    if (existing) {
      const check = () => {
        if (window.Spotify) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () =>
      reject(new Error("Failed to load Spotify playback SDK."));
    document.body.appendChild(script);
  });
}

export function subscribePlayback(
  listener: (state: PlaybackState | null) => void
): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function subscribePlayerError(
  listener: (message: string) => void
): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

export async function initSpotifyPlayer(): Promise<void> {
  if (player && deviceId) {
    return;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await getAccessToken();
    await loadSpotifySdk();
    if (!window.Spotify) {
      throw new Error("Spotify playback SDK is unavailable.");
    }

    const instance = new window.Spotify.Player({
      name: "Clipify",
      getOAuthToken: (cb) => {
        getAccessToken()
          .then((token) => cb(token))
          .catch((err) => {
            handleAuthFailure(
              err instanceof Error
                ? err.message
                : "Could not refresh Spotify access token."
            );
          });
      },
      volume: 0.8,
    });

    instance.addListener("ready", (data) => {
      const { device_id } = data as { device_id: string };
      deviceId = device_id;
    });

    instance.addListener("not_ready", () => {
      deviceId = null;
    });

    instance.addListener("player_state_changed", (data) => {
      const state = mapState(data as SpotifyPlaybackState | null);
      notifyListeners(state);
      if (state && !state.paused) {
        notifyError("");
      }
    });

    instance.addListener("initialization_error", (data) => {
      const { message } = data as { message?: string };
      handleAuthFailure(
        message
          ? `Spotify player failed to initialize: ${message}`
          : "Spotify player failed to initialize."
      );
    });

    instance.addListener("authentication_error", (data) => {
      const { message } = data as { message?: string };
      const lower = (message ?? "").toLowerCase();
      // SDK scope check can fail spuriously while REST playback still works.
      if (lower.includes("scope")) {
        return;
      }
      notifyError(
        `Spotify playback authorization failed.${message ? ` ${message}` : ""} Try Reconnect below. ${DEV_MODE_HINT}`
      );
    });

    instance.addListener("account_error", () => {
      notifyError("Spotify Premium is required for in-browser playback.");
    });

    const connected = await instance.connect();
    if (!connected) {
      throw new Error("Could not connect Spotify player.");
    }

    player = instance;

    await new Promise<void>((resolve, reject) => {
      if (deviceId) {
        resolve();
        return;
      }
      const timeout = window.setTimeout(() => {
        reject(new Error("Spotify player timed out while connecting."));
      }, 15_000);
      const onReady = (data: unknown) => {
        const { device_id } = data as { device_id: string };
        deviceId = device_id;
        window.clearTimeout(timeout);
        instance.removeListener("ready", onReady);
        resolve();
      };
      instance.addListener("ready", onReady);
    });
  })();

  try {
    await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

async function transferPlaybackToDevice(): Promise<void> {
  if (!deviceId) {
    return;
  }
  const token = await getAccessToken();
  await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}

async function requestPlayback(
  body: { uris: string[]; position_ms?: number }
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
}

export interface PlayTrackOptions {
  positionMs?: number;
}

export async function playTrack(
  trackUri: string,
  options: PlayTrackOptions = {}
): Promise<void> {
  await initSpotifyPlayer();
  if (!deviceId) {
    throw new Error("Spotify player is not ready yet. Try again in a moment.");
  }

  const body: { uris: string[]; position_ms?: number } = { uris: [trackUri] };
  if (options.positionMs != null) {
    body.position_ms = Math.max(0, Math.floor(options.positionMs));
  }

  await transferPlaybackToDevice();

  let response = await requestPlayback(body);
  if (response.status === 404) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    await transferPlaybackToDevice();
    response = await requestPlayback(body);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      formatSpotifyPlaybackError(
        response.status,
        errorBody,
        response.status === 403
          ? `Playback was forbidden. Reconnect to grant the streaming scope. ${DEV_MODE_HINT}`
          : "Failed to start playback."
      )
    );
  }

  const state = mapState(await player?.getCurrentState() ?? null);
  if (state) {
    notifyListeners(state);
    notifyError("");
  }
}

export async function pausePlayback(): Promise<void> {
  await initSpotifyPlayer();
  if (!player) {
    throw new Error("Spotify player is not ready.");
  }
  await player.pause();
}

export async function togglePlayback(): Promise<void> {
  await initSpotifyPlayer();
  if (!player) {
    throw new Error("Spotify player is not ready.");
  }
  await player.togglePlay();
}

export async function seekTo(positionMs: number): Promise<void> {
  await initSpotifyPlayer();
  if (!player) {
    throw new Error("Spotify player is not ready.");
  }
  await player.seek(Math.max(0, Math.floor(positionMs)));
}

export async function getPlaybackState(): Promise<PlaybackState | null> {
  if (!player) {
    return null;
  }
  return mapState(await player.getCurrentState());
}

export function destroySpotifyPlayer(): void {
  resetPlayer();
}
