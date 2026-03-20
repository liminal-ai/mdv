import { load } from 'cheerio';

export function preparePrintHtml(htmlBody: string): string {
  const manualBreak = '<section class="mdv-block mdv-block-page-break mdv-allow-split"><div class="mdv-page-break-line" aria-hidden="true"></div></section>';
  const normalizedHtml = htmlBody
    .replaceAll('<p><!-- pagebreak --></p>', manualBreak)
    .replaceAll('<!-- pagebreak -->', manualBreak);

  const $ = load(normalizedHtml);

  $('table').addClass('mdv-table');
  $('thead').addClass('mdv-table-head');
  $('tbody').addClass('mdv-table-body');
  $('tr').addClass('mdv-table-row');
  $('th').addClass('mdv-table-cell mdv-table-heading-cell');
  $('td').addClass('mdv-table-cell mdv-table-data-cell');
  $('img').addClass('mdv-content-image');

  return $('body').html() || $.root().html() || '';
}
