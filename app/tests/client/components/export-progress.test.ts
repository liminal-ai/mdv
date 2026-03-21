// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountExportProgress } from '../../../src/client/components/export-progress.js';
import { mountExportResult } from '../../../src/client/components/export-result.js';
import { createStore, getButtonByText } from '../support.js';

const cleanups: Array<() => void> = [];

function renderExportUi(overrides: Parameters<typeof createStore>[0] = {}) {
  document.body.innerHTML = `
    <div id="export-progress-root"></div>
    <div id="export-result-root"></div>
  `;

  const store = createStore(overrides);
  cleanups.push(
    mountExportProgress(document.querySelector<HTMLElement>('#export-progress-root')!, store),
    mountExportResult(document.querySelector<HTMLElement>('#export-result-root')!, store),
  );

  return { store };
}

describe('export progress and result components', () => {
  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('TC-2.1a: Progress indicator appears when export starts', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: true,
          activeFormat: 'pdf',
          result: null,
        },
      },
      ['exportState'],
    );

    expect(document.querySelector('.export-progress')).not.toBeNull();
    expect(document.body.textContent).toContain('Exporting PDF...');
  });

  it('TC-2.1b: UI elements remain accessible during export', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: true,
          activeFormat: 'docx',
          result: null,
        },
      },
      ['exportState'],
    );

    const progress = document.querySelector<HTMLElement>('.export-progress');
    expect(progress?.getAttribute('role')).toBe('status');
    expect(progress?.textContent).toContain('Exporting DOCX...');
  });

  it('TC-2.2a: Success notification shows output path', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'success',
            outputPath: '/Users/test/exports/architecture.pdf',
            warnings: [],
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    expect(document.querySelector('.export-result--success')).not.toBeNull();
    expect(document.body.textContent).toContain('/Users/test/exports/architecture.pdf');
  });

  it('TC-2.2b: Reveal button exists in success notification', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'success',
            outputPath: '/Users/test/exports/architecture.pdf',
            warnings: [],
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    expect(getButtonByText('Reveal in Finder')).not.toBeNull();
  });

  it('TC-2.2c: Success notification can be dismissed', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'success',
            outputPath: '/Users/test/exports/architecture.pdf',
            warnings: [],
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    getButtonByText('Dismiss').click();

    expect(document.querySelector('.export-result')).toBeNull();
    expect(store.get().exportState.result).toBeNull();
  });

  it('TC-2.3a: Degraded notification shows warning count', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'success',
            outputPath: '/Users/test/exports/architecture.pdf',
            warnings: [
              {
                type: 'missing-image',
                source: './missing.png',
                message: 'Missing image: ./missing.png',
              },
              {
                type: 'mermaid-error',
                source: 'graph TD\nA --> B',
                message: 'Failed to render mermaid diagram',
              },
            ],
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    expect(document.querySelector('.export-result--degraded')).not.toBeNull();
    expect(document.body.textContent).toContain('2 warnings');
  });

  it('TC-2.3b: Warning details are expandable', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'success',
            outputPath: '/Users/test/exports/architecture.pdf',
            warnings: [
              {
                type: 'missing-image',
                source: './missing.png',
                message: 'Missing image: ./missing.png',
              },
            ],
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    const details = document.querySelector<HTMLDetailsElement>('.export-result__warnings');
    expect(details).not.toBeNull();
    expect(details?.querySelector('summary')?.textContent).toBe('1 warning');

    details!.open = true;
    expect(details?.querySelector('.export-result__warning-title')?.textContent).toBe(
      'Missing image: ./missing.png',
    );
    expect(details?.textContent).toContain('Missing image: ./missing.png');
  });

  it('TC-2.4a: Error notification shows error message', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'error',
            warnings: [],
            error: 'You do not have permission to export here.',
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    expect(document.querySelector('.export-result--error')).not.toBeNull();
    expect(document.body.textContent).toContain('Export failed');
  });

  it('TC-2.4b: Error notification includes error detail', () => {
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'error',
            warnings: [],
            error: 'There is not enough free space to complete this export.',
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    expect(document.body.textContent).toContain(
      'There is not enough free space to complete this export.',
    );
  });

  it('Non-TC: Success auto-dismisses after timeout', () => {
    vi.useFakeTimers();
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'success',
            outputPath: '/Users/test/exports/architecture.pdf',
            warnings: [],
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    vi.advanceTimersByTime(10_000);

    expect(document.querySelector('.export-result')).toBeNull();
    expect(store.get().exportState.result).toBeNull();
  });

  it('Non-TC: Error persists until manually dismissed', () => {
    vi.useFakeTimers();
    const { store } = renderExportUi();

    store.update(
      {
        exportState: {
          inProgress: false,
          activeFormat: null,
          result: {
            type: 'error',
            warnings: [],
            error: 'Export engine crashed.',
            completedAt: '2026-03-21T12:00:00.000Z',
          },
        },
      },
      ['exportState'],
    );

    vi.advanceTimersByTime(10_000);

    expect(document.querySelector('.export-result--error')).not.toBeNull();
    expect(store.get().exportState.result?.type).toBe('error');
  });
});
