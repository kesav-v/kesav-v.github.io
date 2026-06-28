// API Configuration
// For local development: http://localhost:8000 (infinite-chess-server default)
// For production: https://infinite-chess.viswanadha.com
export const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://infinite-chess.viswanadha.com"
    : "http://localhost:8000");

export function getWebSocketUrl(): string {
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }

  const httpBase =
    process.env.REACT_APP_API_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://infinite-chess.viswanadha.com"
      : "http://localhost:8000");

  const url = new URL(httpBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
}
