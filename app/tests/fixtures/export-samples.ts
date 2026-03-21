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
