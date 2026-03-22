# Story 6: Relative Link Navigation

### Summary
<!-- Jira: Summary field -->

Relative markdown links open target files in new tabs; broken links show errors; non-markdown links open with system default handler.

### Description
<!-- Jira: Description field -->

**User Profile:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Following links between related documents.

**Objective:** Clicking a relative markdown link in a rendered document opens the target file in a new tab. Links with anchors scroll to the target heading. Broken links produce a visible error. Non-markdown relative links open with the system's default handler.

**Scope — In:**
- Relative `.md` link click opens target in new tab
- Link-with-anchor opens target and scrolls to heading
- Already-open linked file reuses existing tab
- Broken link click shows inline error or toast
- Non-markdown relative links open via system default handler
- Server endpoint for external file opening (non-markdown links)

**Scope — Out:**
- Link pre-validation during rendering (validation happens on click)
- Remote URL handling (already covered by Story 2 AC-2.7a — external links open in browser)

**Dependencies:** Story 2 (rendered content with clickable links), Story 4 (tab management for opening new tabs and reusing existing ones)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-5.1:** Clicking a relative link to a local `.md` file opens it in a new tab

- **TC-5.1a: Relative link navigation**
  - Given: A rendered document contains a link like `[Design](./design.md)` or `[API](../api/endpoints.md)`
  - When: User clicks the link
  - Then: The linked file opens in a new tab with rendered content
- **TC-5.1b: Link with anchor**
  - Given: A rendered document contains a link like `[Section](./other.md#section-name)`
  - When: User clicks the link
  - Then: The linked file opens in a new tab and scrolls to the target heading
- **TC-5.1c: Already-open linked file**
  - Given: The linked file is already open in a tab
  - When: User clicks the link
  - Then: The existing tab is activated (same reuse behavior as tree clicks)

**AC-5.2:** Broken relative links show an error, not a silent failure

- **TC-5.2a: Link to nonexistent file**
  - Given: A rendered document contains a link to a `.md` file that doesn't exist
  - When: User clicks the link
  - Then: An inline error message or toast indicates the file was not found
- **TC-5.2b: Link rendering**
  - Given: A document contains relative markdown links
  - When: Document is rendered
  - Then: Links to existing files are visually active; links are not pre-validated (validation happens on click)

**AC-5.3:** Non-markdown relative links open in the system browser

- **TC-5.3a: Relative link to non-markdown file**
  - Given: A rendered document contains a link like `[Diagram](./diagram.svg)` or `[Report](./report.pdf)`
  - When: User clicks the link
  - Then: The file is opened using the system's default handler (not inside the viewer)

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Link resolution: when a document at `/a/b/doc.md` links to `../other/file.md`, the target resolves to `/a/other/file.md`. Resolution uses the document's own path as the base. Tech design determines whether the client or server resolves these paths (see epic Tech Design Question 7).

External file opening (AC-5.3) requires a server-side endpoint to invoke the system's default handler. Endpoint shape and security constraints are determined in tech design (see epic Tech Design Question 9). Security consideration: what files can be opened externally (only under root, or any local file)?

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Relative `.md` links open target file in new tab with rendered content
- [ ] Links with anchors open target and scroll to heading
- [ ] Already-open linked files reuse existing tab
- [ ] Broken link click shows visible error (not silent failure)
- [ ] Links render without pre-validation
- [ ] Non-markdown relative links open via system default handler
- [ ] All 6 TCs pass
