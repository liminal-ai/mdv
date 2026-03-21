# Story 5: HTML Export

### Summary
<!-- Jira: Summary field -->

Self-contained HTML export with visual parity to the in-app view, embedded assets, Mermaid diagrams, syntax highlighting, link preservation, and degraded content handling.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user has reviewed a rendered document in the viewer and needs to share it with someone who does not work in markdown — a stakeholder, a compliance reviewer, a client. They need the output in a format the recipient can open without tooling.
- **Mental Model:** "I click Export, pick a format, and get a good file. I don't want to configure anything."
- **Key Constraint:** Export runs locally — no cloud conversion services. Good defaults matter more than configurability. The exported output should closely match what the user sees in the viewer.

**Objective:** A user can export a document to self-contained HTML that opens in a browser and looks close to the in-app rendered view. All CSS, images, and diagrams are embedded or co-located — no external dependencies. Links are preserved. Degraded content (missing images, failed Mermaid) appears with the same fallbacks as the viewer.

**Scope — In:**
- HTML export engine integration
- Self-contained output (CSS inlined/embedded, images as base64 or co-located)
- Visual parity with in-app rendered view
- Mermaid diagrams as inline SVGs or embedded images
- Syntax-highlighted code blocks
- External links preserved as clickable
- Relative markdown links preserved as-is
- Anchor links functional within the exported HTML
- Missing image placeholders in HTML
- Failed Mermaid fallback in HTML

**Scope — Out:**
- Export configuration UI
- Theme/color scheme decisions for HTML (Story 6 — AC-6.2c handles this)
- Content fidelity cross-format validation (Story 6)

**Dependencies:** Story 2

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-5.1:** HTML export is self-contained

- **TC-5.1a: Single-file HTML**
  - Given: A document is exported to HTML
  - When: User opens the HTML file in a browser
  - Then: The document renders correctly with all styling, images, and diagrams visible. No external resources are loaded.
- **TC-5.1b: CSS included**
  - Given: A document is exported to HTML
  - When: User views the HTML source
  - Then: All CSS styles are inlined or embedded in a `<style>` tag — no external stylesheet links
- **TC-5.1c: Images included**
  - Given: A document references local images
  - When: Exported to HTML
  - Then: Images are embedded as base64 data URIs or co-located as files alongside the HTML. The HTML displays correctly when moved to a different directory.

**AC-5.2:** HTML export looks close to the in-app rendered view

- **TC-5.2a: Visual parity**
  - Given: A document is open in the viewer with a specific theme
  - When: Exported to HTML and opened in the same browser
  - Then: Typography, heading sizes, code block styling, table formatting, Mermaid diagrams, and theme colors are visually similar to the in-app view (the active theme is preserved per AC-6.2c). Minor differences in spacing or font rendering are acceptable.
  - Note: The theme preservation behavior itself (AC-6.2c) is validated in Story 6. This TC validates the visual structure independent of the specific theme.
- **TC-5.2b: Mermaid diagrams in HTML**
  - Given: A document has rendered Mermaid diagrams
  - When: Exported to HTML
  - Then: Diagrams appear as inline SVGs or embedded images
- **TC-5.2c: Syntax highlighting in HTML**
  - Given: A document has code blocks with syntax highlighting
  - When: Exported to HTML
  - Then: Code blocks have syntax highlighting in the exported HTML

**AC-5.3:** HTML export preserves links

- **TC-5.3a: External links in HTML**
  - Given: A document contains external hyperlinks
  - When: Exported to HTML
  - Then: Links are clickable and open in the browser
- **TC-5.3b: Relative markdown links in HTML**
  - Given: A document contains relative links to other .md files (e.g., `[Design](./design.md)`)
  - When: Exported to HTML
  - Then: Relative links remain as-is in the HTML (pointing to the relative path). They may or may not resolve depending on whether adjacent files have also been exported. No rewriting is performed.
- **TC-5.3c: Anchor links in HTML**
  - Given: A document contains internal anchor links (e.g., `[Section](#heading)`)
  - When: Exported to HTML
  - Then: Anchor links scroll to the target heading within the exported HTML

**AC-5.4:** HTML export handles degraded content

- **TC-5.4a: Missing images in HTML**
  - Given: A document has missing images
  - When: Exported to HTML
  - Then: Placeholders appear in the HTML (matching the viewer's placeholders)
- **TC-5.4b: Failed Mermaid in HTML**
  - Given: A document has a failed Mermaid block
  - When: Exported to HTML
  - Then: The raw source with error banner appears in the HTML (matching the viewer's fallback)

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

This story integrates HTML export with the pipeline established in Story 2.

The server re-renders from source on disk (A5): reads the markdown file, runs it through the rendering pipeline (markdown-it, Mermaid, syntax highlighting), then wraps the rendered HTML with embedded CSS and base64-encoded images to produce a self-contained output file.

The HTML export format (single file with base64 assets vs. folder with assets directory) is a tech design decision. The save dialog filename defaults to `.html` (see Story 1, AC-1.2).

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] HTML export produces self-contained output (no external dependencies)
- [ ] CSS embedded inline or in `<style>` tags
- [ ] Images embedded as base64 data URIs or co-located
- [ ] Visual output closely matches in-app rendered view
- [ ] Mermaid diagrams appear as inline SVGs or embedded images
- [ ] Code blocks have syntax highlighting
- [ ] External links clickable; relative links preserved as-is; anchor links functional
- [ ] Missing images show placeholders; failed Mermaid shows fallback
- [ ] All 11 TCs pass
- [ ] No regressions in existing Epic 1–3 functionality
