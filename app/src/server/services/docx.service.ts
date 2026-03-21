import htmlToDocx from '@turbodocx/html-to-docx';
import { Resvg } from '@resvg/resvg-js';
import type { ExportWarning } from '../schemas/index.js';

const SVG_TAG_RE = /<svg[\s\S]*?<\/svg>/gi;

export class DocxService {
  async generate(contentHtml: string, warnings: ExportWarning[]): Promise<Buffer> {
    const svgResult = this.convertSvgsToPng(contentHtml);
    warnings.push(...svgResult.warnings);

    const docxHtml = this.wrapForDocx(svgResult.html);
    const docxBuffer = await htmlToDocx(docxHtml, null, {
      margins: {
        top: 1440,
        right: 1440,
        bottom: 1440,
        left: 1440,
      },
      title: '',
    });

    if (docxBuffer instanceof Blob) {
      return Buffer.from(await docxBuffer.arrayBuffer());
    }

    if (Buffer.isBuffer(docxBuffer)) {
      return docxBuffer;
    }

    return Buffer.from(new Uint8Array(docxBuffer));
  }

  private convertSvgsToPng(html: string): { html: string; warnings: ExportWarning[] } {
    const warnings: ExportWarning[] = [];

    const convertedHtml = html.replace(SVG_TAG_RE, (svgContent) => {
      try {
        const rendered = new Resvg(svgContent, {
          fitTo: { mode: 'width', value: 1400 },
        }).render();
        const pngBase64 = rendered.asPng().toString('base64');

        return (
          `<img src="data:image/png;base64,${pngBase64}" ` +
          `width="${rendered.width}" height="${rendered.height}" ` +
          'style="max-width:100%;height:auto;" />'
        );
      } catch (error) {
        warnings.push({
          type: 'format-degradation',
          source: 'inline-svg',
          message: `Inline SVG could not be converted for DOCX export: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        return svgContent;
      }
    });

    return {
      html: convertedHtml,
      warnings,
    };
  }

  private wrapForDocx(contentHtml: string): string {
    return `<!DOCTYPE html>
<html><head>
<style>
  body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; }
  h1 { font-size: 20pt; }
  h2 { font-size: 16pt; }
  h3 { font-size: 14pt; }
  h4 { font-size: 12pt; font-weight: bold; }
  code { font-family: Consolas, monospace; font-size: 10pt; background: #f0f0f0; padding: 1px 4px; }
  pre { background: #f5f5f5; padding: 10px; font-family: Consolas, monospace; font-size: 9pt; }
  blockquote { border-left: 3px solid #ccc; padding-left: 10px; color: #555; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  th { background: #f0f0f0; font-weight: bold; }
  img { max-width: 100%; }
  .image-placeholder { background: #f5f5f5; border: 1px dashed #ccc; padding: 10px; color: #888; }
  .mermaid-error__banner { background: #dc3545; color: white; padding: 5px 10px; }
  .mermaid-error__source { background: #f5f5f5; padding: 10px; font-family: Consolas, monospace; }
</style>
</head><body>${contentHtml}</body></html>`;
  }
}
