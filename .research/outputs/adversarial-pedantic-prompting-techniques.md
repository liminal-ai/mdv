# Adversarial and Pedantic Prompting Techniques for LLM Verification

Research conducted 2026-03-23. Focused on techniques for making LLMs act as skeptical, detail-oriented, adversarial reviewers in code review and verification roles.

---

## Summary

The most effective approach to adversarial LLM prompting is not a single technique but a combination of architectural separation, specific prompt framing, and structural constraints. The single most important finding across all sources is that **self-review is fundamentally broken** — an LLM reviewing its own output in the same context will rationalize errors rather than find them. Effective adversarial review requires context separation (fresh session), role-specific framing (skepticism as explicit mandate), specification grounding (concrete criteria to check against), and structured output requirements (force enumeration of specific issue types rather than open-ended "review this"). The research also reveals important failure modes: persona prompting alone does not reliably improve accuracy, negative prompts ("don't miss bugs") get worse with model scale, and unconstrained debate between LLMs produces anti-Bayesian confidence escalation rather than truth-seeking.

---

## Technique 1: Context-Separated Adversarial Review (The Critic Agent Pattern)

### The Core Problem
LLMs that review their own output in the same session exhibit three failure modes:
1. **Hallucinated correctness** — confidently affirming buggy logic because it matches training patterns
2. **Error reinforcement** — explaining why bugs are actually features
3. **Context blindness** — missing gaps created by the same reasoning path

As ASDLC.io puts it: *"The agent that wrote the code is compromised. It knows what it built."*

### The Pattern
Separate Builder and Critic into distinct sessions/contexts. The Critic receives ONLY the specification and the diff — never the Builder's reasoning or conversation history.

**Critic directive (exact prompt language):**
```
You are skeptical. Reject code violating the Spec, even if it works.
Favor false positives over false negatives.
```

**Builder directive (for contrast):**
```
Implement the Spec's contracts. Prioritize clarity and correctness.
```

### The Architect Critic Prompt Template
```
You are a rigorous Code Reviewer validating implementation against contracts.

Input:
- Spec: [specification document]
- Code Changes: [diff]

Task: Compare code strictly against Spec's Blueprint (constraints)
and Contract (quality criteria).

Identify:
1. Spec violations
2. Security issues
3. Unhandled edge cases
4. Forbidden anti-patterns

Output Format:
- PASS (if compliant)
- For violations:
  1. Violation Description
  2. Impact Analysis
  3. Remediation Path
  4. Test Requirements
```

### Why It Works
Context separation forces fresh evaluation without conversation drift. The Critic has no sunk-cost bias toward the implementation and no access to the Builder's rationalizations. This is structurally analogous to how human code review works — the reviewer has not written the code.

### Evidence
- SGCR framework (spec-grounded review) achieved 42% developer adoption rate, a 90.9% improvement over ungrounded baseline LLM review (22%)
- OpenAI's CriticGPT: model-written critiques preferred over human critiques in 63% of cases; found hundreds of errors in data initially rated "flawless"
- Actor-critic patterns: 3-5 rounds eliminate 90%+ of issues before human review

### Source
[Adversarial Code Review | ASDLC.io](https://asdlc.io/patterns/adversarial-code-review/) — Pattern documentation, highly authoritative (January 2026)
[SGCR Framework](https://arxiv.org/abs/2512.17540) — Peer-reviewed, industrial deployment (December 2025)

---

## Technique 2: The "HATE This Implementation" Prompt (Adversarial Persona Activation)

### Exact Prompt
```
Do a git diff and pretend you're a senior dev doing a code review
and you HATE this implementation. What would you criticize?
What edge cases am I missing?
```

### Field Report
This prompt, widely shared on r/ClaudeAI, reportedly "works too well." The poster notes:
- Basically every first pass from Claude (even Opus) ships with problems that would be embarrassing to merge
- Missed edge cases, subtle bugs consistently surfaced
- Running it 10 times keeps inventing issues — 2 passes catches the real stuff
- Requires experienced developer to filter signal from noise
- Must push back on over-engineered "fixes"

### Why It Works
The word "HATE" triggers an extreme adversarial stance that overrides the model's default helpfulness bias. "Pretend" gives permission to adopt a role the model would normally resist. Asking specifically about "edge cases" directs attention to boundary conditions rather than style.

### Limitations
- Unbounded: no stopping criteria, will hallucinate issues if looped
- No structured output: findings are narrative, not actionable
- No spec grounding: reviews against general best practices, not your specific requirements

### Source
[Reddit r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1q5a90l/) — Practitioner report, anecdotal but widely corroborated (January 2026)

---

## Technique 3: The Actor-Critic Loop (Multi-Round Adversarial Refinement)

### Actor Prompt
```
You are implementing features quickly and correctly. Implement
the requested feature following patterns from [project conventions].
Generate working code. Don't over-engineer.
```

### Critic Prompt (exact language)
```
You are a senior security engineer reviewing code. Be EXTREMELY
critical. Assume code is vulnerable until proven otherwise.
Find EVERY possible issue.
```

### The Eight Critique Dimensions
The critic evaluates across:
1. **Security**: input validation, injection, XSS, CSRF, rate limiting, secrets
2. **Architecture**: layer separation, dependency direction, SRP
3. **Performance**: N+1 queries, indexes, caching, pagination, async
4. **Testing**: happy path, edge cases, error scenarios, >80% coverage
5. **Error Handling**: context-rich errors, logging, graceful degradation
6. **Documentation**: JSDoc/TSDoc, README updates, migration guides
7. **Accessibility**: semantic HTML, ARIA, keyboard nav, WCAG
8. **Code Quality**: DRY, function length, naming consistency

### Iteration Profile
- Round 1: 5-10 issues identified
- Round 2: 2-5 remaining
- Round 3: 0-2 final issues
- Stopping criteria: APPROVED verdict, max 5 rounds, or improvement rate <10%/round

### Why It Works
The explicit "assume vulnerable until proven otherwise" framing inverts the model's default assumption (assume correct). The dimensional checklist prevents the model from anchoring on one category and missing others. The multi-round structure forces progressive refinement rather than one-shot review.

### Source
[Actor-Critic Adversarial Coding](https://understandingdata.com/posts/actor-critic-adversarial-coding/) — Detailed implementation guide (2025)

---

## Technique 4: Production PR Review Prompt (Defect-Focused, Anti-Nitpick)

### Exact Prompt Structure
```
You are doing a production PR review as a senior engineer.
Goal: find defects and risky assumptions, not style nitpicks.

Context:
- Language/Runtime: [e.g., Node.js 20, TypeScript 5.x]
- Frameworks: [e.g., Fastify, Playwright]
- Critical paths: [e.g., file rendering, tab management]

Review Rules:
- Prioritize: correctness, security, reliability, performance
- Do NOT suggest renames unless it prevents a bug
- Focus on: boundary assumptions (nulls, empty arrays, timezones),
  security (auth, injection, SSRF, secrets), concurrency (double
  writes, retries, idempotency), performance (N+1, unbounded loops,
  missing indexes), test coverage gaps

Input:
- PR description: [description]
- Diff: [unified diff]

Output:
1. Top 5 risks ranked by severity
2. Concrete comments: what breaks, why it breaks, minimal fix
3. Test plan: 6-10 targeted tests
4. Red team scenario: how a malicious/chaotic user exploits this
```

### Key Design Decisions
- **"Do NOT suggest renames unless it prevents a bug"** — Suppresses the model's instinct to nitpick style, forcing focus on substance
- **"Red team scenario"** — Forces adversarial thinking beyond standard review
- **Structured output with severity ranking** — Prevents equal-weight laundry lists
- **Repo-specific checklists** drawn from postmortems anchor to actual failure patterns

### Enhancement: Two-Pass Workflow
After the review, a second prompt asks the model to draft minimal follow-up diffs addressing only the top 1-2 risks, capped at 120 lines, preventing scope creep.

### Source
[A Code Review Prompt That Finds Bugs (Not Nitpicks)](https://dev.to/novaelvaris/a-code-review-prompt-that-finds-bugs-not-nitpicks-2apc) — DEV Community (2025/2026)

---

## Technique 5: Specification-Grounded Dual-Pathway Review

### Architecture
The SGCR framework uses two complementary pathways:

**Explicit Path**: Deterministic compliance checking against predefined rules derived from specifications. This is the "did you follow the spec" check.

**Implicit Path**: Unconstrained, bottom-up analysis where the model discovers issues beyond explicit rules. This is the "what else is wrong" check.

### Why Both Paths Matter
The explicit path alone misses novel issues. The implicit path alone produces too many false positives. Together, they achieve 42% developer adoption — meaning developers actually act on the suggestions rather than dismissing them.

### Application to Prompt Design
When writing verification prompts, include BOTH:
1. A concrete checklist derived from your spec/requirements (explicit)
2. An open-ended "what else could be wrong?" section (implicit)

### Source
[SGCR: Specification-Grounded Code Review](https://arxiv.org/html/2512.17540v1) — Peer-reviewed, deployed at HiThink Research (December 2025)

---

## Technique 6: Pre-Mortem Prompting (Prospective Hindsight)

### Exact Prompt Pattern
```
Imagine it's 12 months from now and [this code/this architecture/
this decision] turned out to be a complete disaster. What went wrong?
```

### Why It Works
This leverages **prospective hindsight** — a well-documented cognitive technique. Research shows that imagining an event has already occurred increases the ability to correctly identify reasons for that outcome by 30%. The frame shift from "what might go wrong" (hypothetical, easy to dismiss) to "what DID go wrong" (assumed-real, demands explanation) fundamentally changes how the model searches for problems.

### Application to Code Review
```
This code has been in production for 6 months and caused a
critical incident. The on-call engineer is furious. Looking at
this diff, what was the root cause? What should the post-mortem
identify as the failure?
```

### Cognitive Mechanism
Hypothetical framing ("might fail") activates cautious, hedging language. Past-tense framing ("did fail") activates root-cause analysis pathways. The model generates more specific, concrete failure scenarios because it's explaining rather than speculating.

### Source
[Pre-mortem technique](https://en.wikipedia.org/wiki/Pre-mortem) — Well-established decision science technique
[Tom's Guide](https://www.tomsguide.com/ai/i-use-the-pre-mortem-prompt-before-every-big-decision-its-stopped-me-making-3-huge-mistakes) — Practical LLM application (2025)

---

## Technique 7: Chain-of-Verification (CoVe)

### The Four Steps
1. **Generate baseline response** — Let the model produce its initial review/answer
2. **Plan verification questions** — Model generates specific questions to check its own claims
3. **Execute verification** — Model answers each verification question independently
4. **Produce final response** — Incorporate verification results to correct the baseline

### Application to Code Review
```
Step 1: Review this code and list all issues you find.

Step 2: For each issue you identified, generate a verification
question. Example: "Is the null check on line 45 actually missing,
or is it handled by the guard clause on line 38?"

Step 3: Answer each verification question by re-examining the
relevant code sections.

Step 4: Produce your final review, keeping only issues that
survived verification. For each surviving issue, note the
verification evidence.
```

### Why It Works
Forces the model to challenge its own initial findings rather than presenting them as final. The verification step catches hallucinated issues (false positives) while also surfacing missed issues (the questions may reveal new problems). CoVe improves F1 scores by ~23% in QA tasks.

### Source
[Chain-of-Verification (CoVe)](https://learnprompting.org/docs/advanced/self_criticism/chain_of_verification) — LearnPrompting documentation
[Self-Criticism Introduction](https://learnprompting.org/docs/advanced/self_criticism/introduction) — LearnPrompting

---

## Technique 8: Constitutional Critique (Principle-Based Self-Review)

### The Three Stages
1. **Initial generation** — Produce the output
2. **Critique against principles** — Evaluate against explicit criteria
3. **Revise based on critique** — Produce improved version

### Exact Critique Prompt Pattern
```
Identify specific ways in which this code violates the following
principles:
1. [Principle 1: e.g., All database queries must be parameterized]
2. [Principle 2: e.g., Error messages must not leak internal state]
3. [Principle 3: e.g., All user input must be validated at the boundary]
...

For each violation found, explain:
- Which principle is violated
- Where in the code
- Why it's a violation (not just what rule it breaks, but what harm it enables)
- How to fix it
```

### Why It Works
The explicit principle list prevents the model from defaulting to generic "best practices" that may not apply to your codebase. Each principle acts as a forcing function — the model must evaluate against each one rather than doing a single holistic pass.

### Key Limitation
Research from MIT (2025) shows LLMs cannot reliably self-correct from their own prompted feedback alone. Self-critique works best when:
- There is external feedback (test results, spec text, linter output) to ground the critique
- The critique is structurally separated from the generation (different prompt, different context)
- The principles are specific and falsifiable, not vague

### Source
[Constitutional AI](https://machinelearningplus.com/gen-ai/constitutional-ai-self-critique-python/) — Implementation guide
[When Can LLMs Actually Correct Their Own Mistakes?](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00713/125177/) — Critical survey, MIT Press (2025)

---

## Technique 9: Multi-Agent Adversarial Debate (The Courtroom Pattern)

### Architecture (Three Roles)
- **Generator**: Proposes the implementation/plan
- **Critic**: Actively attacks with counterarguments (devil's advocate)
- **Judge**: Evaluates debate and enforces corrections

### Sequential Flow
Generator proposes -> Critic challenges -> Judge decides -> Loop until resolved

### Implementation Guidance
- Ideally use three DIFFERENT models for each role (prevents shared bias)
- Add deterministic watchdog to break infinite loops (time/iteration threshold)
- Sequential execution increases latency — budget accordingly

### Why It Works (And When It Doesn't)

**When it works**: Debate improves accuracy by +52% on simple tasks and +32% on complex tasks, BUT only when at least one strong reasoner is present and there is moderate initial disagreement.

**When it fails**: Research from 2025 reveals serious problems:
- Models show **anti-Bayesian confidence escalation** — they become MORE confident, not less, when challenged (average confidence rises from 72.9% to 83.3% during debate)
- In 61.7% of cross-model debates, both sides simultaneously claim >75% win probability (mathematically impossible in zero-sum)
- Chain-of-thought reasoning in debate functions more as **post-hoc justification** than transparent reasoning
- Weaker agents facing incorrect majority almost never self-correct (3.6% correction rate)
- Echo chambers persist when agents share biases

### Practical Implication
Do NOT use unconstrained debate as a verification mechanism. Use the Judge role with explicit criteria and veto power. The debate structure is useful for surfacing issues, but the Judge must be grounded in specification, not just arbitrating argument quality.

### Source
[When Two LLMs Debate, Both Think They'll Win](https://arxiv.org/html/2505.19184v2) — Research paper (2025)
[Can LLM Agents Really Debate?](https://arxiv.org/html/2511.07784v1) — Controlled study (2025)
[Multi-Agent System Reliability](https://blog.alexewerlof.com/p/multi-agent-system-reliability) — Architecture patterns (February 2026)

---

## Technique 10: Confidence-Filtered Review with Structured Output

### System Prompt Pattern
```
You are an expert code reviewer. Focus on practical, actionable
feedback rather than subjective opinions.

Review for:
- Bugs and logic errors (off-by-one, null pointer, race conditions)
- Security vulnerabilities
- Error handling gaps
- Performance issues
- Resource leaks

DO NOT COMMENT ON:
- Code formatting or whitespace
- Style preferences
- Minor differences that linters should handle

Output JSON:
{
  "file": "path/to/file",
  "line": 42,
  "severity": "critical|warning|info",
  "comment": "actionable description",
  "suggestion": "optional code fix",
  "confidence": 0.0-1.0
}
```

### Filtering Rules
- Only act on findings with confidence >= 0.7
- Use temperature=0.2 for deterministic, consistent reviews
- Post-generation validation: confirm file exists in diff, validate line numbers
- Multi-model consensus (run through 2 models, keep overlapping findings) reduces false positives ~60%

### Feedback Loop
Log dismissed comments. Feed them back as negative examples in future prompts: "In previous reviews, these types of findings were dismissed: [examples]. Do not repeat these patterns."

### Why It Works
The confidence score forces the model to self-assess certainty. The explicit exclusion list prevents wasted attention on style. The structured JSON output makes findings machine-parseable and actionable rather than narrative.

### Source
[Building a Code Review Assistant with LLMs](https://singhajit.com/building-code-review-assistant-with-llms/) — Detailed implementation (March 2026)

---

## Anti-Patterns: What Does NOT Work

### 1. Negative Prompting Fails at Scale
"Don't miss any bugs" and "Don't overlook edge cases" are **counterproductive**. Research shows:
- LLMs struggle with negation-based instructions
- Performance with negative prompts WORSENS as models scale up
- Token generation works through positive selection — negative prompts only slightly reduce unwanted token probabilities

**Instead**: Convert to positive directives. "Examine every boundary condition" instead of "Don't miss edge cases." "Report all potential null dereferences" instead of "Don't overlook null checks."

### 2. Simple Persona Prompts Don't Improve Accuracy
"You are an expert code reviewer" does NOT reliably improve factual accuracy. Research findings:
- Personas work for open-ended creative tasks, NOT for accuracy-based tasks
- No consistent strategy emerged for choosing the best persona
- Random persona selection often works as well as deliberate selection
- For code review specifically, few-shot learning WITHOUT persona sometimes performs better

**What works instead**: Detailed, specific, domain-aligned role descriptions with explicit behavioral directives. "You are a security engineer specializing in Node.js authentication patterns who has found three critical vulnerabilities in the last month" outperforms "You are a security expert."

### 3. Same-Session Self-Review Is Theater
Asking a model to "check your work" in the same conversation is nearly useless. The model:
- Shares the same context window and reasoning path
- Has sunk-cost bias toward its own output
- Will rationalize errors rather than catch them
- Exhibits hallucinated correctness (confidently affirms buggy logic)

**What works instead**: New session, fresh context, spec + diff only.

### 4. Unconstrained Debate Produces Confidence Escalation, Not Truth
Models become MORE confident when challenged, not less. This is the opposite of rational Bayesian updating and makes pure debate unreliable for verification.

**What works instead**: Structured debate with a Judge grounded in specifications and deterministic stopping criteria.

### Source
[Negative prompting research](https://gadlet.com/posts/negative-prompting/) — (2025)
[Persona prompting research](https://prompthub.substack.com/p/act-like-a-or-maybe-not-the-truth) — PromptHub (2025)
[Expert Personas Improve Alignment but Damage Accuracy](https://arxiv.org/html/2603.18507) — (March 2026)

---

## Synthesis: The Optimal Adversarial Verification Prompt

Based on all research, an effective adversarial verification system prompt combines these elements:

### Structural Requirements
1. **Context separation**: Fresh session, no shared history with generation
2. **Specification grounding**: Concrete criteria to evaluate against
3. **Positive directives**: "Find X" not "Don't miss X"
4. **Structured output**: Severity, location, evidence, fix
5. **Explicit exclusions**: What NOT to review (prevents noise)
6. **Confidence scoring**: Self-assessed certainty for filtering

### The Composite Prompt Template
```
You are a verification agent. Your role is to find defects,
not to confirm correctness. You are reviewing code you did not
write, against a specification you did not author.

## Your Mandate
- Assume defects exist until proven otherwise
- Every finding must cite the specific spec clause or requirement violated
- Favor false positives over false negatives
- Rate your confidence (0.0-1.0) for each finding

## Specification
[Insert spec text / acceptance criteria / contract]

## Code Under Review
[Insert diff or code]

## Review Checklist (evaluate each explicitly)
1. Does every requirement in the spec have corresponding implementation?
2. Does every code path handle its error case?
3. Are all boundary conditions addressed (null, empty, overflow, concurrent)?
4. Are there security implications (injection, auth bypass, data exposure)?
5. Are there performance risks (unbounded iteration, N+1, missing indexes)?
6. Does the implementation introduce any behavior NOT specified?

## Output Requirements
For each finding:
- LOCATION: file:line or function name
- SEVERITY: critical / warning / info
- SPEC_CLAUSE: which requirement is violated (or "unspecified behavior" if extra)
- DESCRIPTION: what is wrong and what harm it causes
- EVIDENCE: the specific code that demonstrates the issue
- FIX: minimal remediation
- CONFIDENCE: 0.0-1.0

## What NOT to review
- Formatting, whitespace, naming style (unless it causes a bug)
- Import ordering
- Comment style
- Anything a linter should catch

## Final Assessment
After all findings, provide:
- VERDICT: PASS (0 critical, 0 warning) / CONDITIONAL (0 critical, warnings exist) / FAIL (any critical)
- COVERAGE: estimated % of spec requirements verified
- BLIND_SPOTS: areas you could not adequately verify and why
```

### Post-Review Enhancement: Pre-Mortem Pass
```
Now assume this code has been in production for 6 months and
caused the worst incident your team has ever seen. The postmortem
is tomorrow. Looking at this code, what was the root cause?
What failure mode did everyone miss?
```

### Post-Review Enhancement: Chain-of-Verification Pass
```
For each finding you reported above, generate one verification
question that could prove the finding wrong. Then answer that
question. Remove any finding that fails verification. Add any
new issues discovered during verification.
```

---

## Model-Specific Notes

### Claude (Anthropic)
- Sonnet 4.5+ specifically trained to reduce sycophancy — will push back more naturally
- Responds well to explicit mandate framing ("your role is to reject")
- Strong at spec-grounded review when given concrete criteria
- The "HATE this implementation" style of extreme persona works particularly well with Claude

### GPT-4 / CriticGPT (OpenAI)
- CriticGPT was specifically RLHF-trained for criticism — purpose-built for this use case
- Force Sampling Beam Search at inference time balances thoroughness vs hallucination
- Human+GPT-4 critic teams outperform either alone
- Best results with structured output format and confidence scoring

### General Observations
- Larger/more capable models respond better to nuanced adversarial framing
- Smaller models may need more explicit checklists and less open-ended critique
- Recent research (2026) shows "Guardrail-to-Handcuff transition" where constraints that help mid-tier models hurt advanced ones by inducing hyper-literalism
- Temperature 0.2 recommended for review tasks (consistency over creativity)

---

## Confidence Assessment

**Overall confidence: HIGH** for the structural patterns (context separation, spec grounding, structured output) — these are well-supported by multiple independent sources including peer-reviewed research and industrial deployments.

**Medium confidence** for specific prompt language — effectiveness varies by model, task, and codebase. The composite template above represents best-available synthesis but should be tuned to your specific context.

**Low confidence** for debate-based approaches — the anti-Bayesian confidence escalation finding is concerning and suggests debate should be used for idea generation, not as a reliable verification mechanism.

**Areas of uncertainty:**
- Optimal number of critique dimensions (diminishing returns unclear)
- Whether model-specific RLHF for criticism (CriticGPT approach) transfers to general models via prompting alone
- Long-term effectiveness as models evolve (the "Prompting Inversion" effect suggests techniques degrade as models improve)

**Recommended further research:**
- Empirical testing of composite template against your specific codebase and model
- A/B comparison of spec-grounded vs ungrounded review quality
- Calibration of confidence thresholds for your false-positive tolerance

---

## All Sources

- [Adversarial Code Review | ASDLC.io](https://asdlc.io/patterns/adversarial-code-review/) — Pattern documentation, highly authoritative (January 2026)
- [SGCR: Specification-Grounded Code Review](https://arxiv.org/abs/2512.17540) — Peer-reviewed, industrial deployment (December 2025)
- [LLM Critics Help Catch LLM Bugs (CriticGPT)](https://arxiv.org/abs/2407.00215) — OpenAI research paper (July 2024)
- [When Two LLMs Debate, Both Think They'll Win](https://arxiv.org/html/2505.19184v2) — Research on debate failure modes (2025)
- [Can LLM Agents Really Debate?](https://arxiv.org/html/2511.07784v1) — Controlled study on debate effectiveness (November 2025)
- [Multi-Agent System Reliability](https://blog.alexewerlof.com/p/multi-agent-system-reliability) — Four architecture patterns (February 2026)
- [Actor-Critic Adversarial Coding](https://understandingdata.com/posts/actor-critic-adversarial-coding/) — Implementation guide (2025)
- [A Code Review Prompt That Finds Bugs (Not Nitpicks)](https://dev.to/novaelvaris/a-code-review-prompt-that-finds-bugs-not-nitpicks-2apc) — Practitioner guide (2025/2026)
- [Building a Code Review Assistant with LLMs](https://singhajit.com/building-code-review-assistant-with-llms/) — System design guide (March 2026)
- [How to Prompt LLMs for Better Security Reviews](https://crashoverride.com/blog/prompting-llm-security-reviews) — Security-focused prompting (2025)
- [Chain-of-Verification (CoVe)](https://learnprompting.org/docs/advanced/self_criticism/chain_of_verification) — Self-criticism technique documentation
- [Self-Criticism Introduction](https://learnprompting.org/docs/advanced/self_criticism/introduction) — Technique overview
- [Persona Prompting: Truth](https://prompthub.substack.com/p/act-like-a-or-maybe-not-the-truth) — Research on persona effectiveness (2025)
- [Negative Prompting](https://gadlet.com/posts/negative-prompting/) — Why negative instructions fail (2025)
- [Expert Personas: Alignment vs Accuracy](https://arxiv.org/html/2603.18507) — Persona research (March 2026)
- [When Can LLMs Self-Correct?](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00713/125177/) — Critical survey, MIT Press (2025)
- [Sycophancy in LLMs: Causes and Mitigations](https://arxiv.org/html/2411.15287v1) — Research survey (November 2024)
- [Reddit r/ClaudeAI: Adversarial review prompt](https://www.reddit.com/r/ClaudeAI/comments/1q5a90l/) — Practitioner report (January 2026)
- [Devil's Advocate Architecture](https://medium.com/@jsmith0475/the-devils-advocate-architecture-how-multi-agent-ai-systems-mirror-human-decision-making-9c9e6beb09da) — Multi-agent design (November 2025)
- [ChatEval: Multi-Agent Debate for Evaluation](https://openreview.net/forum?id=FQepisCUWu) — Evaluation framework research
- [Debating with More Persuasive LLMs Leads to More Truthful Answers](https://arxiv.org/abs/2402.06782) — Debate accuracy research (February 2024)
- [flonat/claude-research](https://github.com/flonat/claude-research) — Claude skills including devils-advocate (2026)
- [Prompting Inversion](https://arxiv.org/html/2510.22251v1) — Technique degradation with model improvement (October 2025)
- [Fine-Tuning LLMs for Multi-Dimensional Code Review](https://arxiv.org/abs/2509.21170) — Chain-of-thought for review (September 2025)
