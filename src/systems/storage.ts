const storageKey = (name: string) => `mp.${name}`;

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
