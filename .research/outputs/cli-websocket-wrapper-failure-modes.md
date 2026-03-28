# What Goes Wrong Wrapping Interactive CLI Tools Behind WebSocket/Programmatic Interfaces

Research conducted 2026-03-25. Based on real bug reports, production incidents, and practitioner experience.

---

## Summary

Wrapping interactive CLI tools behind WebSocket or programmatic interfaces is significantly harder than it appears. The problems are not theoretical -- they are well-documented across Claude Code's own issue tracker, Node.js ecosystem bugs, and decades of Unix PTY pain. The core difficulty is that CLI tools were designed for a human sitting at a terminal, and every layer you add between the human and the CLI introduces a new class of failure. The six major categories of real failure are: (1) stdio/PTY behavioral differences that change CLI output silently, (2) WebSocket connection instability that compounds with session state, (3) zombie processes and resource leaks from inadequate lifecycle management, (4) terminal escape sequence parsing that requires implementing a significant chunk of a terminal emulator, (5) breaking changes in the wrapped CLI that invalidate your parsing logic, and (6) authentication and permission models that were designed for interactive use and fight programmatic access.

---

## 1. Claude Code CLI Programmatic Wrapping: What Actually Broke

### 1a. Node.js Cannot Spawn Claude Code (The stdio Trap)

**Issue**: [anthropics/claude-code#771](https://github.com/anthropics/claude-code/issues/771)

Claude Code hangs indefinitely when spawned from Node.js using `child_process.exec()` or `child_process.spawn()` with default settings. The identical command works perfectly from Python's `subprocess.run()` or from the terminal.

**Root cause**: Node.js defaults to `stdio: 'pipe'` for all three file descriptors. Claude Code detects that stdin is a pipe (not a TTY) and enters a code path that hangs. The workaround is `stdio: ['inherit', 'pipe', 'pipe']` -- inheriting stdin from the parent process -- but this defeats the purpose of programmatic control since you can't write to stdin.

**The lesson**: The CLI's behavior changes fundamentally based on whether stdin is a TTY, a pipe, or /dev/null. This is not documented in the CLI's help text. You discover it by trial and error.

### 1b. SDK Subprocess Initialization Hangs, Leaves Zombie Processes

**Issue**: [anthropics/claude-code#18666](https://github.com/anthropics/claude-code/issues/18666)

When using `ClaudeSDKClient.connect()`, the SDK spawns `claude --output-format stream-json` and attempts an initialization handshake. This handshake times out after 60 seconds. Each failed attempt leaves a zombie `claude` process consuming 60-70% CPU. These zombie processes accumulate and appear to block subsequent connection attempts.

**The compounding failure**: First attempt fails silently. Second attempt now has a zombie blocking it. Third attempt has two zombies. The system degrades progressively. The only fix is `pkill -9 -f "claude.*stream-json"`.

**Status**: Closed as "not planned" -- the SDK team chose not to fix the cleanup path.

### 1c. Agent Teams Teammate Spawning Fails

**Issue**: [anthropics/claude-code#29293](https://github.com/anthropics/claude-code/issues/29293)

When Claude Code spawns teammate subprocesses, the `--agent-*` flags internally trigger `--print` mode, which requires input via stdin or as a command-line argument. But the spawning mechanism doesn't pipe the prompt to stdin. The subprocess crashes immediately with: `"Input must be provided either through stdin or as a prompt argument when using --print"`.

**The irony**: Claude Code itself cannot reliably spawn Claude Code as a subprocess. The tool's own internal subprocess spawning mechanism has the same stdio problems that external wrappers face.

### 1d. Each Subprocess Burns 50K Tokens of Overhead

**Source**: [DEV Community article](https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma)

Every subprocess invocation re-injects the full system prompt, MCP tool descriptions (10-20K tokens alone), plugin skill definitions, and user configuration. A single subprocess turn consumes ~50K tokens before doing any actual work. Five turns = 250K tokens of pure overhead.

**Root cause**: The subprocess model reloads global settings on every invocation rather than maintaining a persistent session. There is no built-in way to start a "lean" subprocess.

**Workaround**: Manually isolating the subprocess environment (scoped working directory, empty plugin directory, git boundary to prevent config traversal) reduces overhead from 50K to ~5K tokens. But this requires understanding Claude Code's config resolution internals.

---

## 2. WebSocket Connection Instability (Claude Code's Own Remote Control)

### 2a. 25-Minute Disconnect Cycle

**Issue**: [anthropics/claude-code#31853](https://github.com/anthropics/claude-code/issues/31853)

The Remote Control WebSocket drops every ~25 minutes with close code 1006 (abnormal closure). It reconnects successfully for the first 2-3 cycles, then permanently fails with close code 1002 (protocol error). After 1002, the client gives up entirely.

Timeline from logs:
```
00:29:45 Closed: 1006 -> reconnect -> Connected
00:54:53 Closed: 1006 -> reconnect -> Connected
01:20:01 Closed: 1006 -> reconnect attempt
01:20:02 Closed: 1002 -> Permanent close, not reconnecting
```

The WebSocket gateway has a ~25-minute idle timeout that ignores application-level keep-alives. The client treats 1002 as permanent even though prior reconnects all succeeded.

### 2b. Cloudflare Bot Mitigation Kills WebSocket Relay

**Issue**: [anthropics/claude-code#33232](https://github.com/anthropics/claude-code/issues/33232)

The `/remote-control` WebSocket relay fails because Cloudflare returns `cf-mitigated: challenge` headers, interpreting the WebSocket reconnection as bot traffic. The status bar immediately cycles between "connecting" and "reconnecting" in a loop. Commands sent from the web UI hang indefinitely in a "philosophizing / tinkering / loading" state.

Multiple independent sessions disconnect at identical timestamps, confirming server-side disconnections. No client-side workaround exists.

### 2c. Silent Disconnection with No Recovery

**Issue**: [anthropics/claude-code#34255](https://github.com/anthropics/claude-code/issues/34255)

Remote Control connections drop silently during long sessions (15-60 minutes). The built-in reconnection mechanism doesn't work after the drop. There is no API to detect the disconnection programmatically.

**Feature request**: [anthropics/claude-code#31840](https://github.com/anthropics/claude-code/issues/31840) asks for `claude remote-control status --json` so external watchdogs can detect failures. The current state is only visible in the terminal's status bar React component -- completely inaccessible to automation on headless servers.

### 2d. The General WebSocket Reliability Problem

**Source**: [WebSocket.org troubleshooting guide](https://websocket.org/guides/troubleshooting/timeout/)

"Silent disconnect" is a connection that's dead but nobody knows it -- the TCP stack hasn't detected the failure, the `onclose` callback hasn't fired, `readyState === WebSocket.OPEN`, but nothing can pass through. Every proxy, load balancer, and NAT device between client and server has an idle timeout. If no data flows within that window, the connection dies silently.

---

## 3. PTY vs Pipe: The Behavioral Divergence That Breaks Everything

### 3a. Buffering Changes Silently

**Source**: [Julia Evans - Why pipes get stuck buffering](https://jvns.ca/blog/2024/11/29/why-pipes-get-stuck-buffering/)

When stdout is a TTY, programs use line buffering (flush on newline). When stdout is a pipe, programs use block buffering (flush at 4-8KB). This is controlled by libc's `isatty()` check and happens invisibly.

**Concrete breakage**: `tail -f file | grep thing1 | grep thing2` produces no output. The first grep detects it's writing to a pipe and buffers. The data never reaches grep2 until 8KB accumulates. This is the same class of bug that affects any CLI wrapper reading from a pipe.

**The Ctrl-C data loss problem**: When you kill a pipeline, buffered data is destroyed. If your wrapper crashes or the WebSocket disconnects, any data sitting in pipe buffers is lost permanently.

Solutions and their limitations:
- `grep --line-buffered` -- must remember each command's specific flag
- `stdbuf -o0` -- fails on static binaries, unreliable on macOS
- `unbuffer` (from expect) -- creates a PTY, which enables unwanted side effects like color output
- Python, Ruby, Perl, C all buffer by default when piped

### 3b. Programs Change Behavior Based on TTY Detection

Programs don't just change buffering. They change features:
- **Color output**: Most CLIs disable ANSI colors when not on a TTY
- **Progress bars**: Suppressed when piped (curl, wget, npm)
- **Interactive prompts**: Skipped or error when not on a TTY
- **Output format**: Some CLIs produce machine-readable output only when piped (e.g., `ls` columns vs. one-per-line)
- **Pagers**: `git log` won't invoke `less` when piped
- **Line editing**: readline/editline features disabled

**The wrapper's dilemma**: If you use pipes, you get clean output but lose interactive features and get block-buffered delays. If you use a PTY, you get interactive behavior but now you're parsing escape sequences mixed into your output.

### 3c. stderr Behaves Differently

stderr is typically unbuffered or line-buffered even when piped (to ensure crash messages reach the screen). This means error output arrives with different timing than stdout, which complicates interleaving the two streams for the user.

---

## 4. Terminal Escape Sequence Parsing: Implementing Half a Terminal Emulator

### 4a. The Complexity of ANSI/VT100 Sequences

If you spawn with a PTY to get interactive behavior, the output stream contains terminal escape sequences: cursor positioning, color codes, alternate screen buffers, scroll regions, character set switches, and more.

The xterm control sequence spec defines hundreds of sequences. The state machine to parse them correctly has documented edge cases:
- Execute characters like `\n` and `\r` don't reset the parser state -- they get executed within whatever state the parser is in
- Some sequence types allow nesting; others don't
- Multibyte encodings (CJK) require catching partially transmitted byte sequences
- CSI sequences support up to 32 parameters with sub-parameters

### 4b. Alternate Screen Buffer

Programs like vim, less, and htop switch to an "alternate screen buffer" using escape sequences (`\e[?1049h` / `\e[?1049l`). This creates a separate display area with no scrollback. When the program exits, it restores the original screen.

**The web wrapper problem**: If vim is running inside your wrapped PTY, you need to track both the normal and alternate screen buffers. Resizing the terminal while in the alternate buffer corrupts the normal buffer (documented xterm.js bug [#510](https://github.com/xtermjs/xterm.js/issues/510)). Scrollback behavior changes when in alternate mode (xterm.js [#802](https://github.com/xtermjs/xterm.js/issues/802)). There was no API to detect alternate screen mode until xterm.js eventually exposed `buffer.active.type`.

### 4c. Extracting Structured Data from PTY Output

If your goal is to parse structured information (like a JSON response) from a CLI running in a PTY, you're fighting the terminal emulator layer. The PTY adds:
- CR/LF line endings instead of just LF
- Terminal control sequences interspersed with actual output
- Echo of input characters back to the output stream
- Terminal resizing escape sequences
- Application-mode cursor keys and other mode changes

**Pexpect's documentation says it directly**: Regular expression matching on streams is "inherently fragile" because you can't look ahead in a stream. You never know if the process has paused momentarily or is finished. Pexpect performs non-greedy minimal matches as a result, which leads to capturing partial or wrong data.

### 4d. Available Tools

- **xterm.js** (JS): Full terminal emulator in the browser. Used by VS Code, Theia, ttyd, WeTTY, and most web terminals. Handles the rendering side but you still need server-side PTY management.
- **node-pty** (JS/native): PTY spawning for Node.js. Used by VS Code. Has documented issues: freezes under debugger, EPIPE errors on Windows, killing PowerShell with pending input freezes the app, multiple sequential writes all fire at once with no completion detection.
- **VTE** (Rust): State machine parser from the Alacritty team.
- **node-ansiparser** (JS): ANSI parser that handles incomplete sequences across parse calls.

---

## 5. Session Management and Process Lifecycle Failures

### 5a. Zombie Process Accumulation

**Node.js issue**: [nodejs/node#46569](https://github.com/nodejs/node/issues/46569) -- Child processes spawned inside worker threads become zombies when the worker exits. If your main process spawns many workers over time, you can exhaust PIDs.

**General pattern**: When the wrapper process crashes, is killed, or the WebSocket disconnects, the spawned CLI process often continues running. If the wrapper doesn't properly SIGTERM/SIGKILL the child and `waitpid()` on it, the child becomes a zombie.

With Claude Code specifically, zombie subprocesses run at 60-70% CPU each, compounding resource usage.

### 5b. Signal Handling Mismatches

- On non-Windows platforms, `subprocess.kill('SIGINT')` may not be caught by the child process (Node.js [#22761](https://github.com/nodejs/node/issues/22761))
- node-pty reports exit code 0 when killing with SIGINT, even though the signal was 2 (node-pty [#461](https://github.com/microsoft/node-pty/issues/461))
- Killing a PTY with pending input can freeze the entire application
- Windows has no POSIX signals -- `kill()` forcefully terminates regardless of signal type

### 5c. Detached Process Groups

If you set `detached: true` on the child process and the parent exits, the child keeps running -- but now nothing is monitoring it. If you don't set `detached: true` and the parent crashes, the child receives SIGHUP and may or may not handle it gracefully.

**Process group management**: To kill a CLI and all its children (e.g., a shell that spawned subprocesses), you need to kill the process group (`kill(-pid, SIGTERM)`). But if the child created its own session (`setsid`), it's no longer in your process group.

### 5d. Session Persistence Across Disconnections

When a WebSocket client disconnects:
1. Is the CLI process still running? Maybe.
2. Can the client reconnect to the same session? Only if you buffered the output.
3. How much output was lost during the disconnection? Unknown -- pipe buffers may have discarded data.
4. Has the CLI moved to a different state (e.g., awaiting input) during the disconnection? You have no way to know without parsing the terminal state.

The claude-code-web project addresses this by buffering ~1000 lines of output and keeping sessions alive even after browser disconnect. But this introduces its own problems: memory consumption, stale sessions, and the need to garbage-collect old sessions.

---

## 6. Breaking Changes in the Wrapped CLI

### 6a. Claude Code's Rate of Change

Claude Code's changelog shows major releases every 1-2 weeks with regular additions of new CLI flags, output format changes, and behavioral modifications:
- New `--bare` flag added (changes startup behavior for scripted calls)
- New `--channels` permission relay
- Permission mode semantics changed (v2.1.78 broke `--dangerously-skip-permissions`)
- `--print` mode stdin handling fixed (implying it was previously broken)
- Agent SDK spawn semantics changed
- Remote Control WebSocket protocol changed
- Deprecated settings paths removed

### 6b. The Permission Flag Regression

**Issue**: [anthropics/claude-code#36168](https://github.com/anthropics/claude-code/issues/36168)

In versions newer than v2.1.77, `--dangerously-skip-permissions` stopped working entirely. Claude Code ignores the flag and prompts for permission on every edit. This is critical for automation -- any wrapper using this flag for hands-off operation broke silently when the CLI auto-updated.

The flag interaction between `--permission-mode` and `--dangerously-skip-permissions` also broke: using both together causes the latter to override the former, ignoring the specified permission mode entirely.

### 6c. Cross-Tool Format Fragmentation

Every AI coding CLI uses different configuration formats, output formats, and operational semantics:
- Claude Code: CLAUDE.md, JSONL streaming, specific flag conventions
- Cursor: .cursorrules, different JSON schemas
- Copilot CLI: AGENTS.md, different session models
- Each uses different file paths, different schemas, different concepts of what a "skill" or "rule" is

Building a generic wrapper that handles multiple AI CLIs means implementing separate parsers, flag translators, and behavioral adapters for each one.

### 6d. The Pexpect Warning

Pexpect's own documentation warns that output format parsing is "very risky, painful and slow" and should be used "only when higher-level alternatives don't support your device." The dollar sign ($) regex for end-of-line matching doesn't work because Pexpect reads character-by-character -- each character appears as end-of-line.

---

## 7. The "claude-code-web" Case Study

**Repository**: [vultuk/claude-code-web](https://github.com/vultuk/claude-code-web)

This is a real attempt to wrap Claude Code CLI behind a web interface. Architecture decisions reveal the problems encountered:

- Uses **node-pty** for spawning (accepting the escape sequence parsing burden)
- Uses **Socket.io** WebSocket layer (dealing with reconnection, auth)
- Implements **session persistence** (output buffering ~1000 lines)
- Had to add **authentication** as a breaking change in v2.0.0
- Had to implement **rate limiting** (100 req/min)
- Has **9 open issues** indicating ongoing reliability problems
- Depends on Claude Code CLI being in PATH on the server

The project demonstrates that wrapping a CLI for web access requires building: a PTY manager, a WebSocket relay, an authentication layer, a session store, an output buffer, a rate limiter, and a process lifecycle manager. Each of these is a source of bugs.

---

## Sources

### Claude Code Specific
- [anthropics/claude-code#771 - Can't spawn from Node.js](https://github.com/anthropics/claude-code/issues/771) - Closed/completed, stdio trap documented
- [anthropics/claude-code#18666 - SDK zombie processes](https://github.com/anthropics/claude-code/issues/18666) - Closed as "not planned"
- [anthropics/claude-code#29293 - Agent Teams spawn failure](https://github.com/anthropics/claude-code/issues/29293) - Closed as duplicate
- [anthropics/claude-code#33232 - Remote Control reconnect loop](https://github.com/anthropics/claude-code/issues/33232) - Open bug
- [anthropics/claude-code#31853 - 25-min disconnect cycle](https://github.com/anthropics/claude-code/issues/31853) - Open bug
- [anthropics/claude-code#34255 - Silent disconnection](https://github.com/anthropics/claude-code/issues/34255) - Open bug
- [anthropics/claude-code#31840 - No machine-readable RC status](https://github.com/anthropics/claude-code/issues/31840) - Feature request
- [anthropics/claude-code#36168 - Permission bypass broken](https://github.com/anthropics/claude-code/issues/36168) - Regression report
- [50K tokens per subprocess turn](https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma) - DEV Community, practitioner analysis
- [Programmatic --print mode guide](https://gist.github.com/JacobFV/2c4a75bc6a835d2c1f6c863cfcbdfa5a) - GitHub Gist, practical techniques
- [claude-code-web](https://github.com/vultuk/claude-code-web) - Real wrapper implementation, reveals architectural requirements

### PTY/Buffering/Pipes
- [Julia Evans - Why pipes get stuck buffering](https://jvns.ca/blog/2024/11/29/why-pipes-get-stuck-buffering/) - Excellent concrete examples, highly authoritative
- [TTY and Buffering](https://mattrighetti.com/2026/01/12/tty-and-buffering) - Technical deep-dive on libc buffering behavior
- [Pexpect FAQ - buffering and TTY issues](https://pexpect.readthedocs.io/en/latest/FAQ.html) - Official documentation, decades of battle scars

### Terminal Emulation
- [xterm.js parser docs](https://xtermjs.org/docs/guides/hooks/) - Official, authoritative
- [xterm.js alternate screen issues](https://github.com/xtermjs/xterm.js/issues/802) - Real bugs
- [VT100 ANSI parser state machine](https://vt100.net/emu/dec_ansi_parser) - Reference standard
- [node-pty issues](https://github.com/microsoft/node-pty/issues) - Platform-specific PTY bugs

### WebSocket Reliability
- [WebSocket timeout troubleshooting](https://websocket.org/guides/troubleshooting/timeout/) - Silent disconnection patterns
- [Node.js child_process zombie issues](https://github.com/nodejs/node/issues/46569) - Zombie process accumulation

### Process Lifecycle
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) - Detached process, signal handling reference
- [Killing process families with Node](https://medium.com/@almenon214/killing-processes-with-node-772ffdd19aad) - Process group management

---

## Confidence Assessment

- **Overall confidence**: HIGH. These findings are based on real bug reports with reproduction steps, official documentation, and practitioner post-mortems. The patterns are consistent across multiple independent sources.
- **Areas of high certainty**: PTY vs pipe buffering differences, WebSocket disconnection patterns, zombie process accumulation, escape sequence parsing complexity, Claude Code-specific issues.
- **Areas of moderate certainty**: The "generic wrapper across multiple CLIs" dimension had fewer specific sources. The fragmentation is evident from configuration format differences, but I found fewer documented cases of someone actually building a multi-CLI wrapper and documenting what broke.
- **What I could not find**: Detailed post-mortems from the VS Code team about building their terminal backend (they likely have the most production experience with this problem class, but internal learnings aren't public). Also could not find comprehensive documentation of how Claude Code's streaming JSON output format has changed across versions.
