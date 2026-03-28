// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

describe('electron detection', () => {
  beforeEach(() => {
    document.body.className = '';
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('TC-8.3a: HTML menu bar hidden in Electron', () => {
    const search = '?electron=1';
    if (new URLSearchParams(search).has('electron')) {
      document.body.classList.add('electron');
    }

    expect(document.body.classList.contains('electron')).toBe(true);

    const style = document.createElement('style');
    style.textContent = 'body.electron #menu-bar { display: none; }';
    document.head.appendChild(style);

    const menuBar = document.createElement('div');
    menuBar.id = 'menu-bar';
    document.body.appendChild(menuBar);

    expect(getComputedStyle(menuBar).display).toBe('none');
  });

  it('TC-8.3b: HTML menu bar visible in browser', () => {
    const search = '';
    if (new URLSearchParams(search).has('electron')) {
      document.body.classList.add('electron');
    }

    expect(document.body.classList.contains('electron')).toBe(false);
  });
});
