export const plainTextMarkdown = `
# Architecture Overview

This document describes the system architecture.

The export pipeline should preserve headings and paragraphs.
`;

export const withImagesMarkdown = `
# Diagrams

![System Diagram](./images/system-diagram.png)
![Sequence Diagram](../assets/sequence-flow.jpg)
`;

export const withMermaidMarkdown = `
# Flowchart

\`\`\`mermaid
flowchart TD
  Start --> Render
  Render --> Export
\`\`\`
`;

export const withCodeBlocksMarkdown = `
# Code Examples

\`\`\`js
const exportFormat = 'pdf';
console.log(exportFormat);
\`\`\`

\`\`\`python
def export_document(fmt: str) -> str:
    return f"exporting {fmt}"
\`\`\`
`;

export const withTaskListMarkdown = `
# Task List

- [x] Completed task
- [ ] Pending task
- [x] Another done item
`;

export const withDetailsMarkdown = `
# Collapsible Content

<details>
<summary>Click to expand</summary>

This is the hidden content that should be visible in static exports.

</details>
`;

export const withInlineHtmlMarkdown = `
# Inline HTML

Water is H<sub>2</sub>O and energy equals mc<sup>2</sup>.

Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to copy.

First line<br>Second line
`;

export const withTablesMarkdown = `
# Export Matrix

| Format | Supported | Notes |
|--------|-----------|-------|
| PDF | Yes | Best fidelity |
| DOCX | Yes | Editable output |
| HTML | Yes | Web friendly |
`;

export const withDegradedContentMarkdown = `
# Degraded Content

![Missing](./missing-diagram.png)
![Remote](https://example.com/remote-image.png)

\`\`\`mermaid
graph TD
  Broken[broken
\`\`\`
`;

export const withFullyDegradedMarkdown = `
# All Degraded

![Missing 1](./no-exist-1.png)
![Missing 2](./no-exist-2.png)
![Missing 3](./no-exist-3.png)

\`\`\`mermaid
graph TD
  Invalid[broken
\`\`\`

\`\`\`mermaid
pie title
  broken[syntax
\`\`\`
`;

export const fullDocumentMarkdown = `
# Full Export Sample

This sample includes paragraphs, images, diagrams, code, and tables.

## Images

![System Diagram](./images/system-diagram.png)

## Mermaid

\`\`\`mermaid
sequenceDiagram
  participant User
  participant App
  User->>App: Export document
  App-->>User: Save output
\`\`\`

## Code

\`\`\`js
export async function runExport() {
  return 'ok';
}
\`\`\`

\`\`\`python
def render_document(path: str) -> str:
    return path
\`\`\`

## Table

| Section | Included |
|---------|----------|
| Images | Yes |
| Mermaid | Yes |
| Code | Yes |
`;

export const exportSamplePath = '/Users/test/docs/architecture.md';
export const exportSavePath = '/Users/test/exports/architecture.pdf';

export function generateLargeMarkdown(lineCount: number = 10_000): string {
  const sections: string[] = ['# Large Document Test\n'];

  for (let i = 1; i <= Math.floor(lineCount / 10); i++) {
    sections.push(
      `## Section ${i}\n`,
      `Paragraph content for section ${i}. `.repeat(5) + '\n',
      '',
      '```js',
      `function section${i}() {`,
      `  return ${i};`,
      '}',
      '```',
      '',
    );
  }

  return sections.join('\n');
}
