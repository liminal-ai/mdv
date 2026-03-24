# Epic 13 Publish Review R1

## Critical

None.

## Major

1. Story 5's dependency chain no longer matches the source breakdown or the published dependency graph.

Evidence:
`docs/spec-build/v2/epics/13--package-and-spec-awareness/stories/story-5-spec-awareness.md:36-39` requires Story 3 before Story 5 can start.
`docs/spec-build/v2/epics/13--package-and-spec-awareness/epic.md:1044-1052` sets Story 5's prerequisite to Story 1.
`docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md:651-664` keeps Chunk 5 gated only by Chunk 1.
`docs/spec-build/v2/epics/13--package-and-spec-awareness/stories/coverage.md:164-172` also shows Story 5 branching directly from Story 1, in parallel with the Story 2 -> Story 4 -> Story 3 branch.

Impact:
The published story set is internally inconsistent on sequencing, and a team following Story 5 as written would unnecessarily serialize spec-awareness work behind Story 3, losing the parallel path the epic and tech design both establish.

Recommendation:
Remove Story 3 from Story 5's dependency list, or explicitly update the coverage graph and sequencing rationale everywhere if the dependency change is intentional.

2. Story 4's technical notes point implementers to later Story 3 for shared utilities that belong to the file-operations slice.

Evidence:
`docs/spec-build/v2/epics/13--package-and-spec-awareness/stories/story-4-file-operations.md:165-167` says `atomicWrite(...)` and `markStaleIfExtracted(...)` come "from Story 3".
`docs/spec-build/v2/epics/13--package-and-spec-awareness/stories/coverage.md:166-168` places Story 4 before Story 3 and explicitly says Story 3 requires Story 4.
`docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md:617-646` assigns file creation/editing to Chunk 3 and package operations to later Chunk 4.

Impact:
The technical notes send implementers to the wrong story for shared write-path helpers and contradict the published execution order.

Recommendation:
Remove the "from Story 3" attribution, or restate these as shared `script-executor` utilities introduced with Story 4 and reused by Story 3.

## Minor

1. Story 1 overstates spec-phase injection work that the same story marks as out of scope.

Evidence:
`docs/spec-build/v2/epics/13--package-and-spec-awareness/stories/story-1-package-context-and-indicator.md:24` says the `<workspace-context>` block includes metadata, navigation tree, and spec phase sections.
`docs/spec-build/v2/epics/13--package-and-spec-awareness/stories/story-1-package-context-and-indicator.md:35` says spec phase detection logic integration belongs to Story 5.
`docs/spec-build/v2/epics/13--package-and-spec-awareness/tech-design.md:583-591` scopes Chunk 1 to package context plus indicator, with spec-awareness work broken out later.

Impact:
This blurs the Story 1 / Story 5 boundary and makes Story 1 read as if it already owns spec-phase injection.

Recommendation:
Narrow Story 1's scope wording to metadata + navigation, or explicitly say the block shape is prepared for spec-phase data that is populated in Story 5.

## Checks That Passed

- Coherence/coverage: all 28 ACs and all 90 TCs are assigned exactly once across Stories 1-6. No orphaned or duplicate AC/TC assignments were found.
- TC fidelity: every published TC title and every published Given/When/Then line matches the epic exactly. No paraphrasing, trimming, or rewording was detected.
- Coverage artifact accounting: `coverage.md` correctly reports 28 ACs, 90 TCs, and the per-story 10 / 13 / 21 / 12 / 17 / 17 TC distribution, which sums to 90.
- Story references in the coverage artifact are valid, and the Story 3 / Story 4 vs Chunk 4 / Chunk 3 numbering swap is explicitly documented.
