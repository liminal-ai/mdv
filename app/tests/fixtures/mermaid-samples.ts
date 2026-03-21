// Valid diagrams — one per guaranteed baseline type (AC-1.1)
export const flowchartMermaid = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Do something]
  B -->|No| D[Do something else]
  C --> E[End]
  D --> E`;

export const sequenceMermaid = `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: Hello Bob
  Bob-->>Alice: Hi Alice
  Alice->>Bob: How are you?
  Bob-->>Alice: Good thanks`;

export const classMermaid = `classDiagram
  class Animal {
    +String name
    +int age
    +makeSound() void
  }
  class Dog {
    +fetch() void
  }
  Animal <|-- Dog`;

export const stateMermaid = `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : submit
  Processing --> Done : complete
  Processing --> Error : fail
  Error --> Idle : retry
  Done --> [*]`;

export const ganttMermaid = `gantt
  title Project Timeline
  dateFormat YYYY-MM-DD
  section Phase 1
  Design    :a1, 2026-01-01, 30d
  Develop   :a2, after a1, 60d
  section Phase 2
  Testing   :b1, after a2, 20d`;

export const erMermaid = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE-ITEM : contains
  CUSTOMER {
    string name
    string email
  }
  ORDER {
    int id
    date created
  }`;

export const pieMermaid = `pie title Browser Market Share
  "Chrome" : 65
  "Firefox" : 12
  "Safari" : 10
  "Edge" : 8
  "Other" : 5`;

export const mindmapMermaid = `mindmap
  root((Project))
    Design
      UI
      UX
    Engineering
      Frontend
      Backend
    Testing
      Unit
      Integration`;

// Error cases
export const invalidSyntaxMermaid = `graph TD
  A --> B -->`; // dangling arrow

export const emptyMermaid = '';
export const whitespaceOnlyMermaid = '   \n  \n  ';

export const unknownTypeMermaid = `unknownDiagramType
  node1 --> node2`;

export const clickDirectiveMermaid = `graph TD
  A[Click me] --> B[Target]
  click A "https://example.com"
  click B callback`;

// Complex / stress test
export const complexFlowchartMermaid = Array.from({ length: 50 }, (_, i) => `  N${i} --> N${i + 1}`)
  .join('\n')
  .replace(/^/, 'graph TD\n');

// Multiple diagrams in one markdown document
export const multiDiagramMarkdown = `
# Architecture

\`\`\`mermaid
${flowchartMermaid}
\`\`\`

Some text between diagrams.

\`\`\`mermaid
${sequenceMermaid}
\`\`\`

## Data Model

\`\`\`mermaid
${erMermaid}
\`\`\`
`;

// Mixed content: mermaid + code + images + headings
export const mixedContentMarkdown = `
# Overview

\`\`\`mermaid
${flowchartMermaid}
\`\`\`

## Code Example

\`\`\`typescript
const x: number = 42;
\`\`\`

![diagram](./images/arch.png)

\`\`\`mermaid
${invalidSyntaxMermaid}
\`\`\`

## Summary

Regular paragraph text.
`;
