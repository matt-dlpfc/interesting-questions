// Small wrapper around localStorage. Everything here lives only on this device.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

const PREFIX = 'iq:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Not fatal: the app works without storage, it just won't remember.
  }
}
