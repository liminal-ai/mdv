# Story 3: Image Handling

### Summary
<!-- Jira: Summary field -->

Local image rendering with size constraints, placeholder fallbacks for missing/broken/remote images, and warning count in the toolbar status area.

### Description
<!-- Jira: Description field -->

**User Profile:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts. Working with content that includes images, tables, code blocks, and cross-references.

**Objective:** Images referenced in markdown render inline with sensible sizing. Missing, broken, and remote images show visible placeholders. The content toolbar status area displays a warning count summarizing image issues.

**Scope — In:**
- Local image rendering (relative and absolute paths) with size constraints
- Image path resolution relative to the document's directory
- Placeholder for missing/broken images with expected path shown
- Placeholder for unsupported image formats
- Placeholder for blocked remote (http/https) images with URL shown
- Warning count display in content toolbar status area
- Warning detail panel/popover on click

**Scope — Out:**
- Remote image fetching or caching
- Image editing or manipulation
- Non-image file handling

**Dependencies:** Story 2 (rendering pipeline), Story 5 (content toolbar must exist — Story 3 adds warning UI into Story 5's toolbar status area, it does not build the toolbar itself)

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** Local images render inline with sensible size constraints

- **TC-3.1a: Relative path image**
  - Given: A document references an image via relative path (e.g., `![alt](./images/diagram.png)`)
  - When: Document is rendered
  - Then: The image is displayed inline, resolved relative to the document's directory
- **TC-3.1b: Absolute path image**
  - Given: A document references an image via absolute path
  - When: Document is rendered
  - Then: The image is displayed inline
- **TC-3.1c: Image size constraint**
  - Given: An image's natural dimensions exceed the content area width
  - When: Document is rendered
  - Then: The image scales down to fit within the content area width while maintaining aspect ratio
- **TC-3.1d: Small images**
  - Given: An image's natural dimensions are smaller than the content area
  - When: Document is rendered
  - Then: The image renders at its natural size; it is not scaled up

**AC-3.2:** Missing or broken images show a visible placeholder

- **TC-3.2a: Missing image file**
  - Given: A document references an image that does not exist on disk
  - When: Document is rendered
  - Then: A visible placeholder is shown indicating the image is missing, including the expected path
- **TC-3.2b: Unsupported image format**
  - Given: A document references a file that is not a renderable image (e.g., `.pdf`, `.psd`)
  - When: Document is rendered
  - Then: A placeholder is shown with the filename
- **TC-3.2c: Missing image warning**
  - Given: A document has one or more missing images
  - When: Document rendering completes
  - Then: The content toolbar status area shows a warning count reflecting the missing images

**AC-3.3:** Remote images are blocked with a visible indicator

- **TC-3.3a: HTTP/HTTPS image reference**
  - Given: A document references an image via `http://` or `https://` URL
  - When: Document is rendered
  - Then: A placeholder is shown indicating that remote images are not loaded, with the URL visible
- **TC-3.3b: Remote image warning**
  - Given: A document has blocked remote images
  - When: Document rendering completes
  - Then: The warning count includes the blocked remote images

**AC-6.5:** Status area shows warning count when warnings exist

- **TC-6.5a: Warning count display**
  - Given: A document has rendering warnings (missing images, blocked remote images)
  - When: Document is rendered
  - Then: Status area shows a warning count (e.g., "2 warnings")
- **TC-6.5b: Warning count click**
  - Given: Warning count is displayed
  - When: User clicks the warning count
  - Then: A panel or popover lists the individual warnings with details (type, path/URL, line number if available)
- **TC-6.5c: No warnings**
  - Given: A document has no rendering warnings
  - When: Document is rendered
  - Then: No warning indicator is shown in the status area

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

```typescript
interface RenderWarning {
  type: "missing-image" | "remote-image-blocked" | "unsupported-format";
  source: string;         // the image path or URL from the markdown
  line?: number;          // line number in the source markdown, if available
  message: string;        // human-readable description
}
```

Image serving strategy is determined in tech design (server proxy endpoint, static file plugin, or base64 inlining). The key requirement: local images referenced in markdown must reach the browser. Security constraint: no remote fetch, paths validated server-side.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] Relative and absolute path local images render inline
- [ ] Large images scale down to content area width maintaining aspect ratio
- [ ] Small images render at natural size (not scaled up)
- [ ] Missing images show placeholder with expected path
- [ ] Unsupported formats show placeholder with filename
- [ ] Remote images blocked with placeholder showing URL
- [ ] Warning count appears in status area when warnings exist
- [ ] Warning detail panel/popover works on click
- [ ] No warning indicator when no warnings
- [ ] All 12 TCs pass
