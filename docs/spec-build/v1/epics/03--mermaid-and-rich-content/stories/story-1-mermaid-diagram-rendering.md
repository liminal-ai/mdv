# Story 1: Mermaid Diagram Rendering

### Summary
<!-- Jira: Summary field -->

Mermaid code blocks render as inline SVG diagrams, properly sized and themed, replacing Epic 2's placeholders.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** Reviewing documents that contain architecture diagrams (Mermaid), code samples across multiple languages, and data-heavy tables with nested content. These are real-world files, not pristine samples — some Mermaid will have syntax errors, some code blocks will lack language tags, some tables will have complex cell content.
- **Mental Model:** "I open a doc, the diagrams render, the code is highlighted, the tables look right. If something can't render, I see what went wrong."
- **Key Constraint:** All rendering is local — no remote services. Mermaid diagrams and syntax highlighting must adapt to the active theme (light/dark).

**Objective:** When a user opens a document containing Mermaid code blocks, each valid block renders as an inline SVG diagram. Diagrams fit within the content area, adapt to the active theme, and are static (no interactive features). This replaces Epic 2's placeholder rendering for Mermaid blocks.

**Scope — In:**
- Mermaid code blocks (language tag `mermaid`) render as inline SVG diagrams
- Guaranteed baseline diagram types: flowchart, sequence, class, state, gantt, entity-relationship, pie, mindmap
- Diagram sizing: scale down to fit content area width, render at natural size when smaller, no truncation of tall diagrams
- Theme adaptation: diagrams use appropriate colors for light and dark themes, and update on theme switch
- Multiple Mermaid blocks in one document all render
- Mixed content documents: Mermaid diagrams render inline without affecting surrounding content
- Placeholder replacement: Epic 2's Mermaid placeholders are replaced by rendered diagrams
- Static rendering: click directives stripped, no hover interactivity

**Scope — Out:**
- Mermaid error handling and warning integration (Story 2)
- Syntax highlighting (Story 3)
- Table rendering (Story 4)
- Mermaid editing or live authoring
- Custom Mermaid configuration or user-provided themes
- Diagram accessibility (alt text, ARIA — future enhancement)

**Dependencies:** Story 0, Epic 2 complete

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-1.1:** Mermaid code blocks render as inline diagrams

- **TC-1.1a: Flowchart diagram**
  - Given: A document contains a fenced code block with language `mermaid` containing a flowchart definition
  - When: Document is rendered
  - Then: A flowchart diagram appears inline where the code block was
- **TC-1.1b: Sequence diagram**
  - Given: A document contains a Mermaid sequence diagram
  - When: Document is rendered
  - Then: A sequence diagram renders with actors, messages, and lifelines
- **TC-1.1c: Class diagram**
  - Given: A document contains a Mermaid class diagram
  - When: Document is rendered
  - Then: A class diagram renders with classes, relationships, and labels
- **TC-1.1d: State diagram**
  - Given: A document contains a Mermaid state diagram
  - When: Document is rendered
  - Then: A state diagram renders with states and transitions
- **TC-1.1e: Gantt chart**
  - Given: A document contains a Mermaid gantt chart
  - When: Document is rendered
  - Then: A gantt chart renders with tasks, dates, and sections
- **TC-1.1f: Entity-relationship diagram**
  - Given: A document contains a Mermaid entity-relationship diagram
  - When: Document is rendered
  - Then: An ER diagram renders with entities, attributes, and relationships
- **TC-1.1g: Pie chart**
  - Given: A document contains a Mermaid pie chart
  - When: Document is rendered
  - Then: A pie chart renders with labeled segments
- **TC-1.1h: Mindmap**
  - Given: A document contains a Mermaid mindmap
  - When: Document is rendered
  - Then: A mindmap renders with nodes and branches

**AC-1.2:** Mermaid diagrams are sized to fit within the content area

- **TC-1.2a: Wide diagram scales to fit**
  - Given: A Mermaid diagram's natural width exceeds the content area width
  - When: Document is rendered
  - Then: The diagram scales down to fit within the content area while maintaining aspect ratio
- **TC-1.2b: Small diagram renders at natural size**
  - Given: A Mermaid diagram's natural dimensions are smaller than the content area
  - When: Document is rendered
  - Then: The diagram renders at its natural size; it is not scaled up
- **TC-1.2c: Tall diagram is not truncated**
  - Given: A Mermaid diagram is taller than the viewport
  - When: Document is rendered
  - Then: The full diagram is visible; the user can scroll to see all of it

**AC-1.3:** Mermaid diagrams adapt to the active theme

- **TC-1.3a: Light theme diagram colors**
  - Given: A light theme is active
  - When: A document with Mermaid diagrams is rendered
  - Then: Diagrams use dark lines and text on a light background
- **TC-1.3b: Dark theme diagram colors**
  - Given: A dark theme is active
  - When: A document with Mermaid diagrams is rendered
  - Then: Diagrams use light lines and text on a dark background
- **TC-1.3c: Theme switch updates diagrams**
  - Given: A document with rendered Mermaid diagrams is open
  - When: User switches from a light theme to a dark theme (or vice versa)
  - Then: Diagrams update to match the new theme without requiring a page reload

**AC-1.4:** Multiple Mermaid blocks in one document all render

- **TC-1.4a: Multiple diagrams**
  - Given: A document contains 5 Mermaid code blocks of different types
  - When: Document is rendered
  - Then: All 5 diagrams render correctly in their respective positions
- **TC-1.4b: Mixed content**
  - Given: A document contains Mermaid blocks interspersed with headings, paragraphs, code blocks, and images
  - When: Document is rendered
  - Then: Mermaid diagrams render inline with the rest of the content; surrounding content is unaffected

**AC-1.5:** Mermaid blocks in Epic 2's placeholder state are replaced by rendered diagrams

- **TC-1.5a: Placeholder replacement**
  - Given: Epic 2 rendered Mermaid blocks as placeholders with "diagram rendering not yet available"
  - When: Epic 3 is deployed and a document with Mermaid blocks is opened
  - Then: The placeholders are replaced by actual rendered diagrams; no placeholder text remains for valid Mermaid blocks

**AC-1.6:** Rendered Mermaid diagrams are static — no interactive features

- **TC-1.6a: Click directives stripped**
  - Given: A Mermaid diagram definition includes `click` directives (linking nodes to URLs or callbacks)
  - When: Document is rendered
  - Then: The rendered diagram does not contain clickable links or execute any callbacks; nodes are static
- **TC-1.6b: No hover interactivity**
  - Given: A rendered Mermaid diagram is displayed
  - When: User hovers over diagram nodes
  - Then: No interactive tooltips, popups, or hover effects appear. Standard browser behavior (text selection, right-click) is not blocked.

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Mermaid rendering extends the client-side rendering pipeline established in Epic 2. The rendering library produces SVG output (not canvas), ensuring diagrams can be embedded in PDF, DOCX, and HTML exports in Epic 4.

`MermaidBlockResult` is the contract between the rendering step and the display layer:

```typescript
interface MermaidBlockResult {
  status: "success" | "error";
  svg?: string;              // rendered SVG markup on success
  source: string;            // raw Mermaid source text (always preserved)
  error?: string;            // error message on failure
  diagramType?: string;      // detected type: "flowchart", "sequence", etc.
}
```

Security: Mermaid rendering is sandboxed — diagram definitions cannot execute arbitrary JavaScript. No remote resources are fetched during rendering.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] All 8 guaranteed baseline diagram types render as inline SVG (flowchart, sequence, class, state, gantt, ER, pie, mindmap)
- [ ] Wide diagrams scale down to fit content area; small diagrams render at natural size
- [ ] Tall diagrams are scrollable, not truncated
- [ ] Diagrams adapt to light and dark themes
- [ ] Theme switch updates diagrams without page reload
- [ ] Multiple Mermaid blocks in one document all render
- [ ] Mixed content documents render correctly with Mermaid diagrams inline
- [ ] Epic 2 Mermaid placeholders are replaced by rendered diagrams
- [ ] Click directives are stripped; no hover interactivity
- [ ] Mermaid rendering is sandboxed (no arbitrary JS execution)
- [ ] All 19 TCs pass
- [ ] No regressions in existing Epic 2 functionality
