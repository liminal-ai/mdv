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

// --- Epic 3 additions ---

// Code blocks for each of the 17 guaranteed baseline languages (AC-3.2a)
export const highlightingSamples: Record<string, string> = {
  javascript: '```javascript\nconst x = 42;\nconsole.log(x);\n```',
  typescript: '```typescript\nconst x: number = 42;\ninterface Foo { bar: string; }\n```',
  python: '```python\ndef hello(name: str) -> str:\n    return f"Hello {name}"\n```',
  go: '```go\nfunc main() {\n    fmt.Println("Hello")\n}\n```',
  rust: '```rust\nfn main() {\n    println!("Hello");\n}\n```',
  java: '```java\npublic class Main {\n    public static void main(String[] args) {}\n}\n```',
  c: '```c\n#include <stdio.h>\nint main() { return 0; }\n```',
  cpp: '```cpp\n#include <iostream>\nint main() { std::cout << "Hi"; }\n```',
  sql: '```sql\nSELECT id, name FROM users WHERE active = true;\n```',
  yaml: '```yaml\nname: test\nversion: 1.0\nitems:\n  - one\n  - two\n```',
  json: '```json\n{ "name": "test", "version": 1 }\n```',
  bash: '```bash\n#!/bin/bash\necho "Hello $USER"\nfor f in *.md; do echo "$f"; done\n```',
  html: '```html\n<div class="container"><p>Hello</p></div>\n```',
  css: '```css\n.container { display: flex; color: var(--primary); }\n```',
  markdown: '```markdown\n# Heading\n\n**bold** and *italic*\n```',
  toml: '```toml\n[package]\nname = "my-app"\nversion = "0.1.0"\n```',
  dockerfile: '```dockerfile\nFROM node:24-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\n```',
};

// Alias samples (AC-3.2b)
export const aliasSamples: Record<string, string> = {
  js: '```js\nconst x = 1;\n```',
  ts: '```ts\nconst x: number = 1;\n```',
  py: '```py\nx = 1\n```',
  sh: '```sh\necho "hello"\n```',
  yml: '```yml\nkey: value\n```',
};

// Fallback cases (AC-3.3)
export const noLanguageCodeBlock = '```\nplain text without language tag\n```';
export const unknownLanguageCodeBlock =
  '```brainfuck\n++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.\n```';
export const indentedCodeBlock = '    indented code block\n    no language tag possible';

// Large code block (TC-3.1d)
export const largeCodeBlock =
  '```typescript\n' +
  Array.from({ length: 3000 }, (_, i) => `const line${i} = ${i};`).join('\n') +
  '\n```';

// Tables with complex content (AC-4.1–4.3)
export const tableWithFormattingMarkdown = `
| Feature | Status | Notes |
|---------|--------|-------|
| **Bold** | *italic* | ~~struck~~ |
| \`code\` | [link](https://example.com) | normal |
`;

export const wideTableMarkdownEpic3 = `
| ${Array.from({ length: 15 }, (_, i) => `Col${i + 1}`).join(' | ')} |
| ${Array.from({ length: 15 }, () => '---').join(' | ')} |
| ${Array.from({ length: 15 }, (_, i) => `data-${i + 1}`).join(' | ')} |
`;

export const tableWithListAttemptMarkdown = `
| Feature | Items |
|---------|-------|
| Lists | - item 1 - item 2 |
`;

export const htmlTableWithBlockContent = `
<table>
<tr><th>Feature</th><th>Details</th></tr>
<tr>
<td>Items</td>
<td>
<ul>
<li>First item</li>
<li>Second item</li>
</ul>
</td>
</tr>
</table>
`;

export const tableWithEscapedPipes = `
| Expression | Result |
|------------|--------|
| a \\| b | union |
| \`x \\| y\` | code with pipe |
`;
