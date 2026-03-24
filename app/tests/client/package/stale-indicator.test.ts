// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPackageHeader } from '../../../src/client/components/package-header.js';
import { getDefaultPackageState } from '../../../src/client/state.js';
import { createStore } from '../support.js';

function createPackageState(overrides: Partial<ReturnType<typeof getDefaultPackageState>> = {}) {
  return {
    ...getDefaultPackageState(),
    active: true,
    sidebarMode: 'package' as const,
    sourcePath: '/packages/sample.mpk',
    effectiveRoot: '/tmp/mdv-pkg-sample',
    format: 'mpk' as const,
    mode: 'extracted' as const,
    navigation: [],
    metadata: { title: 'Sample Package' },
    manifestStatus: 'present' as const,
    manifestPath: '/tmp/mdv-pkg-sample/_nav.md',
    collapsedGroups: new Set<string>(),
    ...overrides,
  };
}

function renderPackageHeader(overrides: Partial<ReturnType<typeof createPackageState>> = {}) {
  document.body.innerHTML = '<div id="package-header"></div>';
  const store = createStore({
    packageState: createPackageState(overrides),
  });

  const cleanup = mountPackageHeader(
    document.querySelector<HTMLElement>('#package-header')!,
    store,
    {
      onEditManifest: vi.fn(),
    },
  );

  return { cleanup, store };
}

describe('package stale indicator', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('TC-7.1b: stale indicator visible when extracted package is stale', () => {
    const { cleanup, store } = renderPackageHeader({
      stale: false,
      mode: 'extracted',
    });

    expect(document.querySelector('.pkg-header__stale')).toBeNull();

    store.update(
      {
        packageState: createPackageState({
          stale: true,
          mode: 'extracted',
        }),
      },
      ['packageState'],
    );

    expect(document.querySelector('.pkg-header__stale')?.textContent).toBe('Modified');
    cleanup();
  });

  it('TC-7.2c: stale indicator not shown for directory-mode packages', () => {
    const { cleanup } = renderPackageHeader({
      stale: true,
      mode: 'directory',
    });

    expect(document.querySelector('.pkg-header__stale')).toBeNull();
    cleanup();
  });
});
