// Logical encoding: U+0021 + seconds (per clipify spec).
const TIMESTAMP_BASE = 0x21;
// Spotify rejects control chars (e.g. U+0080+) in playlist descriptions, so
// exports use a safe Unicode block for descriptions stored on Spotify.
const SPOTIFY_DESCRIPTION_BASE = 0x3000;
const MAX_DESCRIPTION_LENGTH = 300;
const CHARS_PER_CLIP = 2;
export const CLIPIFY_PLAYLIST_PREFIX = "!!";

export interface ClipExportItem {
  uri: string;
  startMs: number;
  endMs: number;
}

function secondsFromMs(ms: number): number {
  return Math.floor(ms / 1000);
}

function encodeSeconds(base: number, seconds: number): string {
  const codePoint = base + seconds;
  if (codePoint > 0x10ffff) {
    throw new Error("Clip timestamp is too large to encode.");
  }
  return String.fromCodePoint(codePoint);
}

export function encodeClipTimestamps(startMs: number, endMs: number): string {
  const startSec = secondsFromMs(startMs);
  const endSec = secondsFromMs(endMs);
  return (
    encodeSeconds(TIMESTAMP_BASE, startSec) + encodeSeconds(TIMESTAMP_BASE, endSec)
  );
}

export function encodeClipTimestampsForSpotify(
  startMs: number,
  endMs: number
): string {
  const startSec = secondsFromMs(startMs);
  const endSec = secondsFromMs(endMs);
  return (
    encodeSeconds(SPOTIFY_DESCRIPTION_BASE, startSec) +
    encodeSeconds(SPOTIFY_DESCRIPTION_BASE, endSec)
  );
}

function decodeSeconds(codePoint: number): number {
  if (codePoint >= SPOTIFY_DESCRIPTION_BASE) {
    return codePoint - SPOTIFY_DESCRIPTION_BASE;
  }
  if (codePoint >= TIMESTAMP_BASE) {
    return codePoint - TIMESTAMP_BASE;
  }
  throw new Error("Invalid clip timestamp character.");
}

export function decodeClipTimestamps(encoded: string): {
  startSec: number;
  endSec: number;
} {
  const chars = Array.from(encoded);
  if (chars.length < CHARS_PER_CLIP) {
    throw new Error("Invalid clip timestamp encoding.");
  }
  const codePoints = chars.map((char) => char.codePointAt(0)!);
  return {
    startSec: decodeSeconds(codePoints[0]),
    endSec: decodeSeconds(codePoints[1]),
  };
}

export function defaultClipifyPlaylistName(date = new Date()): string {
  const datePart = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Clipify Playlist on ${datePart} at ${timePart}`;
}

export function formatClipifyPlaylistName(name?: string): string {
  const base = name?.trim() || defaultClipifyPlaylistName();
  if (isClipifyPlaylistName(base)) {
    return base;
  }
  return `${CLIPIFY_PLAYLIST_PREFIX}${base}`;
}

export function isClipifyPlaylistName(name: string): boolean {
  return name.startsWith(CLIPIFY_PLAYLIST_PREFIX);
}

export function stripClipifyPlaylistPrefix(name: string): string {
  return name.startsWith(CLIPIFY_PLAYLIST_PREFIX)
    ? name.slice(CLIPIFY_PLAYLIST_PREFIX.length)
    : name;
}

export function buildPlaylistDescription(items: ClipExportItem[]): string {
  return items
    .map((item) =>
      encodeClipTimestampsForSpotify(item.startMs, item.endMs)
    )
    .join("");
}

export function parsePlaylistDescription(description: string): Array<{
  startSec: number;
  endSec: number;
}> {
  const chars = Array.from(description);
  const clips = [];
  for (let i = 0; i + CHARS_PER_CLIP <= chars.length; i += CHARS_PER_CLIP) {
    try {
      clips.push(
        decodeClipTimestamps(chars.slice(i, i + CHARS_PER_CLIP).join(""))
      );
    } catch {
      break;
    }
  }
  return clips;
}

export interface PlaylistTrackForClips {
  id: string;
  uri: string;
  title: string;
  artists: string;
  album: string;
  durationMs: number;
}

export interface ParsedPlaylistClip extends PlaylistTrackForClips {
  startMs: number;
  endMs: number;
}

export function buildClipsFromPlaylist(
  tracks: PlaylistTrackForClips[],
  description: string
): ParsedPlaylistClip[] {
  const timestamps = parsePlaylistDescription(description);
  if (timestamps.length !== tracks.length) {
    throw new Error(
      `Playlist has ${tracks.length} tracks but ${timestamps.length} encoded clips. The description may be corrupted or truncated.`
    );
  }
  return tracks.map((track, index) => {
    const { startSec, endSec } = timestamps[index];
    return {
      ...track,
      startMs: startSec * 1000,
      endMs: endSec * 1000,
    };
  });
}

export function maxClipsForDescription(): number {
  return Math.floor(MAX_DESCRIPTION_LENGTH / CHARS_PER_CLIP);
}

export function validateClipExport(items: ClipExportItem[]): void {
  if (items.length === 0) {
    throw new Error("Create at least one clip before exporting a playlist.");
  }

  const description = buildPlaylistDescription(items);
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(
      `Too many clips for one playlist description (max ${maxClipsForDescription()}, you have ${items.length}). Remove some clips or export fewer.`
    );
  }

  for (const item of items) {
    const startSec = secondsFromMs(item.startMs);
    const endSec = secondsFromMs(item.endMs);
    if (startSec < 0 || endSec < 0) {
      throw new Error("Clip timestamps must be non-negative.");
    }
    if (
      SPOTIFY_DESCRIPTION_BASE + startSec > 0x10ffff ||
      SPOTIFY_DESCRIPTION_BASE + endSec > 0x10ffff
    ) {
      throw new Error("Clip is too long to encode in the playlist description.");
    }
  }
}
