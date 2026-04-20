// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../src/client/api.js';
import {
  attach,
  classifyLink,
  type LinkHandlerState,
} from '../../../src/client/utils/link-handler.js';
import { singleTab } from '../../fixtures/tab-states.js';

function createLinkHandlerState(overrides: Partial<LinkHandlerState> = {}): LinkHandlerState {
  return {
    tabs: [singleTab],
    activeTabId: singleTab.id,
    openFile: vi.fn().mockResolvedValue(undefined),
    api: {
      openExternal: vi.fn().mockResolvedValue({ ok: true }),
    },
    showError: vi.fn(),
    ...overrides,
  };
}

function renderLink(href: string, text = 'Link') {
  document.body.innerHTML = `<article class="markdown-body"><a href="${href}">${text}</a></article>`;
  return document.querySelector<HTMLElement>('.markdown-body')!;
}

function clickRenderedLink(container: HTMLElement) {
  container
    .querySelector<HTMLAnchorElement>('a')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function dispatchClickAndCaptureDefaultPrevented(
  link: HTMLAnchorElement,
  event: MouseEvent,
): boolean {
  let defaultPreventedBeforeTestCleanup = false;

  link.addEventListener('click', (listenerEvent) => {
    defaultPreventedBeforeTestCleanup = listenerEvent.defaultPrevented;
    // Prevent jsdom from attempting real navigation after the test assertion point.
    listenerEvent.preventDefault();
  });

  link.dispatchEvent(event);
  return defaultPreventedBeforeTestCleanup;
}

describe('link handler', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('TC-2.7a: External link opens in browser', () => {
    const container = renderLink('https://example.com/docs');
    const state = createLinkHandlerState();
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null);

    attach(container, state);
    clickRenderedLink(container);

    expect(windowOpen).toHaveBeenCalledWith('https://example.com/docs', '_blank', 'noopener');
    expect(state.openFile).not.toHaveBeenCalled();
  });

  it('TC-2.7b: Anchor link scrolls to heading', () => {
    const container = renderLink('#section-heading');
    const target = document.createElement('h2');
    target.id = 'section-heading';
    target.scrollIntoView = vi.fn();
    document.body.append(target);
    const state = createLinkHandlerState();

    attach(container, state);
    clickRenderedLink(container);

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('TC-5.1a: Relative .md link opens in new tab with the resolved path', async () => {
    const container = renderLink('./design.md');
    const readFile = vi.fn().mockResolvedValue(undefined);
    const openFile = vi.fn().mockImplementation(async (path: string, anchor?: string) => {
      await readFile(path);
      return { path, anchor };
    });
    const state = createLinkHandlerState({ openFile });

    attach(container, state);
    clickRenderedLink(container);
    await Promise.resolve();

    expect(openFile).toHaveBeenCalledWith('/Users/leemoore/code/docs/design.md', undefined);
    expect(readFile).toHaveBeenCalledWith('/Users/leemoore/code/docs/design.md');
  });

  it('TC-5.1b: Link with anchor opens the file and preserves the heading target', async () => {
    const container = renderLink('./other.md#section-name');
    const state = createLinkHandlerState();

    attach(container, state);
    clickRenderedLink(container);
    await Promise.resolve();

    expect(state.openFile).toHaveBeenCalledWith(
      '/Users/leemoore/code/docs/other.md',
      'section-name',
    );
  });

  it('TC-5.1c: Already-open linked file reuses the existing tab flow', async () => {
    const container = renderLink('./readme.md');
    const activateExistingTab = vi.fn();
    const openFile = vi.fn().mockImplementation(async (path: string) => {
      if (path === singleTab.path) {
        activateExistingTab(singleTab.id);
      }
    });
    const state = createLinkHandlerState({ openFile });

    attach(container, state);
    clickRenderedLink(container);
    await Promise.resolve();

    expect(openFile).toHaveBeenCalledWith(singleTab.path, undefined);
    expect(activateExistingTab).toHaveBeenCalledWith(singleTab.id);
  });

  it('TC-5.2a: Broken markdown link shows an error notification', async () => {
    const container = renderLink('./missing.md');
    const error = new ApiError(404, 'FILE_NOT_FOUND', 'The requested file no longer exists.');
    const state = createLinkHandlerState({
      openFile: vi.fn().mockRejectedValue(error),
    });

    attach(container, state);
    clickRenderedLink(container);
    await Promise.resolve();
    await Promise.resolve();

    expect(state.showError).toHaveBeenCalledWith(error);
  });

  it('TC-5.3a: Non-markdown relative links open with the system handler', async () => {
    const container = renderLink('./diagram.svg');
    const state = createLinkHandlerState();

    attach(container, state);
    clickRenderedLink(container);
    await Promise.resolve();

    expect(state.api.openExternal).toHaveBeenCalledWith('/Users/leemoore/code/docs/diagram.svg');
    expect(state.openFile).not.toHaveBeenCalled();
  });

  it('TC-1.4b: Relative links can resolve outside the current root', async () => {
    const container = renderLink('../../other-repo/docs/spec.md');
    const state = createLinkHandlerState();

    attach(container, state);
    clickRenderedLink(container);
    await Promise.resolve();

    expect(state.openFile).toHaveBeenCalledWith(
      '/Users/leemoore/other-repo/docs/spec.md',
      undefined,
    );
    expect(classifyLink('../../other-repo/docs/spec.md', singleTab.path)).toEqual({
      type: 'markdown',
      path: '/Users/leemoore/other-repo/docs/spec.md',
      anchor: undefined,
    });
  });

  it('Non-TC: Windows absolute document paths resolve relative markdown links correctly', () => {
    expect(classifyLink('./design.md', 'C:\\Users\\leemoore\\code\\docs\\readme.md')).toEqual({
      type: 'markdown',
      path: 'C:/Users/leemoore/code/docs/design.md',
      anchor: undefined,
    });
  });

  it('Non-TC: Unsupported schemes fall back to the browser instead of local-file handling', () => {
    const container = renderLink('mailto:team@example.com');
    const state = createLinkHandlerState();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    attach(container, state);
    const prevented = dispatchClickAndCaptureDefaultPrevented(
      container.querySelector<HTMLAnchorElement>('a')!,
      event,
    );

    expect(prevented).toBe(false);
    expect(state.openFile).not.toHaveBeenCalled();
    expect(state.api.openExternal).not.toHaveBeenCalled();
  });

  it('Non-TC: modifier-key clicks are not intercepted', () => {
    const container = renderLink('./design.md');
    const state = createLinkHandlerState();

    attach(container, state);

    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    const link = container.querySelector<HTMLAnchorElement>('a')!;
    const prevented = dispatchClickAndCaptureDefaultPrevented(link, event);

    expect(prevented).toBe(false);
    expect(state.openFile).not.toHaveBeenCalled();
    expect(state.api.openExternal).not.toHaveBeenCalled();
  });
});
