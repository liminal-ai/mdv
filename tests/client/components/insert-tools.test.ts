// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertLink, insertTable } from '../../../src/client/components/insert-tools.js';

interface MockEditor {
  getSelection: ReturnType<typeof vi.fn>;
  insertAtCursor: ReturnType<typeof vi.fn>;
  replaceSelection: ReturnType<typeof vi.fn>;
}

function createEditor(selection = ''): MockEditor {
  return {
    getSelection: vi.fn(() => selection),
    insertAtCursor: vi.fn(),
    replaceSelection: vi.fn(),
  };
}

describe('insert tools', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('TC-9.1a: Insert link at cursor (no selection)', () => {
    const editor = createEditor('');
    vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('Click here')
      .mockReturnValueOnce('https://example.com');

    insertLink(editor as never);

    expect(window.prompt).toHaveBeenNthCalledWith(1, 'Link text:');
    expect(window.prompt).toHaveBeenNthCalledWith(2, 'Enter URL:');
    expect(editor.insertAtCursor).toHaveBeenCalledWith('[Click here](https://example.com)');
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });

  it('TC-9.1b: Insert link with selection', () => {
    const editor = createEditor('selected text');
    vi.spyOn(window, 'prompt').mockReturnValueOnce('https://example.com');

    insertLink(editor as never);

    expect(window.prompt).toHaveBeenCalledWith('Enter URL:');
    expect(editor.replaceSelection).toHaveBeenCalledWith('[selected text](https://example.com)');
    expect(editor.insertAtCursor).not.toHaveBeenCalled();
  });

  it('TC-9.2a: Insert table with 3 cols, 2 rows', () => {
    const editor = createEditor();
    vi.spyOn(window, 'prompt').mockReturnValueOnce('3').mockReturnValueOnce('2');

    insertTable(editor as never);

    expect(window.prompt).toHaveBeenNthCalledWith(1, 'Number of columns:', '3');
    expect(window.prompt).toHaveBeenNthCalledWith(2, 'Number of rows:', '2');
    expect(editor.insertAtCursor).toHaveBeenCalledWith(
      '\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n|     |     |     |\n|     |     |     |\n',
    );
  });

  it('TC-9.2b: Inserted table structure', () => {
    const editor = createEditor();
    vi.spyOn(window, 'prompt').mockReturnValueOnce('3').mockReturnValueOnce('2');

    insertTable(editor as never);

    const inserted = editor.insertAtCursor.mock.calls[0]?.[0];
    expect(inserted).toBeTypeOf('string');

    const lines = inserted.trim().split('\n');
    expect(lines).toEqual([
      '| Header 1 | Header 2 | Header 3 |',
      '| --- | --- | --- |',
      '|     |     |     |',
      '|     |     |     |',
    ]);
    expect(lines.every((line) => line.split('|').length === 5)).toBe(true);
  });
});
