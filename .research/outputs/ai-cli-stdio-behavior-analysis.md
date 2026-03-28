# AI Coding CLI stdio Behavior Analysis

## Research Question

If someone builds a generic stdio-to-WebSocket bridge for one of these CLIs, how much will break when they try the next one? What are the actual stdio behaviors, PTY requirements, and protocol differences?

## Summary

These four CLIs have fundamentally incompatible stdio behaviors. They fall into two categories: (1) CLIs with full-screen terminal UIs that are essentially unusable via raw stdio pipes (Claude Code interactive, Codex interactive, Copilot interactive, Cursor interactive), and (2) headless/print/exec modes that emit structured NDJSON but each with different message schemas. A generic bridge is feasible ONLY if you target the structured-output modes, never the interactive TUIs. Even then, the protocols diverge enough that you need per-CLI adapters. Codex is the only one with a properly designed, documented subprocess protocol (app-server JSON-RPC). Claude Code's stream-json works but has known bugs around process exit. Copilot's ACP is the newest and closest to an industry standard. Cursor copied Claude Code's interface almost exactly.

---

## Claude Code CLI

### Interactive Mode (no -p flag)

**Terminal Rendering Technology:** Custom React-based renderer. Originally used Ink (React for CLIs) but Anthropic rewrote the renderer from scratch while keeping React as the component model. Uses the Yoga WASM layout engine for layout calculations.

**PTY Requirement: YES, hard requirement for interactive mode.** The CLI checks `isatty()` and will not function without a TTY. It runs the terminal in **raw mode** (`-isig`), meaning Ctrl+C does NOT generate SIGINT -- it sends raw bytes (0x03) that Claude Code handles via its own keypress handler.

**Alternate Screen Buffer: YES.** The Ink-derived renderer uses alternate screen buffer. Original terminal content is restored when the app exits.

**ANSI Escape Codes: HEAVY.** The interactive UI emits:
- Cursor movement sequences for layout
- Color codes (truecolor where supported, with fallback)
- OSC 8 hyperlinks (clickable links in VS Code/Cursor terminals)
- OSC escape sequences for tmux passthrough
- Spinner animations on an isolated 50ms animation loop
- Progress bars, collapsible blocks, permission dialogs
- Multiple overlapping renders (streaming responses, status lines, animations) that send contradictory cursor positions

**Multi-line Input:** Shift+Enter inserts newlines in interactive mode. The input area supports multi-line editing.

**stderr:** Debug output goes to stdout, NOT stderr (this is a known bug, closed NOT_PLANNED -- issue #4859). Hook feedback signals blocking errors via stderr. In practice, stdout and stderr are not cleanly separated in interactive mode.

**Ctrl+C / Interrupt:** Known issues. During "Boondoggling" (thinking/streaming state), the event loop doesn't poll stdin for keypresses. Pressing Ctrl+C or Escape shows red feedback text but the agent often continues executing. The only reliable interrupt is `kill -INT <pid>` from another terminal (issues #17724, #3455, #17466).

### Print Mode (-p flag)

**PTY Requirement: COMPLICATED.** `-p` is documented for non-interactive use, but the CLI historically hangs without a TTY. Issue #9026 documents that `claude -p 'what is 2+2'` hangs indefinitely when spawned from Java ProcessBuilder, Node.js child_process, or any context where `ps` shows `TTY = ??`. The workaround is `stdio: ['inherit', 'pipe', 'pipe']` (inherit stdin from parent's TTY, pipe stdout/stderr). Python's subprocess.run() works because Python handles TTY differently. This issue was closed NOT_PLANNED.

**Without --output-format:** Emits plain text to stdout. No ANSI codes in the response body.

**With --output-format json:** Single JSON object on completion:
```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 1082218,
  "duration_api_ms": 940758,
  "num_turns": 82,
  "result": "the full text response...",
  "session_id": "uuid",
  "total_cost_usd": 5.573962
}
```

**With --output-format stream-json:** NDJSON (one JSON object per line). Event types include:
- `system` messages (init, api_retry events with attempt/max_retries/retry_delay_ms)
- `user` messages
- `assistant` messages (complete messages between tool calls)
- `stream_event` (when --include-partial-messages is set): wraps raw Claude API streaming events:
  - `message_start`, `content_block_start`, `content_block_delta` (text_delta, input_json_delta), `content_block_stop`, `message_delta`, `message_stop`
- `result` (final event with success/error status)

**CRITICAL BUG: Process hangs after final result event (issue #25629).** stdout remains open, process never exits after emitting the result event. Consumers must implement a timeout and force-kill after receiving the result. This breaks any `for await` iteration or stream-end listener. Related: issues #21099, #21133, #25670 (stdout not flushed when piped).

### Bidirectional stream-json (SDK mode)

The Agent SDK spawns Claude CLI with flags:
```
--input-format stream-json --output-format stream-json --include-partial-messages
```

Communication is NDJSON over stdin/stdout. Keep stdin open -- do NOT start a new process per message. Write user messages to stdin, read assistant/control messages from stdout. The `--input-format stream-json` usage is largely undocumented beyond the CLI flags table (issue #24594).

### TTY Detection Behavior

The CLI uses `ioctl(0, TCGETS, ...)` to detect TTY. When it detects non-TTY stdin:
- Interactive mode refuses to start
- Print mode has historically hung (though recent versions may have improved)
- The `script -q /dev/null claude -p '...'` workaround can fake a TTY on macOS

---

## OpenAI Codex CLI

### Interactive Mode (bare `codex`)

**Terminal Rendering Technology:** Built in **Rust** (95.7% of codebase). The TUI is a native Rust terminal application. (Note: earlier versions were TypeScript with Ink/React -- the Rust rewrite changed this. Some documentation still references the old TypeScript/Ink architecture.)

**PTY Requirement: YES for interactive mode.** The codex-cli launches a long-lived PTY for streaming output, REPLs, and interactive sessions. The unified PTY-backed exec tool is enabled by default (except on Windows).

**ANSI Escape Codes:** Uses OSC 9 notifications (desktop notifications in supported terminals) in auto mode, falls back to BEL (\x07). Standard ANSI color codes for UI rendering.

**Interactive mode is NOT designed for subprocess use.** It's a full TUI application.

### Non-Interactive Mode (`codex exec`)

**This is the correct mode for subprocess use.** No TTY required -- explicitly designed for CI/scripts.

**stdout/stderr Separation: CLEAN AND CORRECT.**
- stderr: Streams progress (session metadata, model name, sandbox status, step-by-step activity)
- stdout: Prints ONLY the final agent message (plain text by default)
- This enables clean piping: `codex exec "task" | tee output.md`

**Stdin:** Prompt is passed as command-line argument OR read from stdin with `-` placeholder:
```
codex exec "your task"
echo "your task" | codex exec -
```

**With --json flag:** stdout becomes JSONL stream with event types:
- `thread.started` (with thread_id)
- `turn.started`
- `turn.completed` / `turn.failed`
- `item.started` / `item.completed` (with item types: agent_message, command_execution, file_change, reasoning, plan, mcp_tool_call, web_search)
- `error`

Example:
```json
{"type":"thread.started","thread_id":"0199a213-81c0-7800-8aa1-bbab2a035a53"}
{"type":"turn.started"}
{"type":"item.started","item":{"id":"item_1","type":"command_execution","command":"bash -lc ls","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"Repo contains docs, sdk, and examples."}}
```

**--color flag:** `--color always|never|auto` controls ANSI color in stdout. Defaults to auto (uses color only when stdout is a TTY).

**--progress-cursor flag:** Has no observable effect when stdout/stderr are piped (not connected to a TTY).

### App-Server Mode (`codex app-server`)

**THIS IS THE BEST-DESIGNED SUBPROCESS PROTOCOL OF ANY CLI.**

**Protocol:** Modified JSON-RPC 2.0 (omits `"jsonrpc":"2.0"` header). Framed as JSONL over stdio.

**Transports:**
- `codex app-server` -- stdio (default), JSONL
- `codex app-server --listen ws://127.0.0.1:4500` -- WebSocket (experimental)

**Initialization Handshake (REQUIRED):**
1. Client sends `initialize` request with `clientInfo` (name, title, version) and optional capabilities
2. Server responds with user agent, codexHome, platform metadata
3. Client sends `initialized` notification
4. Only then may other requests proceed
5. Requests before initialization get `"Not initialized"` error

**Core Primitives:** Thread > Turn > Item hierarchy.

**Key Methods:**
- `thread/start`, `thread/resume`, `thread/fork` -- conversation management
- `turn/start` -- send user input, begins generation
- `turn/interrupt` -- cancel in-flight turn
- `turn/steer` -- add input to in-flight turn

**Notification Stream (server->client during turns):**
- `item/started`, `item/completed` -- lifecycle events
- `item/agentMessage/delta` -- streaming text
- `item/commandExecution`, `item/fileChange`, `item/plan`, `item/reasoning`
- `turn/started`, `turn/completed`
- `command/exec/outputDelta` -- base64 encoded stdout/stderr chunks

**Approval Flow (server-initiated requests):**
- Server sends approval requests (not notifications) when dangerous operations need user consent
- Command execution approvals: accept, acceptForSession, decline, cancel
- File change approvals: accept, acceptForSession, decline, cancel
- Client responds with decision; server emits `serverRequest/resolved`

**Overload:** Error code -32001 "Server overloaded; retry later" with bounded queues. Client should implement exponential backoff with jitter.

**Schema Generation:**
```
codex app-server generate-ts --out ./schemas
codex app-server generate-json-schema --out ./schemas
```

---

## Cursor CLI

### Interactive Mode

**PTY Requirement: YES, hard requirement.** Running the agent without a TTY hangs indefinitely. The documentation explicitly warns: "When running Cursor CLI from automated environments (AI agents, scripts, subprocess calls), the CLI requires a real TTY."

**No stdin pipe support:** "The CLI seems to have no practical way to read a prompt from a file or a stdin pipe, so you have to use `$(cat prompt.txt)`"

### Print Mode (`cursor-agent -p` / `cursor-agent --print`)

**Output Formats (same names and structure as Claude Code):**
- `text` (default): clean, final-answer-only
- `json`: single JSON object on completion
- `stream-json`: NDJSON with real-time events

**NDJSON stream-json event types (nearly identical to Claude Code):**
- `user` -- user message with content
- `assistant` -- assistant response with content
- `tool_call` (subtype: "started") -- tool invocations:
  - `shellToolCall`, `readToolCall`, `editToolCall`, `grepToolCall`, `lsToolCall`, `globToolCall`, `todoToolCall`, `writeToolCall`, `deleteToolCall`
- `tool_call` (subtype: "completed") -- results
- `result` -- final event with duration metadata

Example:
```json
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]},"session_id":"..."}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]},"session_id":"..."}
{"type":"tool_call","subtype":"started","call_id":"...","tool":"readToolCall","args":{"path":"..."}}
```

**Non-TTY Behavior:** Default output mode is stream-json when stdout is non-TTY or stdin is piped (auto-detection). But the process has the same hanging-after-completion bug as Claude Code.

**--force flag:** Required for file modifications in print mode. Without it, changes are only proposed, not applied.

**--stream-partial-output:** Enables incremental streaming of deltas.

**KNOWN BUG: Same as Claude Code -- process does not exit after completion in -p mode.** The forum thread confirms this affects Ubuntu, macOS, and GitHub Actions. Same timeout-and-kill workaround required.

### Relationship to Claude Code

Cursor's CLI output format is nearly a 1:1 copy of Claude Code's stream-json format. The event types, message structure, and NDJSON framing are almost identical. A bridge built for Claude Code's stream-json would work for Cursor with minimal adaptation (different tool call type names).

---

## GitHub Copilot CLI

### Interactive Mode

**Terminal Rendering Technology:** Uses **Ink** (React for CLIs) for terminal rendering. Renders JSX components to stdout.

**Alt-Screen Mode: YES (default since v1.0.8).** Full-screen buffer mode with enhanced mouse support. Switches to alternate terminal buffer.

**Also supports Normal Mode:** Scrolling terminal view (non-alt-screen) maintaining standard terminal state.

**ANSI Codes:** Reads terminal ANSI color palette (AUTO theme), uses ANSI color roles. Custom ASCII animation for welcome banner using advanced terminal engineering. Mouse scroll handling for macOS Terminal.app and terminals without SGR mouse encoding.

**PTY Requirement: YES for interactive mode.** Requires TTY for full interface with animated banner, status bars, interactive timelines.

**Input Types:** Natural language (plain text), slash commands (`/`), shell commands (`!` prefix).

**Keyboard:** Double-Escape clears input or triggers undo/rewind. Ctrl-C exits immediately from prompt mode.

### ACP Mode (`copilot --acp --stdio`)

**Protocol:** Agent Client Protocol (ACP) -- an emerging industry standard at agentclientprotocol.com.

**Transport:** NDJSON over stdin/stdout (stdio mode) or TCP.

**Launch:**
- `copilot --acp --stdio` (default when --acp is used alone)
- `copilot --acp --port 3000` (TCP mode)

**Protocol Foundation:** JSON-RPC over stdio (local agents). Uses JSON representations compatible with MCP where possible. Text defaults to Markdown.

**Message Envelope (from acpx client implementation):**
```json
{
  "eventVersion": 1,
  "sessionId": "abc123",
  "requestId": "req-42",
  "seq": 7,
  "stream": "prompt",
  "type": "tool_call"
}
```

**Capabilities:**
- Initialize connection and discover agent capabilities
- Create isolated sessions with custom working directories
- Send prompts with text, images, and context resources
- Receive streaming updates as agent works
- Respond to permission requests for tool execution
- Cancel operations and manage session lifecycle

**Message Flow:**
- Client sends initialization with protocol version and capabilities
- Client creates sessions specifying working directory and MCP servers
- Client submits prompts with text content
- Server streams responses with `sessionUpdate` callbacks
- Server sends `requestPermission()` callbacks (client can refuse)
- Response includes `stopReason` field indicating completion status

**Message types include:** `agent_message_chunk` with content type "text", tool_call events with stable envelope fields.

**ACP vs other protocols:** ACP is positioned as an industry standard meant to replace proprietary protocols. It's the newest of the four approaches (public preview January 28, 2026).

---

## Cross-CLI Comparison Matrix

| Feature | Claude Code | Codex | Cursor | Copilot |
|---------|-------------|-------|--------|---------|
| **Interactive TUI** | React/custom renderer | Rust TUI | Yes (unclear tech) | Ink (React) |
| **Alt-screen buffer** | Yes | Yes (TUI) | Yes | Yes (default) |
| **PTY required (interactive)** | Yes | Yes | Yes | Yes |
| **Non-interactive mode** | `-p` flag | `codex exec` | `-p` / `--print` | `--acp --stdio` |
| **PTY required (non-interactive)** | Historically yes (bug) | No | Yes (hangs without) | No (ACP mode) |
| **Structured output protocol** | NDJSON (stream-json) | JSONL (--json) | NDJSON (stream-json) | NDJSON (ACP) |
| **Proper subprocess protocol** | stream-json (uni/bidirectional) | app-server JSON-RPC | stream-json (Claude-like) | ACP JSON-RPC |
| **stderr/stdout separation** | Broken (debug->stdout) | Clean (progress->stderr, result->stdout) | Unknown/likely broken | Clean in ACP mode |
| **Process exits cleanly** | NO (known bug #25629) | Yes | NO (same bug as Claude) | Yes (ACP mode) |
| **Bidirectional communication** | --input-format stream-json (underdocumented) | app-server (fully documented JSON-RPC) | Unknown | ACP (fully bidirectional) |
| **Schema available** | No formal schema | `generate-json-schema` command | No formal schema | ACP spec (partial) |

---

## What Breaks When You Try the Next CLI

### If you build a bridge for Claude Code stream-json:

**Cursor:** Almost works. Same NDJSON format, same event types. Different tool call names (`readToolCall` vs `Read`). Same hanging bug. ~80% compatible.

**Codex exec --json:** Different event schema entirely. Uses `thread.started`, `turn.started`, `item.completed` vs Claude's `user`, `assistant`, `tool_call`. Different field names. Need a new adapter. 0% wire-compatible.

**Codex app-server:** Completely different protocol (JSON-RPC with initialize handshake, threads, turns, items). Full rewrite needed. But it's the best protocol of the bunch.

**Copilot ACP:** Different protocol (ACP JSON-RPC). Different message envelope. Different session model. Need a new adapter. 0% wire-compatible with Claude's format. But it's an industry standard that other tools will likely adopt.

### If you build a bridge for Codex app-server:

Best starting point for a multi-CLI bridge. Properly designed JSON-RPC with:
- Clean initialization handshake
- Explicit thread/turn/item lifecycle
- Server-initiated approval requests
- Schema generation for type safety
- Clean process lifecycle (no hanging bugs)
- Both stdio and WebSocket transports

You'd still need adapters for each other CLI, but the app-server protocol gives you the richest and most robust foundation to map others onto.

### If you build a bridge for Copilot ACP:

Second-best starting point. ACP is designed as an industry standard, so future CLIs may adopt it. Clean bidirectional protocol, session management, permission flow. But still new (public preview Jan 2026) and the spec isn't fully public yet.

---

## The Hard Truths

1. **No CLI works well as a raw subprocess with piped stdio in interactive mode.** Every single one requires a PTY for its TUI. None of them gracefully degrade to a text-only interface when they detect non-TTY stdin.

2. **Claude Code and Cursor have a critical process-exit bug.** Both hang indefinitely after completing work in -p/stream-json mode. You MUST implement timeout-and-kill logic. This is not a minor issue.

3. **Claude Code's stdin TTY requirement in -p mode is a trap.** The documentation says -p is for scripting, but it historically hangs without a TTY. The workaround is inheriting stdin from the parent's TTY, which means your bridge process needs a TTY itself.

4. **Codex is the only one that got stderr right.** Progress goes to stderr, results go to stdout. Claude Code puts debug output on stdout. This matters enormously for a bridge.

5. **The four structured-output protocols are completely incompatible.** Different event names, different schemas, different lifecycle models. A "generic" bridge needs four adapters, full stop.

6. **Codex app-server and Copilot ACP are the only two with proper bidirectional RPC.** Claude Code's `--input-format stream-json` is underdocumented and fragile. Cursor doesn't appear to support bidirectional communication at all.

7. **Interrupt handling is broken across the board.** Claude Code doesn't reliably respond to Ctrl+C during generation. The only reliable way to stop any of these is SIGKILL from the outside.

---

## Recommendations for a Bridge Implementation

1. **Target the structured-output modes exclusively.** Never try to bridge the interactive TUIs.

2. **Use Codex app-server as the reference architecture.** Its JSON-RPC protocol with proper initialization, lifecycle management, and approval flow is the gold standard. Map other CLIs onto this model.

3. **Implement per-CLI adapters** that translate each CLI's NDJSON/JSONL into a unified internal event model.

4. **Always implement timeout-and-kill for Claude Code and Cursor.** After receiving a `result` event, start a 30-second timer and SIGKILL if the process hasn't exited.

5. **For Claude Code, use `stdio: ['inherit', 'pipe', 'pipe']`** or fake a TTY with `script -q /dev/null`. Do not try to pipe all three file descriptors.

6. **For Codex, prefer app-server over exec --json** if you need bidirectional communication or approval handling.

7. **For Copilot, use ACP mode** (`--acp --stdio`). Don't try to scrape the interactive TUI.

8. **Expect ANSI codes in stderr** from all CLIs. Strip them in your bridge or pass them through to the client for rendering.

---

## Sources

### Claude Code
- [CLI Reference - Claude Code Docs](https://code.claude.com/docs/en/cli-reference) - Official documentation, highly authoritative
- [Headless Mode / Programmatic Usage](https://code.claude.com/docs/en/headless) - Official docs on -p mode
- [Agent SDK Streaming Output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) - Stream event format documentation
- [Issue #4859: debug/verbose don't output to stderr](https://github.com/anthropics/claude-code/issues/4859) - Closed NOT_PLANNED
- [Issue #9026: CLI hangs without TTY in -p mode](https://github.com/anthropics/claude-code/issues/9026) - Closed NOT_PLANNED
- [Issue #771: Can't spawn from Node.js](https://github.com/anthropics/claude-code/issues/771) - Documents inherit workaround, Closed COMPLETED
- [Issue #25629: Hangs after result in stream-json](https://github.com/anthropics/claude-code/issues/25629) - Critical subprocess bug
- [Issue #17724: Ctrl+C doesn't interrupt during Boondoggling](https://github.com/anthropics/claude-code/issues/17724) - Interrupt handling broken
- [Issue #24594: --input-format stream-json undocumented](https://github.com/anthropics/claude-code/issues/24594) - Documentation gap
- [DeepWiki: Claude Code UI/UX & Terminal Integration](https://deepwiki.com/anthropics/claude-code/3.9-uiux-and-terminal-integration) - Rendering architecture analysis
- [Issue #32632: ANSI escape codes in commit messages](https://github.com/anthropics/claude-code/issues/32632) - ANSI leakage issue
- [Headless-TTY project](https://github.com/revoconner/Headless-TTY) - Third-party workaround for TTY requirement

### OpenAI Codex
- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference) - Official docs, all command-line options
- [Non-Interactive Mode](https://developers.openai.com/codex/noninteractive) - Official codex exec documentation
- [App Server](https://developers.openai.com/codex/app-server) - JSON-RPC protocol documentation
- [Codex SDK](https://developers.openai.com/codex/sdk) - SDK documentation
- [GitHub: openai/codex](https://github.com/openai/codex) - Source repository (Rust)
- [Issue #2288: JSON output for codex exec](https://github.com/openai/codex/issues/2288) - Output format details
- [Issue #4776: JSON output mode docs out of date](https://github.com/openai/codex/issues/4776) - Schema documentation
- [Codex exec experiments gist](https://gist.github.com/alexfazio/359c17d84cb6a5af12bac88fa1db9770) - 81 flag/feature tests with raw outputs

### Cursor
- [Cursor CLI Output Format](https://cursor.com/docs/cli/reference/output-format) - Official output format docs
- [Cursor Headless CLI](https://cursor.com/docs/cli/headless) - Headless mode documentation
- [Forum: cursor-agent -p not exiting](https://forum.cursor.com/t/cursor-agent-p-non-interactive-not-exiting-at-the-end/133109) - Hang bug reports
- [Prettifying Cursor CLI Stream Format](https://tarq.net/posts/cursor-agent-stream-format/) - Actual raw NDJSON output analysis
- [Slicer: Run Headless Cursor CLI Agent](https://docs.slicervm.com/examples/cursor-cli-agent/) - Subprocess usage documentation

### GitHub Copilot
- [Copilot CLI ACP Server - GitHub Docs](https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server) - Official ACP documentation
- [ACP Public Preview Announcement](https://github.blog/changelog/2026-01-28-acp-support-in-copilot-cli-is-now-in-public-preview/) - ACP launch details
- [Agent Client Protocol](https://agentclientprotocol.com) - ACP specification site
- [ACPX: Headless ACP Client](https://github.com/openclaw/acpx) - Third-party ACP client with protocol details
- [DeepWiki: Copilot CLI Interactive Session Basics](https://deepwiki.com/github/copilot-cli/3.1-interactive-session-basics) - Architecture analysis
- [GitHub: copilot-cli](https://github.com/github/copilot-cli) - Source repository
- [GitHub Blog: ASCII Banner Engineering](https://github.blog/engineering/from-pixels-to-characters-the-engineering-behind-github-copilot-clis-animated-ascii-banner/) - Terminal rendering details

### Cross-Cutting
- [AWS Blog: Inside the Claude Agent SDK stdin/stdout Communication](https://buildwithaws.substack.com/p/inside-the-claude-agent-sdk-from) - Protocol analysis
- [Block/Goose Issue #7641: ANSI codes from Claude Code provider](https://github.com/block/goose/issues/7641) - ANSI code leakage when automating Claude Code

## Confidence Assessment

- **Overall confidence: HIGH** for Claude Code and Codex behaviors (well-documented, many GitHub issues, active communities)
- **Medium confidence** for Cursor (less documentation, but clearly derived from Claude Code's approach)
- **Medium confidence** for Copilot ACP (new protocol, limited real-world automation reports, spec not fully public)
- **Area of uncertainty:** Exact behavior of `--input-format stream-json` for Claude Code -- documentation is acknowledged as missing (issue #24594)
- **Area of uncertainty:** Whether Copilot's interactive mode emits any structured output when piped, or completely requires TTY
- **Area of uncertainty:** Whether Cursor has any bidirectional input mechanism beyond command-line prompt
- **Further research recommended:** Actually running each CLI with `strace`/`dtruss` to capture exact syscalls and byte-level stdio output; testing with `script -q /dev/null` TTY faker across all CLIs
