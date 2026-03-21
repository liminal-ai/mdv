import type { ExportWarning } from '../schemas/index.js';

export class DocxService {
  async generate(_html: string, _warnings: ExportWarning[]): Promise<Buffer> {
    return Buffer.from('PK stub docx');
  }
}
