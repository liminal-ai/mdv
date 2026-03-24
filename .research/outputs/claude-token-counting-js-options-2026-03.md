# Claude Token Counting in JavaScript/Node.js -- Current State (March 2026)

## Summary

There is no viable offline/synchronous Claude tokenizer for JavaScript. Anthropic's own `@anthropic-ai/tokenizer` package is effectively abandoned (last commit July 2023, v0.0.4) and explicitly inaccurate for Claude 3+ models. Anthropic's recommended approach is the `messages.countTokens()` API endpoint (available via `@anthropic-ai/sdk`), which is free but asynchronous and rate-limited. For your use case -- synchronous, server-side, approximate token estimation for truncation decisions -- the best options are either a character-based heuristic (`chars / 4`) or the lightweight `tokenx` package (2kB, synchronous, ~96% accuracy, model-agnostic).

## Key Findings

- **`@anthropic-ai/tokenizer` is dead.** v0.0.4, last published ~3 years ago, last GitHub commit July 2023. Explicitly warns it is inaccurate for Claude 3+ models. Do not use.
- **Anthropic provides a free API endpoint** (`POST /v1/messages/count_tokens`) with SDK support (`client.messages.countTokens()`). Accurate, but async + requires API key + subject to RPM rate limits.
- **Anthropic's official heuristic**: ~4 characters per token (i.e., `Math.ceil(text.length / 4)`).
- **Claude uses a proprietary tokenizer** distinct from OpenAI's tiktoken. No encoding file has been published. All third-party BPE tokenizers are approximations.
- **`js-tiktoken`**: v1.0.21, ~3M weekly downloads, actively maintained, pure JS. OpenAI tokenizer -- not Claude's. Using `cl100k_base` encoding gives a rough approximation but not a calibrated one.
- **`gpt-tokenizer`**: actively maintained, fastest JS BPE tokenizer, ESM+CJS, supports all OpenAI encodings. Same caveat: it's an OpenAI tokenizer, not Claude's.
- **`tokenx`**: v1.3.0, 2kB bundle, zero deps, synchronous, ~96% accuracy via character heuristics. Model-agnostic. Best fit for the stated requirements.
- **`@anthropic-ai/sdk`**: v0.80.0, actively maintained. Includes `client.messages.countTokens()` but no offline/synchronous token counting utility.

---

## Detailed Analysis

### 1. `@anthropic-ai/tokenizer` (npm)

| Attribute | Value |
|-----------|-------|
| Version | 0.0.4 |
| Last published | ~3 years ago (mid-2023) |
| Last GitHub commit | July 12, 2023 |
| Total commits | 8 |
| Open issues | 4 |
| Status | Beta, effectively abandoned |

**Critical warning from README:**
> "This package can be used to count tokens for Anthropic's older models. As of the Claude 3 models, this algorithm is no longer accurate, but can be used as a very rough approximation."

The package exports a synchronous `countTokens(text)` function. It was built for Claude 1/2 era models. Claude 3, 3.5, 4, and 4.5 use a different tokenizer. Anthropic has not updated this package and recommends using the API endpoint instead.

**Verdict: Do not depend on this. Not accurate for any current model.**

Source: [GitHub - anthropics/anthropic-tokenizer-typescript](https://github.com/anthropics/anthropic-tokenizer-typescript)

### 2. Anthropic Token Counting API

**Endpoint:** `POST https://api.anthropic.com/v1/messages/count_tokens`

**SDK usage (TypeScript):**
```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
const response = await client.messages.countTokens({
  model: "claude-opus-4-6",
  system: "You are a scientist",
  messages: [{ role: "user", content: "Hello, Claude" }]
});
// response: { input_tokens: 14 }
```

**Key characteristics:**
- Free to use (no token billing)
- Async (HTTP round-trip to Anthropic API)
- Requires API key (`ANTHROPIC_API_KEY`)
- Rate limited by tier (100-8000 RPM depending on tier)
- Separate rate limits from message creation
- Supports system prompts, tools, images, PDFs, extended thinking
- Result is an estimate -- may differ slightly from actual billing
- All active models supported

**Verdict: Gold standard for accuracy, but violates the synchronous/no-latency requirement. Best used for validation, not hot-path truncation.**

Sources:
- [Token counting - Claude Docs](https://platform.claude.com/docs/en/build-with-claude/token-counting)
- [Count tokens API Reference](https://platform.claude.com/docs/en/api/messages-count-tokens)

### 3. Anthropic's Estimation Recommendations

Anthropic's documentation states:
- **~4 characters per token** as a rough heuristic
- **~0.75 words per token** as an alternative heuristic
- For exact values: use the Token Counting API
- The `usage` field in API responses gives actual billed token counts

A third-party guide (Propel) suggests `p50k_base` encoding from tiktoken as a rough approximation, but this is not an official Anthropic recommendation.

Sources:
- [Anthropic Pricing Docs](https://platform.claude.com/docs/en/about-claude/pricing)
- [Token Counting Guide (Propel)](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025)

### 4. `js-tiktoken` (npm)

| Attribute | Value |
|-----------|-------|
| Version | 1.0.21 |
| Weekly downloads | ~3M |
| Type | Pure JavaScript BPE tokenizer |
| Encodings | cl100k_base, p50k_base, p50k_edit, r50k_base, o200k_base |
| ESM support | Yes |
| Lite import | `js-tiktoken/lite` (load only needed encoding ranks) |
| npm size | 22.4 MB (all encodings); much smaller with lite imports |

**Pros:** Well-maintained, huge community, pure JS (synchronous), supports lite/tree-shaken imports.
**Cons:** This is OpenAI's tokenizer. Claude uses a different vocabulary and BPE merge table. Using `cl100k_base` for Claude gives an approximation that could be off by 10-20%+ depending on content.

**Verdict: Viable as a rough approximation if you need actual BPE tokenization, but for Claude it's not calibrated. Overkill for truncation decisions -- the character heuristic is simpler and similarly approximate.**

Source: [js-tiktoken - npm](https://www.npmjs.com/package/js-tiktoken)

### 5. `gpt-tokenizer` (npm)

| Attribute | Value |
|-----------|-------|
| Version | latest (actively maintained, 142+ commits) |
| Weekly downloads | Significant (exact number not retrieved) |
| Type | Pure JavaScript/TypeScript BPE tokenizer |
| Encodings | r50k_base, p50k_base, p50k_edit, cl100k_base, o200k_base, o200k_harmony |
| ESM + CJS | Yes |
| Performance claim | "Fastest tokenizer implementation on NPM" since v2.4.0 |

**Pros:** Fast, small footprint, ESM native, comprehensive OpenAI model support.
**Cons:** Same fundamental issue -- it's an OpenAI tokenizer, not Claude's. No mention of Claude/Anthropic support anywhere.

**Verdict: Same story as js-tiktoken. Good package, wrong tokenizer for Claude.**

Sources:
- [gpt-tokenizer - npm](https://www.npmjs.com/package/gpt-tokenizer)
- [GitHub - niieani/gpt-tokenizer](https://github.com/niieani/gpt-tokenizer)

### 6. `@anthropic-ai/sdk` (npm)

| Attribute | Value |
|-----------|-------|
| Version | 0.80.0 |
| Last published | ~5 days ago (as of 2026-03-23) |
| Status | Actively maintained, official |

The SDK includes `client.messages.countTokens()` which wraps the API endpoint. It does **not** include any offline/synchronous token counting utility. There is no bundled tokenizer vocabulary or BPE implementation.

**Verdict: No offline token counting. The SDK is just an HTTP client wrapper for the API endpoint.**

Source: [@anthropic-ai/sdk - npm](https://www.npmjs.com/package/@anthropic-ai/sdk)

---

## Recommendation for Your Use Case

Given the requirements:
- Synchronous (negligible latency)
- Server-side Node.js (ESM)
- Approximate (truncation decisions, not billing)

### Option A: Character Heuristic (Simplest, Zero Dependencies)

```javascript
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
```

Anthropic's own documentation uses ~4 chars/token. For English markdown, this is within ~20% of actual counts. No dependencies, zero latency, trivially testable.

### Option B: `tokenx` Package (Better Accuracy, Still Tiny)

```javascript
import { estimateTokenCount, isWithinTokenLimit } from 'tokenx';

const tokens = estimateTokenCount(markdownText);
const fits = isWithinTokenLimit(markdownText, 100000);
```

- 2kB bundle, zero dependencies
- Synchronous
- ~96% accuracy (benchmarked against full tokenizers)
- Has `isWithinTokenLimit()` and `sliceByTokens()` which directly serve truncation use cases
- Model-agnostic (uses character heuristics with language-aware adjustments)
- v1.3.0, published ~1 month ago

### Option C: `js-tiktoken` with `cl100k_base` (BPE Approximation)

```javascript
import { encodingForModel } from 'js-tiktoken';
const enc = encodingForModel('gpt-4'); // cl100k_base
const tokens = enc.encode(text).length;
```

- Actual BPE tokenization (synchronous after initialization)
- ~3M weekly downloads, battle-tested
- But: wrong tokenizer for Claude, 22MB npm payload (mitigated with lite imports)
- Initialization requires loading encoding ranks (async or sync from bundled data)

### My Recommendation

**Option A** (character heuristic) if you want zero dependencies and the estimation only needs to answer "is this document roughly over N tokens?" For a 100K token budget with markdown content, `chars / 4` with a 10-15% safety margin (i.e., treat 85K estimated tokens as the cutoff) is pragmatic and correct enough.

**Option B** (`tokenx`) if you want a slightly more sophisticated estimation with built-in `isWithinTokenLimit()` and `sliceByTokens()` convenience functions, still at negligible bundle cost.

**Avoid** Option C unless you have other reasons to pull in a full BPE tokenizer -- it's not meaningfully more accurate than the heuristics for Claude, since it's using OpenAI's vocabulary anyway.

---

## Sources

- [@anthropic-ai/tokenizer - npm](https://www.npmjs.com/package/@anthropic-ai/tokenizer) -- Package page, version/download data
- [GitHub - anthropics/anthropic-tokenizer-typescript](https://github.com/anthropics/anthropic-tokenizer-typescript) -- Deprecation warning, last commit date
- [Token counting - Claude Docs](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- Official token counting guide with SDK examples
- [Count tokens API Reference](https://platform.claude.com/docs/en/api/messages-count-tokens) -- API endpoint specification
- [Token Counting Explained (Propel, 2025)](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025) -- Comparative guide, p50k_base approximation tip
- [js-tiktoken - npm](https://www.npmjs.com/package/js-tiktoken) -- Package page
- [gpt-tokenizer - npm](https://www.npmjs.com/package/gpt-tokenizer) -- Package page
- [GitHub - niieani/gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) -- README, encoding support, performance claims
- [@anthropic-ai/sdk - npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- SDK package page, version data
- [GitHub - johannschopplich/tokenx](https://github.com/johannschopplich/tokenx) -- Lightweight estimation library
- [tokenx - npm](https://www.npmjs.com/package/tokenx) -- Package page, v1.3.0

## Confidence Assessment

- **Overall confidence: High** -- The core finding (no offline Claude tokenizer exists) is well-established and confirmed across multiple sources.
- **Heuristic accuracy**: Medium confidence that `chars / 4` is within 20% for English markdown. Anthropic's own docs use this number but don't specify error bounds.
- **tokenx accuracy claims**: Medium confidence -- the 96% figure is self-reported by the package author, not independently validated for Claude specifically.
- **Area of uncertainty**: Exactly how far off `cl100k_base` is from Claude's actual tokenizer for typical markdown content. No public benchmarks exist for this specific comparison.
