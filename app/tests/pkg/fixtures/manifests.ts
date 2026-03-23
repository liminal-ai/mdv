export const FULL_MANIFEST = `---
title: API Reference
version: 1.2.3
author: Docs Team
description: Comprehensive API package manifest
type: reference
status: published
---
- [Overview](overview.md)
- Authentication
  - [Introduction](auth/intro.md)
  - [Login](auth/login.md)
- Endpoints
  - [Users](endpoints/users.md)
  - [Sessions](endpoints/sessions.md)
`;

export const MINIMAL_MANIFEST = `---
title: Quickstart
version: 0.1.0
---
- [Install](install.md)
- [Usage](usage.md)
`;

export const NO_FRONTMATTER_MANIFEST = `- [Overview](overview.md)
- [Setup](setup.md)
- [Usage](usage.md)
`;

export const FLAT_MANIFEST = `---
title: Flat Navigation
version: 1.0.0
---
- [One](one.md)
- [Two](two.md)
- [Three](three.md)
`;

export const NESTED_MANIFEST = `---
title: Nested Navigation
version: 1.0.0
---
- Guides
  - [Start Here](guides/start.md)
  - [Advanced](guides/advanced.md)
- Reference
  - [CLI](reference/cli.md)
`;

export const DEEP_MANIFEST = `---
title: Deep Navigation
version: 1.0.0
---
- Product
  - Guides
    - Getting Started
      - [Install](guides/getting-started/install.md)
      - [Configure](guides/getting-started/configure.md)
`;

export const GROUP_NO_CHILDREN = `---
title: Empty Group
version: 1.0.0
---
- Authentication
- [Overview](overview.md)
`;

export const ORDERED_LIST_MANIFEST = `---
title: Ordered Navigation
version: 1.0.0
---
1. [First](first.md)
2. [Second](second.md)
3. [Third](third.md)
`;

export const EMPTY_LINK_MANIFEST = `---
title: Empty Links
version: 1.0.0
---
- [Overview]()
- [Setup]()
`;

export const NON_MD_LINK_MANIFEST = `---
title: Mixed Assets
version: 1.0.0
---
- [Data Export](exports/report.csv)
- [Whitepaper](docs/whitepaper.pdf)
`;

export const PARAGRAPHS_BETWEEN_LISTS = `---
title: Interleaved Content
version: 1.0.0
---
Introductory paragraph for the package.

- [Overview](overview.md)
- [Setup](setup.md)

Additional notes between list blocks.

- [Reference](reference.md)
`;

export const EMPTY_BODY_MANIFEST = `---
title: Empty Body
version: 1.0.0
author: Example
---
`;

export const INVALID_YAML_MANIFEST = `---
title: Broken
version: "1.0.0
author: Missing quote
---
- [Overview](overview.md)
`;

export const PARAGRAPH_ONLY_MANIFEST = `---
title: Paragraphs Only
version: 1.0.0
---
This manifest has descriptive text only.

There are no list items here.
`;

export const AMBIGUOUS_NAMES_MANIFEST = `---
title: Ambiguous Names
version: 1.0.0
---
- Guides
  - [Overview](guides/overview.md)
- Reference
  - [Overview](reference/overview.md)
`;

export const UNICODE_MANIFEST = `---
title: 国际化文档
version: 1.0.0
author: Zoë
---
- [Résumé](profiles/resume.md)
- [東京ガイド](guides/tokyo.md)
- Café
  - [Crème brûlée](recipes/creme-brulee.md)
`;

export const LARGE_MANIFEST = `---
title: Large Manifest
version: 1.0.0
---
${Array.from({ length: 120 }, (_, index) => {
  const number = String(index + 1).padStart(3, '0');
  return `- [Document ${number}](docs/document-${number}.md)`;
}).join('\n')}
`;
