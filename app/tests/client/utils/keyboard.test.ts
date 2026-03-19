// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyboardManager } from '../../../src/client/utils/keyboard.js';

describe('KeyboardManager', () => {
  let manager: KeyboardManager;

  beforeEach(() => {
    document.body.innerHTML = '<input id="focused" />';
    manager = new KeyboardManager(document);
  });

  afterEach(() => {
    manager.destroy();
    document.body.innerHTML = '';
  });

  it('TC-2.3a: Cmd+O is NOT registered', () => {
    manager.register({
      key: 'o',
      meta: true,
      shift: true,
      description: 'Open Folder',
      action: vi.fn(),
    });

    expect(
      manager
        .getShortcuts()
        .some((shortcut) => shortcut.key.toLowerCase() === 'o' && shortcut.meta && !shortcut.shift),
    ).toBe(false);
  });

  it('TC-2.3b: Shortcut works regardless of focus', () => {
    const action = vi.fn();
    const input = document.querySelector<HTMLInputElement>('#focused');

    manager.register({
      key: 'b',
      meta: true,
      description: 'Toggle Sidebar',
      action,
    });
    manager.attach();
    input?.focus();
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('TC-9.1d: Cmd+Shift+O triggers folder browse', () => {
    const action = vi.fn();

    manager.register({
      key: 'o',
      meta: true,
      shift: true,
      description: 'Open Folder',
      action,
    });
    manager.attach();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'O', metaKey: true, shiftKey: true, bubbles: true }),
    );

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('Non-TC: Unrecognized shortcut is ignored', () => {
    const action = vi.fn();

    manager.register({
      key: 'b',
      meta: true,
      description: 'Toggle Sidebar',
      action,
    });
    manager.attach();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'x', metaKey: true, bubbles: true }),
    );

    expect(action).not.toHaveBeenCalled();
  });

  it('Non-TC: preventDefault called on match', () => {
    const action = vi.fn();
    const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    manager.register({
      key: 'b',
      meta: true,
      description: 'Toggle Sidebar',
      action,
    });
    manager.attach();
    document.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
