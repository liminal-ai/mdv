# Implementer-Verifier Structural Tension: Multi-Agent Architecture Research

Date: 2026-03-23

---

## Summary

The core pattern that emerges across all research is **context isolation as the primary mechanism for maintaining adversarial tension**. When a verifier shares context with an implementer, it gets captured by the implementer's reasoning and systematically finds the work acceptable. The fix is architectural: spawn the verifier in a fresh context window with access only to the artifact and a specification — never the implementation conversation. The optimal number of tension rounds is 2-3 before diminishing returns, with the strongest gains coming from the first verification pass. For model allocation, Opus for planning/judging and Sonnet for implementation/execution is an emerging standard pattern.

---

## 1. Handoff Design: What to Pass, What to Withhold

### The AgentCoder Principle: Independent Verification

The strongest finding comes from AgentCoder (Huang et al., 2023). Their test designer agent generates tests **without seeing the generated code** — only the task specification. This single design choice improved pass@1 from 61.0% to 87.8% on HumanEval. The mechanism: when tests are generated in the same context as code, they inherit the code's blind spots (e.g., if the code ignores edge cases, co-generated tests ignore them too).

**Actionable pattern for handoff:**

```
VERIFIER RECEIVES:
  - The specification / acceptance criteria (original, not implementer-interpreted)
  - The produced artifact (code, files, diffs)
  - Build/lint/test results (mechanical output, no narrative)

VERIFIER DOES NOT RECEIVE:
  - The implementer's conversation history
  - The implementer's reasoning or planning notes
  - The implementer's self-assessment
  - Any narrative about "what was tricky" or "why I chose X"
```

### Anthropic's Evaluator-Optimizer Pattern

Anthropic's "Building Effective Agents" guide describes the evaluator-optimizer as a two-agent loop where one generates and another evaluates against **predetermined criteria**. The key phrase: evaluation criteria must be established **before generation begins**. This prevents post-hoc rationalization where the evaluator adjusts its standards to match what was produced.

### Structured Verdict Format

From the Verification Gate pattern (Vadim's blog):

```
VERIFICATION: {
  change_id: "E-xxx",
  status: "PASS | WARN | FAIL",
  confidence: 0.0-1.0,
  checks_performed: ["coherence", "convention", "regression", "build"],
  issues: [{
    severity: "critical | warning | info",
    location: "file:line",
    description: "what's wrong",
    expected: "what spec requires"
  }]
}
```

The verdict includes a **counterfactual analysis phase**: for each change, the verifier considers (a) impact if the change weren't applied, (b) blast radius of incorrect application, (c) simpler alternative approaches.

---

## 2. Preventing Verifier Capture by Implementer Framing

### Primary Defense: Context Isolation

The single most important architectural decision. Multiple sources converge on this:

> "When Claude reviews its own work in the same conversation, it suffers confirmation bias — it has internalized its own reasoning and will systematically find the work acceptable. The fix: spawn a new agent via the Task tool with NO access to the original conversation. Give it only the artifact and a critique prompt."

### Secondary Defense: Specification-Anchored Evaluation

The verifier's prompt should anchor to the original specification, not the implementer's interpretation of it. Pattern:

```
You are a verification agent. You have NEVER seen the implementation
process. You are reviewing cold artifacts against a specification.

SPECIFICATION (the source of truth):
[paste original spec / acceptance criteria]

ARTIFACT TO VERIFY:
[paste code / output]

Your job is to find where the artifact DIVERGES from the specification.
Do not explain what the artifact does well. Report only:
1. Specification requirements not met
2. Behavior that contradicts specification
3. Edge cases the specification implies but the artifact ignores
4. Convention violations
```

### Tertiary Defense: Multi-Dimensional Auditing

Run N independent audit passes, each focused on ONE dimension. Each auditor sees only the artifact — not previous audits — to prevent groupthink and anchoring bias. Dimensions might include:

- Correctness against spec
- Edge case coverage
- Convention compliance
- Regression risk
- Performance implications

### Anti-Pattern: Narrative Handoff

Passing the implementer's reasoning to the verifier ("I chose approach X because...") is the fastest way to capture the verifier. The verifier will evaluate the reasoning rather than the artifact, and will be persuaded by plausible-sounding explanations for incorrect behavior.

---

## 3. Optimal Number of Tension Rounds

### Research Consensus: 2-3 Rounds

Multiple sources converge:

- **Debate literature**: Performance at 0 rounds (majority vote): 75%. After 1 round: 83%. After 2 rounds: 87.5%. After 3 rounds: 89%. Rounds 4-5 show diminishing returns or degradation.
- **Ablation studies**: "Three rounds of debate yield the optimal balance between accuracy and efficiency. Excessive debate rounds (4 and 5 rounds) lead to diminished returns, indicating that over-debating can introduce noise or consensus breakdowns."
- **ICLR 2025 blog post**: "We didn't observe obvious trends in performance concerning more agents or more debating rounds" beyond the initial gains. Simple majority voting captures most performance gains; debate rounds provide "only minor additive benefit."
- **ECON approach**: Reduces token usage by 21.4% on average compared to 3-round MAD protocols while maintaining quality, by driving toward Bayesian Nash Equilibrium faster.
- **Blueprint2Code**: Uses up to 5 repair rounds maximum, but falls back to re-planning (not more repair) when exhausted.

### Practical Recommendation

For code implementation/verification tension:

| Round | Purpose | Expected Yield |
|-------|---------|---------------|
| 1 (Implementation) | Implementer produces artifact | Baseline |
| 2 (Verification) | Verifier reviews cold against spec | ~80% of total quality gain |
| 3 (Revision) | Implementer addresses verified issues | ~15% additional gain |
| 4 (Re-verification) | Only if Round 2 found critical issues | ~5% additional gain, diminishing |

**Stop after Round 3 unless Round 2 produced FAIL verdicts on critical items.** Beyond that, you're paying tokens for noise.

### Early Termination Signal

Agreements among agents typically solidify within 2-3 rounds. If the verifier returns PASS or PASS_WITH_WARNINGS on the first check, do not force additional rounds. The adaptive break of debate is required for good performance — over-debating degrades quality.

---

## 4. Pipeline Architecture Patterns

### Pattern A: Opus-Plan / Sonnet-Execute / Opus-Judge (opslane/verify)

Four-stage pipeline:

1. **Bash pre-flight** — Pure shell validation (server liveness, auth) before spending tokens
2. **Opus planning** — Interprets specification, generates check strategies
3. **Parallel Sonnet execution** — Each Sonnet instance controls a Playwright browser agent, executes one acceptance criterion, captures screenshots/recordings
4. **Opus judgment** — Reviews all evidence, returns per-criterion pass/fail

Key isolation: Separate Sonnet instances per criterion (no cross-contamination between checks). Opus never sees implementation conversation — only evidence artifacts.

### Pattern B: Dual Quality Gates (Sagar Mandal)

Two independent quality processes:

- **Implementation Verification**: "Did we build the right thing?" — Checks code against spec, runs test suites, verifies acceptance criteria
- **Experience Validation**: "Does this work from the user's perspective?" — Real browser automation walking user journeys

Neither feeds into the other. Independent failure modes reveal different problem categories. Code changes can trigger validation-only without re-running expensive browser tests.

### Pattern C: AgentCoder Three-Agent Loop

- **Programmer agent**: Generates code from task description
- **Test designer agent**: Generates tests from task description ONLY (never sees code)
- **Test executor agent**: Runs code against tests, returns structured error messages to programmer

The test designer's independence is the structural tension. It tests what the spec says, not what the code does.

### Pattern D: Verification Gate (Vadim)

The Verification Gate is a **read-only agent** in a six-agent pipeline. It:

- Never modifies code or skills
- Only reads, checks, and reports verdicts
- Runs five checks: coherence, cross-skill conflict, convention, regression, build
- Prioritizes false positives over false negatives (rejecting valid changes is better than accepting problematic ones in autonomous systems)
- Performs counterfactual analysis for each change

---

## 5. Model Role Allocation

### Emerging Standard: Opus for Judgment, Sonnet for Execution

The `opusplan` model alias in Claude Code codifies this: Opus for complex reasoning and architecture decisions, Sonnet for code generation and implementation.

Rationale from the research:
- **Opus**: "State-of-the-art software engineering, complex multi-file changes, and agentic workflows." Best for planning, spec interpretation, and verdict synthesis.
- **Sonnet**: "Excellent speed and cost-efficiency" for routine coding. Best for implementation, test execution, and mechanical verification.

### Practical Allocation

| Role | Model | Rationale |
|------|-------|-----------|
| Spec interpretation | Opus | Needs deep reasoning about requirements |
| Implementation | Sonnet | Volume work, well-defined tasks |
| Test generation | Sonnet | Mechanical, spec-driven |
| Cold verification | Opus | Judgment calls, finding subtle divergence |
| Build/lint execution | Neither | Shell scripts, not LLM |
| Final verdict synthesis | Opus | Weighing evidence, confidence calibration |

---

## 6. Concrete Handoff Message Structure

Based on the synthesis of all patterns, here is an actionable handoff template:

### Implementation -> Verification Handoff

```markdown
## Verification Request

### Specification
[Original acceptance criteria, pasted verbatim from spec — NOT the
implementer's interpretation]

### Artifacts to Verify
- Files changed: [list with paths]
- Diff summary: [mechanical diff, no narrative]

### Mechanical Results
- Build: PASS/FAIL [raw output]
- Lint: PASS/FAIL [raw output]
- Tests: X/Y passing [raw output]

### Verification Instructions
You are reviewing these artifacts for the first time. You have no
knowledge of how or why they were built this way.

For each acceptance criterion in the specification:
1. State the criterion
2. Identify the artifact evidence (or lack thereof)
3. Verdict: MET / NOT_MET / PARTIAL / UNTESTABLE
4. If NOT_MET: specific gap description

Do NOT:
- Speculate about implementer intent
- Suggest improvements beyond spec compliance
- Give credit for partial work on failed criteria
```

### Verification -> Revision Handoff

```markdown
## Revision Required

### Failed Criteria
[List of NOT_MET items with specific gap descriptions]

### Passing Criteria (do not modify)
[List of MET items — prevents regression during revision]

### Instructions
Address ONLY the failed criteria. Do not refactor or improve passing
code. When done, report what changed and why for each failed criterion.
```

---

## Sources

### Primary (architectural patterns, high authority)
- [Building Effective Agents — Anthropic](https://www.anthropic.com/research/building-effective-agents) — Evaluator-optimizer pattern
- [Effective Context Engineering for AI Agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Sub-agent isolation, summarized handoffs
- [AgentCoder: Multi-Agent Code Generation](https://arxiv.org/html/2312.13010v3) — Independent test designer, bias prevention through isolation
- [The Agent That Says No: Verification Gate](https://vadim.blog/verification-gate-research-to-practice) — Read-only verifier, structured verdicts, counterfactual analysis

### Secondary (pipeline designs, recent)
- [Agentic Engineering Part 7: Dual Quality Gates](https://www.sagarmandal.com/2026/03/15/agentic-engineering-part-7-dual-quality-gates-why-validation-and-testing-must-be-separate-processes/) — Implementation vs. experience validation separation
- [Spec-Driven Verification for Overnight Coding Agents](https://agent-wars.com/news/2026-03-14-spec-driven-verification-claude-code-agents) — Opus/Sonnet four-stage pipeline
- [Blueprint2Code: Multi-Agent Pipeline](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1660912/full) — Four-agent pipeline with 5-round repair cap
- [Best Practices for Claude Code Subagents — PubNub](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/) — Queue-file handoffs, artifact-based context isolation

### Debate Rounds / Convergence
- [Multi-LLM-Agents Debate — ICLR 2025](https://d2jud02ci9yv69.cloudfront.net/2025-04-28-mad-159/blog/mad/) — No obvious trends beyond initial gains
- [Literature Review of Multi-Agent Debate](https://arxiv.org/html/2506.00066v1) — 3 rounds optimal, 4-5 degrade
- [Improving Factuality through Multiagent Debate](https://composable-models.github.io/llm_debate/) — Original debate framework

### Model Roles
- [Claude Sonnet 4.6 vs Opus — ClaudeLog](https://claudelog.com/faqs/claude-4-sonnet-vs-opus/) — Role allocation guidance
- [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) — Skill isolation via isMeta and contextModifier

---

## Confidence Assessment

- **Overall confidence: HIGH** for the core finding (context isolation is the primary mechanism)
- **HIGH** for round count recommendations (multiple independent sources converge on 2-3)
- **MEDIUM** for specific prompt templates (synthesized from patterns, not validated head-to-head)
- **MEDIUM** for model role allocation (emerging practice, not rigorously benchmarked for verification specifically)
- **Area of uncertainty**: No research directly measures how much the verifier's prompt framing (adversarial vs. neutral) affects catch rates. The recommendation to use adversarial framing ("find where the artifact DIVERGES") is based on the bias prevention literature, not direct A/B testing of verification prompts.
