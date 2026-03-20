import { describe, expect, it } from 'vitest';

import { clampSidebarWidth, createRendererState, mergeTabsState, setChildrenForPath } from '../src/renderer/state';

describe('renderer state helpers', () => {
  it('preserves the active dirty draft when merging tab state updates', () => {
    const state = createRendererState();
    state.activeTabId = 'tab-1';
    state.tabsById.set('tab-1', {
      tabId: 'tab-1',
      filePath: '/tmp/a.md',
      title: 'a.md',
      savedMarkdown: '# old',
      currentMarkdown: '# local edits',
      renderHtml: '<p>local</p>',
      renderBlocks: [],
      warnings: [],
      isDirty: true,
      hasExternalChange: false,
      mode: 'edit'
    });

    mergeTabsState(state, {
      activeTabId: 'tab-1',
      tabs: [
        {
          tabId: 'tab-1',
          filePath: '/tmp/a.md',
          title: 'a.md',
          savedMarkdown: '# old',
          currentMarkdown: '# disk version',
          renderHtml: '<p>disk</p>',
          renderBlocks: [],
          warnings: [],
          isDirty: false,
          hasExternalChange: false
        }
      ]
    });

    expect(state.tabsById.get('tab-1')?.currentMarkdown).toBe('# local edits');
    expect(state.tabsById.get('tab-1')?.isDirty).toBe(true);
    expect(state.tabsById.get('tab-1')?.mode).toBe('edit');
  });

  it('sets nested directory children by path', () => {
    const tree = [
      {
        type: 'dir' as const,
        name: 'docs',
        path: '/tmp/docs',
        children: [{ type: 'dir' as const, name: 'nested', path: '/tmp/docs/nested', children: [] }]
      }
    ];

    const updated = setChildrenForPath(tree, '/tmp/docs/nested', [{ type: 'file', name: 'guide.md', path: '/tmp/docs/nested/guide.md' }]);

    expect(updated).toBe(true);
    expect(tree[0]?.children?.[0]?.children?.[0]).toEqual({
      type: 'file',
      name: 'guide.md',
      path: '/tmp/docs/nested/guide.md'
    });
  });

  it('clamps sidebar widths into the allowed range', () => {
    expect(clampSidebarWidth(10, 180, 640)).toBe(180);
    expect(clampSidebarWidth(400, 180, 640)).toBe(400);
    expect(clampSidebarWidth(900, 180, 640)).toBe(640);
  });
});
