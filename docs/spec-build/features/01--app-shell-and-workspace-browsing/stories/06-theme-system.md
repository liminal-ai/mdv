# Story 5: Theme System

## Summary
<!-- Jira: Summary field -->
Four built-in themes (2 light, 2 dark) selectable from View menu, applied immediately, persisted across sessions.

## Description
<!-- Jira: Description field -->

**User Profile:**
Technical agentic user who customizes appearance. Working across repos and project workspaces, possibly in different lighting conditions.

**Objective:** Deliver the theme system — 4 built-in themes, selectable from the View menu theme submenu, applied instantly to the entire UI, persisted across sessions. The architecture supports adding themes without code changes.

**Scope:**
- In: 4 themes (2 light, 2 dark), View menu theme submenu with current indicator, immediate full-app application, persistence via session API, extensible architecture (new themes = new definitions only)
- Out: Custom user themes (future), theme preview on hover (not required)

**Dependencies:** Story 1 (View menu structure)

## Acceptance Criteria
<!-- Jira: Acceptance Criteria field -->

**AC-7.1:** Four built-in themes are available: 2 light and 2 dark

- **TC-7.1a: Theme list**
  - Given: User opens View menu → Theme submenu
  - When: Submenu opens
  - Then: 4 themes are listed, clearly labeled as light or dark variants
- **TC-7.1b: Current theme is indicated**
  - Given: User views the theme submenu
  - When: Submenu is open
  - Then: The currently active theme has a checkmark or similar indicator

**AC-7.2:** Selecting a theme applies it immediately to the entire app

- **TC-7.2a: Theme applies to all chrome**
  - Given: User is using a light theme
  - When: User selects a dark theme
  - Then: Menu bar, sidebar, tab strip, content area, and all chrome update to the dark theme without page reload
- **TC-7.2b: No flash of default theme**
  - Given: User selects a new theme
  - When: Theme changes
  - Then: Transition is immediate with no flash of the previous theme

**AC-7.3:** Selected theme persists across sessions

- **TC-7.3a: Theme restored on launch**
  - Given: User selected a dark theme and quit the app
  - When: App launches again
  - Then: The dark theme is applied from the start

**AC-7.4:** Adding a fifth theme does not require changes to rendering logic or component code — only a new theme definition

- **TC-7.4a: Theme extensibility**
  - Given: The 4 built-in themes exist
  - When: A new theme is added
  - Then: The new theme appears in the View menu and applies correctly without modifying any code outside of theme definitions

## Technical Design
<!-- Jira: Technical Notes or sub-section of Description -->

Relevant data contracts:

```typescript
type ThemeId = string; // e.g., "light-default", "light-warm", "dark-default", "dark-cool"
```

API endpoint:

| Method | Path | Request | Success Response | Notes |
|--------|------|---------|-----------------|-------|
| PUT | /api/session/theme | `{ theme: ThemeId }` | `SessionState` | Set theme; returns updated session |

Theme persistence also covers AC-8.4 (session persistence of theme selection). TC-7.3a and TC-8.4a are the same test condition.

*See the tech design document for full architecture, implementation targets, and test mapping.*

## Definition of Done
<!-- Jira: Definition of Done or Acceptance Criteria footer -->

- [ ] 4 themes render (2 light, 2 dark)
- [ ] Theme submenu in View menu with current indicator
- [ ] Theme applies instantly to all chrome, no flash
- [ ] Theme persists across sessions
- [ ] Adding a new theme requires only a definition file/entry, no code changes
- [ ] All tests pass
