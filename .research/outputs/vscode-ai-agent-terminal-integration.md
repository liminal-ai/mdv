# How VS Code Handles AI Agent CLIs

## Summary

VS Code's AI agent integrations use three distinct architectural patterns, none of which rely on the standard terminal shell integration (OSC 633) for agent communication. The Claude Code extension spawns the CLI as a child process with bidirectional JSON streaming over stdin/stdout, rendering its UI in a webview panel (with an optional terminal mode). GitHub Copilot agent mode is built into VS Code's native chat system (ChatWidget, not a webview), and executes terminal commands by programmatically creating terminal instances via the extension API. Neither system depends on shell integration for agent-to-editor communication -- they use purpose-built IPC channels instead, and the terminal is only involved when the agent explicitly needs to run a shell command.

## Key Findings

- The Claude Code VS Code extension is a **webview panel** that spawns the bundled CLI as a **subprocess** with `--output-format stream-json --input-format stream-json`, communicating via bidirectional NDJSON over stdin/stdout. It does NOT use the Agent SDK's `query()` API.
- The extension bundles its own copy of the CLI at `~/.vscode-server/extensions/anthropic.claude-code-X.X.X/resources/claude-code/cli.js` and invokes it directly via Node.js.
- The extension also runs a **local MCP server** on localhost (random high port, token-authenticated) so that the CLI process can call back into VS Code for diffs, diagnostics, and Jupyter execution.
- There is a `claudeCode.useTerminal` setting that switches the extension to run in the integrated terminal instead of the webview, but the default is the webview panel.
- GitHub Copilot agent mode uses VS Code's **native ChatWidget** (not a webview) and executes terminal commands by creating **dedicated terminal instances** via the VS Code terminal API (`createTerminal` / `sendText`). The terminal tool requires user approval.
- OSC 633 shell integration is irrelevant for agent-to-editor communication. It only matters if you run Claude Code manually in the integrated terminal (via `claude` command), and even then it provides no agent-specific awareness.
- VS Code has **no special handling** for long-running interactive CLI programs that don't emit OSC 633 sequences. Such programs run in the terminal without structured command detection.

## Detailed Analysis

### 1. Claude Code VS Code Extension Architecture

The Claude Code extension uses a **dual-layer architecture**:

**Layer 1: Webview UI**
The extension renders a chat interface in a VS Code webview panel. This is a standard VS Code webview (HTML/CSS/JS running in an iframe-like sandbox), not a native VS Code UI component. The webview handles prompt input, conversation display, permission dialogs, and plan review. It communicates with the extension host via VS Code's standard webview message-passing API.

**Layer 2: CLI Subprocess**
The extension host spawns the Claude Code CLI as a child process. The specific invocation is:

```
node <extension-path>/resources/claude-code/cli.js \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  --append-system-prompt [...]
```

Communication is bidirectional NDJSON (newline-delimited JSON) over the process's stdin and stdout. The extension writes user messages to the CLI's stdin and reads streaming responses from stdout. This is the same `stream-json` protocol the Claude Code SDK uses, but the VS Code extension talks to the CLI directly rather than going through the SDK.

The message flow is: Webview -> (postMessage) -> Extension Host -> (stdin) -> CLI Process -> (stdout) -> Extension Host -> (postMessage) -> Webview.

**Layer 3: IDE MCP Server**
When the extension activates, it starts a local MCP server bound to `127.0.0.1` on a random high port. The CLI process connects to this server (authenticated via a fresh random token written to `~/.claude/ide/` with restrictive file permissions). This reverse channel lets the CLI:
- Open diffs in VS Code's native diff viewer
- Read the user's current editor selection (for @-mentions)
- Execute code in Jupyter notebook kernels
- Access VS Code diagnostics (Problems panel)

Only two tools from this MCP server are exposed to the LLM itself: `getDiagnostics` and `executeCode`. The rest are internal RPC used by the CLI for UI operations.

**Terminal Mode Alternative**
Setting `claudeCode.useTerminal = true` switches the extension to spawn Claude Code in a VS Code integrated terminal instead of the webview. In this mode, you interact with the CLI's own TUI (the same interface you see when running `claude` from any terminal). The extension's MCP server still runs, so diff viewing and IDE integration features still work. Both modes share conversation history.

**What it does NOT do:**
- It does not use the Claude Agent SDK's `query()` method
- It does not make direct API calls to Anthropic (the CLI handles all API communication)
- It does not use VS Code's chat participant API or ChatWidget

### 2. VS Code Terminal Architecture and Shell Integration

**PTY Host Architecture**
VS Code's integrated terminal uses a process-isolated architecture:
- A dedicated **Pty Host** process (forked from the main process) manages all pseudo-terminal sessions
- Each terminal instance is a `PersistentTerminalProcess` wrapping `node-pty`
- A **headless xterm.js** instance in the Pty Host replays terminal output for session persistence
- Communication flows through IPC channels: Renderer <-> Shared Process <-> Pty Host

**OSC 633 Shell Integration**
Shell integration is an opt-in protocol where shells emit special escape sequences:
- `OSC 633 ; A` -- Prompt start
- `OSC 633 ; B` -- Command start (prompt end)
- `OSC 633 ; C` -- Command executed (pre-execution)
- `OSC 633 ; D [; exitcode]` -- Command finished
- `OSC 633 ; E ; <commandline>` -- Explicit command line text
- `OSC 633 ; P ; Key=Value` -- Properties (Cwd, IsWindows, etc.)

These sequences are injected by shell-specific scripts that VS Code activates automatically for bash, zsh, fish, and PowerShell. The `ShellIntegrationAddon` (an xterm.js addon) parses them to build a `CommandDetectionCapability` that tracks command lifecycle, exit codes, and working directory.

**Non-Shell Programs**
When Claude Code (or any interactive CLI) runs in the terminal, VS Code has **no special awareness** of it. The shell integration sequences are emitted by the parent shell, not by the interactive program running inside it. This means:
- VS Code cannot distinguish "agent is thinking" from "agent is waiting for input"
- No structured command detection is available for the agent's internal operations
- The `PromptInputModel` can read the xterm buffer for basic input detection, but this is unreliable for complex TUI applications
- The Julia REPL is the only documented non-shell program that implements OSC 633

When Claude Code runs in the integrated terminal (either via `claude` command or via the `useTerminal` mode), it functions as any other interactive program -- VS Code sees raw terminal output and has no semantic understanding of the agent's state.

### 3. GitHub Copilot Agent Mode Architecture

Copilot agent mode is built on VS Code's **native chat system**, not a webview:

**ChatWidget** (`src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts`) is a reusable native VS Code component containing:
- `ChatInputPart` -- a `CodeEditorWidget` for prompt input
- `WorkbenchObjectTree` rendered by `ChatListRenderer` -- displays conversation turns
- `attachmentModel` for file, image, and tool attachments

**ChatViewPane** hosts the ChatWidget in the sidebar/panel, while **ChatEditor** hosts it as a full editor tab.

**Tool Execution**
The LLM receives a summarized workspace structure, OS context, and tool descriptions. It makes tool calls (read_file, edit_file, run_in_terminal, search, etc.) which VS Code executes and returns results for. This is a standard tool-calling loop.

For terminal commands specifically:
- Agent mode creates **dedicated terminal instances** via VS Code's terminal API
- These are visible in the terminal panel with a distinct chat icon
- Terminal commands require explicit user approval before execution
- Users can edit proposed commands before they run
- Long-running commands can be pushed to the background via "Continue in Background"
- Output can be displayed inline in chat or in the integrated terminal (configurable via `chat.tools.terminal.outputLocation`)

**Communication with Backend**
Copilot communicates with GitHub's backend API (not local LLM). The chat system uses `IChatService.sendRequest()` which creates `ChatRequestModel` and `ChatResponseModel` entries. Tool calls are part of the response stream. The backend returns tool_calls in the response, VS Code executes them locally, and sends results back.

**Copilot CLI (Separate Product)**
GitHub also offers Copilot CLI, which is distinct from agent mode. Copilot CLI sessions run **outside the VS Code process** in background containers. VS Code detects these sessions and displays them in the Chat view, but they're architecturally independent.

### 4. How VS Code Knows Agent State

**Short answer: it doesn't, for terminal-based agents.**

When an interactive CLI agent runs in the VS Code terminal, VS Code has no mechanism to determine whether the agent is generating output, waiting for user input, or processing. The OSC 633 sequences are shell-level constructs -- they mark command boundaries in the shell, not within interactive programs.

The approaches each tool uses instead:
- **Claude Code extension (webview mode)**: Knows agent state because it controls the subprocess directly via stdin/stdout JSON streaming. The extension parses the stream events to know exactly when the agent is thinking, using tools, or waiting for input.
- **Claude Code extension (terminal mode)**: The extension still maintains the MCP server connection, but state awareness is more limited than webview mode.
- **Claude Code in raw terminal**: No special state awareness. VS Code treats it like any interactive program.
- **Copilot agent mode**: Knows agent state because it controls the entire conversation via the chat system's request/response model. Terminal commands are tool calls that the agent initiates, not user-driven terminal interactions.

### 5. Does the Claude Code Extension Use the SDK?

No. The VS Code extension spawns the **CLI directly** as a subprocess, using the same `stream-json` protocol that the SDK uses, but without going through the SDK abstraction.

The Claude Code SDK (available in Python as `claude-code-sdk` and as the npm package `@anthropic-ai/claude-code`) is a separate product designed for programmatic integration. It also spawns the CLI as a subprocess with `--output-format stream-json`, but provides a higher-level API (`query()` method returning async iterables).

Some third-party implementations (like Claudeck) use the SDK's `query()` method directly in-process, with the SDK returning async iterables of messages. But the official VS Code extension does not use this pattern -- it manages the CLI subprocess directly for tighter control over the process lifecycle.

## Sources

- [Use Claude Code in VS Code - Official Docs](https://code.claude.com/docs/en/vs-code) - Official Anthropic documentation, highly authoritative. Documents the webview panel UI, terminal mode option, MCP server architecture, and all extension settings.
- [Claude Code GitHub Repository](https://github.com/anthropics/claude-code) - Official source repository.
- [Claude Code SDK Python - subprocess_cli.py](https://github.com/anthropics/claude-code-sdk-python/blob/343ec4812c4bb1b74ccaf4a370aa6d10f1374ad9/src/claude_code_sdk/_internal/transport/subprocess_cli.py) - SDK transport implementation showing CLI subprocess spawn pattern.
- [VS Code Terminal Shell Integration Docs](https://code.visualstudio.com/docs/terminal/shell-integration) - Official VS Code documentation on OSC 633 protocol and shell integration.
- [VS Code Terminal Backend: Pty Host and Shell Processes (DeepWiki)](https://deepwiki.com/microsoft/vscode/6.2-ai-agents-and-tool-integration) - Detailed architecture analysis of VS Code's terminal backend.
- [VS Code Terminal Shell Integration and Suggestions (DeepWiki)](https://deepwiki.com/microsoft/vscode/6.3-xterm.js-integration-and-rendering) - Technical deep dive on OSC 633 processing, ShellIntegrationAddon, and PromptInputModel.
- [VS Code Chat System (DeepWiki)](https://deepwiki.com/microsoft/vscode/13.1-chat-system) - Architecture of ChatWidget, ChatViewPane, and the native chat UI.
- [Introducing GitHub Copilot Agent Mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode) - Official VS Code blog post on agent mode architecture and tool system.
- [Copilot CLI Sessions in VS Code](https://code.visualstudio.com/docs/copilot/agents/copilot-cli) - Documentation on Copilot CLI session management.
- [Use Agent Mode in VS Code](https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode) - Official agent mode documentation with terminal tool details.
- [Claude Code Extension Issue #8510](https://github.com/anthropics/claude-code/issues/8510) - Feature request revealing bundled CLI path and `claudeProcessWrapper` setting.
- [Claude Code Extension Issue #25976](https://github.com/anthropics/claude-code/issues/25976) - Bug report revealing dual process spawn, MCP server communication, and config file management.
- [Claude Code Extension Issue #14760](https://github.com/anthropics/claude-code/issues/14760) - SessionEnd bug revealing webview->extension->process message flow and session lifecycle management.
- [Claude Code for VS Code - VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) - Official marketplace listing.

## Confidence Assessment

- **Overall confidence: High** for architectural patterns, Medium for some internal implementation details.
- The Claude Code extension architecture is well-documented through official docs, bug reports, and the SDK source code. The subprocess-with-JSON-streaming pattern is confirmed from multiple independent sources.
- Copilot agent mode's use of native ChatWidget (not webview) is confirmed through DeepWiki's VS Code source analysis. Terminal command execution via dedicated terminal instances is documented officially.
- The OSC 633 limitation for non-shell programs is clearly documented.
- **Area of uncertainty**: The exact internal IPC between the Claude Code extension host and its webview is not fully documented. The message format `{"type":"io_message","channelId":"..."}` was extracted from debug logs in bug reports, not from official architecture documentation.
- **Area of uncertainty**: Whether Copilot agent mode uses `createTerminal` + `sendText` or `vscode.Pseudoterminal` for its terminal tool is not confirmed from source code -- only inferred from the terminal API documentation and observable behavior.
