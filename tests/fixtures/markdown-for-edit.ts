export const simpleMarkdown = '# Title\n\nParagraph with **bold** and *italic*.\n';

export const highlightedMarkdown = `# Heading

**bold** *italic* ~~strike~~ \`code\`

- list item
- another item

> blockquote

\`\`\`javascript
const x = 42;
\`\`\`

[link](https://example.com)

| Col1 | Col2 |
|------|------|
| a    | b    |
`;

export const largeMarkdown = Array.from(
  { length: 10_000 },
  (_, i) => `Line ${i + 1}: Some content here.\n`,
).join('');

export const emptyMarkdown = '';
