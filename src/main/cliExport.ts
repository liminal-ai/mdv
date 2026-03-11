import path from 'node:path';

import { exportDocxFromHtml } from '../core/export/docx';
import { exportHtmlFolder } from '../core/export/html';
import { exportPdfFromHtml } from '../core/export/pdf';
import { readMarkdownFile, renderMarkdown } from '../core/render/markdown';
import type { MermaidRenderer } from '../core/types';

export interface CliExportArgs {
  input: string;
  output: string;
  format: 'pdf' | 'html' | 'docx' | 'all';
}

export async function runCliExport(args: CliExportArgs, mermaidRenderer: MermaidRenderer): Promise<number> {
  try {
    const inputPath = path.resolve(args.input);
    const markdown = await readMarkdownFile(inputPath);
    const renderResult = await renderMarkdown(
      {
        inputPath,
        markdown,
        baseDir: path.dirname(inputPath),
        offline: true
      },
      mermaidRenderer
    );

    const stem = path.parse(inputPath).name;
    if (args.format === 'pdf' || args.format === 'all') {
      const pdfOutput = resolvePdfPath(args.output, stem, args.format === 'pdf');
      const pdfWarnings = await exportPdfFromHtml(
        stem,
        renderResult.exportHtml,
        pdfOutput,
        undefined,
        renderResult.baseDir,
        renderResult.diagrams,
        renderResult.warnings,
        {
          pageSize: 'Letter',
          printBackground: true
        }
      );
      console.log(`PDF exported: ${pdfOutput}`);
      if (pdfWarnings.length > 0) {
        console.warn('Warnings:');
        for (const warning of pdfWarnings) {
          console.warn(`- [${warning.code}] ${warning.message}`);
        }
      }
    }

    if (args.format === 'docx' || args.format === 'all') {
      const docxOutput = resolveDocxPath(args.output, stem, args.format === 'docx');
      const docxResult = await exportDocxFromHtml(
        stem,
        renderResult.exportHtml,
        docxOutput,
        renderResult.baseDir,
        renderResult.diagrams,
        renderResult.warnings,
        {
          pageSize: 'Letter',
          marginsInches: {
            top: 1,
            right: 1,
            bottom: 1,
            left: 1
          }
        }
      );
      console.log(`DOCX exported: ${docxResult.outputFile}`);
      if (docxResult.warnings.length > 0) {
        console.warn('Warnings:');
        for (const warning of docxResult.warnings) {
          console.warn(`- [${warning.code}] ${warning.message}`);
        }
      }
    }

    if (args.format === 'html' || args.format === 'all') {
      const htmlDir = resolveHtmlDir(args.output, stem, args.format === 'html');
      const htmlResult = await exportHtmlFolder(
        htmlDir,
        stem,
        renderResult.exportHtml,
        renderResult.baseDir,
        renderResult.diagrams,
        renderResult.warnings
      );
      console.log(`HTML exported: ${htmlResult.outputFile}`);
      if (htmlResult.warnings.length > 0) {
        console.warn('Warnings:');
        for (const warning of htmlResult.warnings) {
          console.warn(`- [${warning.code}] ${warning.message}`);
        }
      }
    }

    return 0;
  } catch (error) {
    console.error(`Export failed: ${String(error)}`);
    return 3;
  }
}

export function resolvePdfPath(output: string, stem: string, strictFile: boolean): string {
  const resolved = path.resolve(output);
  if (strictFile && resolved.toLowerCase().endsWith('.pdf')) {
    return resolved;
  }
  if (resolved.toLowerCase().endsWith('.pdf')) {
    return resolved;
  }
  return path.join(resolved, `${stem}.pdf`);
}

export function resolveHtmlDir(output: string, stem: string, strictDir: boolean): string {
  const resolved = path.resolve(output);
  if (strictDir) {
    return resolved;
  }
  if (path.extname(resolved)) {
    return resolved;
  }
  return path.join(resolved, `${stem}-export`);
}

export function resolveDocxPath(output: string, stem: string, strictFile: boolean): string {
  const resolved = path.resolve(output);
  if (strictFile && resolved.toLowerCase().endsWith('.docx')) {
    return resolved;
  }
  if (resolved.toLowerCase().endsWith('.docx')) {
    return resolved;
  }
  return path.join(resolved, `${stem}.docx`);
}
