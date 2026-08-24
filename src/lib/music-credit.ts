export type MusicCredit = Readonly<{
  title: string;
  artist: string;
  url?: string;
}>;

function isHttpUrl(value: string): boolean {
  if (value !== value.trim() || /\s/.test(value)) return false;

  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isMusicCredit(value: unknown): value is MusicCredit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const music = value as Record<string, unknown>;
  const allowedKeys = new Set(["title", "artist", "url"]);
  return (
    Object.keys(music).every((key) => allowedKeys.has(key)) &&
    typeof music.title === "string" &&
    music.title.trim().length > 0 &&
    typeof music.artist === "string" &&
    music.artist.trim().length > 0 &&
    (music.url === undefined || (typeof music.url === "string" && isHttpUrl(music.url)))
  );
}
