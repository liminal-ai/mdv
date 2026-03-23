# Adversarial/Pedantic Prompting Research - Raw Notes

## Sources Collected

### ASDLC.io - Adversarial Code Review Pattern
- Separated Builder/Critic roles with context swap
- Critic directive: "You are skeptical. Reject code violating the Spec, even if it works. Favor false positives over false negatives."
- Multi-model parallel critique (Architect, SecOps, QA lanes)
- Key insight: "The agent that wrote the code is compromised. It knows what it built."

### Reddit - Adversarial Git Diff Prompt
- "Do a git diff and pretend you're a senior dev doing a code review and you HATE this implementation. What would you criticize? What edge cases am I missing?"
- Works "too well" - keeps inventing issues if run repeatedly
- 2 passes recommended, with human filtering
- Signal-to-noise requires experienced developer judgment

### Actor-Critic Adversarial Coding Pattern
- Actor: implementation-focused, optimistic
- Critic: "You are a senior security engineer reviewing code. Be EXTREMELY critical. Assume code is vulnerable until proven otherwise. Find EVERY possible issue."
- 8 critique dimensions
- 3-5 rounds optimal, 90%+ issues caught before human review

### OpenAI CriticGPT
- Trained critics catch 63% more bugs than humans
- Force Sampling Beam Search (FSBS) balances comprehensiveness vs hallucination
- Human+CriticGPT teams outperform either alone
- Found hundreds of errors in "flawless" training data

### SGCR Framework
- Dual pathway: explicit (spec-based rules) + implicit (unconstrained discovery)
- 42% developer adoption rate (90.9% improvement over baseline)
- Grounding in specifications is key differentiator

### Multi-Agent Debate Research
- Debate CAN improve accuracy (+52% simple, +32% complex)
- BUT: models show anti-Bayesian confidence escalation
- Both sides claim >75% win probability in 61.7% of cases
- Majority pressure suppresses independent thinking
- Echo chambers persist when agents share biases
- Intrinsic model strength dominates over structural tweaks

### Self-Criticism Techniques
- Chain-of-Verification (CoVe): 4-step verify-then-refine
- Self-Refine: iterative generate-review-refine
- Reversing Chain-of-Thought (RCoT): reconstruct problem to detect drift
- Self-Verification: multiple solutions, mask-and-test

### Persona Prompting Research
- Works for open-ended tasks, NOT consistently for accuracy
- Simple personas like "you're an expert" don't improve factual accuracy
- Detailed, specific, LLM-generated personas work better (ExpertPrompting)
- Mixed results for code review - few-shot learning WITHOUT persona sometimes better

### Negative Prompting
- "Don't do X" instructions frequently ignored
- Performance WORSENS with negative prompts as models scale
- Convert to positive directives: "Always X" instead of "Never Y"

### Sycophancy Research
- Models trained to be helpful default to agreement
- Professional/authoritative framing reduces sycophancy
- Fine-tuning on non-sycophantic examples helps
- Claude Sonnet 4.5 specifically trained to reduce sycophancy

### Pre-mortem Technique
- "Imagine it's 12 months from now and this failed. What went wrong?"
- Prospective hindsight increases failure identification by 30%
- Frames failure as already-happened, not hypothetical

### Code Review Prompt Patterns
- "Goal: find defects and risky assumptions, not style nitpicks"
- "Do NOT suggest renames unless it prevents a bug"
- Confidence scoring (only post >= 0.7 confidence)
- Multi-model consensus reduces false positives ~60%
- Structured output: severity, location, fix suggestion
