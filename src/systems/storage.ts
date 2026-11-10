import { STORAGE_PREFIX } from '../config/runtime.ts';

const storageKey = (name: string) => `${STORAGE_PREFIX}${name}`;

export function read<T>(name: string, fallback: T): T {
  try {
    const value = localStorage.getItem(storageKey(name));
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function write(name: string, value: unknown): void {
  localStorage.setItem(storageKey(name), JSON.stringify(value));
}

export function clearPrefixedStorage(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  }
}
