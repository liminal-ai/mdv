import { rename, unlink, writeFile } from 'node:fs/promises';
import type { ExportRequest, ExportResponse, ExportWarning } from '../schemas/index.js';
import { ExportInProgressError } from '../utils/errors.js';
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
  return warnings.map((warning) => ({ ...warning }));
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

    try {
      const source = await this.fileService.readFile(request.path);
      const exportTheme = getExportTheme(request);

      const renderResult = await this.renderService.renderForExport(
        source.content,
        request.path,
        exportTheme,
      );

      const mermaidResult = await this.mermaidSsrService.renderAll(
        renderResult.html,
        getMermaidTheme(exportTheme),
      );

      const assetResult = await this.assetService.resolveImages(mermaidResult.html, request.path);
      const warnings = toExportWarnings([
        ...renderResult.warnings,
        ...mermaidResult.warnings,
        ...assetResult.warnings,
      ]);
      const fullHtml = this.htmlExportService.assemble(assetResult.html, exportTheme);

      let output: Buffer | string;
      switch (request.format) {
        case 'pdf':
          output = await this.pdfService.generate(fullHtml);
          break;
        case 'docx':
          output = await this.docxService.generate(assetResult.html, warnings);
          break;
        case 'html':
        default:
          output = fullHtml;
          break;
      }

      if (typeof output === 'string') {
        await writeFile(tempPath, output, 'utf8');
      } else {
        await writeFile(tempPath, output);
      }
      await rename(tempPath, request.savePath);

      return {
        status: 'success',
        outputPath: request.savePath,
        warnings,
      };
    } finally {
      await unlink(tempPath).catch(() => {});
      this.exporting = false;
    }
  }
}
