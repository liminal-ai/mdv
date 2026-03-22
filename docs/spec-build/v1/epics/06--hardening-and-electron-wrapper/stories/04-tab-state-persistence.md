# Story 4: Tab State Persistence

### Summary
<!-- Jira: Summary field -->

Open tabs, active tab, and per-tab mode persist across app restarts. Lazy loading on restore. Incremental persistence for crash recovery.

### Description
<!-- Jira: Description field -->

**Primary User:** Technical agentic user who keeps multiple documents open across work sessions.
**Context:** Tab persistence infrastructure already exists (`openTabs: string[]`, `activeTab`, `syncTabsToSession()`, `restoreTabsFromSession()`). This story extends the persisted shape to include per-tab mode and scroll position, and specifies the restore behavior including lazy loading.

**Objective:** Tabs survive app restart with correct modes. Active tab loads eagerly, others lazily. Missing files show error state. Persistence is incremental (survives crashes).

**Scope:**

In scope:
- Extend `syncTabsToSession()` to send `PersistedTab[]` (path + mode + scrollPosition)
- Extend `restoreTabsFromSession()` to use `PersistedTab` objects with per-tab mode
- Active tab loads eagerly, other tabs load lazily on switch
- Missing file tabs show "file not found" state (consistent with Epic 2 AC-7.3)
- Dirty tabs are not persisted — the quit modal is the safety net
- Verify incremental persistence (already calls `syncTabsToSession()` on every open/close)

Out of scope:
- Edit content persistence (unsaved edits are lost on restart — by design)
- Electron-specific quit flow (Story 6)

**Dependencies:** Story 0 complete (PersistedTab schema).

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-11.1:** Open tabs are restored on app restart

- **TC-11.1a: Tabs restored**
  - Given: User had 5 tabs open with document A active
  - When: App is quit (clean — no dirty tabs) and relaunched
  - Then: The same 5 tabs appear in the tab strip. Document A is the active tab.

- **TC-11.1b: Active tab loads eagerly, others lazy**
  - Given: 10 tabs are restored
  - When: App launches
  - Then: The active tab's content loads and renders immediately. Other tabs show in the tab strip but their content loads only when the user switches to them.

- **TC-11.1c: Tab mode restored**
  - Given: Tab A was in Edit mode, Tab B was in Render mode
  - When: App restarts
  - Then: Tab A opens in Edit mode, Tab B in Render mode

- **TC-11.1d: Missing file on restore**
  - Given: A persisted tab points to a file that was deleted since the last session
  - When: App launches
  - Then: The tab appears with a "file not found" indicator (consistent with Epic 2 AC-7.3). Other tabs load normally.

**AC-11.2:** Dirty tabs are not persisted — the quit modal is the safety net

- **TC-11.2a: Quit with unsaved changes**
  - Given: 5 tabs are open, 2 of which have unsaved changes. The user confirms Discard All and Quit.
  - When: App relaunches
  - Then: All 5 tabs appear (including the 2 that were dirty). Content is loaded from disk — the unsaved edits are gone. No dirty indicators.

- **TC-11.2b: Save All and Quit persists saved state**
  - Given: 2 tabs had unsaved changes and the user chose Save All and Quit
  - When: App relaunches
  - Then: All tabs appear. The 2 previously-dirty files show their saved content.

**AC-11.3:** Tab list is persisted on every tab open and close, not only at quit

- **TC-11.3a: Crash recovery**
  - Given: User has 5 tabs open. The app crashes (or the browser tab is forcefully closed).
  - When: App relaunches
  - Then: The 5 tabs are restored. The crash did not lose the tab list because it was persisted incrementally, not just at quit time.

- **TC-11.3b: Browser tab close**
  - Given: User is running the browser-based app with 5 tabs open
  - When: User closes the browser tab (bypassing `beforeunload` or confirming the prompt)
  - Then: On next launch, the 5 tabs are restored because tab state was persisted on every tab open/close event.

**AC-4.1:** App is ready to use within 3 seconds of launch (tab restore portion)

- **TC-4.1c: Startup with restored tabs**
  - Given: The user previously had 10 tabs open (tab persistence enabled)
  - When: App launches
  - Then: Tab strip shows the 10 tabs. The active tab's content loads first. Other tabs load lazily (content fetched when the user switches to them).

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

**Session State extension:**

```typescript
interface PersistedTab {
  path: string;
  mode: "render" | "edit";
  scrollPosition?: number;
}

// SessionState.openTabs changes from string[] to PersistedTab[]
// SessionState.activeTab remains string | null
```

**Server:** `PUT /api/session/tabs` request schema updated to accept `PersistedTab[]`. No tab healing on load — all persisted tabs returned regardless of file existence. Client handles 404 on load.

**Client:** `syncTabsToSession()` sends `PersistedTab` objects. `restoreTabsFromSession()` creates loading tabs with `persisted.mode` and loads active tab eagerly.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] `npm run verify` passes
- [ ] Tabs restored on restart with correct active tab
- [ ] Per-tab mode restored (edit/render)
- [ ] Active tab loads eagerly, others lazy
- [ ] Missing file tab shows "file not found" state
- [ ] Dirty tabs not persisted — edits lost on restart
- [ ] Crash recovery: tabs survive unexpected exit
- [ ] Startup with 10 restored tabs within target
