import fs from 'node:fs/promises';
import path from 'node:path';

import HtmlToDocx from '@turbodocx/html-to-docx';

import { DiagramAsset, DocxExportResult, DocxOptions, RenderWarning } from '../types';
import { wrapDocumentHtml } from '../render/styles';
import { inlineImagesForDocx } from './assets';
import { preparePrintHtml } from './layout';

function pageSizeTwips(pageSize: 'Letter' | 'A4'): { width: number; height: number } {
  if (pageSize === 'A4') {
    return { width: 11906, height: 16838 };
  }
  return { width: 12240, height: 15840 };
}

function toTwips(inches: number): number {
  return Math.round(inches * 1440);
}

export async function exportDocxFromHtml(
  title: string,
  htmlBody: string,
  outputPath: string,
  baseDir: string,
  diagrams: DiagramAsset[],
  initialWarnings: RenderWarning[],
  options: DocxOptions
): Promise<DocxExportResult> {
  const warnings = [...initialWarnings];
  const printHtml = preparePrintHtml(htmlBody);
  const htmlWithEmbeddedImages = await inlineImagesForDocx(printHtml, baseDir, diagrams, warnings);
  const fullHtml = wrapDocumentHtml(title, htmlWithEmbeddedImages, undefined, options.pageSize);

  const pageSize = pageSizeTwips(options.pageSize);
  const margins = {
    top: toTwips(options.marginsInches.top),
    right: toTwips(options.marginsInches.right),
    bottom: toTwips(options.marginsInches.bottom),
    left: toTwips(options.marginsInches.left)
  };

  const generated = await HtmlToDocx(fullHtml, null, {
    pageSize,
    margins,
    title,
    imageProcessing: {
      svgHandling: 'convert'
    }
  });

  const buffer = Buffer.isBuffer(generated)
    ? generated
    : generated instanceof ArrayBuffer
      ? Buffer.from(generated)
      : Buffer.from(await generated.arrayBuffer());

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);

  return {
    outputFile: outputPath,
    warnings
  };
}
