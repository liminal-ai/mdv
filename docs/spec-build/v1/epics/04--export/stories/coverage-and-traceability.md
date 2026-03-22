# Coverage and Traceability

## Integration Path Trace

### Path 1: Click Export → Select Format → Save Dialog → Export Completes → Reveal in Finder

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Click Export button | User clicks "Export" in content toolbar or menu bar | Story 1 | TC-1.1a, TC-1.1b |
| Format dropdown shown | PDF, DOCX, HTML options appear | Story 1 | TC-1.1a |
| Select format | User clicks a format option | Story 1 | TC-1.1a |
| Save dialog opens | Dialog with default filename and directory | Story 1 | TC-1.2a, TC-1.2b |
| User confirms save path | User accepts or modifies the path | Story 1 | TC-1.2a |
| Progress indicator shown | Spinner/bar visible; Export button disabled | Story 2 | TC-2.1a |
| UI remains responsive | User can switch tabs, scroll during export | Story 2 | TC-2.1b |
| Export engine runs | Format-specific engine produces output | Story 3 (PDF), Story 4 (DOCX), Story 5 (HTML) | TC-3.1a, TC-4.1a, TC-5.1a |
| Success notification | File path shown with Reveal in Finder button | Story 2 | TC-2.2a |
| Reveal in Finder | System file manager opens with file selected | Story 2 | TC-2.2b |
| Last-used dir saved | Export directory persisted for next export | Story 1 | TC-1.4a |

### Path 2: Export Document with Degraded Content → Warnings Shown

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| Document has degraded content | Missing images, failed Mermaid in viewer | Story 6 | TC-6.1a |
| User triggers export | Clicks Export, selects format, confirms save | Story 1 | TC-1.1a, TC-1.2a |
| Export runs with placeholders | Placeholders substituted for missing content | Story 3 (PDF), Story 4 (DOCX), Story 5 (HTML) | TC-3.5b, TC-4.4c, TC-5.4a |
| Export completes with warnings | ExportResponse has status "success" with warnings | Story 2 | TC-2.3a |
| Warning count shown | Notification shows "Exported with N warnings" | Story 2 | TC-2.3a |
| Warning details expandable | User sees type and description per warning | Story 2 | TC-2.3b |
| Output file created | File contains placeholders, not missing content | Story 2 | TC-2.3c |
| Viewer/export consistency | Export placeholders match viewer placeholders | Story 6 | TC-6.1a, TC-6.1b |

### Path 3: Export Fails → Error Shown → Retry

| Path Segment | Description | Owning Story | Relevant TC |
|---|---|---|---|
| User triggers export | Clicks Export, selects format, confirms save | Story 1 | TC-1.1a, TC-1.2a |
| Progress indicator shown | Export in progress | Story 2 | TC-2.1a |
| Export fails | Permission denied, engine error, or disk full | Story 2 | TC-2.4a, TC-2.4b, TC-2.4c |
| Error message shown | Clear description of what went wrong | Story 2 | TC-2.4a |
| No partial file left | Failed write cleaned up | Story 2 | TC-7.1b |
| App recovers | User can retry export or continue using app | Story 2 | TC-7.1a |
| Retry export | User triggers export again successfully | Story 2 | TC-7.1a |

---

## Coverage Gate

Every AC and TC from the epic mapped to exactly one story.

| AC | TC | Story |
|----|-----|-------|
| AC-1.1 | TC-1.1a | Story 1 |
| AC-1.1 | TC-1.1b | Story 1 |
| AC-1.1 | TC-1.1c | Story 1 |
| AC-1.1 | TC-1.1d | Story 1 |
| AC-1.1 | TC-1.1e | Story 1 |
| AC-1.1 | TC-1.1f | Story 1 |
| AC-1.2 | TC-1.2a | Story 1 |
| AC-1.2 | TC-1.2b | Story 1 |
| AC-1.2 | TC-1.2c | Story 1 |
| AC-1.2 | TC-1.2d | Story 1 |
| AC-1.2 | TC-1.2e | Story 1 |
| AC-1.2 | TC-1.2f | Story 1 |
| AC-1.3 | TC-1.3a | Story 1 |
| AC-1.4 | TC-1.4a | Story 1 |
| AC-1.5 | TC-1.5a | Story 1 |
| AC-2.1 | TC-2.1a | Story 2 |
| AC-2.1 | TC-2.1b | Story 2 |
| AC-2.2 | TC-2.2a | Story 2 |
| AC-2.2 | TC-2.2b | Story 2 |
| AC-2.2 | TC-2.2c | Story 2 |
| AC-2.3 | TC-2.3a | Story 2 |
| AC-2.3 | TC-2.3b | Story 2 |
| AC-2.3 | TC-2.3c | Story 2 |
| AC-2.4 | TC-2.4a | Story 2 |
| AC-2.4 | TC-2.4b | Story 2 |
| AC-2.4 | TC-2.4c | Story 2 |
| AC-3.1 | TC-3.1a | Story 3 |
| AC-3.1 | TC-3.1b | Story 3 |
| AC-3.1 | TC-3.1c | Story 3 |
| AC-3.2 | TC-3.2a | Story 3 |
| AC-3.2 | TC-3.2b | Story 3 |
| AC-3.2 | TC-3.2c | Story 3 |
| AC-3.2 | TC-3.2d | Story 3 |
| AC-3.3 | TC-3.3a | Story 3 |
| AC-3.3 | TC-3.3b | Story 3 |
| AC-3.4 | TC-3.4a | Story 3 |
| AC-3.5 | TC-3.5a | Story 3 |
| AC-3.5 | TC-3.5b | Story 3 |
| AC-3.6 | TC-3.6a | Story 3 |
| AC-3.6 | TC-3.6b | Story 3 |
| AC-3.6 | TC-3.6c | Story 3 |
| AC-3.6 | TC-3.6d | Story 3 |
| AC-4.1 | TC-4.1a | Story 4 |
| AC-4.1 | TC-4.1b | Story 4 |
| AC-4.1 | TC-4.1c | Story 4 |
| AC-4.2 | TC-4.2a | Story 4 |
| AC-4.2 | TC-4.2b | Story 4 |
| AC-4.3 | TC-4.3a | Story 4 |
| AC-4.4 | TC-4.4a | Story 4 |
| AC-4.4 | TC-4.4b | Story 4 |
| AC-4.4 | TC-4.4c | Story 4 |
| AC-4.5 | TC-4.5a | Story 4 |
| AC-4.5 | TC-4.5b | Story 4 |
| AC-4.5 | TC-4.5c | Story 4 |
| AC-4.5 | TC-4.5d | Story 4 |
| AC-4.6 | TC-4.6a | Story 4 |
| AC-5.1 | TC-5.1a | Story 5 |
| AC-5.1 | TC-5.1b | Story 5 |
| AC-5.1 | TC-5.1c | Story 5 |
| AC-5.2 | TC-5.2a | Story 5 |
| AC-5.2 | TC-5.2b | Story 5 |
| AC-5.2 | TC-5.2c | Story 5 |
| AC-5.3 | TC-5.3a | Story 5 |
| AC-5.3 | TC-5.3b | Story 5 |
| AC-5.3 | TC-5.3c | Story 5 |
| AC-5.4 | TC-5.4a | Story 5 |
| AC-5.4 | TC-5.4b | Story 5 |
| AC-6.1 | TC-6.1a | Story 6 |
| AC-6.1 | TC-6.1b | Story 6 |
| AC-6.1 | TC-6.1c | Story 6 |
| AC-6.2 | TC-6.2a | Story 6 |
| AC-6.2 | TC-6.2b | Story 6 |
| AC-6.2 | TC-6.2c | Story 6 |
| AC-6.2 | TC-6.2d | Story 6 |
| AC-6.3 | TC-6.3a | Story 6 |
| AC-6.3 | TC-6.3b | Story 6 |
| AC-6.3 | TC-6.3c | Story 6 |
| AC-6.3 | TC-6.3d | Story 6 |
| AC-6.4 | TC-6.4a | Story 6 |
| AC-7.1 | TC-7.1a | Story 2 |
| AC-7.1 | TC-7.1b | Story 2 |
| AC-7.1 | TC-7.1c | Story 2 |
| AC-7.2 | TC-7.2a | Story 6 |
| AC-7.2 | TC-7.2b | Story 6 |
| AC-7.2 | TC-7.2c | Story 6 |
| AC-7.2 | TC-7.2d | Story 6 |

**Coverage summary:**
- 31 ACs -- all mapped
- 86 TCs from epic -- all mapped to exactly one story
- 0 story-derived TCs
- 86 total TCs
- 0 unmapped epic TCs
- 0 AC/TC integration gaps (see Cross-Cutting Concerns below for NFR coverage)

---

## Cross-Cutting Concerns

The epic defines non-functional requirements (performance, reliability, security) that are not individually testable as standalone ACs. These apply across multiple stories and must be verified as part of each story's implementation.

### Performance

| Requirement | Primary Stories | Verification |
|---|---|---|
| Export of a typical document (under 50 pages, under 20 images, under 10 Mermaid diagrams) completes within 30 seconds | Story 3, Story 4, Story 5 | Measured during Stories 3–5 integration |
| Export does not freeze the UI — server handles processing; client remains responsive | Story 2 | TC-2.1b |
| PDF generation of a 5-page document with no images completes within 10 seconds | Story 3 | Story 3 integration test |

### Reliability

| Requirement | Primary Stories | Verification |
|---|---|---|
| Failed exports do not leave partial files at the save path | Story 2 | TC-7.1b |
| Export can be retried immediately after failure without app restart | Story 2 | TC-7.1a |
| Concurrent exports are prevented at the UI level | Story 2 | TC-7.1c |

### Security

| Requirement | Primary Stories | Verification |
|---|---|---|
| Export writes only to the path the user selected in the save dialog | Story 1, Story 2 | Save dialog flow validation |
| No temporary files are left in system temp directories after export completes (success or failure) | Story 2, Story 3, Story 4, Story 5 | Post-export temp directory check |
| Export does not fetch remote resources — remote image placeholders appear as-is | Story 6 | TC-6.1b |

---

## Validation

- [x] Every AC from the epic appears in a story file
- [x] Every TC from the epic appears in exactly one story
- [x] Integration path trace complete with no gaps
- [x] Coverage gate table complete with no orphans
- [x] Each story has Jira section markers
- [x] No TypeScript or code blocks in coverage/traceability (they live in stories)
- [x] NFRs, security requirements mapped to stories as cross-cutting concerns
- [x] Story dependency chains are complete (Story 1 depends on Story 0; Story 2 depends on Story 1; Stories 3, 4, 5 depend on Story 2; Story 6 depends on Stories 3, 4, 5)
