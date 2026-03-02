import { describe, expect, it } from 'vitest';

import { parseInternalCliArgs, parseUserCliArgs } from '../src/core/cliArgs';

describe('CLI arg parsing', () => {
  it('parses user export command', () => {
    const parsed = parseUserCliArgs([
      'export',
      '--input',
      './README.md',
      '--format',
      'pdf',
      '--output',
      './README.pdf'
    ]);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.format).toBe('pdf');
      expect(parsed.value.input).toBe('./README.md');
    }
  });

  it('parses internal electron export command', () => {
    const parsed = parseInternalCliArgs([
      '--cli-export',
      '--input',
      './README.md',
      '--format',
      'all',
      '--output',
      './out'
    ]);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value?.cliExport).toBe(true);
      expect(parsed.value?.format).toBe('all');
    }
  });

  it('parses docx format for user export command', () => {
    const parsed = parseUserCliArgs([
      'export',
      '--input',
      './README.md',
      '--format',
      'docx',
      '--output',
      './README.docx'
    ]);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.format).toBe('docx');
    }
  });
});
