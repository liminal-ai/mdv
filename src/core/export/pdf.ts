import fs from 'node:fs/promises';
import path from 'node:path';

import { BrowserWindow } from 'electron';

import { PdfOptions } from '../types';
import { wrapDocumentHtml } from '../render/styles';
import { preparePrintHtml } from './layout';

export async function exportPdfFromHtml(
  title: string,
  htmlBody: string,
  outputPath: string,
  baseHref: string,
  pdfOptions: PdfOptions
): Promise<void> {
  const hiddenWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    const printHtmlBody = preparePrintHtml(htmlBody);
    const html = wrapDocumentHtml(title, printHtmlBody, baseHref, pdfOptions.pageSize);
    await hiddenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const pdf = await hiddenWindow.webContents.printToPDF({
      pageSize: pdfOptions.pageSize,
      printBackground: pdfOptions.printBackground,
      preferCSSPageSize: true
    });

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, pdf);
  } finally {
    hiddenWindow.destroy();
  }
}
