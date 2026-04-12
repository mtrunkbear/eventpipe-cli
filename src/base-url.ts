export const DEFAULT_EVENTPIPE_BASE_URL = "https://eventpipe.app";

export function resolveEventpipeBaseUrl(): string {
  const fromEnv = process.env.EVENTPIPE_BASE_URL?.replace(/\/$/, "").trim();
  if (fromEnv) {
    return fromEnv;
  }
  return DEFAULT_EVENTPIPE_BASE_URL;
}
