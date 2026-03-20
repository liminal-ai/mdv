import { describe, expect, it, vi } from 'vitest';

import {
  buildPreviewPatchPlan,
  computeDirty,
  createDebouncedRunner,
  findOpenTabIdByPath,
  nextActiveTabAfterClose,
  resolveConflictOutcome,
  resolveSwitchOutcome
} from '../src/renderer/editorState';

describe('editor state helpers', () => {
  it('computes dirty-state transitions', () => {
    expect(computeDirty('a', 'a')).toBe(false);
    expect(computeDirty('a', 'b')).toBe(true);
    expect(computeDirty('b', 'b')).toBe(false);
  });

  it('resolves switch outcomes', () => {
    expect(resolveSwitchOutcome(false, 'cancel')).toBe('proceed-discard');
    expect(resolveSwitchOutcome(true, 'save')).toBe('proceed-save');
    expect(resolveSwitchOutcome(true, 'discard')).toBe('proceed-discard');
    expect(resolveSwitchOutcome(true, 'cancel')).toBe('cancel');
  });

  it('resolves conflict outcomes', () => {
    expect(resolveConflictOutcome('keep-mine')).toBe('keep');
    expect(resolveConflictOutcome('reload-disk')).toBe('reload');
    expect(resolveConflictOutcome('save-copy')).toBe('save-copy');
  });

  it('debounces repeated calls into one execution', () => {
    vi.useFakeTimers();

    const run = vi.fn();
    const debounced = createDebouncedRunner(250, run, (fn, ms) => setTimeout(fn, ms), (timer) => clearTimeout(timer as number));

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(249);
    expect(run).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('reuses already-open tab by path', () => {
    expect(
      findOpenTabIdByPath(
        [
          { tabId: 'tab-1', filePath: '/tmp/a.md' },
          { tabId: 'tab-2', filePath: '/tmp/b.md' }
        ],
        '/tmp/b.md'
      )
    ).toBe('tab-2');

    expect(findOpenTabIdByPath([{ tabId: 'tab-1', filePath: '/tmp/a.md' }], '/tmp/c.md')).toBeNull();
  });

  it('chooses next active tab when closing', () => {
    expect(nextActiveTabAfterClose(['a', 'b', 'c'], 'b', 'b')).toBe('a');
    expect(nextActiveTabAfterClose(['a', 'b', 'c'], 'c', 'a')).toBe('a');
    expect(nextActiveTabAfterClose(['a'], 'a', 'a')).toBeNull();
  });

  it('builds a keyed preview patch plan without replacing unchanged blocks', () => {
    const plan = buildPreviewPatchPlan(
      [
        { id: 'a', signature: 'a-1' },
        { id: 'b', signature: 'b-1' },
        { id: 'c', signature: 'c-1' }
      ],
      [
        { id: 'a', signature: 'a-1' },
        { id: 'b', signature: 'b-2' },
        { id: 'd', signature: 'd-1' }
      ]
    );

    expect(plan.insertedIds).toEqual(['d']);
    expect(plan.updatedIds).toEqual(['b']);
    expect(plan.removedIds).toEqual(['c']);
    expect(plan.orderedIds).toEqual(['a', 'b', 'd']);
  });
});
