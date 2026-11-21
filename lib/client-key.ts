/**
 * The one place the browser reads the user's own Gemini key.
 *
 * Stored in localStorage under a single name, never logged, never rendered
 * back into a text field in plain text (Settings masks it). A malformed value
 * is treated as absent so the UI can say "add a valid key" instead of sending
 * junk to the server (audit H-3).
 */

export const API_KEY_STORAGE = "anvik-gemini-api-key";
export const DEVICE_STORAGE = "anvik-device-id";

export function readApiKey(): string {
  try {
    const value = localStorage.getItem(API_KEY_STORAGE)?.trim() ?? "";
    return value.length >= 20 ? value : "";
  } catch {
    return "";
  }
}

export function hasApiKey(): boolean {
  return readApiKey().length > 0;
}

export function saveApiKey(value: string): void {
  try {
    localStorage.setItem(API_KEY_STORAGE, value.trim());
  } catch {
    /* private mode: the key simply is not remembered */
  }
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE);
  } catch {
    /* nothing to clear */
  }
}

/** Show enough to recognise a key, never enough to use it. */
export function maskKey(value: string): string {
  if (value.length < 8) return "••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

export function readDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(DEVICE_STORAGE, created);
    return created;
  } catch {
    return "anon";
  }
}
