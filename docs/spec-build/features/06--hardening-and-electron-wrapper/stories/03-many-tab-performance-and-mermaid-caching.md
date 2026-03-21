# Story 3: Many-Tab Performance and Mermaid Caching

### Summary
<!-- Jira: Summary field -->

20+ open tabs do not degrade performance. Mermaid diagrams are cached to avoid redundant re-rendering on tab switch, mode switch, and theme switch.

### Description
<!-- Jira: Description field -->

**Primary User:** Technical agentic user who keeps many documents open simultaneously while working across specs and documentation.
**Context:** Users keep 20+ tabs open. Tab switching should be instant. Mermaid diagrams are expensive to render (~500ms–1s each) and should not re-render on every tab switch or mode round-trip.

**Objective:** Tab switching remains instant with 20+ tabs. Mermaid SVGs are cached with LRU eviction, keyed by source hash + theme ID. Memory is bounded.

**Scope:**

In scope:
- Verify tab switching performance with 25+ tabs (under 200ms)
- Verify memory reclamation on tab close (file watchers released, tab state garbage-collected)
- Mermaid LRU cache (200 entries max, keyed by FNV-1a hash of source + themeId)
- Cache invalidation on content change, theme switch behavior, tab close cleanup

Out of scope:
- Tab drag-to-reorder (deferred)
- Tab limits or automatic tab management

**Dependencies:** Story 0 complete.

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-3.1:** 20+ open tabs do not degrade switching or rendering performance

- **TC-3.1a: Tab switching with many tabs**
  - Given: 25 tabs are open, each with a different rendered document
  - When: User switches between tabs
  - Then: Tab switching is instant (under 200ms). The previously rendered content appears without re-rendering from scratch.

- **TC-3.1b: Opening additional tabs**
  - Given: 20 tabs are already open
  - When: User opens a 21st document
  - Then: The new tab opens and renders at the same speed as when few tabs were open

- **TC-3.1c: Tab strip with many tabs**
  - Given: 30 tabs are open
  - When: User views the tab strip
  - Then: The tab strip scrolls horizontally without lag. Tab count indicator shows "30 tabs".

**AC-3.2:** Memory usage is bounded with many open tabs

- **TC-3.2a: Memory does not grow unboundedly**
  - Given: User opens 25 tabs, then closes 20 of them
  - When: The closed tabs' resources are released
  - Then: Memory usage decreases after tab closure. Closing tabs reclaims most of their associated memory.

- **TC-3.2b: File watchers released**
  - Given: 25 tabs are open (25 file watchers active)
  - When: User closes 20 tabs
  - Then: 20 file watchers are released, leaving 5 active

**AC-6.1:** Rendered Mermaid diagrams are cached

- **TC-6.1a: Tab switch cache hit**
  - Given: A document with 3 Mermaid diagrams is rendered. User switches to another tab and back.
  - When: The original tab is reactivated
  - Then: The Mermaid diagrams appear immediately from cache without re-rendering

- **TC-6.1b: Mode switch cache hit**
  - Given: A document with Mermaid diagrams is in Render mode. User switches to Edit, then back to Render.
  - When: Render mode is reactivated
  - Then: The Mermaid diagrams appear immediately from cache, provided the markdown source has not changed

- **TC-6.1c: Cache invalidation on content change**
  - Given: A Mermaid diagram is cached
  - When: The document's markdown is modified (edited or auto-reloaded from disk) such that the Mermaid block's source text changes
  - Then: The cached SVG is invalidated and the diagram re-renders from the new source

**AC-6.2:** Theme switch re-renders Mermaid diagrams with the new theme

- **TC-6.2a: Theme change invalidates cache**
  - Given: A document with cached Mermaid diagrams is displayed under a light theme
  - When: User switches to a dark theme
  - Then: Diagrams re-render with dark theme colors. The light-theme SVGs are no longer used.

- **TC-6.2b: Switch back to original theme**
  - Given: User switched from light to dark theme, then back to light
  - When: Light theme is reactivated
  - Then: If the light-theme SVGs are still in the cache, they are reused without re-rendering. If evicted, they re-render.

**AC-6.3:** The cache is bounded and does not grow unboundedly

- **TC-6.3a: Cache eviction**
  - Given: The cache has reached its size limit
  - When: A new Mermaid diagram needs to be cached
  - Then: The least recently used entry is evicted to make room. The evicted diagram will re-render if displayed again.

- **TC-6.3b: Cache cleared on tab close**
  - Given: A tab with cached Mermaid diagrams is closed
  - When: The tab is removed
  - Then: The cache entries associated with that tab are removed from the cache immediately

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**New module:** `client/components/mermaid-cache.ts`

```typescript
interface MermaidCacheEntry {
  sourceHash: string;
  themeId: string;
  svg: string;
  accessedAt: number;
}
```

Global LRU cache, 200 entries max. Key: `fnv1a(source):themeId`. FNV-1a is a fast 32-bit non-cryptographic hash. Cache entries for closed tabs are removed immediately via `invalidateForTab(sources)`.

**Modified module:** `client/components/mermaid-renderer.ts` — check cache before `mermaid.render()`, populate cache after render.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] Tab switching under 200ms with 25 open tabs
- [ ] File watchers released on tab close
- [ ] Mermaid cache hits on tab switch and mode switch (no re-render)
- [ ] Theme switch re-renders diagrams with correct theme
- [ ] Cache bounded at 200 entries with LRU eviction
- [ ] Tab close removes cache entries for that tab
