# Integration Path Trace and Coverage Gate

---

## Integration Path Trace

### Path 1: First Launch → Set Root via Empty State → Browse Files

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Run start command | Server starts, browser opens | Story 1 | TC-1.1a |
| Server binds localhost | Security: localhost only | Story 1 | TC-1.1b |
| App shell renders | Menu bar, sidebar, tab strip, content area | Story 1 | TC-1.1a |
| Empty state displayed | Launch state with Open Folder button | Story 1 | TC-1.3a |
| User clicks Open Folder in empty state | Folder picker appears, user selects folder | Story 3 | TC-9.1c |
| Root updates, file tree refreshes | Markdown files shown in tree | Story 3 | TC-5.1a |
| User expands directory | Children shown | Story 3 | TC-5.2a |
| User sees count badges | Markdown count per directory | Story 3 | TC-5.5a |

### Path 2: Save Workspace → Quit → Relaunch → Switch Workspace

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| User pins current root | Workspace added | Story 2 | TC-4.3a |
| Workspace appears in list | Label and tooltip | Story 2 | TC-3.2a, TC-3.2b |
| User quits app | Session saved | Story 6 | TC-8.1a |
| User relaunches | Session restored | Story 6 | TC-1.2a |
| Workspaces restored | All entries in order | Story 6 | TC-8.1a |
| Root restored | File tree shows | Story 6 | TC-8.2a |
| User clicks different workspace | Root switches | Story 2 | TC-3.3a |
| File tree refreshes | New root's files | Story 3 | TC-5.1a |

### Path 3: Theme Selection → Persistence → Restore

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| User opens View → Theme | Theme submenu | Story 5 | TC-7.1a |
| User selects dark theme | Theme applies instantly | Story 5 | TC-7.2a |
| All chrome updates | No flash | Story 5 | TC-7.2b |
| User quits and relaunches | Theme restored | Story 6 | TC-1.2d |
| Dark theme applied on start | No flash of default | Story 6 | TC-1.2d |

---

## Coverage Gate

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a, TC-1.1b, TC-1.1c | Story 1 |
| AC-1.2 | TC-1.2a, TC-1.2b, TC-1.2c, TC-1.2d | Story 6 |
| AC-1.3 | TC-1.3a, TC-1.3b, TC-1.3c | Story 1 |
| AC-1.4 | TC-1.4a | Story 1 |
| AC-2.1 | TC-2.1a, TC-2.1b, TC-2.1c, TC-2.1d, TC-2.1e | Story 1 |
| AC-2.2 | TC-2.2a, TC-2.2b, TC-2.2c | Story 1 |
| AC-2.3 | TC-2.3a, TC-2.3b | Story 1 |
| AC-2.4 | TC-2.4a, TC-2.4b, TC-2.4c | Story 1 |
| AC-2.5 | TC-2.5a, TC-2.5b | Story 1 |
| AC-3.1 | TC-3.1a, TC-3.1b, TC-3.1c | Story 2 |
| AC-3.2 | TC-3.2a, TC-3.2b, TC-3.2c | Story 2 |
| AC-3.3 | TC-3.3a, TC-3.3b, TC-3.3c | Story 2 |
| AC-3.4 | TC-3.4a, TC-3.4b, TC-3.4c | Story 2 |
| AC-4.1 | TC-4.1a, TC-4.1b | Story 2 |
| AC-4.2 | TC-4.2a, TC-4.2b, TC-4.2c | Story 2 |
| AC-4.3 | TC-4.3a, TC-4.3b | Story 2 |
| AC-4.4 | TC-4.4a | Story 2 |
| AC-4.5 | TC-4.5a, TC-4.5b | Story 2 |
| AC-4.6 | TC-4.6a, TC-4.6b | Story 2 |
| AC-5.1 | TC-5.1a, TC-5.1b, TC-5.1c, TC-5.1d, TC-5.1e, TC-5.1f, TC-5.1g, TC-5.1h | Story 3 |
| AC-5.2 | TC-5.2a, TC-5.2b, TC-5.2c | Story 3 |
| AC-5.3 | TC-5.3a, TC-5.3b, TC-5.3c, TC-5.3d | Story 3 |
| AC-5.4 | TC-5.4a | Story 3 |
| AC-5.5 | TC-5.5a | Story 3 |
| AC-5.6 | TC-5.6a | Story 3 |
| AC-5.7 | TC-5.7a | Story 3 |
| AC-6.1 | TC-6.1a, TC-6.1b | Story 4 |
| AC-6.2 | TC-6.2a, TC-6.2b, TC-6.2c | Story 4 |
| AC-6.3 | TC-6.3a, TC-6.3b, TC-6.3c | Story 4 |
| AC-7.1 | TC-7.1a, TC-7.1b | Story 5 |
| AC-7.2 | TC-7.2a, TC-7.2b | Story 5 |
| AC-7.3 | TC-7.3a | Story 5 |
| AC-7.4 | TC-7.4a | Story 5 |
| AC-8.1 | TC-8.1a | Story 6 |
| AC-8.2 | TC-8.2a, TC-8.2b | Story 6 |
| AC-8.3 | TC-8.3a, TC-8.3b | Story 6 |
| AC-8.4 | TC-7.3a | Story 5 (sole owner) |
| AC-8.5 | TC-3.1c | Story 2 (sole owner) |
| AC-9.1 | TC-9.1a, TC-9.1b, TC-9.1c, TC-9.1d | Story 3 |
| AC-9.2 | TC-9.2a, TC-9.2b | Story 3 |
| AC-10.1 | TC-10.1a | Story 6 |
| AC-10.2 | TC-10.2a | Story 6 |
| AC-10.3 | TC-10.3a, TC-10.3b | Story 6 |

All ACs mapped. All TCs mapped exactly once. AC-8.4 and AC-8.5 are single-owner — Story 5 owns theme persistence (TC-7.3a), Story 2 owns sidebar state persistence (TC-3.1c). Story 6 depends on these but does not re-test them. No orphans.

---

## Validation

- [x] Every AC from the detailed epic appears in the story file
- [x] Every TC from the detailed epic appears in exactly one story
- [x] Integration path trace complete with no gaps
- [x] Coverage gate table complete with no orphans
- [x] Each story has Jira section markers
- [x] Cross-story TC dependencies noted (TC-2.4b → Story 3, TC-2.4c → Story 4, TC-1.3c → Epic 2)
