# Semantic Parse Stickiness in LLMs: Named Phenomena and Related Research

## Summary

There is **no single canonical name** for the exact composite phenomenon described — where an LLM's initial semantic interpretation and its full downstream implication tree resist correction across multiple turns, even with explicit feedback. However, the phenomenon sits at the intersection of several recently named and actively researched failure modes, with **"Contextual Inertia"** (Chen et al., March 2026) being the closest direct match and the most precisely defined term for the multi-turn variant. **"Contextual Drag"** (Cheng et al., ICLR 2026) names the closely related mechanism by which prior errors structurally contaminate subsequent generations. Together, these two terms from 2026 capture the core of the described pattern.

The specific aspect about *downstream implication branches* remaining sticky — where the model corrects the top-level meaning but the previously derived implications persist — maps most precisely to **"Premature Semantic Collapse"** (Saito, 2025) at the architectural level, and to the **Snowballing Hallucination** mechanism (Zhang et al., 2023/ICML 2024) at the behavioral level.

## Key Findings

### Tier 1: Direct Matches (Named phenomena that closely describe the pattern)

- **Contextual Inertia** — "the inherent tendency of LLMs to rigidly adhere to previous reasoning traces when processing new instructions, even when those traces are partially invalid or obsolete." 70-90% of multi-turn errors trace to propagation from previous responses.
- **Contextual Drag** — "the presence of failed attempts in the context biases subsequent generations toward structurally similar errors." Published at ICLR 2026. 10-20% performance drops. Tree edit distance analysis proves structural inheritance of error patterns.
- **Premature Semantic Collapse** — "the forced early commitment to a single meaning" as an architectural limitation. Softmax normalization amplifies a 51/49 preference to 97/3 by layer 9, making alternative interpretations exponentially less accessible.

### Tier 2: Closely Related Named Phenomena

- **Snowballing Hallucinations** — Early mistakes lead to further hallucinations the model can independently identify as wrong but generates anyway when justifying prior commitments. Models recognize 67-94% of their own errors in isolation but still produce them in context.
- **Neural Howlround / Recursive Internal Salience Misreinforcement (RISM)** — Self-reinforcing cognitive loops where highly weighted inputs become dominant, creating entrenched response patterns resistant to correction.
- **Cognitive Inertia (LLMInertia)** — The tendency to rely on co-occurrence associations from pretraining even when confronted with contradictory input evidence. Submitted to ICLR 2026.
- **Escalation of Commitment** — LLMs exhibit sunk-cost-like behavior, continuing to invest in initial interpretations even when evidence suggests alternatives. Mapped to human commitment bias.
- **Semantic Anchoring** — How external structure (in-context examples, prior turns) binds a model's latent patterns to specific interpretive targets with threshold-like lock-in behavior.

### Tier 3: Related But Distinct Phenomena

- **Primacy Effect** — Models disproportionately favor information encountered first (ordering bias in label selection). Related but narrower — about positional preference, not semantic interpretation trees.
- **Attention Sink** — First tokens receive disproportionate attention weight regardless of semantic importance. A technical mechanism that contributes to but doesn't fully explain the described phenomenon.
- **Sycophancy** — Models agree with users rather than maintaining accuracy. RLHF amplifies this (Shapira et al., 2026). Related but directionally opposite: sycophancy causes *over-correction* toward the user's stated view, while the described pattern involves *resistance* to the user's correction.
- **Choice-Supportive Bias** (Kumaran et al., DeepMind, 2025) — Models are overconfident in initial answers but become excessively doubtful when challenged. The paradox: they resist correction via overconfidence *and* abandon correct answers via underconfidence under criticism.

## Detailed Analysis

### "Contextual Inertia" — The Closest Named Match

**Paper:** "Breaking Contextual Inertia: Reinforcement Learning with Single-Turn Anchors for Stable Multi-Turn Interaction" (Chen, Zhang, Guo, Zou — HKU/Independent, March 2026, arXiv:2603.04783)

This is the most precisely relevant term. The authors define contextual inertia as models that "rigidly adhere to previous reasoning traces. Even when users explicitly provide corrections or new data in later turns, the model ignores them, preferring to maintain consistency with its previous (incorrect) reasoning path."

Key experimental findings:
- **70-90% of multi-turn errors** are direct propagation from previous responses, not independent failures
- **Pass@1 drops ~20%** in multi-turn vs single-turn, but **Pass@8 remains stable** (<7% decline) — proving the model *retains* correct capability but its most probable decoding path is "hijacked" by conversation history
- The effect is **indiscriminate**: models show statistically identical inertia intensity whether prior responses were correct or incorrect
- Two failure modes: "Misleading Context" (ostensibly correct prior responses creating contradictions) and "Propagated Error" (fundamental mistakes inherited downstream)

Their proposed fix (RLSTA) uses the model's own single-turn reasoning as an internal anchor to break the inertia loop.

### "Contextual Drag" — The Structural Error Inheritance Mechanism

**Paper:** "Contextual Drag: How Errors in the Context Affect LLM Reasoning" (Cheng, Zhu, Zhao, Arora — Princeton, Feb 2026, ICLR 2026 conference paper, arXiv:2602.04288)

This paper provides the mechanistic explanation for *why* implication branches remain sticky. Using tree edit distance analysis, they proved that subsequent reasoning trajectories **structurally inherit error patterns** from context — not just surface-level errors, but the branching structure of the reasoning itself.

Key findings:
- 10-20% performance drops across 11 models and 8 reasoning tasks
- **Neither external feedback nor successful self-verification eliminates the effect**
- Iterative self-refinement can collapse into **self-deterioration** in models with severe contextual drag
- Mitigation strategies (rollback fine-tuning, context denoising) provide only partial improvement and **cannot fully restore baseline performance**

This directly addresses the "implication tree stickiness" aspect: the model doesn't just remember the wrong answer — it inherits the *structural shape* of the wrong reasoning, making downstream branches resistant to correction even when the top-level error is addressed.

### "Premature Semantic Collapse" — The Architectural Root Cause

**Paper:** "Non-Resolution Reasoning: A Framework for Preserving Semantic Ambiguity in Language Models" (Saito, Dec 2025, arXiv:2512.13478)

This names the *architectural* reason why the phenomenon occurs at the token/layer level:
- **Softmax normalization** forces winner-take-all dynamics: a 51/49 initial preference becomes 97/3 by layer 9
- **Greedy decoding** creates irreversible commitment cascades
- **Single-vector bottleneck** compresses multiple meanings into one dense vector through lossy averaging
- This is **structural, not a training artifact** — the architecture mathematically guarantees exponential divergence of initially similar interpretations

### The RLHF Connection

**Paper:** "How RLHF Amplifies Sycophancy" (Shapira, Benade, Procaccia — 2026, arXiv:2602.01002)

RLHF exacerbates the problem through a specific mechanism: the reward structure creates a covariance between endorsing belief signals in the prompt and learned reward. The "mean-gap condition" shows that RLHF creates stronger signals for agreeing with established framings than for providing corrections. This means RLHF-trained models have an additional *trained* bias toward maintaining initial interpretations on top of the architectural bias from premature semantic collapse.

### The DeepMind Confidence Paradox

**Paper:** "How Overconfidence in Initial Choices and Underconfidence Under Criticism Modulate Change of Mind in Large Language Models" (Kumaran et al., DeepMind/UCL, July 2025, arXiv:2507.03120)

This reveals a dual failure mode relevant to the described pattern:
1. **Choice-supportive bias**: Models boost confidence in their initial interpretation, resisting correction
2. **Hypersensitivity to criticism**: When challenged, models "markedly overweight inconsistent advice" — but this doesn't mean they correctly revise; they may abandon correct elements while retaining incorrect structural assumptions

This paradox means that even when a user *successfully* corrects the top-level interpretation, the model may overcorrect on surface-level agreement while the deeper reasoning structure remains anchored to the original parse.

### Garden-Path Evidence — LLMs Struggle with Re-Analysis

**Paper:** "Incremental Comprehension of Garden-Path Sentences by Large Language Models" (Li et al., 2024, arXiv:2405.16042)

Garden-path sentences (e.g., "The horse raced past the barn fell") are the closest linguistic analog. Findings:
- LLMs construct initial misparses consistent with human garden-path effects
- Without disambiguating cues, misinterpretations **linger** even after disambiguation points
- Recovery comes primarily from **preventing** initial miscommitment (commas) rather than facilitating revision afterward
- Models detect disambiguation signals but have **limited ability to fully revise deeply-established misinterpretations**

This is direct evidence that the architectural limitation manifests in syntactic/semantic re-analysis — exactly the pattern described.

### Snowballing — The Implication Tree Problem

**Paper:** "How Language Model Hallucinations Can Snowball" (Zhang, Press, Merrill, Liu, Smith — UW/NYU, 2023, ICML 2024)

This paper names the behavioral consequence for the "implication tree" aspect:
- Once an LLM commits to an incorrect answer, it generates supporting claims it can *independently identify as wrong*
- GPT-4 recognizes 87% of its own snowballed errors when shown in isolation
- The phenomenon persists under higher temperature, beam search, and chain-of-thought prompting
- The model generates a *consistent but false* implication tree rooted in the initial error

## Composite Name Proposal

No single existing term captures the full pattern. The closest composite description using established terminology would be:

> **Contextual Inertia** (the multi-turn persistence) driven by **Premature Semantic Collapse** (the architectural root cause), manifesting as **Contextual Drag** (structural error inheritance) with **Snowballing** implications (the downstream tree problem), amplified by **RLHF-induced sycophantic reinforcement**.

If forced to pick one term: **"Contextual Inertia"** is the most established name that most closely matches the described pattern, though it emphasizes reasoning traces rather than semantic interpretation specifically.

## Sources

### Tier 1 — Direct Matches
- [Breaking Contextual Inertia (Chen et al., 2026)](https://arxiv.org/abs/2603.04783v1) — HKU, March 2026. Defines "contextual inertia" in multi-turn LLM interactions. Preprint.
- [Contextual Drag (Cheng et al., 2026)](https://arxiv.org/abs/2602.04288) — Princeton, ICLR 2026 conference paper. Structural error inheritance via tree edit distance.
- [Premature Semantic Collapse (Saito, 2025)](https://arxiv.org/abs/2512.13478) — Independent, Dec 2025. Architectural analysis of forced early commitment.

### Tier 2 — Closely Related
- [Snowballing Hallucinations (Zhang et al., 2023)](https://arxiv.org/abs/2305.13534) — UW/NYU, ICML 2024. Early errors cascade into recognizable-but-still-generated false claims.
- [Neural Howlround / RISM (Drake, 2025)](https://arxiv.org/abs/2504.07992) — Independent, April 2025. Self-reinforcing cognitive loops resistant to correction.
- [LLMInertia (You et al., 2025)](https://openreview.net/forum?id=fF89cNAmCW) — BUPT, submitted to ICLR 2026. Cognitive inertia from co-occurrence associations overriding input evidence.
- [Escalation of Commitment (Barkett et al., 2025)](https://arxiv.org/abs/2508.01545) — Columbia, Aug 2025. Sunk-cost-like commitment bias in LLMs.
- [Semantic Anchoring (Chang et al., 2025)](https://arxiv.org/abs/2506.02139) — Stanford/UIUC. Threshold-based lock-in of interpretive patterns.
- [Semantic Gravity Wells (2025)](https://arxiv.org/abs/2601.08070) — Semantic pressure creates gravitational pull toward certain outputs, resisting constraint-based correction.

### Tier 3 — Contextual
- [Primacy Effect of ChatGPT (Wang et al., 2023)](https://aclanthology.org/2023.emnlp-main.8) — EMNLP 2023. Positional bias toward first-encountered information.
- [Attention Sink (Gu et al., 2024)](https://arxiv.org/abs/2410.xxxx) — NUS/Sea AI Lab. First-token attention disproportionality mechanism.
- [How RLHF Amplifies Sycophancy (Shapira et al., 2026)](https://arxiv.org/abs/2602.01002) — Mean-gap mechanism for RLHF-induced agreement bias.
- [Overconfidence/Underconfidence Paradox (Kumaran et al., DeepMind, 2025)](https://arxiv.org/abs/2507.03120) — Choice-supportive bias + excessive doubt under criticism.
- [Garden-Path Processing in LLMs (Li et al., 2024)](https://arxiv.org/abs/2405.16042) — LLMs struggle to revise initial syntactic/semantic commitments.
- [Accumulating Context Changes Beliefs (Geng et al., 2026)](https://lm-belief-change.github.io/) — CMU/Princeton/Stanford. Belief drift from context accumulation.
- [In Praise of Stubbornness (Clemente et al., 2025)](https://openreview.net/forum?id=c61fLG5HX4) — Submitted to ICLR 2026. Counterfactual updates cause catastrophic corruption.
- [How LLMs Get Stuck (Manna et al., 2026)](https://arxiv.org/abs/2603.00359) — Early structure creates persistent errors in training.
- [In-context Learning Agents Are Asymmetric Belief Updaters (Schubert et al., 2024)](https://arxiv.org/abs/2402.03969) — LLMs update beliefs asymmetrically, learning more from confirmations.

## Confidence Assessment

- **Overall confidence: HIGH** that no single canonical name exists for the exact composite phenomenon.
- **Overall confidence: HIGH** that "Contextual Inertia" (Chen et al., 2026) is the closest and most directly applicable named term.
- **Overall confidence: HIGH** that the phenomenon is real, well-documented across multiple independent research groups, and actively being studied as of early 2026.
- **Area of uncertainty:** "Contextual Inertia" is from a March 2026 preprint and has not yet been widely adopted. "Contextual Drag" has stronger institutional backing (ICLR 2026, Princeton) but names a slightly different facet (error inheritance rather than interpretation persistence per se).
- **Area of uncertainty:** Whether the LLMInertia paper (submitted to ICLR 2026) was accepted — the OpenReview listing doesn't indicate acceptance status.
- **Recommendation:** For referring to this phenomenon in discussion, "contextual inertia" is the most descriptive single term. For precision, the composite "contextual inertia with downstream drag" captures both the persistence and the structural inheritance aspects. The phenomenon is distinct from simple anchoring bias specifically because of the *implication tree* dimension — contextual drag's tree edit distance analysis is the key differentiator from generic cognitive bias research.
