// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountContentArea } from '../../../src/client/components/content-area.js';
import { mountTabStrip } from '../../../src/client/components/tab-strip.js';
import { createStore } from '../support.js';
import { manyTabs, multipleTabs, singleTab } from '../../fixtures/tab-states.js';

function renderTabStrip(
  overrides: Parameters<typeof createStore>[0] = {},
  actionOverrides: Partial<Parameters<typeof mountTabStrip>[2]> = {},
) {
  document.body.innerHTML = '<div id="tab-strip"></div>';

  const store = createStore(overrides);
  const actions = {
    onActivateTab: vi.fn(),
    onCloseTab: vi.fn(),
    onCloseOtherTabs: vi.fn(),
    onCloseTabsToRight: vi.fn(),
    onCopyTabPath: vi.fn(),
    ...actionOverrides,
  };

  const cleanup = mountTabStrip(document.querySelector<HTMLElement>('#tab-strip')!, store, actions);

  return { store, actions, cleanup };
}

function renderWorkspaceWithTabSwitch(overrides: Parameters<typeof createStore>[0]) {
  document.body.innerHTML = '<div id="tab-strip"></div><div id="content-area"></div>';

  const store = createStore(overrides);
  const switchTab = (tabId: string) => {
    const state = store.get();
    const body = document.querySelector<HTMLElement>('.content-area__body');
    const nextTabs = state.tabs.map((tab) =>
      tab.id === state.activeTabId ? { ...tab, scrollPosition: body?.scrollTop ?? 0 } : tab,
    );
    const targetTab = nextTabs.find((tab) => tab.id === tabId);
    store.update({ tabs: nextTabs, activeTabId: tabId }, ['tabs', 'activeTabId']);
    const nextBody = document.querySelector<HTMLElement>('.content-area__body');
    if (nextBody && targetTab) {
      nextBody.scrollTop = targetTab.scrollPosition;
    }
  };

  mountTabStrip(document.querySelector<HTMLElement>('#tab-strip')!, store, {
    onActivateTab: switchTab,
  });
  mountContentArea(document.querySelector<HTMLElement>('#content-area')!, store, {
    onBrowse: vi.fn(),
    onOpenFile: vi.fn(),
  });

  return { store, switchTab };
}

describe('tab strip', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    scrollIntoView.mockReset();
    vi.unstubAllGlobals();
  });

  it('renders the empty tab state', () => {
    renderTabStrip();

    expect(document.body.textContent).toContain('No documents open');
  });

  it('renders tabs with the stored filename labels in order', () => {
    renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-3',
      contentToolbarVisible: true,
    });

    const labels = Array.from(document.querySelectorAll('.tab__label')).map(
      (element) => element.textContent,
    );
    expect(labels).toEqual(['readme.md', 'design.md', 'notes.md']);
    expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe('/a/notes.md');
  });

  it('appends a newly added tab at the right edge and marks it active', () => {
    const { store } = renderTabStrip({
      tabs: multipleTabs.slice(0, 2),
      activeTabId: 'tab-2',
      contentToolbarVisible: true,
    });

    store.update(
      {
        tabs: [...multipleTabs.slice(0, 2), multipleTabs[2]!],
        activeTabId: 'tab-3',
      },
      ['tabs', 'activeTabId'],
    );

    const labels = Array.from(document.querySelectorAll('.tab__label')).map(
      (element) => element.textContent,
    );
    expect(labels.at(-1)).toBe('notes.md');
    expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe('/a/notes.md');
  });

  it('renders disambiguated labels when filenames collide', () => {
    renderTabStrip({
      tabs: [
        {
          ...singleTab,
          id: 'tab-1',
          path: '/a/docs/readme.md',
          canonicalPath: '/a/docs/readme.md',
          filename: 'docs/readme.md',
        },
        {
          ...singleTab,
          id: 'tab-2',
          path: '/b/specs/readme.md',
          canonicalPath: '/b/specs/readme.md',
          filename: 'specs/readme.md',
        },
      ],
      activeTabId: 'tab-2',
      contentToolbarVisible: true,
    });

    const labels = Array.from(document.querySelectorAll('.tab__label')).map(
      (element) => element.textContent,
    );
    expect(labels).toEqual(['docs/readme.md', 'specs/readme.md']);
  });

  it('calls activate when an inactive tab is clicked', () => {
    const { actions } = renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    document.querySelectorAll<HTMLElement>('.tab')[1]?.click();

    expect(actions.onActivateTab).toHaveBeenCalledWith('tab-2');
  });

  it('switches the rendered content when the active tab changes', () => {
    renderWorkspaceWithTabSwitch({
      tabs: multipleTabs.map((tab, index) => ({
        ...tab,
        html: `<h1>tab-${index + 1}</h1>`,
      })),
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    expect(document.querySelector('.markdown-body')?.innerHTML).toContain('tab-1');

    document.querySelectorAll<HTMLElement>('.tab')[1]?.click();

    expect(document.querySelector('.tab--active')?.getAttribute('title')).toBe('/a/design.md');
    expect(document.querySelector('.markdown-body')?.innerHTML).toContain('tab-2');
  });

  it('preserves scroll position when switching away and back', () => {
    renderWorkspaceWithTabSwitch({
      tabs: [
        { ...multipleTabs[0]!, html: '<div>first</div>', scrollPosition: 0 },
        { ...multipleTabs[1]!, html: '<div>second</div>', scrollPosition: 48 },
      ],
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    const body = document.querySelector<HTMLElement>('.content-area__body')!;
    body.scrollTop = 120;

    document.querySelectorAll<HTMLElement>('.tab')[1]?.click();
    expect(document.querySelector('.markdown-body')?.innerHTML).toContain('second');
    expect(document.querySelector<HTMLElement>('.content-area__body')?.scrollTop).toBe(48);

    document.querySelectorAll<HTMLElement>('.tab')[0]?.click();
    expect(document.querySelector<HTMLElement>('.content-area__body')?.scrollTop).toBe(120);
  });

  it('calls close when the close control is clicked', () => {
    const { actions } = renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    document.querySelectorAll<HTMLElement>('.tab__close')[1]?.click();

    expect(actions.onCloseTab).toHaveBeenCalledWith('tab-2');
  });

  it('renders a real close button for the active tab', () => {
    renderTabStrip({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    const closeButton = document.querySelector<HTMLButtonElement>('.tab__close');
    expect(closeButton?.tagName).toBe('BUTTON');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close readme.md');
  });

  it('shows a spinner for loading tabs and removes it on update', () => {
    const { store } = renderTabStrip({
      tabs: [{ ...singleTab, loading: true }],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    expect(document.querySelector('.tab__spinner')).not.toBeNull();

    store.update(
      {
        tabs: [{ ...singleTab, loading: false }],
      },
      ['tabs'],
    );

    expect(document.querySelector('.tab__spinner')).toBeNull();
  });

  it('opens a context menu with close actions and copy path', () => {
    renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    document
      .querySelector<HTMLElement>('.tab')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 160 }));

    const items = Array.from(document.querySelectorAll('.context-menu__item')).map(
      (element) => element.textContent,
    );
    expect(items).toEqual(['Close', 'Close Others', 'Close Tabs to the Right', 'Copy Path']);
  });

  it('fires close from the tab context menu', () => {
    const { actions } = renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    document
      .querySelector<HTMLElement>('.tab')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 160 }));
    Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu__item'))
      .find((element) => element.textContent === 'Close')
      ?.click();

    expect(actions.onCloseTab).toHaveBeenCalledWith('tab-1');
  });

  it('fires close others from the tab context menu', () => {
    const { actions } = renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    document
      .querySelectorAll<HTMLElement>('.tab')[1]
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 90, clientY: 90 }));
    Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu__item'))
      .find((element) => element.textContent === 'Close Others')
      ?.click();

    expect(actions.onCloseOtherTabs).toHaveBeenCalledWith('tab-2');
  });

  it('fires close tabs to the right from the tab context menu', () => {
    const { actions } = renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    document
      .querySelector<HTMLElement>('.tab')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 70, clientY: 80 }));
    Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu__item'))
      .find((element) => element.textContent === 'Close Tabs to the Right')
      ?.click();

    expect(actions.onCloseTabsToRight).toHaveBeenCalledWith('tab-1');
  });

  it('fires copy path from the tab context menu', () => {
    const { actions } = renderTabStrip({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    document
      .querySelector<HTMLElement>('.tab')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 70, clientY: 80 }));
    Array.from(document.querySelectorAll<HTMLButtonElement>('.context-menu__item'))
      .find((element) => element.textContent === 'Copy Path')
      ?.click();

    expect(actions.onCopyTabPath).toHaveBeenCalledWith(singleTab.id);
  });

  it('hides close-right when there are no tabs to the right', () => {
    renderTabStrip({
      tabs: [singleTab],
      activeTabId: singleTab.id,
      contentToolbarVisible: true,
    });

    document
      .querySelector<HTMLElement>('.tab')
      ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 70, clientY: 80 }));

    const closeRight = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.context-menu__item'),
    ).find((element) => element.textContent === 'Close Tabs to the Right');

    expect(closeRight?.disabled).toBe(true);
  });

  it('shows the tab count when the strip overflows', () => {
    renderTabStrip({
      tabs: manyTabs,
      activeTabId: manyTabs[0]!.id,
      contentToolbarVisible: true,
    });

    const scrollContainer = document.querySelector<HTMLElement>('.tab-strip__scroll-container')!;
    Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 1600 });
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 400 });
    window.dispatchEvent(new Event('resize'));

    expect(document.querySelector('.tab-strip__count')?.hasAttribute('hidden')).toBe(false);
    expect(document.body.textContent).toContain('15 tabs');
  });

  it('shows overflow gradients when the strip has hidden tabs', () => {
    renderTabStrip({
      tabs: manyTabs,
      activeTabId: manyTabs[0]!.id,
      contentToolbarVisible: true,
    });

    const scrollContainer = document.querySelector<HTMLElement>('.tab-strip__scroll-container')!;
    Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 1600 });
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(scrollContainer, 'scrollLeft', { configurable: true, value: 80 });
    window.dispatchEvent(new Event('resize'));
    scrollContainer.dispatchEvent(new Event('scroll'));

    expect(document.querySelector('.tab-strip__overflow--left')?.hasAttribute('hidden')).toBe(
      false,
    );
    expect(document.querySelector('.tab-strip__overflow--right')?.hasAttribute('hidden')).toBe(
      false,
    );
  });

  it('keeps the count indicator hidden when tabs do not overflow', () => {
    renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    const scrollContainer = document.querySelector<HTMLElement>('.tab-strip__scroll-container')!;
    Object.defineProperty(scrollContainer, 'scrollWidth', { configurable: true, value: 400 });
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 400 });
    window.dispatchEvent(new Event('resize'));

    expect(document.querySelector('.tab-strip__count')?.hasAttribute('hidden')).toBe(true);
  });

  it('scrolls the active tab into view when the active id changes', () => {
    const { store } = renderTabStrip({
      tabs: multipleTabs,
      activeTabId: 'tab-1',
      contentToolbarVisible: true,
    });

    store.update({ activeTabId: 'tab-3' }, ['activeTabId']);

    expect(scrollIntoView).toHaveBeenCalled();
  });
});
