import type { ExportResponse, ExportWarning } from '../../src/shared/types.js';

export const exportWarnings: ExportWarning[] = [
  {
    type: 'missing-image',
    source: './missing-diagram.png',
    line: 4,
    message: 'Missing image: ./missing-diagram.png',
  },
  {
    type: 'remote-image-blocked',
    source: 'https://example.com/remote-image.png',
    line: 5,
    message: 'Remote image blocked during export',
  },
  {
    type: 'unsupported-format',
    source: './diagram.psd',
    line: 8,
    message: 'Unsupported image format: .psd',
  },
  {
    type: 'mermaid-error',
    source: 'graph TD\n  Broken[broken',
    line: 12,
    message: 'Failed to render mermaid diagram',
  },
  {
    type: 'format-degradation',
    source: 'table',
    line: 20,
    message: 'Complex table styling was simplified for export',
  },
];

export const successResponse: ExportResponse = {
  status: 'success',
  outputPath: '/Users/test/exports/architecture.pdf',
  warnings: [],
};

export const successWithWarningsResponse: ExportResponse = {
  status: 'success',
  outputPath: '/Users/test/exports/architecture.pdf',
  warnings: [exportWarnings[0]!, exportWarnings[3]!],
};
