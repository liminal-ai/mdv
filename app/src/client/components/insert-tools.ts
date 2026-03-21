import type { Editor } from './editor.js';

export function insertLink(editor: Editor): void {
  const selection = editor.getSelection();

  if (selection) {
    const url = window.prompt('Enter URL:');
    if (!url) {
      return;
    }

    editor.replaceSelection(`[${selection}](${url})`);
    return;
  }

  const text = window.prompt('Link text:');
  if (!text) {
    return;
  }

  const url = window.prompt('Enter URL:');
  if (!url) {
    return;
  }

  editor.insertAtCursor(`[${text}](${url})`);
}

export function insertTable(editor: Editor): void {
  const colsPrompt = window.prompt('Number of columns:', '3');
  const rowsPrompt = window.prompt('Number of rows:', '2');

  if (!colsPrompt || !rowsPrompt) {
    return;
  }

  const cols = Math.max(1, Math.min(20, Number.parseInt(colsPrompt, 10) || 3));
  const rows = Math.max(1, Math.min(50, Number.parseInt(rowsPrompt, 10) || 2));

  const header =
    '| ' + Array.from({ length: cols }, (_, index) => `Header ${index + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
  const bodyRows = Array.from(
    { length: rows },
    () => '| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |',
  );

  editor.insertAtCursor(`\n${[header, separator, ...bodyRows].join('\n')}\n`);
}
