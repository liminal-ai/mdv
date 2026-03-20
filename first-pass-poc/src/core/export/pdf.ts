import fs from 'node:fs/promises';
import path from 'node:path';

import { BrowserWindow } from 'electron';

import { DiagramAsset, PdfOptions, RenderWarning } from '../types';
import { wrapDocumentHtml } from '../render/styles';
import { inlineImagesForPdf } from './assets';
import { preparePrintHtml } from './layout';

export async function exportPdfFromHtml(
  title: string,
  htmlBody: string,
  outputPath: string,
  baseHref: string | undefined,
  baseDir: string,
  diagrams: DiagramAsset[],
  initialWarnings: RenderWarning[],
  pdfOptions: PdfOptions
): Promise<RenderWarning[]> {
  const hiddenWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    const warnings = [...initialWarnings];
    const printHtmlBody = preparePrintHtml(htmlBody);
    const htmlWithEmbeddedImages = await inlineImagesForPdf(printHtmlBody, baseDir, diagrams, warnings);
    const html = wrapDocumentHtml(title, htmlWithEmbeddedImages, baseHref, pdfOptions.pageSize);
    await hiddenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const pdf = await hiddenWindow.webContents.printToPDF({
      pageSize: pdfOptions.pageSize,
      printBackground: pdfOptions.printBackground,
      preferCSSPageSize: true
    });

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, pdf);
    return warnings;
  } finally {
    hiddenWindow.destroy();
  }
}
