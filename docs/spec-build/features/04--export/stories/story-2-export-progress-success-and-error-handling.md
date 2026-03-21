# Story 2: Export Progress, Success, and Error Handling

### Summary
<!-- Jira: Summary field -->

Export execution with progress indicator, success notification with reveal-in-Finder, degraded output warnings, export failure errors, and concurrent export prevention.

### Description
<!-- Jira: Description field -->

**User Profile:**
- **Primary User:** Technical agentic user who works with markdown as a primary medium — specs, agent outputs, system documentation, knowledge artifacts.
- **Context:** The user has reviewed a rendered document in the viewer and needs to share it with someone who does not work in markdown — a stakeholder, a compliance reviewer, a client. They need the output in a format the recipient can open without tooling.
- **Mental Model:** "I click Export, pick a format, and get a good file. I don't want to configure anything."
- **Key Constraint:** Export runs locally — no cloud conversion services. Good defaults matter more than configurability. The exported output should closely match what the user sees in the viewer.

**Objective:** After the user confirms the save location (Story 1), the export runs with a visible progress indicator. On completion, the user sees a success notification with the output path and a reveal option, or a failure message with a clear error. Degraded exports show warnings. No partial files are left behind on failure. Concurrent exports are prevented.

**Scope — In:**
- POST /api/export endpoint (full implementation of the request/response flow)
- POST /api/export/reveal endpoint (full implementation)
- Progress indicator during export
- Success notification with file path and "Reveal in Finder" button
- Degraded export notification with warning count and detail list
- Export failure error messages (permission denied, engine failure, disk full)
- Cleanup of partial files on failure
- Concurrent export prevention (Export button disabled during export)
- App recovery after export failure

**Scope — Out:**
- Format-specific rendering engines (Stories 3–5 implement the actual PDF/DOCX/HTML conversion)
- Content fidelity cross-format validation (Story 6)

**Dependencies:** Story 1

### Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-2.1:** An in-progress indicator is visible during export

- **TC-2.1a: Progress indicator appears**
  - Given: User confirmed the save location
  - When: Export is in progress
  - Then: A progress indicator (spinner or progress bar) is visible in the content toolbar or as an overlay. The Export button is disabled to prevent concurrent exports.
- **TC-2.1b: UI remains responsive during export**
  - Given: Export is in progress
  - When: User interacts with the app (switches tabs, scrolls, toggles sidebar)
  - Then: The UI remains responsive; export runs in the background on the server

**AC-2.2:** On success, the app shows the output file path with a reveal option

- **TC-2.2a: Success notification**
  - Given: Export completes without errors or warnings
  - When: Success state is displayed
  - Then: A notification shows the output file path (truncated if long, with full path on hover) and a "Reveal in Finder" button (or equivalent for the platform)
- **TC-2.2b: Reveal in Finder**
  - Given: Success notification is displayed
  - When: User clicks "Reveal in Finder"
  - Then: The system file manager opens with the exported file selected
- **TC-2.2c: Success notification dismissal**
  - Given: Success notification is displayed
  - When: User dismisses the notification (close button or timeout)
  - Then: The notification disappears; the app returns to normal state

**AC-2.3:** On degraded output, the app shows warnings alongside the success path

- **TC-2.3a: Degraded export with missing images**
  - Given: The document has 2 missing images
  - When: Export completes
  - Then: The success notification includes a warning count (e.g., "Exported with 2 warnings") and a way to view the warning details
- **TC-2.3b: Warning detail list**
  - Given: Degraded export notification is displayed
  - When: User expands or clicks the warning count
  - Then: A list shows each warning with type and description (e.g., "Missing image: ./images/diagram.png -- placeholder included in export")
- **TC-2.3c: Degraded export still produces a file**
  - Given: A document has degraded content (missing images, failed Mermaid)
  - When: Export completes
  - Then: The output file is created with placeholders in place of the missing content. The export does not fail — it succeeds with warnings.

**AC-2.4:** On export failure, the app shows a clear error

- **TC-2.4a: Write permission denied**
  - Given: User selected a save path they don't have write permission to
  - When: Export attempts to write the file
  - Then: An error message indicates the file could not be written, with the path shown
- **TC-2.4b: Export engine failure**
  - Given: The PDF/DOCX/HTML generation engine encounters an internal error
  - When: Export fails
  - Then: An error message indicates the export failed, with a description of what went wrong. No partial file is left behind.
- **TC-2.4c: Disk full**
  - Given: The target disk has insufficient space
  - When: Export attempts to write
  - Then: An error message indicates insufficient disk space. No partial file is left behind.

**AC-7.1:** Export errors do not crash the app or leave partial files

- **TC-7.1a: App recovers from export failure**
  - Given: An export fails for any reason (engine error, permission denied, disk full)
  - When: The error is displayed
  - Then: The app is fully functional — the user can retry the export, switch tabs, or continue using the app normally
- **TC-7.1b: No partial files**
  - Given: An export fails mid-write
  - When: The error is handled
  - Then: No partial or corrupted file remains at the save path
- **TC-7.1c: Concurrent export prevention**
  - Given: An export is in progress
  - When: User attempts to start another export
  - Then: The second export is blocked; the Export button remains disabled until the current export completes or fails

### Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Endpoints implemented in this story:

| Method | Path | Request | Success Response | Error |
|--------|------|---------|-----------------|-------|
| POST | /api/export | `ExportRequest` | `ExportResponse` | 400, 403, 404, 409, 500, 507 |
| POST | /api/export/reveal | `{ path: string }` | `{ ok: true }` | 400, 500 |

The `/api/export` endpoint blocks until the export completes. The client shows a progress indicator during the request. HTTP 200 returns a success-only `ExportResponse` (`status: "success"`, `outputPath`, `warnings`). Failures use HTTP error responses rather than an in-band `status: "error"` payload.

Error responses relevant to this story:

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_PATH | Source or save path is not absolute or is invalid |
| 400 | INVALID_FORMAT | Format is not one of: pdf, docx, html |
| 403 | PERMISSION_DENIED | Cannot write to the specified save path |
| 404 | FILE_NOT_FOUND | Source markdown file does not exist |
| 409 | EXPORT_IN_PROGRESS | Another export is already running |
| 500 | EXPORT_ERROR | Export engine failed |
| 507 | INSUFFICIENT_STORAGE | Target disk has insufficient space |

Note: This story implements the export request/response flow and error handling. The actual format-specific rendering engines are plugged in by Stories 3–5. This story may use a stub or minimal engine to validate the end-to-end flow.

*See the tech design document for full architecture, implementation targets, and test mapping.*

### Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] POST /api/export accepts ExportRequest and returns ExportResponse
- [ ] POST /api/export/reveal opens system file manager with file selected
- [ ] Progress indicator visible during export
- [ ] UI remains responsive during export
- [ ] Success notification shows file path and Reveal in Finder button
- [ ] Degraded export shows warning count with expandable detail list
- [ ] Export failure shows clear error message
- [ ] No partial files left on failure
- [ ] Concurrent exports prevented (Export button disabled during export)
- [ ] App fully functional after export failure
- [ ] All 14 TCs pass
- [ ] No regressions in existing Epic 1–3 functionality
