// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountContentArea } from '../../../src/client/components/content-area.js';
import { mountTabStrip } from '../../../src/client/components/tab-strip.js';
import { createStore, getButtonByText, getByText } from '../support.js';

describe('content area', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('TC-1.3a: Empty state shows app name, buttons, and recent files', () => {
    document.body.innerHTML = '<div id="content-area"></div>';
    const store = createStore();
    const onBrowse = vi.fn();

    mountContentArea(document.querySelector<HTMLElement>('#content-area')!, store, { onBrowse });

    expect(document.body.textContent).toContain('MD Viewer');
    expect(getButtonByText('Open File').disabled).toBe(true);
    expect(getButtonByText('Open Folder').disabled).toBe(false);
    expect(document.body.textContent).toContain('Recent files');
  });

  it('TC-9.1c: Empty state Open Folder triggers browse', () => {
    document.body.innerHTML = '<div id="content-area"></div>';
    const onBrowse = vi.fn();

    mountContentArea(document.querySelector<HTMLElement>('#content-area')!, createStore(), {
      onBrowse,
    });
    getButtonByText('Open Folder').click();

    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it('TC-1.3b: No recent files on first launch shows fallback copy', () => {
    document.body.innerHTML = '<div id="content-area"></div>';

    mountContentArea(document.querySelector<HTMLElement>('#content-area')!, createStore(), {
      onBrowse: vi.fn(),
    });

    expect(document.body.textContent).toContain('No recent files');
  });

  it('TC-8.3b (client): Empty recent files after server heals stale entries', () => {
    document.body.innerHTML = '<div id="content-area"></div>';
    const store = createStore({
      session: {
        ...createStore().get().session,
        recentFiles: [],
      },
    });

    mountContentArea(document.querySelector<HTMLElement>('#content-area')!, store, {
      onBrowse: vi.fn(),
    });

    expect(document.body.textContent).toContain('No recent files');
  });

  it('TC-1.3c: Recent files listed with names and paths', () => {
    document.body.innerHTML = '<div id="content-area"></div>';
    const store = createStore({
      session: {
        ...createStore().get().session,
        recentFiles: [
          { path: '/tmp/docs/guide.md', openedAt: '2026-03-19T00:00:00.000Z' },
          { path: '/tmp/docs/setup.md', openedAt: '2026-03-18T00:00:00.000Z' },
        ],
      },
    });

    mountContentArea(document.querySelector<HTMLElement>('#content-area')!, store, {
      onBrowse: vi.fn(),
    });

    expect(getByText('guide.md')).toBeDefined();
    expect(getByText('/tmp/docs/guide.md')).toBeDefined();
    expect(getByText('setup.md')).toBeDefined();
  });

  it('TC-1.4a: Tab strip shows "No documents open"', () => {
    document.body.innerHTML = '<div id="tab-strip"></div>';

    mountTabStrip(document.querySelector<HTMLElement>('#tab-strip')!, createStore());

    expect(document.body.textContent).toContain('No documents open');
  });
});
