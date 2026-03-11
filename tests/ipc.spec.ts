import { describe, expect, it } from 'vitest';

import { IPC_CHANNELS } from '../src/core/ipc';
import { toLegacyActionResult } from '../src/main/ipc';

describe('ipc contract helpers', () => {
  it('exposes the expected channel names', () => {
    expect(IPC_CHANNELS.tabsGetState).toBe('tabs:get-state');
    expect(IPC_CHANNELS.exportPdf).toBe('export:pdf');
    expect(IPC_CHANNELS.uiSetSidebarWidth).toBe('ui:set-sidebar-width');
  });

  it('keeps legacy open results from lying about file paths', () => {
    expect(toLegacyActionResult({ ok: true, tabId: 'tab-7' }, '/tmp/example.md')).toEqual({
      ok: true,
      tabId: 'tab-7',
      reason: undefined,
      filePath: '/tmp/example.md'
    });
  });
});
