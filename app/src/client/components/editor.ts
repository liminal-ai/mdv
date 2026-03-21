import { indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';

export interface EditorOptions {
  onContentChange: (content: string) => void;
  onCursorChange: (line: number, column: number) => void;
}

export class Editor {
  private view: EditorView;

  private suppressUpdates = false;

  constructor(parent: HTMLElement, options: EditorOptions) {
    const state = EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (this.suppressUpdates) {
            return;
          }

          if (!update.docChanged && !update.selectionSet) {
            return;
          }

          if (update.docChanged) {
            options.onContentChange(update.state.doc.toString());
          }

          const position = update.state.selection.main.head;
          const line = update.state.doc.lineAt(position);
          options.onCursorChange(line.number, position - line.from + 1);
        }),
        EditorView.theme({
          '&': {
            height: '100%',
          },
          '.cm-content': {
            fontFamily: '"SF Mono", "Fira Code", monospace',
            fontSize: '14px',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--color-bg-secondary)',
            color: 'var(--color-text-muted)',
            borderRight: '1px solid var(--color-border)',
          },
          '&.cm-focused .cm-cursor': {
            borderLeftColor: 'var(--color-text-primary)',
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--color-bg-hover)',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: 'var(--color-accent)',
            opacity: '0.2',
          },
          '::selection': {
            backgroundColor: 'var(--color-accent)',
          },
        }),
      ],
    });

    this.view = new EditorView({ state, parent });
  }

  setContent(content: string): void {
    this.suppressUpdates = true;
    try {
      this.view.dispatch({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: content,
        },
      });
    } finally {
      this.suppressUpdates = false;
    }
  }

  getContent(): string {
    return this.view.state.doc.toString();
  }

  getScrollTop(): number {
    return this.view.scrollDOM.scrollTop;
  }

  setScrollTop(top: number): void {
    this.view.scrollDOM.scrollTop = top;
  }

  scrollToPercentage(percentage: number): void {
    const maxScroll = this.view.scrollDOM.scrollHeight - this.view.scrollDOM.clientHeight;
    this.view.scrollDOM.scrollTop = Math.max(maxScroll, 0) * percentage;
  }

  getScrollPercentage(): number {
    const maxScroll = this.view.scrollDOM.scrollHeight - this.view.scrollDOM.clientHeight;
    if (maxScroll <= 0) {
      return 0;
    }

    return this.view.scrollDOM.scrollTop / maxScroll;
  }

  insertAtCursor(text: string): void {
    const position = this.view.state.selection.main.head;
    this.view.dispatch({
      changes: { from: position, insert: text },
      selection: { anchor: position + text.length },
    });
    this.view.focus();
  }

  replaceSelection(text: string): void {
    const { from, to } = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    this.view.focus();
  }

  getSelection(): string {
    const { from, to } = this.view.state.selection.main;
    return this.view.state.doc.sliceString(from, to);
  }

  focus(): void {
    this.view.focus();
  }

  destroy(): void {
    this.view.destroy();
  }
}
