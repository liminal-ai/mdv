interface CacheEntry {
  svg: string;
  accessedAt: number;
}

export function fnv1a(str: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < str.length; index += 1) {
    hash ^= str.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16);
}

export class MermaidCache {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly maxEntries = 200) {}

  get size(): number {
    return this.cache.size;
  }

  private makeKey(source: string, themeId: string): string {
    return `${fnv1a(source)}:${themeId}`;
  }

  get(source: string, themeId: string): string | null {
    const key = this.makeKey(source, themeId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    entry.accessedAt = Date.now();
    return entry.svg;
  }

  set(source: string, themeId: string, svg: string): void {
    const key = this.makeKey(source, themeId);
    this.cache.set(key, { svg, accessedAt: Date.now() });
    this.evictIfNeeded();
  }

  invalidateForTab(sources: string[], remainingSources: Iterable<string>): void {
    const sourceHashes = new Set(sources.map((source) => fnv1a(source)));
    const stillNeededHashes = new Set(Array.from(remainingSources, (source) => fnv1a(source)));

    for (const [key] of this.cache) {
      const sourceHash = key.split(':')[0];
      if (sourceHash && sourceHashes.has(sourceHash) && !stillNeededHashes.has(sourceHash)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestAccessedAt = Infinity;

      for (const [key, entry] of this.cache) {
        if (entry.accessedAt < oldestAccessedAt) {
          oldestKey = key;
          oldestAccessedAt = entry.accessedAt;
        }
      }

      if (!oldestKey) {
        return;
      }

      this.cache.delete(oldestKey);
    }
  }
}

export const mermaidCache = new MermaidCache();
