# Raw Research Findings: VS Code AI Agent CLI Integration

## Finding 1: Claude Code VS Code Extension Architecture

The Claude Code VS Code extension uses a **webview panel** as its UI, NOT the integrated terminal. Under the hood, it spawns the Claude Code CLI as a **child process** (subprocess) with bidirectional JSON streaming communication.

### Process Spawn Details
- Extension bundles the CLI at: `~/.vscode-server/extensions/anthropic.claude-code-X.X.X/resources/claude-code/cli.js`
- Spawns via Node.js: `node <path>/cli.js --output-format stream-json --verbose --input-format stream-json`
- Communication: bidirectional NDJSON (newline-delimited JSON) over stdin/stdout
- The `claudeCode.claudeProcessWrapper` setting allows customizing the executable path

### Webview Communication
- Extension uses channel-based message passing: Webview -> Extension Host -> Claude Process
- Messages flow as: `{"type":"io_message","channelId":"...","message":{"type":"user",...}}`
- Session lifecycle managed via hooks: SessionStart, SessionEnd, Stop

### Built-in IDE MCP Server
- The extension runs a local MCP server on 127.0.0.1 (random high port)
- Fresh auth token generated per activation, stored in ~/.claude/ide/ with 0600 permissions
- CLI connects to this MCP server to show diffs in VS Code's native diff viewer
- Only 2 tools exposed to model: getDiagnostics and executeCode (Jupyter)
- Rest are internal RPC for UI operations

### Terminal Mode Option
- Setting `claudeCode.useTerminal = true` switches to terminal mode
- In terminal mode, Claude Code runs in the integrated terminal instead of webview
- Both modes share conversation history

## Finding 2: VS Code Terminal Architecture

### PTY Host Process Isolation
- VS Code isolates shell I/O in a dedicated Pty Host process
- PtyHostService spawns the Pty Host via fork()
- PtyService maintains registry: Map<number, PersistentTerminalProcess>
- TerminalProcess wraps node-pty for individual pseudo-terminal sessions
- PersistentTerminalProcess adds session persistence with headless xterm.js for output replay

### IPC Channels
- localPty: Renderer -> Shared Process (proxies IPtyService calls)
- ptyHost: Shared Process <-> Pty Host (main RPC channel)
- ptyHostWindow: Renderer -> Pty Host (window-scoped messages like resize)

### Shell Integration (OSC 633)
- Opt-in feature injecting escape sequences into shell prompt scripts
- OSC 633 codes: A (PromptStart), B (CommandStart), C (CommandExecuted), D (CommandFinished), E (CommandLine), P (Property)
- ShellIntegrationAddon is an xterm.js addon in the Pty Host process
- PromptInputModel reads xterm buffer to reconstruct input without shells reporting every keystroke

### Non-Shell Program Handling
- Shell integration requires programs to actively emit OSC sequences
- Without sequences, structured command lifecycle info unavailable
- PromptInputModel provides fallback by reading xterm buffer
- Julia REPL is an example of non-shell program implementing OSC 633

## Finding 3: GitHub Copilot Agent Mode

### Architecture
- Agent mode runs in VS Code's native ChatWidget (NOT a webview)
- ChatWidget is a reusable component embedded in panel view and chat editor
- Uses ChatInputPart (CodeEditorWidget) and WorkbenchObjectTree
- ChatViewPane hosts ChatWidget in sidebar/panel location

### Tool System
- LLM receives: query, summarized workspace structure, OS context, tool descriptions
- Tools: read_file, edit_file, run_in_terminal, search, etc.
- Agent mode supports tool-calling loops
- Each tool invocation transparently displayed in UI

### Terminal Command Execution
- Creates dedicated terminal instances for command execution
- Agent terminals distinguished by chat icon in terminals list
- Terminal tool requires approval before execution
- Users can edit proposed commands before running
- Background execution supported for long-running commands
- Uses configured default shell (except cmd)

### Copilot CLI Sessions
- Separate product: runs outside VS Code process in background containers
- VS Code detects sessions automatically, displays in Chat view
- Supports worktree and workspace isolation modes

## Finding 4: Claude Code SDK Transport

### Python SDK Subprocess Transport
- Finds CLI via PATH or common install locations
- Spawns with: `--output-format stream-json --verbose`
- stdin is NOT used for ongoing communication in basic mode
- stdout streams NDJSON responses
- stderr collected for logging (10MB limit, 30s timeout)
- Environment: CLAUDE_CODE_ENTRYPOINT=sdk-py

### VS Code Extension Transport
- Uses BOTH --output-format and --input-format stream-json
- Bidirectional communication over stdin/stdout
- Persistent process maintains context across turns
