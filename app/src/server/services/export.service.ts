import { rename, unlink, writeFile } from 'node:fs/promises';
import puppeteer, { type Browser } from 'puppeteer';
import type { ExportRequest, ExportResponse, ExportWarning } from '../schemas/index.js';
import {
  ExportInProgressError,
  ExportInsufficientStorageError,
  ExportWriteError,
  ExportWritePermissionError,
  isInsufficientStorageError,
  isPermissionError,
} from '../utils/errors.js';
import { AssetService } from './asset.service.js';
import { DocxService } from './docx.service.js';
import { FileService } from './file.service.js';
import { HtmlExportService } from './html-export.service.js';
import { MermaidSsrService } from './mermaid-ssr.service.js';
import { PdfService } from './pdf.service.js';
import { RenderService } from './render.service.js';

function getExportTheme(request: ExportRequest): string {
  return request.format === 'html' ? request.theme : 'light-default';
}

function getMermaidTheme(themeId: string): 'default' | 'dark' {
  return themeId.startsWith('dark') ? 'dark' : 'default';
}

function toExportWarnings(
  warnings: Array<{ type: ExportWarning['type']; source: string; message: string; line?: number }>,
): ExportWarning[] {
  return warnings.map((warning) => ({
    ...warning,
    source: warning.source.length > 200 ? `${warning.source.slice(0, 197)}...` : warning.source,
  }));
}

function setHtmlAttribute(attrs: string | undefined, name: string, value: string): string {
  const source = attrs ?? '';
  const attributePattern = new RegExp(`${name}\\s*=\\s*(".*?"|'.*?'|[^\\s>]+)`, 'i');

  if (attributePattern.test(source)) {
    return source.replace(attributePattern, `${name}="${value}"`);
  }

  return `${source} ${name}="${value}"`;
}

function isRelativeMarkdownHref(href: string): boolean {
  if (
    href.startsWith('#') ||
    href.startsWith('/') ||
    href.startsWith('//') ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href)
  ) {
    return false;
  }

  const [pathname] = href.split(/[?#]/, 1);
  const normalizedPath = pathname.toLowerCase();
  return normalizedPath.endsWith('.md') || normalizedPath.endsWith('.markdown');
}

function flattenRelativeMarkdownLinks(html: string): string {
  return html.replace(
    /<a\b([^>]*?)href=(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (match, _pre, _quote, href: string, _post, content: string) =>
      isRelativeMarkdownHref(href) ? content : match,
  );
}

function expandDetailsElements(html: string): { html: string; warnings: ExportWarning[] } {
  const warnings: ExportWarning[] = [];
  const DETAILS_RE = /<details(?![^>]*\bopen\b)([^>]*)>/gi;

  const expandedHtml = html.replace(DETAILS_RE, (_match, attrs: string = '') => {
    warnings.push({
      type: 'format-degradation',
      source: '<details>',
      message: '<details> element expanded for static format export',
    });

    return `<details open${attrs}>`;
  });

  return {
    html: expandedHtml.replace(
      /<summary([^>]*)>/gi,
      (_match, attrs: string = '') =>
        `<summary${setHtmlAttribute(attrs, 'data-mdv-static-summary', 'true')}>`,
    ),
    warnings,
  };
}

export class ExportService {
  private exporting = false;

  constructor(
    private readonly fileService: FileService,
    private readonly renderService: RenderService,
    private readonly mermaidSsrService: MermaidSsrService,
    private readonly assetService: AssetService,
    private readonly pdfService: PdfService,
    private readonly docxService: DocxService,
    private readonly htmlExportService: HtmlExportService,
  ) {}

  async export(request: ExportRequest): Promise<ExportResponse> {
    if (this.exporting) {
      throw new ExportInProgressError();
    }

    this.exporting = true;
    const tempPath = `${request.savePath}.tmp`;
    let browser: Browser | null = null;

    try {
      const source = await this.fileService.readFile(request.path);
      const exportTheme = getExportTheme(request);
      if (request.format === 'pdf') {
        browser = await puppeteer.launch({ headless: true });
      }

      const renderResult = await this.renderService.renderForExport(
        source.content,
        request.path,
        exportTheme,
      );

      const mermaidResult = await this.mermaidSsrService.renderAll(
        renderResult.html,
        getMermaidTheme(exportTheme),
        browser ?? undefined,
      );

      const assetResult = await this.assetService.resolveImages(mermaidResult.html, request.path);
      const staticContentResult =
        request.format === 'html'
          ? { html: assetResult.html, warnings: [] }
          : expandDetailsElements(flattenRelativeMarkdownLinks(assetResult.html));
      const warnings = toExportWarnings([
        ...renderResult.warnings,
        ...mermaidResult.warnings,
        ...assetResult.warnings,
        ...staticContentResult.warnings,
      ]);
      const fullHtml = this.htmlExportService.assemble(staticContentResult.html, exportTheme);

      let output: Buffer | string;
      switch (request.format) {
        case 'pdf':
          output = await this.pdfService.generate(fullHtml, browser ?? undefined);
          break;
        case 'docx':
          output = await this.docxService.generate(staticContentResult.html, warnings);
          break;
        case 'html':
        default:
          output = fullHtml;
          break;
      }

      try {
        if (typeof output === 'string') {
          await writeFile(tempPath, output, 'utf8');
        } else {
          await writeFile(tempPath, output);
        }
        await rename(tempPath, request.savePath);
      } catch (error) {
        if (isPermissionError(error)) {
          throw new ExportWritePermissionError(request.savePath);
        }
        if (isInsufficientStorageError(error)) {
          throw new ExportInsufficientStorageError(request.savePath);
        }
        throw new ExportWriteError(request.savePath, error);
      }

      return {
        status: 'success',
        outputPath: request.savePath,
        warnings,
      };
    } finally {
      await unlink(tempPath).catch(() => {});
      await browser?.close().catch(() => {});
      this.exporting = false;
    }
  }
}
