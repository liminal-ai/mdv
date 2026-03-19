export interface ShortcutDefinition {
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export class KeyboardManager {
  private readonly shortcuts: ShortcutDefinition[] = [];

  private attached = false;

  constructor(private readonly target: Document = document) {}

  register(shortcut: ShortcutDefinition): () => void {
    this.shortcuts.push(shortcut);

    return () => {
      const index = this.shortcuts.indexOf(shortcut);
      if (index >= 0) {
        this.shortcuts.splice(index, 1);
      }
    };
  }

  getShortcuts(): ShortcutDefinition[] {
    return [...this.shortcuts];
  }

  attach(): void {
    if (this.attached) {
      return;
    }

    this.target.addEventListener('keydown', this.handleKeydown);
    this.attached = true;
  }

  destroy(): void {
    if (!this.attached) {
      return;
    }

    this.target.removeEventListener('keydown', this.handleKeydown);
    this.attached = false;
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    const match = this.shortcuts.find((shortcut) => this.matches(shortcut, event));
    if (!match) {
      return;
    }

    event.preventDefault();
    match.action();
  };

  private matches(shortcut: ShortcutDefinition, event: KeyboardEvent): boolean {
    return (
      event.key.toLowerCase() === shortcut.key.toLowerCase() &&
      event.metaKey === Boolean(shortcut.meta) &&
      event.shiftKey === Boolean(shortcut.shift) &&
      event.altKey === Boolean(shortcut.alt)
    );
  }
}
