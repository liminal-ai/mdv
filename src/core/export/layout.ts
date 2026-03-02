import { load } from 'cheerio';

export function preparePrintHtml(htmlBody: string): string {
  const manualBreak = '<div class="page-break" style="page-break-after: always;"></div>';
  const normalizedHtml = htmlBody
    .replaceAll('<p><!-- pagebreak --></p>', manualBreak)
    .replaceAll('<!-- pagebreak -->', manualBreak);

  const $ = load(normalizedHtml);

  $('h1, h2, h3').addClass('mdv-print-keep-with-next');
  $('pre, table, blockquote, .mdv-warning, .mdv-missing-image, .mdv-mermaid-diagram').addClass(
    'mdv-print-keep-together'
  );

  $('img').each((_, element) => {
    const alt = ($(element).attr('alt') || '').trim();
    if (alt.startsWith('Mermaid diagram')) {
      $(element).addClass('mdv-print-keep-together');
    }
  });

  $('p, li').addClass('mdv-print-text');

  return $('body').html() || $.root().html() || '';
}
