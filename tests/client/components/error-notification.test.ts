// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountErrorNotification } from '../../../src/client/components/error-notification.js';
import { createStore } from '../support.js';

describe('error notification', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('TC-10.1a: Permission denied shows visible error', () => {
    document.body.innerHTML = '<div id="error-root"></div>';
    const store = createStore({
      error: { code: 'PERMISSION_DENIED', message: 'You do not have access to this folder.' },
    });

    mountErrorNotification(document.querySelector<HTMLElement>('#error-root')!, store, {
      onDismiss: vi.fn(),
    });

    expect(document.querySelector('[role="alert"]')).toBeTruthy();
    expect(document.body.textContent).toContain('You do not have access to this folder.');
  });

  it('TC-10.2a: Deleted root on refresh shows error', () => {
    document.body.innerHTML = '<div id="error-root"></div>';
    const store = createStore({
      error: { code: 'PATH_NOT_FOUND', message: 'The last opened folder is gone.' },
    });

    mountErrorNotification(document.querySelector<HTMLElement>('#error-root')!, store, {
      onDismiss: vi.fn(),
    });

    expect(document.body.textContent).toContain('The last opened folder is gone.');
  });

  it('TC-3.3c: Deleted workspace click shows error', () => {
    document.body.innerHTML = '<div id="error-root"></div>';
    const store = createStore({
      error: { code: 'PATH_NOT_FOUND', message: 'That workspace no longer exists.' },
    });

    mountErrorNotification(document.querySelector<HTMLElement>('#error-root')!, store, {
      onDismiss: vi.fn(),
    });

    expect(document.body.textContent).toContain('That workspace no longer exists.');
  });

  it('Non-TC: Error dismissed on click', () => {
    document.body.innerHTML = '<div id="error-root"></div>';
    const store = createStore({
      error: { code: 'PATH_NOT_FOUND', message: 'Dismiss me.' },
    });
    const onDismiss = vi.fn(() => {
      store.update({ error: null }, ['error']);
    });

    mountErrorNotification(document.querySelector<HTMLElement>('#error-root')!, store, {
      onDismiss,
    });
    document.querySelector<HTMLButtonElement>('.error-notification__dismiss')?.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('Non-TC: New error replaces old', () => {
    document.body.innerHTML = '<div id="error-root"></div>';
    const store = createStore({
      error: { code: 'PATH_NOT_FOUND', message: 'Old error' },
    });

    mountErrorNotification(document.querySelector<HTMLElement>('#error-root')!, store, {
      onDismiss: vi.fn(),
    });
    store.update(
      {
        error: { code: 'PERMISSION_DENIED', message: 'New error' },
      },
      ['error'],
    );

    expect(document.body.textContent).toContain('New error');
    expect(document.body.textContent).not.toContain('Old error');
  });
});
