export class PdfService {
  async generate(_html: string): Promise<Buffer> {
    return Buffer.from('%PDF-1.4 stub');
  }
}
