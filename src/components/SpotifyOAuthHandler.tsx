import React, { useEffect, useState } from "react";
import {
  getClipifyUrl,
  handleSpotifyCallback,
  hasSpotifyCallbackParams,
} from "../lib/spotifyAuth";

const OAUTH_ERROR_KEY = "clipify_oauth_error";

export function consumeClipifyOAuthError(): string | null {
  try {
    const message = sessionStorage.getItem(OAUTH_ERROR_KEY);
    if (message) {
      sessionStorage.removeItem(OAUTH_ERROR_KEY);
      return message;
    }
  } catch {
    // ignore
  }
  return null;
}

const SpotifyOAuthHandler: React.FC = () => {
  const [handling, setHandling] = useState(hasSpotifyCallbackParams);

  useEffect(() => {
    if (!handling) {
      return;
    }

    let cancelled = false;

    async function completeLogin() {
      try {
        await handleSpotifyCallback();
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "Spotify login failed.";
        sessionStorage.setItem(OAUTH_ERROR_KEY, message);
        window.location.replace(getClipifyUrl());
      }
    }

    completeLogin();
    return () => {
      cancelled = true;
    };
  }, [handling]);

  if (!handling) {
    return null;
  }

  return (
    <div className="section">
      <p>Connecting Spotify…</p>
    </div>
  );
};

export default SpotifyOAuthHandler;
