import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { exportDocxFromHtml } from '../src/core/export/docx';

const execFileAsync = promisify(execFile);

describe('exportDocxFromHtml', () => {
  it('creates a readable docx with document xml and media entries', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-docx-test-'));
    const outputPath = path.join(tempRoot, 'sample.docx');

    const result = await exportDocxFromHtml(
      'Docx Test',
      '<h1>Docx Test</h1><p>Inline mermaid image:</p><p><img src="./assets/diagram-001.svg" alt="Mermaid diagram diagram-1"></p>',
      outputPath,
      '/Users/leemoore/code/md-viewer',
      [
        {
          id: 'diagram-1',
          source: 'graph TD; A --> B;',
          svgPath: 'diagram-001.svg',
          svgContent:
            '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect x="2" y="2" width="116" height="76" fill="#ecfeff" stroke="#0f766e"/><text x="60" y="45" text-anchor="middle">D1</text></svg>'
        }
      ],
      [],
      {
        pageSize: 'Letter',
        marginsInches: { top: 1, right: 1, bottom: 1, left: 1 }
      }
    );

    expect(result.outputFile).toBe(outputPath);
    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(0);

    try {
      const { stdout } = await execFileAsync('unzip', ['-l', outputPath]);
      expect(stdout).toContain('word/document.xml');
      expect(stdout).toMatch(/word\/media\//);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  });
});
