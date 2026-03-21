# Story 3: Code Syntax Highlighting

### Summary
<!-- Jira: Summary field -->

Code blocks with language tags render with language-aware syntax highlighting that adapts to the active theme.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** Reviewing documents that contain architecture diagrams (Mermaid), code samples across multiple languages, and data-heavy tables with nested content. These are real-world files, not pristine samples — some Mermaid will have syntax errors, some code blocks will lack language tags, some tables will have complex cell content.
- **Mental Model:** "I open a doc, the diagrams render, the code is highlighted, the tables look right. If something can't render, I see what went wrong."
- **Key Constraint:** All rendering is local — no remote services. Mermaid diagrams and syntax highlighting must adapt to the active theme (light/dark).

**Objective:** Code blocks with language tags render with language-aware syntax highlighting, replacing Epic 2's monospace-only rendering. Highlighting colors adapt to the active theme. Code blocks without a language tag or with an unrecognized language continue to render as plain monospace. Highlighting failures degrade silently to monospace — no warnings are produced.

**Scope — In:**
- Language-aware syntax highlighting for code blocks with language tags
- Guaranteed baseline languages: JavaScript, TypeScript, Python, Go, Rust, Java, C, C++, SQL, YAML, JSON, Bash/Shell, HTML, CSS, Markdown, TOML, Dockerfile
- Common language tag aliases (e.g., `js`, `ts`, `py`, `sh`, `yml`)
- Highlighting preserves text content — visual styling only
- Large code blocks (3,000+ lines) render without freezing the UI
- Unknown or missing language tags fall back to plain monospace (same as Epic 2)
- Indented code blocks (4-space, no language tag) render as plain monospace
- Theme adaptation: highlighting colors adapt to light and dark themes
- Theme switch updates highlighting without page reload
- Silent fallback: highlighting engine errors or grammar load failures fall back to monospace without warnings

**Scope — Out:**
- Mermaid rendering (Stories 1–2)
- Table rendering (Story 4)
- Line numbers in code blocks (future enhancement)
- Code block copy-to-clipboard button (future enhancement)

**Dependencies:** Story 0, Epic 2 complete

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** Code blocks with language tags render with syntax highlighting

- **TC-3.1a: JavaScript highlighting**
  - Given: A document contains a fenced code block tagged as `javascript`
  - When: Document is rendered
  - Then: Keywords, strings, comments, and other syntax elements are visually distinguished by color
- **TC-3.1b: Multiple languages in one document**
  - Given: A document contains code blocks in TypeScript, Python, and YAML
  - When: Document is rendered
  - Then: Each block is highlighted according to its language's syntax rules
- **TC-3.1c: Highlighting preserves content**
  - Given: A code block contains specific text
  - When: Syntax highlighting is applied
  - Then: The text content is unchanged — highlighting adds visual styling only, no content modification
- **TC-3.1d: Large code block**
  - Given: A document contains a single code block with 3,000+ lines of code
  - When: Document is rendered
  - Then: The block renders with syntax highlighting without freezing the UI

**AC-3.2:** Common languages are supported

- **TC-3.2a: Core language set**
  - Given: Documents with code blocks tagged as: javascript, typescript, python, go, rust, java, c, cpp, sql, yaml, json, bash, html, css, markdown, toml, dockerfile
  - When: Each document is rendered
  - Then: Each code block has language-appropriate syntax highlighting
- **TC-3.2b: Language tag aliases**
  - Given: Code blocks use common aliases (e.g., `js` for JavaScript, `ts` for TypeScript, `py` for Python, `sh` for Bash, `yml` for YAML)
  - When: Document is rendered
  - Then: Aliases resolve to the correct language and highlighting is applied

**AC-3.3:** Unknown or missing language tags fall back to monospace

- **TC-3.3a: No language tag**
  - Given: A fenced code block has no language specified (bare triple backticks)
  - When: Document is rendered
  - Then: The block renders as plain monospace text with a distinct background (same as Epic 2)
- **TC-3.3b: Unrecognized language**
  - Given: A code block is tagged with an unknown language (e.g., `brainfuck` or `custom-dsl`)
  - When: Document is rendered
  - Then: The block renders as plain monospace text; no error is shown
- **TC-3.3c: Indented code blocks**
  - Given: A code block is created via 4-space indentation (no language tag possible)
  - When: Document is rendered
  - Then: The block renders as plain monospace text (same as Epic 2)

**AC-3.4:** Syntax highlighting adapts to the active theme

- **TC-3.4a: Light theme highlighting**
  - Given: A light theme is active
  - When: A document with code blocks is rendered
  - Then: Highlighting uses colors that are readable on a light background
- **TC-3.4b: Dark theme highlighting**
  - Given: A dark theme is active
  - When: A document with code blocks is rendered
  - Then: Highlighting uses colors that are readable on a dark background
- **TC-3.4c: Theme switch updates highlighting**
  - Given: A document with highlighted code blocks is open
  - When: User switches themes
  - Then: Code highlighting colors update to match the new theme without requiring a page reload

**AC-3.5:** Syntax highlighting failures fall back to monospace without warnings

- **TC-3.5a: Highlighting engine error**
  - Given: A code block is tagged with a supported language but the highlighting engine throws an error during tokenization
  - When: Document is rendered
  - Then: The code block falls back to plain monospace rendering (same as Epic 2). No warning is shown — the content is still fully readable, just unhighlighted. The rest of the document renders normally.
- **TC-3.5b: Grammar fails to load**
  - Given: A code block is tagged with a supported language but the grammar definition fails to load
  - When: Document is rendered
  - Then: The code block falls back to plain monospace rendering. No warning is shown. Other code blocks with different languages are not affected.
  - Note: Syntax highlighting failures are silent fallbacks (monospace is always readable), unlike Mermaid failures which produce a materially different output and warrant warnings.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Syntax highlighting extends the client-side rendering pipeline established in Epic 2. The highlighting library produces structured HTML with CSS-based coloring (not inline bitmap rendering), ensuring exports can include highlighted code in Epic 4.

No new types, API endpoints, or error codes. Syntax highlighting failures do not produce `RenderWarning` entries — they degrade silently to Epic 2's monospace rendering because monospace code is always fully readable.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Code blocks with language tags render with language-aware syntax highlighting
- [ ] All 17 guaranteed baseline languages highlight correctly
- [ ] Common language tag aliases resolve to the correct language
- [ ] Highlighting preserves text content (no content modification)
- [ ] Large code blocks (3,000+ lines) render without freezing the UI
- [ ] Unknown and missing language tags fall back to plain monospace
- [ ] Indented code blocks render as plain monospace
- [ ] Highlighting adapts to light and dark themes
- [ ] Theme switch updates highlighting without page reload
- [ ] Highlighting engine errors and grammar load failures fall back to monospace silently
- [ ] All 14 TCs pass
- [ ] No regressions in existing Epic 2 functionality
