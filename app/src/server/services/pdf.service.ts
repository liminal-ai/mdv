import puppeteer from 'puppeteer';

export class PdfService {
  async generate(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print');
        const pdfBuffer = await page.pdf({
          format: 'letter',
          margin: {
            top: '1in',
            right: '1in',
            bottom: '1in',
            left: '1in',
          },
          printBackground: true,
          waitForFonts: true,
          tagged: true,
          timeout: 60_000,
        });
        return Buffer.from(pdfBuffer);
      } finally {
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
}
