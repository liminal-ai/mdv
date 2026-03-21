export interface EditorOptions {
  onContentChange: (content: string) => void;
  onCursorChange: (line: number, column: number) => void;
  shouldSuppressUpdates: () => boolean;
}

export class Editor {
  constructor(_parent: HTMLElement, _options: EditorOptions) {
    throw new Error('Editor not implemented — Story 2');
  }

  setContent(_content: string): void {
    throw new Error('Editor not implemented — Story 2');
  }

  getContent(): string {
    throw new Error('Editor not implemented — Story 2');
  }

  getScrollTop(): number {
    throw new Error('Editor not implemented — Story 2');
  }

  setScrollTop(_top: number): void {
    throw new Error('Editor not implemented — Story 2');
  }

  scrollToPercentage(_percentage: number): void {
    throw new Error('Editor not implemented — Story 2');
  }

  getScrollPercentage(): number {
    throw new Error('Editor not implemented — Story 2');
  }

  insertAtCursor(_text: string): void {
    throw new Error('Editor not implemented — Story 2');
  }

  replaceSelection(_text: string): void {
    throw new Error('Editor not implemented — Story 2');
  }

  getSelection(): string {
    throw new Error('Editor not implemented — Story 2');
  }

  focus(): void {
    throw new Error('Editor not implemented — Story 2');
  }

  destroy(): void {
    throw new Error('Editor not implemented — Story 2');
  }
}
