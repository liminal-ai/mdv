# Claude CLI Pipe/Headless Mode Research

**Date:** 2026-03-22
**Subject:** Claude Code CLI flags and behavior for non-interactive/child-process usage

---

## Summary

The Claude CLI (`claude` command, aka "Claude Code") has comprehensive support for non-interactive, programmatic usage via its `-p`/`--print` flag. This mode bypasses the TUI entirely, outputting clean text or structured JSON to stdout. Three output formats are available (`text`, `json`, `stream-json`), and there is a corresponding `--input-format stream-json` for piping conversations between Claude instances. The CLI manages its own conversation context via sessions persisted to disk, supports multi-turn continuation via `--continue` and `--resume`, and provides extensive flags for controlling model, tools, budget, and permissions. Anthropic now refers to this capability as the "Agent SDK" (CLI variant), having renamed the older "headless mode" terminology.

The CLI also has a companion programmatic SDK available as npm (`@anthropic-ai/claude-agent-sdk`) and pip (`claude-agent-sdk`) packages, which spawn the same CLI binary under the hood but provide native async iterators for message consumption. Both the raw CLI and the SDK share the same streaming protocol.

---

## Key Findings

- **`-p` / `--print`** is the primary flag for non-interactive mode. It prints the response to stdout and exits. There is no `--no-interactive` flag; `-p` is the mechanism.
- **`--output-format`** accepts three values: `text` (default), `json`, `stream-json`.
- **`--input-format`** accepts `text` (default) or `stream-json`, enabling piped multi-agent chains.
- **`--include-partial-messages`** enables token-level streaming within `stream-json` mode.
- **`--verbose`** is required alongside `stream-json` for full event output (without it, some event types are suppressed).
- **`--bare`** skips all auto-discovery (CLAUDE.md, hooks, MCP servers, plugins) for faster startup in scripted contexts. Anthropic recommends this for all `-p` usage and plans to make it the default.
- The CLI manages sessions on disk at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. The caller can opt out with `--no-session-persistence`.
- Cancellation via SIGINT has known issues in `stream-json` mode (process may not terminate immediately; see bugs #28408, #32223).

---

## Detailed Analysis

### 1. Non-Interactive Mode Flags

#### `-p` / `--print`

The primary flag. When present, Claude processes the prompt, writes output to stdout, and exits. No TUI is rendered. The prompt can come as a positional argument or via stdin pipe.

```bash
# Positional argument
claude -p "Explain this function"

# Stdin pipe
cat logs.txt | claude -p "Explain these errors"

# Combined with continuation
claude -c -p "Check for type errors"
```

There is **no** `--no-interactive` flag. The `-p` flag is the sole mechanism for non-interactive execution.

#### `--output-format` (requires `-p`)

| Value | Behavior |
|-------|----------|
| `text` | Default. Plain text to stdout. |
| `json` | Single JSON object written to stdout after completion. Contains `result`, `session_id`, `total_cost_usd`, `usage`, `duration_ms`. |
| `stream-json` | Newline-delimited JSON (NDJSON). Each line is a complete JSON event. Emitted in real-time as the agent works. |

#### `--input-format` (requires `-p`)

| Value | Behavior |
|-------|----------|
| `text` | Default. Prompt is plain text (argument or stdin). |
| `stream-json` | Stdin is interpreted as NDJSON messages, enabling conversation piping from another Claude instance. |

#### `--include-partial-messages` (requires `-p` and `--output-format stream-json`)

When set, emits `stream_event` messages containing raw API streaming events (token deltas). Without this flag, only complete messages are emitted.

#### `--verbose`

Required alongside `stream-json` for full event output. Shows full turn-by-turn output. Without `--verbose`, stream-json output may suppress intermediate events.

#### `--bare`

Skips auto-discovery of hooks, skills, plugins, MCP servers, auto memory, and CLAUDE.md. Dramatically reduces startup time and token consumption for scripted calls. Sets `CLAUDE_CODE_SIMPLE` env var. In bare mode, Claude has access to Bash, Read, and Edit tools only. Additional context must be passed explicitly via flags.

```bash
claude --bare -p "Summarize this file" --allowedTools "Read"
```

Anthropic states: "`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release."

---

### 2. Streaming JSON Format

#### Complete JSON Output (`--output-format json`)

```json
{
  "type": "result",
  "subtype": "success",
  "result": "The response text with \\n escaping",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_cost_usd": 0.001234,
  "usage": {
    "input_tokens": 10,
    "output_tokens": 50,
    "cache_read_input_tokens": 1000
  },
  "duration_ms": 2500
}
```

The `subtype` field indicates termination reason:
- `success` - completed normally
- `error_max_turns` - hit `--max-turns` limit
- `error_max_budget_usd` - hit `--max-budget-usd` limit
- `error_during_execution` - API failure or cancellation
- `error_max_structured_output_retries` - structured output validation failed

The `result` text field is **only present** on `success` subtype.

#### Streaming JSON Output (`--output-format stream-json --verbose`)

Each line is a complete JSON object. Event types include:

| Event Type | Description |
|------------|-------------|
| `system` (subtype `init`) | Session initialization with `session_id` |
| `system` (subtype `compact_boundary`) | Context compaction occurred |
| `system` (subtype `api_retry`) | API request failed, retrying |
| `assistant` | Complete assistant message with content blocks |
| `user` | Tool results sent back to Claude |
| `result` | Final result (same structure as `--output-format json`) |
| `stream_event` | Partial streaming event (only with `--include-partial-messages`) |

#### StreamEvent Detail (with `--include-partial-messages`)

Stream events wrap raw Claude API events:

```json
{
  "type": "stream_event",
  "event": { ... raw API event ... },
  "parent_tool_use_id": null,
  "uuid": "unique-event-id",
  "session_id": "session-uuid"
}
```

The inner `event` field contains standard Claude API streaming events:

| Inner Event Type | Description |
|------------------|-------------|
| `message_start` | Start of a new message |
| `content_block_start` | Start of a content block (text or tool_use) |
| `content_block_delta` | Incremental update (text_delta or input_json_delta) |
| `content_block_stop` | End of a content block |
| `message_delta` | Message-level updates (stop_reason, usage) |
| `message_stop` | End of the message |

**Extracting streaming text with jq:**
```bash
claude -p "Write a poem" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

#### API Retry Events

When an API request fails with a retryable error, a `system/api_retry` event is emitted:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"system"` | Message type |
| `subtype` | `"api_retry"` | Retry event |
| `attempt` | integer | Current attempt number (starting at 1) |
| `max_retries` | integer | Total retries permitted |
| `retry_delay_ms` | integer | Milliseconds until next attempt |
| `error_status` | integer or null | HTTP status code |
| `error` | string | Error category (`rate_limit`, `server_error`, etc.) |

---

### 3. Input Format (stream-json chaining)

The `--input-format stream-json` flag allows piping NDJSON conversations into a Claude instance via stdin. This enables multi-agent chaining:

```bash
claude -p --output-format stream-json "analyze dataset" | \
  claude -p --input-format stream-json --output-format stream-json "process results" | \
  claude -p --input-format stream-json "generate report"
```

Input NDJSON messages follow this structure:
```json
{"type":"init","session_id":"abc123","timestamp":"2026-01-01T00:00:00Z"}
{"type":"message","role":"assistant","content":[{"type":"text","text":"Analysis results..."}]}
```

This is primarily designed for agent-to-agent piping rather than interactive multi-turn conversations over stdin. For multi-turn use, the recommended approach is separate `claude -p` invocations with `--continue` or `--resume`.

---

### 4. Cancellation Behavior

**SIGINT (Ctrl+C):** Standard Unix signal handling applies. However, there are known issues:
- In `stream-json` mode (especially when piped), SIGINT may not terminate the process immediately. The process can continue executing until the current tool loop completes (GitHub issue #32223, closed as duplicate of #28408).
- SessionEnd hooks may be cancelled prematurely when using Ctrl+C (GitHub issue #32712, regression in v2.1.72).

**stdin close:** The CLI inherits standard Unix behavior for broken pipes. When used with `--input-format stream-json`, closing stdin should signal end-of-input.

**AbortController (SDK):** The TypeScript and Python Agent SDKs support abort signals for programmatic cancellation. The CLI itself does not expose an abort mechanism beyond Unix signals.

**Process group behavior:** There is a known issue (#31264) where Ctrl+Z sends SIGSTOP to the process's own PID instead of SIGTSTP to the process group, which breaks job control in containers.

**Practical guidance for child process usage:** Send SIGTERM or SIGINT to the process. Be prepared for the process to take some time to clean up, especially during active tool execution. If immediate termination is required, SIGKILL works but may leave orphaned child processes (MCP servers, etc.).

---

### 5. Session/Conversation Context Management

The CLI manages its own conversation context. Sessions are persisted to disk automatically.

**Storage location:** `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`
- `<encoded-cwd>` is the absolute working directory with non-alphanumeric characters replaced by `-`
- Example: `/Users/me/proj` becomes `-Users-me-proj`

**Session management flags:**

| Flag | Description |
|------|-------------|
| `--continue` / `-c` | Resume the most recent session in the current directory |
| `--resume` / `-r` | Resume a specific session by ID or name |
| `--session-id` | Use a specific session ID (must be valid UUID) |
| `--name` / `-n` | Set a display name for the session |
| `--fork-session` | Create a new session branched from the resumed one |
| `--no-session-persistence` | Don't save session to disk (print mode only) |

**Multi-turn pattern with session reuse:**
```bash
# First request
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')

# Continue with the same context
claude -p "Continue that review" --resume "$session_id"
```

**Multi-turn with `--continue`:**
```bash
claude -p "Review this codebase for performance issues"
claude -p "Now focus on the database queries" --continue
claude -p "Generate a summary of all issues found" --continue
```

**Key details:**
- Each `claude -p` invocation spawns a new process (~1-2s startup overhead).
- Sessions are local to the machine. Resuming across hosts requires manually copying the `.jsonl` file.
- The `--continue` flag finds the most recent session in the current working directory. If `cwd` differs between invocations, it won't find the session.
- Use `--no-session-persistence` for ephemeral, stateless CI/CD runs where you don't need to resume.

---

### 6. All Flags Relevant to Child Process Usage

#### Core execution flags
| Flag | Description |
|------|-------------|
| `--print` / `-p` | Non-interactive mode |
| `--output-format` | `text`, `json`, `stream-json` |
| `--input-format` | `text`, `stream-json` |
| `--include-partial-messages` | Token-level streaming events |
| `--verbose` | Full turn-by-turn output |
| `--bare` | Skip auto-discovery for fast startup |

#### Model and behavior
| Flag | Description |
|------|-------------|
| `--model` | Model selection: `sonnet`, `opus`, or full model ID |
| `--effort` | Reasoning depth: `low`, `medium`, `high`, `max` |
| `--fallback-model` | Auto-fallback when primary model is overloaded (print mode only) |
| `--max-turns` | Limit agentic turns (print mode only) |
| `--max-budget-usd` | Maximum dollar spend (print mode only) |

#### Session management
| Flag | Description |
|------|-------------|
| `--continue` / `-c` | Continue most recent session in current directory |
| `--resume` / `-r` | Resume specific session by ID or name |
| `--session-id` | Use specific session UUID |
| `--name` / `-n` | Name the session |
| `--fork-session` | Branch from resumed session |
| `--no-session-persistence` | Don't persist session to disk |

#### Permissions and tools
| Flag | Description |
|------|-------------|
| `--allowedTools` | Auto-approve specific tools |
| `--disallowedTools` | Block specific tools |
| `--tools` | Restrict available tools (`"Bash,Edit,Read"`) |
| `--permission-mode` | `default`, `plan`, `acceptEdits`, `bypassPermissions` |
| `--dangerously-skip-permissions` | Skip all permission prompts |
| `--permission-prompt-tool` | MCP tool for handling permission prompts in non-interactive mode |

#### System prompt
| Flag | Description |
|------|-------------|
| `--system-prompt` | Replace entire system prompt |
| `--system-prompt-file` | Replace system prompt from file |
| `--append-system-prompt` | Append to default system prompt |
| `--append-system-prompt-file` | Append from file |

#### Output control
| Flag | Description |
|------|-------------|
| `--json-schema` | Validate output against JSON Schema (print mode, requires `--output-format json`) |
| `--debug` | Debug mode with category filtering |

#### Context and configuration
| Flag | Description |
|------|-------------|
| `--add-dir` | Add additional working directories |
| `--mcp-config` | Load MCP servers from JSON file |
| `--strict-mcp-config` | Only use MCP servers from `--mcp-config` |
| `--settings` | Load settings from JSON file |
| `--setting-sources` | Control which setting sources to load (`user`, `project`, `local`) |
| `--agents` | Define custom subagents via JSON |
| `--agent` | Specify an agent for the session |

---

### 7. Agent SDK (Programmatic Alternative)

For applications that need tighter integration than spawning CLI subprocesses, Anthropic provides the Agent SDK:

- **TypeScript:** `npm install @anthropic-ai/claude-agent-sdk`
- **Python:** `pip install claude-agent-sdk`

The SDK provides native async iterators, typed message objects, AbortController support, callback-based tool approval, and automatic session management. It spawns the same CLI binary internally but handles process lifecycle, parsing, and session state automatically.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    includePartialMessages: true,  // enables streaming
    maxTurns: 10,
  }
})) {
  if (message.type === "stream_event") {
    const event = message.event;
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }
  if (message.type === "result") {
    console.log(`Done: ${message.subtype}, cost: $${message.total_cost_usd}`);
  }
}
```

The SDK also supports streaming input via async generators for long-lived multi-turn sessions within a single process.

---

## Sources

- [Official CLI Reference](https://code.claude.com/docs/en/cli-reference) - Authoritative. Complete flag reference from Anthropic. (Previously at docs.anthropic.com, now redirects to code.claude.com)
- [Official Headless/Programmatic Docs](https://code.claude.com/docs/en/headless) - Authoritative. Covers `-p` mode, output formats, streaming, bare mode, conversation continuation.
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) - Authoritative. Official SDK documentation covering TypeScript and Python packages.
- [Agent SDK Streaming Output](https://platform.claude.com/docs/en/agent-sdk/streaming-output) - Authoritative. Detailed StreamEvent reference, message flow, event types.
- [Agent SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions) - Authoritative. Session management, continue/resume/fork patterns.
- [Agent SDK Agent Loop](https://platform.claude.com/docs/en/agent-sdk/agent-loop) - Authoritative. Message types, result subtypes, tool execution, context window.
- [Agent SDK Input Modes](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) - Authoritative. Streaming input vs single message input.
- [JacobFV Gist: Using Claude Code Programmatically](https://gist.github.com/JacobFV/2c4a75bc6a835d2c1f6c863cfcbdfa5a) - Community. Practical guide to `--print --output-format=json` with code examples. Updated March 2026.
- [GitHub Issue #32223: stream-json SIGINT bug](https://github.com/anthropics/claude-code/issues/32223) - Primary source for cancellation issues. Closed as duplicate of #28408.
- [Avasdream Blog: Wrapping Claude CLI](https://avasdream.com/blog/claude-cli-agentic-wrapper) - Community. Input/output format matrix, subprocess patterns, session management.
- [ruflo Wiki: Stream Chaining](https://github.com/ruvnet/ruflo/wiki/Stream-Chaining) - Community. Detailed `--input-format stream-json` piping examples.
- [BSWEN: Claude Code Headless Mode](https://docs.bswen.com/blog/2026-03-13-claude-code-headless-mode) - Community. Practical `-p` flag tutorial. March 2026.
- [Reddit: 24/7 Claude Code Wrapper Token Costs](https://www.reddit.com/r/ClaudeAI/comments/1rc7yj8/) - Community. Real-world subprocess isolation patterns showing ~50K tokens per fresh subprocess startup without `--bare`.

---

## Confidence Assessment

- **Overall confidence: High.** The core findings are sourced from official Anthropic documentation (code.claude.com and platform.claude.com), which was fetched directly and is comprehensive.
- **High confidence:** `-p`/`--print` flag, `--output-format` values, `--model`, `--max-turns`, `--verbose`, session management via `--continue`/`--resume`, and the JSON output structure.
- **High confidence:** Streaming event types and their structure, as documented in the official Agent SDK streaming output reference.
- **Medium confidence:** `--input-format stream-json` behavior. The official CLI reference lists it, but detailed protocol documentation for the NDJSON input format is sparse in the official docs. Community sources (ruflo wiki, avasdream blog) fill in the gaps.
- **Medium confidence:** Cancellation/SIGINT behavior. Known to have issues per GitHub bug reports. The exact current state depends on the CLI version.
- **Area of uncertainty:** Whether `--verbose` is strictly required for `stream-json` output to include all event types, or merely recommended. The Elixir SDK changelog explicitly states "Added required `--verbose` flag for `stream-json` output format," but the official docs show examples both with and without it.
