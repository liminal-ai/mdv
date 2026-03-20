import type { FileReadResponse } from '../../src/shared/types.js';

export const basicFileResponse: FileReadResponse = {
  path: '/Users/leemoore/code/project/docs/architecture.md',
  canonicalPath: '/Users/leemoore/code/project/docs/architecture.md',
  filename: 'architecture.md',
  content: '# Architecture\n\nSome content.',
  html: '<h1 id="architecture" tabindex="-1">Architecture</h1>\n<p>Some content.</p>\n',
  warnings: [],
  modifiedAt: '2026-03-19T00:00:00Z',
  size: 35,
};

export const fileWithWarnings: FileReadResponse = {
  ...basicFileResponse,
  warnings: [
    { type: 'missing-image', source: './missing.png', message: 'Missing image: ./missing.png' },
    {
      type: 'remote-image-blocked',
      source: 'https://example.com/img.png',
      message: 'Remote image blocked',
    },
  ],
};

export const largeFileResponse: FileReadResponse = {
  ...basicFileResponse,
  size: 2 * 1024 * 1024,
};

export const duplicateFilenameResponses: FileReadResponse[] = [
  {
    ...basicFileResponse,
    path: '/a/docs/architecture.md',
    canonicalPath: '/a/docs/architecture.md',
  },
  {
    ...basicFileResponse,
    path: '/b/specs/architecture.md',
    canonicalPath: '/b/specs/architecture.md',
  },
];

export const symlinkFileResponse: FileReadResponse = {
  ...basicFileResponse,
  path: '/root/docs/link.md',
  canonicalPath: '/real/path/doc.md',
};
