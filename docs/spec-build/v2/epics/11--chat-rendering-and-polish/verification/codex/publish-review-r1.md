# Publish Review R1

## Critical

No critical findings.

## Major

1. Story 3 cannot satisfy `TC-5.4c` within its published scope, so the story set still has an integration/sequencing gap. `story-3-scroll-behavior-and-keyboard-shortcuts.md:22-34` explicitly says panel toggle controls are out of scope for Story 3, but `story-3-scroll-behavior-and-keyboard-shortcuts.md:126-139` still assigns `TC-5.4c`, which requires the developer to hover the panel toggle control. The actual close/toggle controls are introduced in Story 4 (`story-4-ui-polish-panel-toggle-and-error-handling.md:30-34`, `story-4-ui-polish-panel-toggle-and-error-handling.md:104-117`). The publish skill says that if a TC is only exercisable after a later story, the story should carry an explicit note instead of silently implying standalone completeness (`/Users/leemoore/.claude/plugins/cache/liminal-plugins/liminal-spec/0.9.0/skills/ls-publish-epic/SKILL.md:45`). No such note is present, and `stories/coverage.md:130` incorrectly says there are no integration gaps.

## Minor

1. The integration path trace misreferences the theme-switch segment. `stories/coverage.md:118` maps "Developer switches theme" to `Story 1 | TC-1.3a`, but the epic defines theme switching under `TC-1.3b` (`epic.md:183-190`), and the coverage gate already assigns `TC-1.3b` to Story 2 (`stories/coverage.md:11-12`). This is an invalid story/TC reference in the published coverage artifact.

2. The integration path trace uses shorthand TC ranges that are not literal TC identifiers. `stories/coverage.md:85` cites `TC-1.1a–k, TC-1.2a–d`; those strings do not exist as actual TC IDs in the epic or story files. The intent is understandable, but for an accuracy-focused artifact these should be expanded to concrete TC references or replaced with a precise range notation explanation.

## Verified With No Findings

- Exact TC fidelity: all published stories preserve the epic's TC titles and exact Given/When/Then wording. I found no paraphrasing, trimming, or rewording in story AC sections.
- Coverage completeness: all 82 epic TCs appear in exactly one story and in `stories/coverage.md`; no orphaned or duplicated TCs were found.
- Coverage counts: the published artifacts correctly report 27 ACs and 82 TCs.
