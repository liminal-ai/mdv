// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/client/components/chunked-render.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/client/components/chunked-render.js')>();

  return {
    ...actual,
    renderChunked: vi.fn(actual.renderChunked),
  };
});

vi.mock('../../../src/client/utils/mermaid-renderer.js', () => ({
  renderMermaidBlocks: vi.fn().mockResolvedValue({ warnings: [] }),
}));

import { mountContentArea } from '../../../src/client/components/content-area.js';
import { renderChunked } from '../../../src/client/components/chunked-render.js';
import { singleTab } from '../../fixtures/tab-states.js';
import { createStore } from '../support.js';

function createRafController() {
  const callbacks: FrameRequestCallback[] = [];
  let handle = 0;

  return {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      handle += 1;
      return handle;
    }),
    cancelAnimationFrame: vi.fn(),
    get queuedFrames() {
      return callbacks.length;
    },
    step(timestamp = 0) {
      const callback = callbacks.shift();
      if (!callback) {
        throw new Error('No animation frame is queued');
      }
      callback(timestamp);
    },
    flushAll() {
      let timestamp = 0;
      while (callbacks.length > 0) {
        this.step(timestamp);
        timestamp += 16;
        if (timestamp > 20_000) {
          throw new Error('requestAnimationFrame queue did not settle');
        }
      }
    },
  };
}

function createLargeHtml(blocks: number): string {
  return Array.from(
    { length: blocks },
    (_, index) =>
      `<p data-index="${index}">Paragraph ${index} with enough text to exercise chunk splitting.</p>`,
  ).join('');
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('chunked render', () => {
  let raf: ReturnType<typeof createRafController>;

  beforeEach(() => {
    raf = createRafController();
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('TC-1.1a: large HTML renders without blocking', () => {
    const container = document.createElement('article');
    const onComplete = vi.fn();
    const html = createLargeHtml(600);

    renderChunked({
      container,
      html,
      chunkSize: 500,
      onComplete,
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(raf.queuedFrames).toBeGreaterThan(0);

    raf.flushAll();

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('p')).toHaveLength(600);
  });

  it('TC-1.1a: loading indicator animates during render', () => {
    const container = document.createElement('article');
    const progressValues: number[] = [];

    renderChunked({
      container,
      html: createLargeHtml(600),
      chunkSize: 500,
      onProgress: (inserted) => {
        progressValues.push(inserted);
      },
    });

    expect(container.children).toHaveLength(0);

    raf.step();
    expect(progressValues).toEqual([1]);
    const firstBatchCount = container.querySelectorAll('p').length;
    expect(firstBatchCount).toBeGreaterThan(0);
    expect(firstBatchCount).toBeLessThan(600);

    raf.step();
    expect(progressValues).toEqual([1, 2]);
    const secondBatchCount = container.querySelectorAll('p').length;
    expect(secondBatchCount).toBeGreaterThan(firstBatchCount);
    expect(secondBatchCount).toBeLessThan(600);

    raf.step();
    expect(progressValues).toEqual([1, 2, 3]);
    expect(container.querySelectorAll('p').length).toBeGreaterThan(secondBatchCount);
  });

  it('TC-1.1b: scroll works during chunked render', () => {
    const container = document.createElement('article');
    const onScroll = vi.fn();
    container.addEventListener('scroll', onScroll);

    renderChunked({
      container,
      html: createLargeHtml(600),
      chunkSize: 500,
    });

    raf.step();
    raf.step();
    container.scrollTop = 120;
    container.dispatchEvent(new Event('scroll'));

    expect(container.querySelectorAll('p').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('p').length).toBeLessThan(600);
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  it('TC-1.2b: mode switch uses chunked render for large files', async () => {
    document.body.innerHTML = '<div id="content-area"></div>';
    const largeRenderedHtml = createLargeHtml(300);
    const store = createStore({
      tabs: [
        {
          ...singleTab,
          html: largeRenderedHtml,
          size: 600_000,
        },
      ],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    mountContentArea(document.querySelector<HTMLElement>('#content-area')!, store, {
      onBrowse: vi.fn(),
      onOpenFile: vi.fn(),
    });

    await flushAsyncWork();

    const markdownBody = document.querySelector<HTMLElement>('.markdown-body');
    expect(markdownBody).not.toBeNull();
    expect(renderChunked).toHaveBeenCalledTimes(1);
    expect(markdownBody?.children).toHaveLength(0);

    raf.flushAll();
    await flushAsyncWork();

    expect(markdownBody?.querySelectorAll('p')).toHaveLength(300);
  });

  it('Abort cancels remaining batches', () => {
    const container = document.createElement('article');
    const controller = new AbortController();
    const onComplete = vi.fn();

    renderChunked({
      container,
      html: createLargeHtml(600),
      chunkSize: 500,
      onComplete,
      signal: controller.signal,
    });

    raf.step();
    raf.step();
    const insertedBeforeAbort = container.querySelectorAll('p').length;

    controller.abort();
    raf.flushAll();

    expect(insertedBeforeAbort).toBeGreaterThan(0);
    expect(insertedBeforeAbort).toBeLessThan(600);
    expect(container.querySelectorAll('p')).toHaveLength(insertedBeforeAbort);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('Small documents use direct innerHTML', () => {
    const container = document.createElement('article');
    const onComplete = vi.fn();

    renderChunked({
      container,
      html: createLargeHtml(100),
      onComplete,
    });

    expect(raf.requestAnimationFrame).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('p')).toHaveLength(100);
  });
});
