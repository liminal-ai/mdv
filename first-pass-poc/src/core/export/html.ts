import fs from 'node:fs/promises';
import path from 'node:path';

import { RenderWarning } from '../types';
import { wrapDocumentHtml } from '../render/styles';
import { copyLocalImagesToAssets, writeDiagramSvgAssets } from './assets';

export interface HtmlExportResult {
  outputFile: string;
  warnings: RenderWarning[];
}

export async function exportHtmlFolder(
  exportDir: string,
  title: string,
  exportBodyHtml: string,
  baseDir: string,
  diagrams: Array<{ svgPath: string; svgContent?: string }>,
  initialWarnings: RenderWarning[]
): Promise<HtmlExportResult> {
  await fs.mkdir(exportDir, { recursive: true });

  const assetsDir = path.join(exportDir, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  await writeDiagramSvgAssets(assetsDir, diagrams);

  const warnings = [...initialWarnings];
  const htmlWithCopiedImages = await copyLocalImagesToAssets(exportBodyHtml, baseDir, assetsDir, warnings);
  const documentHtml = wrapDocumentHtml(title, htmlWithCopiedImages);
  const outputFile = path.join(exportDir, 'document.html');

  await fs.writeFile(outputFile, documentHtml, 'utf8');

  return {
    outputFile,
    warnings
  };
}
