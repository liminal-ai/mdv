# Vercel Agent Browser — Research for Gorilla/Exploratory Testing by AI Agents

**Date:** 2026-03-23
**Confidence:** High — primary sources include official docs, GitHub repo, npm registry, and multiple practitioner reports

---

## Summary

Vercel's **agent-browser** (npm: `agent-browser`, repo: `vercel-labs/agent-browser`) is a headless browser automation CLI built in Rust, purpose-designed for AI agents. Its core innovation is the "Snapshot + Refs" paradigm: instead of sending full DOM/accessibility trees to the LLM context window, it returns a compact text representation with stable element references (`@e1`, `@e2`, etc.) that achieve **~93% context reduction** versus Playwright MCP. The tool has 24K+ GitHub stars, 183K weekly npm downloads, and ships with a dedicated **"dogfood" skill** — a first-party exploratory testing workflow that systematically explores web apps, finds bugs, and produces structured reports with screenshots and repro videos.

For gorilla/exploratory testing by AI agents, agent-browser is currently the best-fit tool. It combines extreme token efficiency (enabling more test iterations per context budget), a deterministic interaction model, and an opinionated exploratory testing skill that can be installed with a single command.

---

## 1. What Agent Browser Actually Is

### Architecture

Three-tier client-daemon-browser architecture:

```
┌──────────────┐    Unix Socket/TCP    ┌──────────────────┐    CDP    ┌─────────┐
│  Rust CLI     │ ◄──────────────────► │  Native Daemon    │ ◄──────► │ Chrome  │
│  (< 1ms parse)│                      │  (Rust or Node.js)│          │         │
└──────────────┘                       └──────────────────┘          └─────────┘
```

| Layer | Implementation | Role |
|-------|---------------|------|
| **CLI** | Rust binary | Argument parsing, IPC client, output formatting |
| **Daemon** | Rust (native) or Node.js | WebSocket server, command queue, Chrome management via CDP |
| **Browser** | Chromium (from Chrome for Testing) | Actual page rendering and interaction |

Key architectural properties:
- **Daemon persistence** — starts automatically on first command, persists between commands. Eliminates browser restart overhead.
- **Socket communication** — `~/.agent-browser/{session}.sock` (Unix) or TCP (Windows). Sub-millisecond IPC.
- **Serial command queue** — commands execute sequentially through the daemon.
- **No Playwright dependency at runtime** when using native Rust daemon with direct CDP.

### The Snapshot + Refs System

This is the core innovation. The `snapshot` command generates an accessibility tree with deterministic element references:

```bash
$ agent-browser open https://example.com
$ agent-browser snapshot -i

# Output:
# - heading "Example Domain" [ref=e1]
# - link "More information..." [ref=e2]
```

**How refs work internally:**
1. Calls Playwright's `ariaSnapshot()` → `processAriaTree()` to add refs
2. Builds accessibility tree with stable element references
3. Caches references in a RefMap mapping refs → selector data
4. On interaction (`click @e2`), resolves ref to Playwright locator using `page.getByRole()` with stored role/name
5. For duplicate elements, `.nth(index)` disambiguation is applied

**Two snapshot modes:**
- `snapshot -i` — interactive elements only (buttons, links, inputs, etc.) — for finding things to click
- `snapshot` (no flag) — all visible content (text, headings, data) — for reading page content

**Ref lifecycle:** Refs are valid only within the current session context. After navigation or significant DOM changes, re-snapshot to get fresh refs.

---

## 2. Installation and Configuration

### Installation

```bash
# Global (recommended) — native Rust binary
npm install -g agent-browser
agent-browser install  # Download Chrome from Chrome for Testing (first time)

# macOS via Homebrew
brew install agent-browser
agent-browser install

# Quick start (no install)
npx agent-browser install   # Chrome download
npx agent-browser open example.com

# Project-local
npm install agent-browser
npx agent-browser install

# Rust toolchain
cargo install agent-browser
agent-browser install
```

### AI Agent Setup (Skill Installation)

```bash
# Install the skill for Claude Code, Codex, Cursor, Gemini CLI, Copilot, etc.
npx skills add vercel-labs/agent-browser

# Install the dogfood (exploratory testing) skill specifically
npx skills add vercel-labs/agent-browser --skill dogfood
```

### Configuration Precedence

Five-tier (lower → higher priority):
1. Built-in defaults
2. User config (`~/.agent-browser/config.json`)
3. Project config (`./agent-browser.json`)
4. Environment variables (`AGENT_BROWSER_*`)
5. CLI flags

### Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `AGENT_BROWSER_HEADED=1` | Show browser window |
| `AGENT_BROWSER_EXECUTABLE_PATH` | Custom browser binary |
| `AGENT_BROWSER_ENCRYPTION_KEY` | Encrypt state files at rest |
| `AGENT_BROWSER_SCREENSHOT_DIR` | Default screenshot output directory |
| `AGENT_BROWSER_DOWNLOAD_PATH` | Default download directory |

### Dependencies

- Chrome/Chromium — downloaded automatically via `agent-browser install`
- No Node.js runtime required when using global install (native Rust binary)
- Linux: `agent-browser install --with-deps` for system dependencies

---

## 3. How Agents Use It — The API/Interface

### Core Workflow Pattern

Every browser automation follows this loop:

```bash
# 1. Navigate
agent-browser open <url>

# 2. Snapshot — get element refs
agent-browser snapshot -i

# 3. Interact — use refs
agent-browser click @e2
agent-browser fill @e1 "user@example.com"

# 4. Re-snapshot — after DOM changes
agent-browser snapshot -i
```

### Complete Command Reference (50+ commands)

**Navigation & State:**
```bash
agent-browser open <url>              # Navigate (aliases: goto, navigate)
agent-browser back / forward / reload # History navigation
agent-browser close                   # Shut down browser
agent-browser state save/load <path>  # Persist cookies + localStorage
agent-browser session list            # Manage parallel sessions
```

**Discovery:**
```bash
agent-browser snapshot -i             # Interactive elements with refs
agent-browser snapshot -i -C          # Include cursor-interactive elements
agent-browser snapshot -s "#selector" # Scope to CSS selector
agent-browser snapshot --json         # JSON output for programmatic use
agent-browser get text @e1            # Extract text from element
agent-browser get url / get title     # Page metadata
agent-browser get count <sel>         # Count matching elements
```

**Interaction:**
```bash
agent-browser click @e1               # Click element
agent-browser fill @e1 "text"         # Clear and fill input
agent-browser type @e1 "text"         # Type character-by-character
agent-browser select @e1 "option"     # Dropdown selection
agent-browser check @e1               # Checkbox
agent-browser press Enter             # Keyboard key
agent-browser scroll down 500         # Scroll
agent-browser hover @e1               # Hover
agent-browser drag @e1 @e2            # Drag and drop
agent-browser upload @e1 ./file.pdf   # File upload
```

**Waiting:**
```bash
agent-browser wait @e1                # Wait for element
agent-browser wait --load networkidle # Network idle
agent-browser wait --url "**/page"    # URL pattern
agent-browser wait --text "Welcome"   # Text appearance
agent-browser wait --fn "condition"   # Custom JS condition
```

**Capture & Debug:**
```bash
agent-browser screenshot [path]       # PNG screenshot
agent-browser screenshot --annotate   # Numbered element labels overlay
agent-browser screenshot --full       # Full page
agent-browser record start demo.webm  # Video recording
agent-browser record stop             # Stop recording
agent-browser console                 # View console messages
agent-browser errors                  # View page errors
agent-browser diff snapshot --baseline before.txt  # Compare states
```

**Network:**
```bash
agent-browser network requests        # Inspect tracked requests
agent-browser network route "**/api/*" --abort  # Block requests
agent-browser network route <url> --body <json>  # Mock response
agent-browser network har start/stop  # HAR recording
```

**Viewport & Device:**
```bash
agent-browser set viewport 1920 1080  # Desktop
agent-browser set viewport 375 812    # Mobile
agent-browser set device "iPhone 14"  # Full device emulation
agent-browser set media dark          # Color scheme
```

### Command Chaining

```bash
# Chain with && when intermediate output isn't needed
agent-browser open example.com && agent-browser wait --load networkidle && agent-browser snapshot -i

# Batch execution for multi-command sequences
echo '[["open","https://example.com"],["snapshot","-i"],["click","@e1"]]' | agent-browser batch --json
```

### Authentication Patterns

```bash
# Auth Vault (recommended) — save encrypted credentials
echo "$PASSWORD" | agent-browser auth save github \
  --url https://github.com/login \
  --username user --password-stdin

agent-browser auth login github

# Session persistence — auto-save/restore across restarts
agent-browser --session-name myapp open https://app.example.com/login
# ... login ...
agent-browser close  # Auto-saves state
agent-browser --session-name myapp open https://app.example.com/dashboard  # Already logged in

# Manual state files
agent-browser state save ./auth.json
agent-browser state load ./auth.json
```

### Security Controls for AI Agents

```bash
# Domain allowlist — restrict navigation
agent-browser --allowed-domains example.com,api.example.com open https://example.com

# Content boundaries — CSPRNG nonces wrap output for LLM safety
agent-browser --content-boundaries snapshot -i

# Output limits — prevent context flooding
agent-browser --max-output 5000 snapshot

# Action confirmation — require approval for dangerous operations
agent-browser --confirm-actions eval,download eval "document.title"
```

---

## 4. The Dogfood Skill — First-Party Exploratory Testing

Agent-browser ships with a dedicated **"dogfood" skill** that implements systematic exploratory testing. This is the closest thing to a gorilla testing framework for AI agents.

### Installation

```bash
npx skills add vercel-labs/agent-browser --skill dogfood
```

### Workflow

```
1. Initialize    → Set up session, output dirs, report file
2. Authenticate  → Sign in if needed, save state
3. Orient        → Navigate to starting point, take initial snapshot
4. Explore       → Systematically visit pages and test features
5. Document      → Screenshot + record each issue as found
6. Wrap up       → Update summary counts, close session
```

### How It Works

The agent:
1. Opens the target URL and waits for networkidle
2. Takes an annotated screenshot and interactive snapshot to map the app structure
3. Identifies main navigation elements
4. Systematically visits each section, testing:
   - Interactive elements (buttons, forms, dropdowns, modals)
   - Edge cases (empty states, error handling, boundary inputs)
   - End-to-end workflows (create, edit, delete flows)
   - Browser console for errors
5. Documents each issue with evidence:
   - **Interactive bugs** → repro video + step-by-step screenshots
   - **Static bugs** (typos, visual) → single annotated screenshot
6. Produces a markdown report with severity classification

### Issue Taxonomy

The skill includes a comprehensive issue taxonomy covering seven categories:

| Category | Examples |
|----------|----------|
| **Visual/UI** | Layout problems, text clipping, z-index stacking, dark/light mode, animation glitches |
| **Functional** | Broken links, unresponsive controls, invalid validation, silent failures, race conditions |
| **UX** | Missing feedback, sluggish interactions (>300ms), cryptic errors, dead ends, no keyboard support |
| **Content** | Typos, placeholder text, truncated content, inconsistent terminology |
| **Performance** | Slow loading (>3s), janky scrolling, layout shifts, excessive requests, memory leaks |
| **Console/Error** | JS exceptions, 4xx/5xx, CORS errors, unhandled promise rejections |
| **Accessibility** | Missing alt text, unlabeled inputs, focus traps, insufficient contrast |

### Severity Levels

- **Critical** — Blocks a core workflow, causes data loss, or crashes the app
- **High** — Major feature broken or unusable, no workaround
- **Medium** — Feature works but with noticeable problems, workaround exists
- **Low** — Minor cosmetic or polish issue

### Usage

```bash
# Simple — just point at a URL
"dogfood vercel.com"

# With scope
"QA http://localhost:3000 — focus on the billing page"

# With authentication
"dogfood http://localhost:3000 — sign in to user@example.com"
```

### Key Design Principles

- **Repro is everything** — every issue needs proof matched to its type
- **Verify before documenting** — verify reproducibility with at least one retry
- **Document incrementally** — append each issue to report as found (survives interruption)
- **Test like a user, not a robot** — try common workflows, enter realistic data
- **Aim for 5-10 well-documented issues** — depth of evidence > count
- **Never read source code** — test as a user, all findings from browser observation

---

## 5. Gorilla/Exploratory Testing Patterns with AI Agents

### Terminology Clarification

- **Monkey testing** — random, unstructured inputs across the whole app to find crashes
- **Gorilla testing** — focused, repetitive testing of a specific feature/module to ensure robustness
- **Exploratory testing** — session-based, heuristic-driven testing guided by the tester's judgment

Agent-browser's dogfood skill is closest to **AI-driven exploratory testing** with elements of gorilla testing when scoped to specific features.

### Pattern 1: Dogfood Skill (First-Party)

The recommended approach. Install the dogfood skill and invoke it:

```
"dogfood http://localhost:3000"
"QA http://localhost:3000 — focus on the billing page"  # gorilla-style focused testing
```

The agent autonomously explores, tests, and documents findings.

### Pattern 2: Self-Verifying Build Loop

From Pulumi's "Ralph Wiggum Loop" pattern:

```
1. Agent makes code changes
2. Builds the project
3. Launches agent-browser against the running app
4. Takes snapshots and screenshots to verify behavior
5. If issues found, loops back to fix code
```

This is powerful for CI/CD — the agent verifies its own work using real browser interaction.

### Pattern 3: QA Agent with Vercel AI SDK

From the dev.to tutorial — a programmatic QA agent:

```typescript
// Define browser tools using Zod schemas
const tools = {
  browser_navigate: { /* go to URL */ },
  browser_snapshot: { /* get accessibility tree, max 30K chars */ },
  browser_click: { /* click by ref */ },
  browser_type: { /* fill input */ },
  browser_press_key: { /* keyboard */ },
  browser_scroll: { /* scroll */ },
};

// Agent loop with safety guardrails
const result = await generateText({
  model: llmProvider,
  tools,
  maxSteps: 25,  // prevent runaway execution
  timeout: 120_000,
  prompt: "Test signup flow and verify confirmation appears"
});
```

### Pattern 4: Playwright MCP Explore-and-Test

Playwright's own approach (for comparison):

```
1. AI explores site autonomously via MCP tools
2. Discovers functionalities
3. Identifies edge cases and potential bugs
4. Generates comprehensive Playwright test suites
```

However, this consumes significantly more tokens than agent-browser (see Section 6).

### Pattern 5: Browser Testing Patterns Skill (Community)

A community skill (`tommymorgan/claude-plugins-browser-testing-patterns`) that structures exploratory testing into phases:
- Functional testing
- Visual inspection
- Accessibility checks (WCAG)
- Performance analysis (Core Web Vitals)

Uses agent-browser for core automation, optional Playwright CLI for video demos, and Chrome DevTools MCP for deep performance profiling.

### Pattern 6: Focused Gorilla Testing

For true gorilla testing (hammering one feature), scope the dogfood skill:

```
"dogfood http://localhost:3000 — Focus exclusively on the form submission workflow.
Test every input field with: empty values, maximum length strings, special characters,
SQL injection attempts, XSS payloads, unicode, and rapid repeated submissions.
Try submitting with fields in various combinations of filled/empty."
```

The AI agent's judgment makes this more effective than traditional random input generation because it understands what constitutes meaningful edge cases.

---

## 6. Token Efficiency

This is agent-browser's primary competitive advantage for AI-driven testing.

### Benchmarks

| Metric | agent-browser | Playwright MCP | Chrome DevTools MCP |
|--------|:------------:|:--------------:|:-------------------:|
| **10-step workflow** | ~7,000 tokens | ~114,000 tokens | ~50,000 tokens |
| **Tool schema overhead** | 0 tokens (CLI) | ~13,700 tokens | ~17,000 tokens |
| **Single page snapshot** | 200-400 tokens | 3,000-5,000 tokens | — |
| **Single action response** | ~6 chars ("Done") | ~12,891 chars | — |
| **Page snapshot size** | ~280 chars | ~8,247 chars | — |

### Why It's So Efficient

1. **CLI model** — No tool schemas loaded into context window. Agent calls shell commands. Zero token overhead for tooling itself.
2. **Compact text output** — Accessibility tree with refs, not full DOM/HTML.
3. **Interactive-only filtering** — `snapshot -i` returns only actionable elements.
4. **Deterministic refs** — No need to re-describe elements; `@e1` is sufficient.
5. **Minimal responses** — Most action commands return just "Done" or a single value.

### Practical Impact

- **5.7×** more test cycles in the same context budget vs Playwright MCP
- **3.5×** faster execution (Vercel internal results)
- **37%** fewer tokens consumed
- **42%** fewer steps required
- **100%** success rate (up from lower with Playwright MCP)

### How the Agent Sees a Page

```
               [1]*  [2]Hacker News [3]new|   [4]past|  [5]comments|
               1.[11]upvote [12]Welcome (back) to Macintosh( [13]take.surf)
                       101 points by [14]Udo_Schmitz [15]1 hour ago | [16]hide| [17]42 comments
```

This ASCII wireframe representation is extremely token-efficient while preserving all interactive element references.

---

## 7. Limitations and Gotchas

### Known Issues (from GitHub issues tracker, 308 open as of 2026-03-23)

| Issue | Status | Impact |
|-------|--------|--------|
| **Ref expiration after navigation** | By design | Must re-snapshot after page changes; forgetting causes failed interactions |
| **`snapshot -i` vs `snapshot` confusion** | Fixed in docs (issue #566) | Agents waste turns using `-i` when they need content, not interactive elements |
| **Daemon has no idle timeout** | Fixed (issue #721) | Chrome processes persisted indefinitely; now auto-closes |
| **Multiple sessions sharing profile** | Open (issue #896) | Sessions using same `--profile` path connect to same Chrome, causing tab accumulation |
| **CDP connection drops on remote Browserless** | Fixed in v0.21.4 (issue #934) | WSS connections dropped between commands in v0.21.x |
| **Chrome extensions not loading** | Fixed (issue #640) | Content scripts not injected; Playwright direct works but agent-browser didn't |
| **Windows headed mode ignored** | Fixed (issue #90) | `AGENT_BROWSER_HEADED=1` had no effect on Windows |
| **`--profile` flag doesn't persist data** | Open (issue #253) | Browser data not actually persisted between sessions with `--profile` |

### Design Limitations

1. **Serial command execution** — Commands execute sequentially through daemon queue. No parallel command execution within a session.
2. **Accessibility tree dependency** — Snapshot quality depends on the page's ARIA implementation. Poorly-marked-up pages produce sparse snapshots.
3. **No visual reasoning** — Agent sees text representation, not pixels. Visual bugs (misalignment, color issues) require `screenshot --annotate` and LLM vision.
4. **25-second default timeout** — Commands timeout after 25s by default. Slow pages or heavy SPAs may need explicit waits.
5. **Session isolation** — Each session requires a separate browser instance. Resource-intensive for many parallel sessions.
6. **Rapid evolution** — 60 releases since Jan 2026. API surface still stabilizing. Breaking changes between versions (e.g., v0.21.x CDP regression).

### Practical Gotchas for Exploratory Testing

- **Always re-snapshot after navigation** — Refs become stale after page changes.
- **Use `snapshot` (no flag) for reading content**, `snapshot -i` for finding interactive elements. This distinction trips up agents frequently.
- **Use `agent-browser` directly, never `npx agent-browser`** — npx routes through Node.js and is significantly slower than the Rust binary.
- **Close sessions explicitly** — `agent-browser close` or `agent-browser --session name close`. Otherwise Chrome processes accumulate.
- **State persistence is unreliable** — The `--profile` flag may not persist data. Use `state save`/`state load` for reliable session persistence.
- **Dynamic content may not appear in snapshots** — Content loaded via JavaScript after initial render may need explicit `wait` commands before snapshotting.

---

## 8. Comparison with Alternatives

### agent-browser vs Playwright MCP

| Aspect | agent-browser | Playwright MCP |
|--------|:------------:|:--------------:|
| **Designed for** | AI agents (agent-first) | General automation (agent support added) |
| **Context efficiency** | ~200-400 tokens/page | ~3,000-5,000 tokens/page |
| **Tool overhead** | 0 (CLI commands) | ~13,700 tokens (26+ tool schemas) |
| **Interaction model** | Shell commands + refs | Protocol-based tool calls |
| **State management** | Disk-based (explicit save/load) | In-context (accumulates) |
| **Test generation** | Via dogfood skill (reports) | Built-in test codegen from exploration |
| **Visual capabilities** | Screenshots + annotated screenshots | Screenshots + accessibility tree |
| **Setup complexity** | `npm i -g agent-browser && agent-browser install` | MCP server configuration required |
| **Exploratory testing** | First-party dogfood skill | Explore-and-test mode |
| **Sandboxed agents** | Requires filesystem access | Works without filesystem |
| **Maturity** | ~3 months old (Jan 2026) | Years of development |
| **Community** | 24K stars, rapid growth | Massive ecosystem |

### When to Use Which

**Use agent-browser when:**
- Token efficiency is critical (long sessions, many iterations)
- Agent has filesystem/shell access (Claude Code, Codex, Copilot)
- Exploratory/gorilla testing is the goal
- Sessions exceed 5-10 page interactions
- Cost-sensitive workflows

**Use Playwright MCP when:**
- Agent is sandboxed without filesystem access
- Brief exploratory sessions (<5 interactions)
- Need deep page introspection/debugging
- Self-healing tests requiring continuous state awareness
- Need to generate reusable Playwright test code

### agent-browser vs Bright Data's "Agent Browser"

**Important disambiguation:** Bright Data also has a product called "Agent Browser" — a cloud-based browser automation platform for AI agents. This is a completely different product focused on web scraping at scale with anti-bot bypass. Vercel's `agent-browser` (npm package) is the one relevant for testing.

### Other Alternatives

| Tool | Approach | Best For |
|------|----------|----------|
| **Rova AI** | Fully autonomous SaaS testing agent | Teams wanting zero-setup autonomous testing |
| **AI Test User** | SaaS exploratory testing with MFA support | E2E exploratory testing as a service |
| **BrowserStack AI** | AI agents in cloud browser grid | Cross-browser/device testing at scale |
| **Pilo (Tabstack)** | Open-source browser automation engine | Building custom AI agent pipelines |
| **browser-agent (Go)** | A2A protocol-based browser agent | Enterprise agent-to-agent architectures |

---

## Sources

### Official / Primary
- [GitHub: vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) — Source repo (24K stars, Apache-2.0)
- [agent-browser.dev](https://agent-browser.dev/) — Official documentation site
- [npm: agent-browser](https://www.npmjs.com/package/agent-browser) — npm package (183K weekly downloads)
- [skills.sh: dogfood skill](https://skills.sh/vercel-labs/agent-browser/dogfood) — Exploratory testing skill (12.9K weekly installs)
- [SKILL.md](https://github.com/vercel-labs/agent-browser/blob/main/skills/agent-browser/SKILL.md) — Full command reference skill

### Analysis & Tutorials
- [DeepWiki: vercel-labs/agent-browser](https://deepwiki.com/vercel-labs/agent-browser) — Architecture deep-dive, highly authoritative
- [Dev.to: Token Efficiency War](https://dev.to/chen_zhang_bac430bc7f6b95/why-vercels-agent-browser-is-winning-the-token-efficiency-war-for-ai-browser-automation-4p87) — Benchmark data, dated 2026
- [Dev.to: Build QA Agent](https://dev.to/smakosh/build-an-ai-powered-qa-agent-with-agent-browser-vercel-ai-sdk-and-llm-gateway-2om0) — Programmatic QA agent tutorial
- [Pulumi Blog: Self-Verifying AI Agents](https://www.pulumi.com/blog/self-verifying-ai-agents-vercels-agent-browser-in-the-ralph-wiggum-loop/) — Self-verification pattern
- [Apiyi Guide](https://help.apiyi.com/en/agent-browser-ai-browser-automation-cli-guide-en.html) — Complete guide with Playwright comparison
- [TestDino: Playwright CLI vs MCP](https://testdino.com/blog/playwright-cli-and-mcp/) — CLI vs MCP comparison for AI agents

### Context
- [Towards AI: Vercel Just Solved Browser Automation](https://pub.towardsai.net/vercel-just-solved-browser-automation-for-ai-agents-b3414ebdb4d7) — Overview article, Jan 2026
- [ClaudeKit: Agent Browser docs](https://docs.claudekit.cc/docs/engineer/skills/agent-browser) — Community documentation
- [LobeHub: Browser Testing Patterns](https://lobehub.com/skills/tommymorgan-claude-plugins-browser-testing-patterns) — Community exploratory testing skill
- [testRigor: Monkey vs Gorilla Testing](https://testrigor.com/blog/monkey-testing-vs-gorilla-testing/) — Testing terminology reference

### GitHub Issues (Limitations Evidence)
- [#934: CDP connection drops](https://github.com/vercel-labs/agent-browser/issues/934) — v0.21.x regression, fixed
- [#896: Multiple sessions sharing profile](https://github.com/vercel-labs/agent-browser/issues/896) — Open
- [#721: Daemon no idle timeout](https://github.com/vercel-labs/agent-browser/issues/721) — Fixed
- [#640: Chrome extensions not loading](https://github.com/vercel-labs/agent-browser/issues/640) — Fixed
- [#566: Dogfood snapshot confusion](https://github.com/vercel-labs/agent-browser/issues/566) — Fixed
- [#253: --profile doesn't persist](https://github.com/vercel-labs/agent-browser/issues/253) — Open
