import { afterEach, describe, expect, it, vi } from 'vitest';
import { MermaidCache, fnv1a } from '../../../src/client/components/mermaid-cache.js';

describe('mermaid cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-6.1a: cache hit on tab switch', () => {
    const cache = new MermaidCache();

    cache.set('flowchart LR\nA-->B', 'default', '<svg>tab-switch</svg>');

    expect(cache.get('flowchart LR\nA-->B', 'default')).toBe('<svg>tab-switch</svg>');
  });

  it('TC-6.1b: cache hit on mode switch', () => {
    const cache = new MermaidCache();

    cache.set('sequenceDiagram\nA->>B: hi', 'default', '<svg>mode-switch</svg>');

    expect(cache.get('sequenceDiagram\nA->>B: hi', 'default')).toBe('<svg>mode-switch</svg>');
  });

  it('TC-6.1c: cache miss after source change', () => {
    const cache = new MermaidCache();

    cache.set('flowchart LR\nA-->B', 'default', '<svg>original</svg>');

    expect(cache.get('flowchart LR\nA-->C', 'default')).toBeNull();
  });

  it('TC-6.2a: theme change misses cache', () => {
    const cache = new MermaidCache();

    cache.set('flowchart LR\nA-->B', 'default', '<svg>light</svg>');

    expect(cache.get('flowchart LR\nA-->B', 'dark')).toBeNull();
  });

  it('TC-6.2b: switch back hits cache', () => {
    const cache = new MermaidCache();

    cache.set('flowchart LR\nA-->B', 'default', '<svg>light</svg>');
    cache.set('flowchart LR\nA-->B', 'dark', '<svg>dark</svg>');

    expect(cache.get('flowchart LR\nA-->B', 'default')).toBe('<svg>light</svg>');
  });

  it('TC-6.3a: LRU eviction at max entries', () => {
    let now = 1;
    vi.spyOn(Date, 'now').mockImplementation(() => now++);

    const cache = new MermaidCache(200);

    for (let index = 0; index < 200; index += 1) {
      cache.set(`flowchart LR\nA${index}-->B${index}`, 'default', `<svg>${index}</svg>`);
    }

    cache.set('flowchart LR\nA200-->B200', 'default', '<svg>200</svg>');

    expect(cache.size).toBe(200);
    expect(cache.get('flowchart LR\nA0-->B0', 'default')).toBeNull();
    expect(cache.get('flowchart LR\nA200-->B200', 'default')).toBe('<svg>200</svg>');
  });

  it('TC-6.3b: invalidateForTab removes entries', () => {
    const cache = new MermaidCache();

    const sourceA = 'flowchart LR\nA-->B';
    const sourceB = 'sequenceDiagram\nA->>B: hi';
    const sourceC = 'classDiagram\nClass01 <|-- AveryLongClass';

    cache.set(sourceA, 'default', '<svg>a-light</svg>');
    cache.set(sourceA, 'dark', '<svg>a-dark</svg>');
    cache.set(sourceB, 'default', '<svg>b-light</svg>');
    cache.set(sourceC, 'default', '<svg>c-light</svg>');

    cache.invalidateForTab([sourceA, sourceB]);

    expect(cache.get(sourceA, 'default')).toBeNull();
    expect(cache.get(sourceA, 'dark')).toBeNull();
    expect(cache.get(sourceB, 'default')).toBeNull();
    expect(cache.get(sourceC, 'default')).toBe('<svg>c-light</svg>');
  });

  it('FNV-1a consistent', () => {
    expect(fnv1a('test')).toBe(fnv1a('test'));
  });

  it('Different strings different hashes', () => {
    expect(fnv1a('flowchart LR')).not.toBe(fnv1a('sequenceDiagram'));
  });
});
