import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { exportHtmlFolder } from '../src/core/export/html';

describe('exportHtmlFolder', () => {
  it('writes document.html, diagram assets, and copied local images', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mdv-test-'));
    const outputDir = path.join(tempRoot, 'export');
    const baseDir = path.resolve(__dirname, '..');

    const htmlBody = `
      <h1>Doc</h1>
      <p><img src="./fixtures/local.svg" alt="local"></p>
      <p><img src="./assets/diagram-001.svg" alt="diagram"></p>
    `;

    const result = await exportHtmlFolder(
      outputDir,
      'Doc',
      htmlBody,
      baseDir,
      [{ svgPath: 'diagram-001.svg', svgContent: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }],
      []
    );

    const documentPath = path.join(outputDir, 'document.html');
    const diagramPath = path.join(outputDir, 'assets', 'diagram-001.svg');

    const [documentHtml, diagramSvg] = await Promise.all([
      fs.readFile(documentPath, 'utf8'),
      fs.readFile(diagramPath, 'utf8')
    ]);

    expect(result.outputFile).toBe(documentPath);
    expect(documentHtml).toContain('<title>Doc</title>');
    expect(documentHtml).toContain('./assets/image-001-local.svg');
    expect(diagramSvg).toContain('<svg');
  });
});
