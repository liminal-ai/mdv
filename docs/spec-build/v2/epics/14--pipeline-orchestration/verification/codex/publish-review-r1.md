# Epic 14 Published Stories Review — Round 1

## Findings

### Critical

No critical findings.

### Major

1. `coverage.md` contradicts the published story set on who owns `TC-2.4c`, which breaks the artifact's own "exactly one story" claim.

- The published story body assigns `TC-2.4c` to Story 3 in [story-3-pipeline-phase-dispatch.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/stories/story-3-pipeline-phase-dispatch.md#L126).
- The coverage gate reassigns the same TC to Story 4 in [coverage.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/stories/coverage.md#L49), and the summary/note repeat that split in [coverage.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/stories/coverage.md#L106) and [coverage.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/stories/coverage.md#L112).
- The source chunk breakdown keeps `TC-2.4a–TC-2.4c` under Chunk 2 / Story 3 in [tech-design.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/tech-design.md#L635), while the test plan places the test for `TC-2.4c` in Chunk 3 in [test-plan.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/test-plan.md#L447).
- Test location and story ownership are different concepts. As published, the stories say Story 3 owns the TC, but the coverage artifact says Story 4 does.

Fix direction: either move `TC-2.4c` out of Story 3 and into Story 4 consistently, or keep it owned by Story 3 and rewrite the coverage summary/note to say it is tested in Story 4 while still owned by Story 3.

### Minor

1. The integration trace cites the wrong TC for prerequisite-failure behavior.

- [coverage.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/stories/coverage.md#L126) says "Missing inputs produce error" but points to `TC-2.3c`.
- In the epic source, `TC-2.3c` is the success case ("All prerequisites met"). The missing-prerequisite cases are `TC-2.3a`, `TC-2.3b`, and `TC-2.3d`.

2. The integration trace cites the wrong story/TC for "partial output not added to manifest."

- [coverage.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/stories/coverage.md#L167) maps "No manifest update on failure / Partial output not added" to Story 4 / `TC-3.7d`.
- The coverage gate itself maps the manifest exclusion behavior to Story 2 / `TC-5.2b` in [coverage.md](/Users/leemoore/code/md-viewer/docs/spec-build/v2/epics/14--pipeline-orchestration/stories/coverage.md#L92).
- `TC-3.7d` is only about `specPhase`/`specStatus` not advancing on failure or cancellation, not about partial output being omitted from the manifest.

## Quick Verification

- Coherence: story sequence, dependencies, and technical sections are otherwise coherent. Story references are valid, and the chunk/story progression still matches the source design.
- Completeness: all 26 epic ACs appear in the published stories, and all 87 epic TCs appear in the story set with no orphan or extra TCs.
- TC fidelity: I found no Given/When/Then wording drift in the story files. The published TC blocks match the epic source exactly.
- Accuracy: the main remaining problems are traceability inaccuracies inside `coverage.md`, especially the ownership drift around `TC-2.4c`.

## Verdict

**FAIL**

The published story files are text-faithful to the epic, but the coverage artifact is not yet reliable as the source of story ownership and integration traceability.
