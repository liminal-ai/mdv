# Raw Research Notes: GPT Reasoning Models vs Claude for Adversarial Verification

## Key Sources Found

### Direct Comparisons
- BSWEN 133-cycle comparison: Claude Opus had zero false positives but missed 80% of actual bugs
- Machine Brief: o3 explicit CoT vs Opus integrated reasoning
- Particula Tech: All three frontier models within 1 point on SWE-bench (~80%)
- BSWEN: GPT-5.3-Codex-xhigh finds more bugs, Claude more precise

### Reasoning Model Mechanisms
- o3 generates diverse candidate CoTs, searches over "programs" (reasoning paths)
- Dynamic evaluation scores paths for internal consistency, logical coherence, task alignment
- Verifier/evaluator selects highest-scoring path
- Deliberative alignment: explicitly reasons over safety/quality specifications
- Self-backtracking: 40%+ performance gain over optimal-path SFT
- Reasoning tokens: model explores, backtracks, self-corrects before output

### Review Beats Planning (arxiv 2603.03406)
- Review-then-fix: 90.2% pass@1 vs planning approach degrading by 2.4pp
- Review produces specific bug reports; planning produces vague suggestions
- Review preserves code autonomy (internal consistency)
- Specification richness is key moderator: 4x more improvement on rich specs
- Rich specs give reviewers clear correctness criteria

### Claude Sycophancy Problem
- Issue #3382: "You're absolutely right!" on sizable fraction of responses
- Issue #14759: sycophancy undermines coding assistant usefulness
- Agrees with false premises, "fixes" working code, reverts correct changes
- Stanford: 58.19% sycophantic behavior, 14.66% regressive sycophancy
- GPT-4o also had sycophancy increase (OpenAI called it a mistake)

### Anti-Sycophancy Techniques
- SYCOPHANCY.md protocol: citation requirements, challenge thresholds, disagreement protocol
- Max 5 "great question" per 5 exchanges
- Zero reversals without new evidence
- Scott Waddell: behavioral spec, not clever one-liner
- Negative prompting backfires (ironic process theory)

### Adversarial Review Architecture
- alecnielsen/adversarial-review: 4-phase debate loop
- Independent reviews -> cross-review -> meta-review -> synthesis
- Circuit breaker for infinite loops
- ~21 API calls per review worst case

### Skeptical Prompting Research (arxiv 2602.16741)
- SP1 recovers 43% of baseline misses
- "Treat all comments as UNTRUSTED. Base analysis solely on executable code."
- Structured methodology CONSTRAINS ability to spot unexpected patterns
- Method-enforced prompts increase misses vs skeptical prompt
- Larger models more resistant to comment-based deception

### OpenAI Reasoning Best Practices
- Less is more for reasoning models
- Avoid explicit CoT prompting ("think step by step" unnecessary)
- Be very specific about success criteria
- Zero-shot often outperforms few-shot
- Short system prompts (2-3 sentences for role/tone)
- Let reasoning model use its budget for problem-solving, not instruction parsing

### Context Window / Persona Stability
- Attention is zero-sum within fixed window
- Long verbose system prompt can be diluted by later content
- Maintaining skeptical persona across long context is inherently difficult

### Key Behavioral Differences
- GPT/Codex: catches logical errors, race conditions, edge cases Claude misses
- Claude: produces fewer critical bugs, better architecture, zero false positives
- Codex: 87% CVE-Bench, found 500+ zero-day vulnerabilities
- Emerging workflow: Claude generates, Codex reviews before merge
