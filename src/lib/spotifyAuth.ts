const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SCOPES =
  "user-library-read streaming user-modify-playback-state user-read-email playlist-modify-private playlist-read-private";
const SCOPES_KEY = "spotify_scopes";

const CODE_VERIFIER_KEY = "spotify_code_verifier";
const STATE_KEY = "spotify_oauth_state";
const ACCESS_TOKEN_KEY = "spotify_access_token";
const REFRESH_TOKEN_KEY = "spotify_refresh_token";
const TOKEN_EXPIRY_KEY = "spotify_token_expiry";

function getClientId(): string {
  const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Spotify client ID is not configured. Set REACT_APP_SPOTIFY_CLIENT_ID."
    );
  }
  return clientId;
}

function getOriginForRedirect(): string {
  const { protocol, hostname, port } = window.location;
  const host = hostname === "localhost" ? "127.0.0.1" : hostname;
  const portSuffix = port ? `:${port}` : "";
  return `${protocol}//${host}${portSuffix}`;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function getRedirectUri(): string {
  const origin = getOriginForRedirect();

  if (isLoopbackHost(window.location.hostname)) {
    const configured = process.env.REACT_APP_SPOTIFY_REDIRECT_URI?.trim();
    if (configured) {
      return configured;
    }
    return `${origin}/callback`;
  }

  return `${origin}/`;
}

export function ensureSpotifyDevSetup(): void {
  if (window.location.hostname === "localhost") {
    const url = new URL(window.location.href);
    url.hostname = "127.0.0.1";
    window.location.replace(url.toString());
  }
}

function generateRandomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (value) => chars[value % chars.length]).join("");
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function startSpotifyLogin(
  options: { forceConsent?: boolean } = {}
): Promise<void> {
  const codeVerifier = generateRandomString(64);
  const state = generateRandomString(16);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });

  if (options.forceConsent) {
    params.set("show_dialog", "true");
  }

  window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export function getStoredAccessToken(): string | null {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!token || !expiry) {
    return null;
  }
  if (Date.now() >= Number(expiry)) {
    return null;
  }
  return token;
}

export function clearSpotifySession(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  sessionStorage.removeItem(SCOPES_KEY);
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

async function storeTokenResponse(
  data: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  },
  options: { fromAuthorizationCode?: boolean } = {}
): Promise<void> {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  }
  if (data.scope) {
    sessionStorage.setItem(SCOPES_KEY, data.scope);
  } else if (options.fromAuthorizationCode) {
    sessionStorage.setItem(SCOPES_KEY, SCOPES);
  }
  sessionStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + data.expires_in * 1000 - 60_000)
  );
}

async function exchangeCodeForToken(code: string): Promise<void> {
  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!codeVerifier) {
    throw new Error("Missing PKCE verifier. Try logging in again.");
  }

  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: codeVerifier,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange Spotify authorization code.");
  }

  const data = await response.json();
  await storeTokenResponse(data, { fromAuthorizationCode: true });
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error("Session expired. Log in again.");
  }

  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    clearSpotifySession();
    throw new Error("Session expired. Log in again.");
  }

  const data = await response.json();
  await storeTokenResponse(data);
  return data.access_token;
}

export async function getAccessToken(): Promise<string> {
  const stored = getStoredAccessToken();
  if (stored) {
    return stored;
  }
  return refreshAccessToken();
}

export function getClipifyUrl(): string {
  return `${getOriginForRedirect()}/slop/clipify`;
}

export function hasSpotifyCallbackParams(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("code") || params.has("error");
}

export async function handleSpotifyCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (!code && !error) {
    return false;
  }

  const savedState = sessionStorage.getItem(STATE_KEY);
  if (error) {
    throw new Error(`Spotify login failed: ${error}`);
  }
  if (!state || state !== savedState) {
    throw new Error("Invalid OAuth state. Try logging in again.");
  }

  await exchangeCodeForToken(code!);

  window.location.replace(getClipifyUrl());
  return true;
}
