export const headingsMarkdown = `
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
`;

export const inlineFormattingMarkdown = `
**bold** *italic* ~~strikethrough~~ \`inline code\`
`;

export const listsMarkdown = `
- item 1
- item 2
  - nested 2a
  - nested 2b
    - deep nested

1. first
2. second
3. third
`;

export const taskListMarkdown = `
- [ ] undone task
- [x] done task
- [ ] another undone
`;

export const tableMarkdown = `
| Left | Center | Right |
|:-----|:------:|------:|
| a    |   b    |     c |
| long content | centered | right-aligned |
`;

export const wideTableMarkdown = `
| Col1 | Col2 | Col3 | Col4 | Col5 | Col6 | Col7 | Col8 | Col9 | Col10 | Col11 | Col12 |
|------|------|------|------|------|------|------|------|------|-------|-------|-------|
| data | data | data | data | data | data | data | data | data | data  | data  | data  |
`;

export const codeBlockMarkdown = `
\`\`\`typescript
const x: number = 42;
\`\`\`

    indented code block
`;

export const blockquoteMarkdown = `
> Single blockquote

> > Nested blockquote
`;

export const linksMarkdown = `
[External](https://example.com)
[Anchor](#section-heading)
[Relative MD](./other.md)
[Relative with anchor](./other.md#heading)
[Non-MD](./diagram.svg)
`;

export const imageMarkdown = `
![Local](./images/diagram.png)
![Absolute](/tmp/test/image.jpg)
![Missing](./missing.png)
![Remote](https://example.com/image.png)
![Unsupported](./file.psd)
`;

export const rawHtmlMarkdown = `
<details>
<summary>Click me</summary>
Content inside details
</details>

<kbd>Ctrl+C</kbd>
<sup>superscript</sup>
<sub>subscript</sub>
<br>
`;

export const scriptTagMarkdown = `
<script>alert('xss')</script>
Normal content after script.
`;

export const mermaidMarkdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
`;

export const emptyMarkdown = '';

export const binaryMarkdown =
  '# Binary Fixture\n\n' + String.fromCharCode(0, 1, 2, 255, 128) + '\n';

export const malformedMarkdown = `
**unclosed bold
*unclosed italic
\`unclosed code
| broken | table
`;

export const longLineMarkdown = 'x'.repeat(15000);

export const horizontalRuleMarkdown = `
---
***
___
`;
