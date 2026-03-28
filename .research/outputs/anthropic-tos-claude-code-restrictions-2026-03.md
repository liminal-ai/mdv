# Anthropic Terms of Service: Claude Code CLI Restrictions and the OpenCode Incident

**Research Date:** 2026-03-26
**Confidence Level:** High (based on official documentation, news coverage, GitHub issues, and HN discussions)

---

## Summary

Anthropic has progressively tightened restrictions on how Claude subscriptions (Free, Pro, Max) can be used outside of their official applications (Claude.ai and Claude Code CLI). The core policy, formalized in February 2026 after months of enforcement, is: **OAuth tokens from consumer subscriptions may only be used within Claude Code and Claude.ai**. Using those tokens in third-party tools, including Anthropic's own Agent SDK, is explicitly prohibited. The distinction that matters is not what you do with Claude Code CLI itself (scripting, automation, cron, PTY wrapping are all fine when using the actual CLI binary), but whether you extract OAuth tokens and use them in non-Anthropic clients, or whether you build tools that let others authenticate with their subscriptions through your product.

The situation has been marked by contradictory messaging from Anthropic employees, a phased enforcement-then-policy pattern, and significant developer backlash. The economic motivation is clear: a $200/mo Max subscription running agentic workloads through third-party harnesses consumes $1,000+ worth of API compute, making flat-rate subscriptions deeply unprofitable.

---

## 1. Claude Code Subscription Terms

### What the Terms Say

Claude Code usage is governed by:
- **Consumer Terms of Service** for Free, Pro, and Max users
- **Commercial Terms of Service** for Team, Enterprise, and API key users

The key provision is **Consumer ToS Section 3.7**, which prohibits accessing services "through automated or non-human means, whether through a bot, script, or otherwise" with a critical exception: **"Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it."**

Claude Code CLI is the "otherwise explicitly permit it" -- it is Anthropic's official tool built for scripted and automated use. The official docs demonstrate automated workflows including:
- Piping data through `claude -p`
- GitHub Actions integration
- Cron-based scheduled tasks (`/loop`, Desktop scheduled tasks, Cloud scheduled tasks)
- CI/CD pipelines
- The Agent SDK spawning `claude -p` as a subprocess

The docs state: *"Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK."*

### What "Ordinary Individual Usage" Means

This phrase is never precisely defined. The docs show examples of cron automation, CI/CD, and overnight loops as intended features, but the lack of a bright line creates ambiguity. The practical enforcement has targeted:
- Third-party tools that spoof the Claude Code client identity
- Tools that extract OAuth tokens for use in non-Anthropic clients
- Multi-user platforms routing through subscription credentials

What has NOT been targeted (based on available evidence):
- Individual developers running Claude Code CLI in scripts
- Using `claude -p` in personal automation
- Running Claude Code on VPS or remote machines for personal use

### Sources
- [Claude Code Legal and Compliance](https://code.claude.com/docs/en/legal-and-compliance) - Official Anthropic documentation
- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) - Official docs showing CLI automation
- [Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks) - Official docs showing cron/loop automation
- [Is This Allowed? Claude Code ToS Explained](https://autonomee.ai/blog/claude-code-terms-of-service-explained/) - Detailed third-party analysis

---

## 2. The OpenCode Incident - Complete Timeline

### Background
OpenCode is an open-source coding agent (originally ~56K GitHub stars) that allowed developers to use Claude models via their Pro/Max subscription OAuth tokens, bypassing API billing.

### Timeline

**Late December 2025**: The "Ralph Wiggum technique" goes viral -- autonomous loops where Claude works for hours unattended. YC hackathon teams ship 6+ repos overnight for ~$297 in API costs equivalent. OpenCode's subscription access becomes widely known.

**January 9, 2026 (02:20 UTC)**: Anthropic deploys server-side safeguards blocking subscription OAuth tokens from working outside Claude Code CLI. Third-party tools receive error: *"This credential is only authorized for use with Claude Code and cannot be used for other API requests."* No advance notice given.

**January 9-10, 2026**: Thariq Shihipar (Anthropic Member of Technical Staff, Claude Code team) states: *"Yesterday we tightened our safeguards against spoofing the Claude Code harness after accounts were banned for triggering abuse filters from third-party harnesses."* He cites:
- Unusual traffic patterns
- Lack of telemetry that official tools provide
- Difficulty debugging issues without telemetry

**January-February 2026**: Community backlash intensifies. George Hotz publishes "Anthropic is making a huge mistake." DHH calls it "very customer hostile." OpenCode's star count doubles.

**February 17-18, 2026**: Anthropic updates Claude Code Legal and Compliance docs to add explicit "Authentication and credential use" section banning subscription OAuth in third-party tools.

**February 19, 2026**: Anthropic formally publishes the updated Consumer ToS. Same day, OpenCode's core maintainer Dax Raad merges PR #18186 with commit message "anthropic legal requests" -- removing all Anthropic OAuth code, provider hints, and the anthropic-20250930.txt prompt file.

**February 20, 2026**: The Register and other outlets report on the clarification. Anthropic says it was a "docs cleanup" (more on this contradiction below).

**March 19, 2026**: Anthropic takes legal action against OpenCode. The removal becomes permanent, with the PR receiving 40 thumbs-down reactions vs 4 thumbs-up.

**Post-incident**: OpenAI officially partners with OpenCode, extending subscription support. OpenCode reaches 112K+ stars. The open-source ecosystem diversifies away from Anthropic dependency.

### Sources
- [Anthropic's Walled Garden: The Claude Code Crackdown](https://paddo.dev/blog/anthropic-walled-garden-crackdown/) - Detailed technical timeline
- [Anthropic blocks third-party use of Claude Code subscriptions (HN)](https://news.ycombinator.com/item?id=46549823) - Community discussion
- [Using opencode with Anthropic OAuth violates ToS (GitHub)](https://github.com/anomalyco/opencode/issues/6930) - OpenCode GitHub issue
- [Anthropic takes legal action against OpenCode (HN)](https://news.ycombinator.com/item?id=47444748) - Legal action discussion
- [Anthropic Explicitly Blocking OpenCode (HN)](https://news.ycombinator.com/item?id=46625918) - Earlier HN thread
- [Did Anthropic Just Kill OpenCode?](https://ridakaddir.com/blog/post/did-anthropic-kill-opencode-claude-subscription-ban) - Analysis

---

## 3. OAuth/SDK Restrictions

### Current Official Policy (as of February 2026)

From the [Legal and Compliance](https://code.claude.com/docs/en/legal-and-compliance) page:

> **OAuth authentication** (used with Free, Pro, and Max plans) is intended exclusively for Claude Code and Claude.ai. Using OAuth tokens obtained through Claude Free, Pro, or Max accounts in any other product, tool, or service -- including the Agent SDK -- is not permitted and constitutes a violation of the Consumer Terms of Service.
>
> **Developers** building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users.

### The Agent SDK Confusion

This is where the contradictions became most acute:

1. **The Agent SDK technically supports OAuth tokens**: You can set `CLAUDE_CODE_OAUTH_TOKEN` and the Agent SDK will use it. This was confirmed working through v0.1.58.

2. **The docs explicitly prohibit it**: "including the Agent SDK" is called out by name as not permitted.

3. **Shihipar's contradictory statement**: When asked by The New Stack, he wrote: *"Apologies, this was a docs clean up we rolled out that's caused some confusion. Nothing is changing about how you can use the Agent SDK and MAX subscriptions!"* He later clarified: *"if you're building a business on top of the Agent SDK, you should use an API key instead."*

4. **The "nothing is changing" claim was contradicted by enforcement**: Users continued reporting OAuth failures and bans even after the "docs cleanup" characterization. The technical blocks remained in place.

### Practical Boundaries

Based on all available evidence, the current enforcement posture appears to be:

| Scenario | Status |
|----------|--------|
| OAuth token in Claude Code CLI | Permitted (official use) |
| OAuth token in Claude.ai | Permitted (official use) |
| OAuth token in Agent SDK for personal local dev | Gray area -- technically prohibited by docs, but Shihipar said "nothing is changing" and some users report it working |
| OAuth token in third-party tools (OpenCode, OpenClaw, etc.) | Blocked technically and prohibited by policy |
| OAuth token in your own product serving other users | Explicitly prohibited |
| API key in any tool/SDK | Permitted under Commercial Terms |

### Sources
- [Anthropic: You can still use your Claude accounts to run OpenClaw (The New Stack)](https://thenewstack.io/anthropic-agent-sdk-confusion/) - The contradictory "docs cleanup" article
- [Anthropic clarifies ban on third-party tool access (The Register)](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/) - Policy clarification
- [Anthropic's Confusing Claude Subscription Policy, Explained](https://www.engineerscodex.com/anthropic-claude-subscription-switcharoo) - Analysis of contradictions
- [Claude Max Usage (GitHub Issue)](https://github.com/anthropics/claude-agent-sdk-typescript/issues/11) - Agent SDK + Max discussion
- [Anthropic officially bans using subscription auth for third party use (HN)](https://news.ycombinator.com/item?id=47069299) - HN discussion
- [Rob Zolkos on X](https://x.com/robzolkos/status/2024125323755884919) - Quote of official policy

---

## 4. PTY/CLI Wrapping - Is It a Violation?

### Short Answer

**Wrapping the Claude Code CLI binary in a PTY and exposing it via WebSocket is a legal gray area that Anthropic has not explicitly addressed.** No enforcement action has been documented against this pattern. But the risk profile depends heavily on specifics.

### Analysis

**Arguments that it IS allowed:**

1. You are running the actual `claude` CLI binary -- Anthropic's official product. The Consumer ToS exempts Claude Code from the automated access prohibition.

2. Anthropic's own documentation promotes automation: `claude -p`, `--output-format stream-json`, cron scheduling, CI/CD integration, and GitHub Actions are all officially supported patterns.

3. Several open-source projects do exactly this and remain operational:
   - [claude-code-web](https://github.com/vultuk/claude-code-web) - node-pty + WebSocket wrapper with multi-session support
   - [claude-code-server](https://github.com/Kurogoma4D/claude-code-server) - WebSocket server for remote CLI access
   - [claude-agent-server](https://github.com/dzhng/claude-agent-server) - Sandbox + WebSocket control
   - Various "Claude Code Remote" projects

4. Anthropic themselves built "Claude Code on the web" and "Remote Control" features that are functionally similar (running Claude Code on a machine and accessing it remotely).

5. The autonomee.ai analysis concludes: *"Running Claude Code CLI on your own computer works as it always has -- it's Anthropic's official product built for scripted and automated use."*

**Arguments that it COULD be problematic:**

1. The "ordinary, individual usage" qualifier is vague. If a PTY-wrapped Claude Code instance is exposed to multiple users, it could be construed as exceeding individual usage.

2. If the wrapper is a product/service that other people use, Anthropic's policy states: *"Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users."*

3. The HN discussion on the legal action thread included a comment from someone identified as speaking for Anthropic policy who stated subscription terms *"expressly prohibit use of the product outside of the Claude Code harness"* -- though the exact scope of what "outside" means when you're literally running the Claude Code binary is unclear.

4. Claude Code is proprietary (License: "All rights reserved. Use is subject to Anthropic's Commercial Terms of Service"). The right to embed or wrap it in another product is not explicitly granted.

### The Key Distinction

The pattern that triggered enforcement was **extracting OAuth tokens and replaying them in non-Anthropic clients that spoofed the Claude Code identity**. A PTY wrapper around the actual `claude` CLI binary is fundamentally different -- the binary itself handles authentication, sends telemetry, and presents as the official client to Anthropic's servers.

However, if you build a multi-user product around this pattern and it gains traction, you enter the territory where Anthropic's economic concerns (subscription arbitrage) and policy concerns (third-party developers routing through subscription credentials) could apply.

### Personal Use Assessment

For a personal tool where you are the sole user, wrapping Claude Code CLI in a PTY and accessing it via WebSocket from your own browser/devices appears to be within the current enforcement posture. You are:
- Running the official Claude Code binary
- Authenticated with your own subscription
- Using it for your own development work
- Not extracting tokens or spoofing clients
- The binary handles its own telemetry

This is functionally equivalent to SSH-ing into a machine and running Claude Code there, or using Anthropic's own Remote Control feature.

### Sources
- [claude-code-web (GitHub)](https://github.com/vultuk/claude-code-web) - Active PTY+WebSocket wrapper project
- [Claude Code Remote (HN)](https://news.ycombinator.com/item?id=46627628) - Show HN for similar project
- [Claude Code on the web (Anthropic)](https://code.claude.com/docs/en/claude-code-on-the-web) - Official remote feature
- [Claude Code overview](https://code.claude.com/docs/en/overview) - Official documentation

---

## 5. Enforcement Mechanisms

### Technical Detection

Anthropic uses several mechanisms to detect unauthorized usage:

**1. Client Identity Verification**
- OAuth tokens are now scoped so they only work when Anthropic can verify the caller is the real Claude Code client
- Server-side checks distinguish between official and third-party clients
- Tools like OpenCode were caught because they sent spoofed headers mimicking Claude Code's client identity

**2. Telemetry Signals**
- Official Claude Code sends telemetry including: accepted vs rejected sessions, tool usage patterns, error rates
- Third-party harnesses either don't send telemetry or fake it
- Absence of expected telemetry is itself a detection signal

**3. Traffic Pattern Analysis**
- Anthropic runs a "dedicated threat intelligence program for spotting misuse patterns"
- High-volume overnight loops look different from interactive developer usage
- Unusual request patterns without corresponding telemetry trigger abuse filters

**4. Transport and Authentication Layer Checks**
- Detection operates at transport and authentication layers, not just behavioral heuristics
- This makes simple header-spoofing ("camouflage") ineffective long-term

### Enforcement Actions

**Account Bans**: Some accounts were automatically banned for triggering abuse filters. Anthropic acknowledged some were erroneous and reversed them. Shihipar stated: *"accounts were banned for triggering abuse filters from third-party harnesses."*

**Technical Blocks**: The January 9 block returned: *"This credential is only authorized for use with Claude Code and cannot be used for other API requests."*

**Legal Action**: Anthropic sent legal demands to OpenCode in March 2026, forcing removal of Claude integration.

### What This Means for PTY Wrapping

When you wrap the actual `claude` CLI binary in a PTY, the binary itself:
- Authenticates with Anthropic's servers using its own OAuth flow
- Sends its own telemetry
- Presents its own client identity headers

The PTY wrapper is transparent to Anthropic's servers -- they see a normal Claude Code client. This is fundamentally different from extracting a token and using it in a different HTTP client.

### Sources
- [Anthropic cracks down on unauthorized Claude usage (VentureBeat)](https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses) - Technical enforcement details
- [The End of the Claude Subscription Hack](https://augmentedmind.substack.com/p/the-end-of-the-claude-subscription-hack) - Detection mechanisms analysis
- [Anthropic Tightens Control (techbuddies.io)](https://www.techbuddies.io/2026/01/12/anthropic-tightens-control-over-claude-code-access-disrupting-third-party-harnesses-and-rival-labs/) - Enforcement details
- [Rohan Paul on X](https://x.com/rohanpaul_ai/status/2009786956356649410) - Summary of technical changes

---

## 6. Community Discussion and Contradictions

### The Central Contradiction

The most damaging contradiction was between enforcement and messaging:

1. **January 9**: Technical blocks deployed with no notice
2. **January 10**: Shihipar explains it as anti-spoofing, cites abuse filters
3. **February 17-18**: Docs updated to explicitly ban OAuth in third-party tools "including the Agent SDK"
4. **February 19**: When The New Stack asks about it, Shihipar responds: *"Apologies, this was a docs clean up we rolled out that's caused some confusion. Nothing is changing about how you can use the Agent SDK and MAX subscriptions!"*
5. **Same day (February 19)**: OpenCode removes Claude OAuth citing "Anthropic legal requests"
6. **March 19**: Legal action against OpenCode

The claim that "nothing is changing" while simultaneously issuing legal demands and maintaining technical blocks was the core contradiction that eroded community trust.

### DHH and Notable Reactions

David Heinemeier Hansson (DHH, creator of Ruby on Rails): *"Seems very customer hostile"* and *"Terrible policy for a company built on training models on our code, our writing, our everything."*

George Hotz: Published "Anthropic is making a huge mistake" -- predicted users would switch model providers rather than return to Claude Code.

Community member: *"The biggest L in the whole Anthropic vs OpenCode situation is that they've just radicalised the entire anomalyco team and the supporting OSS community. Models are not sticky and this action is an admission to that."*

### The Buffet Analogy (from HN)

Users described the situation as: Anthropic offers an all-you-can-eat buffet ($200/mo Max) but controls the speed of consumption through Claude Code's built-in rate limits and UX. Third-party harnesses removed these speed limits, letting autonomous agents eat 24/7. Anthropic's response was to ban non-buffet-approved plates rather than adjust the buffet pricing.

### OpenAI's Response

OpenAI explicitly partnered with OpenCode after the ban, extending subscription support for OpenCode, OpenHands, and RooCode. OpenAI employee Thibault Sottiaux publicly endorsed third-party subscription usage. The contrast could not have been sharper.

### Sources
- [Anthropic officially bans using subscription auth for third party use (HN)](https://news.ycombinator.com/item?id=47069299) - 245+ point HN discussion
- [Anthropic blocks third-party use of Claude Code subscriptions (HN)](https://news.ycombinator.com/item?id=46549823) - Earlier HN discussion
- [Anthropic takes legal action against OpenCode (HN)](https://news.ycombinator.com/item?id=47444748) - Legal action discussion
- [Anthropic Banned OpenClaw (Natural 20)](https://natural20.com/coverage/anthropic-banned-openclaw-oauth-claude-code-third-party) - OpenClaw coverage
- [Why Developers Are Turning Against Claude Code](https://ucstrategies.com/news/why-developers-are-suddenly-turning-against-claude-code/) - Broader backlash analysis

---

## 7. Assessment for PTY/WebSocket Wrapper Pattern

### Specific to Your Architecture (PTY bridge exposing Claude Code via WebSocket)

Based on the totality of research, here is my assessment:

**Low Risk if:**
- You are the sole user of the tool
- You are running the actual `claude` CLI binary (not extracting tokens)
- The tool is for personal development use
- You are not distributing the tool as a product with Claude integration
- You are not exposing it to other users who would authenticate with their own subscriptions through your tool

**Medium Risk if:**
- You distribute the tool publicly and others use it with their subscriptions
- The tool becomes popular enough to attract attention
- Usage patterns become "non-ordinary" (e.g., many concurrent sessions, 24/7 autonomous loops)

**High Risk if:**
- You extract OAuth tokens and use them in non-Claude-Code HTTP clients
- You build a product/business that routes subscription credentials through your platform
- You spoof Claude Code client identity headers

### The Unaddressed Question

What Anthropic has NOT addressed is the specific pattern of: "I run the official Claude Code CLI binary, but I interact with it through a web UI I built for my own convenience." This sits in a genuine gap between:
- Clearly allowed: Running `claude -p` in a script
- Clearly prohibited: Extracting OAuth tokens for use in a different client

The PTY wrapper pattern falls closer to the "clearly allowed" end because the `claude` binary handles all authentication and telemetry. But the "ordinary, individual usage" qualifier and the proprietary license ("all rights reserved") leave theoretical room for Anthropic to object if they chose to.

### Practical Recommendation

For personal use: proceed. The risk is minimal and no enforcement action against this pattern has been documented.

For anything that becomes a product or gains a user base: use API keys under Commercial Terms. This eliminates all ambiguity.

---

## Claude Code License

Claude Code is **proprietary, not open source**.

From LICENSE.md:
> (c) Anthropic PBC. All rights reserved. Use is subject to Anthropic's Commercial Terms of Service.

This is notable because competitors (OpenAI Codex CLI, Google Gemini CLI) are Apache 2.0 open source. The proprietary license means Anthropic retains the right to restrict how the binary is used, embedded, or wrapped -- though they haven't exercised this specifically against PTY wrappers.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| OAuth ban in third-party tools | High | Explicitly documented, technically enforced, legally actioned |
| Timeline of OpenCode incident | High | Well-documented across multiple sources |
| Contradictory messaging | High | Quotes are well-sourced from multiple outlets |
| PTY wrapping assessment | Medium | No explicit Anthropic statement either way; assessment based on inference from policy, enforcement patterns, and community observation |
| Detection mechanisms | Medium | General approach documented, but specific implementation details are proprietary |
| "Ordinary individual usage" boundary | Low | Deliberately undefined by Anthropic |

### Remaining Uncertainties

1. Whether Anthropic would ever enforce against personal PTY wrappers running the official binary
2. The exact technical mechanism for client verification (beyond "server-side checks")
3. Whether the Agent SDK + OAuth token for personal use is genuinely tolerated or just not yet enforced
4. How Anthropic defines the boundary between "personal experimentation" and a "product"
