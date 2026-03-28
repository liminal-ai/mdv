# PTY-to-WebSocket Bridge: Engineering Tradeoffs

Research Date: 2026-03-25

## Summary

Building a PTY-to-WebSocket bridge is a well-understood problem with mature implementations across multiple languages. The core architectural decision is between embedding PTY management in your existing Node.js/Fastify server (simplest integration, highest risk surface) versus running a separate sidecar process in Go or Rust (more operational complexity, better isolation and reliability). Node.js via node-pty is the most common approach and powers VS Code's terminal, but it carries native addon baggage and thread-safety constraints. Go offers the best balance of simplicity, reliability, and operational characteristics for a standalone bridge. Rust offers the highest theoretical performance ceiling but with significantly more development effort for marginal gains in this I/O-bound use case.

The key insight from VS Code's architecture is that even Microsoft, who maintains node-pty, runs it in a **separate dedicated process** (the "Pty Host") rather than in-process with the renderer. This validates the sidecar pattern strongly.

## Key Findings

- **node-pty** (v1.1.0, Dec 2025) is actively maintained by Microsoft but is a native C++ addon requiring node-gyp builds, is explicitly not thread-safe, and has had event-loop-blocking bugs and memory/FD leaks in production
- **VS Code's architecture** isolates all PTY operations into a dedicated "Pty Host" process communicating over IPC, with replay buffers (headless xterm.js), flow control (high/low watermarks), and heartbeat monitoring
- **Go's creack/pty** (v1.1.24) is the most mature Unix PTY library across languages: pure Go, no CGo, 25K+ dependents, trivially concurrent via goroutines, single-binary deployment
- **Rust's portable-pty** (from wezterm) provides cross-platform PTY support but no ready-made WebSocket bridge exists; you'd build from scratch combining portable-pty + tokio-tungstenite
- **Python's terminado** (Jupyter project) is production-proven but Python's performance characteristics make it unsuitable as a high-throughput bridge
- **ttyd** (C, libwebsockets + libuv) and **gotty** (Go) are the two main open-source PTY-WebSocket bridges with established protocols
- For an I/O-bound PTY relay, language performance differences are marginal (within 10-20%); the bottleneck is the PTY/network, not CPU
- The **sidecar pattern** is strongly validated by both VS Code's architecture and general microservices practice

---

## 1. Node.js / TypeScript Approach (node-pty)

### Current State
- **Version**: 1.1.0 (released December 22, 2025)
- **Maintainer**: Microsoft (same team as VS Code)
- **Language composition**: TypeScript 54%, C++ 30.6%, JavaScript 10.4%, Python 3%, C 1.1%
- **Minimum**: Node.js 16 or Electron 19

### API Surface
```typescript
const ptyProcess = pty.spawn(shell, args, {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.HOME,
  env: process.env,
  handleFlowControl: true  // XOFF/XON support
});

ptyProcess.onData((data: string) => { /* terminal output */ });
ptyProcess.write('command\r');
ptyProcess.resize(100, 40);
```

### Platform Support
- **macOS**: Native PTY via forkpty(3). Requires Xcode.
- **Linux**: Native PTY via forkpty(3). Requires build-essential.
- **Windows**: ConPTY API (Windows 1809+, build 18309+). Winpty support removed entirely.

### Known Issues and Risks
1. **Native addon**: Requires node-gyp, C++ compiler, Python at install time. Distribution pain especially on Windows.
2. **Not thread-safe**: Explicitly documented. Cannot use across worker threads.
3. **Event loop blocking**: A tty refactor caused libuv event loop starvation where Node.js attempted to read a non-blocking FD as blocking. Fixed in recent versions but illustrates the fragility of native addon/Node integration.
4. **Memory/FD leaks**: Historical issues with termios struct leaks, /dev/ptmx leaks on macOS, inherited FD leaks in child processes on Linux. Fixed in recent releases but indicative of the native addon maintenance burden.
5. **Electron compatibility**: Requires rebuild for each Electron version. Prebuild forks exist (@homebridge/node-pty-prebuilt-multiarch) but fragment the ecosystem.
6. **Security**: All processes launched inherit parent process permissions. Microsoft recommends container isolation for internet-accessible servers.

### Integration with @fastify/websocket
@fastify/websocket (built on ws@8) provides:
- Route-level WebSocket handlers with `{ websocket: true }`
- Full hook integration (preValidation, onRequest) for auth before upgrade
- `verifyClient` for connection authorization
- `maxPayload` configuration
- `clientTracking` for session management

The integration is straightforward: spawn a node-pty process per session, pipe ptyProcess.onData to socket.send, pipe socket.on('message') to ptyProcess.write. However, you must handle:
- Binary vs text framing decisions
- A structured message protocol (not just raw bytes)
- Flow control / backpressure
- Cleanup on disconnect

### VS Code's Architecture (Instructive Reference)
VS Code's terminal uses node-pty but with significant infrastructure:
- **Pty Host process**: Dedicated Node.js child process owns all PTY instances, communicates with renderer via IPC
- **PersistentTerminalProcess**: Wraps each PTY with a headless xterm.js instance for replay buffer, enabling reconnection
- **Flow control**: Tracks accumulated bytes, pauses forwarding above `HighWatermarkChars`, resumes below `LowWatermarkChars`, client sends explicit acknowledgment messages
- **Heartbeat monitoring**: Parent process monitors Pty Host liveness
- **Process revival**: `reviveTerminalProcesses()` recovers after Pty Host restart

This is effectively a sidecar pattern within a single application.

### Verdict
Best choice if: you want the fastest path to integration with your existing Fastify server and are willing to accept native addon operational complexity. Worst choice if: you need reliable cross-platform distribution, multi-threaded operation, or want to minimize your Node.js process's risk surface.

---

## 2. Go Approach

### creack/pty
- **Version**: 1.1.24 (October 2024)
- **Dependents**: 25,300+ projects
- **License**: MIT
- **Platform support**: Linux, macOS, FreeBSD, OpenBSD, NetBSD, DragonFly BSD, Solaris, IBM z/OS. Partial Windows support (start_windows.go exists).

### API
```go
cmd := exec.Command("bash")
ptmx, err := pty.Start(cmd)               // or pty.StartWithSize(cmd, &pty.Winsize{Rows: 30, Cols: 80})
defer ptmx.Close()

// Resize
pty.Setsize(ptmx, &pty.Winsize{Rows: 40, Cols: 100})

// SIGWINCH handling
ch := make(chan os.Signal, 1)
signal.Notify(ch, syscall.SIGWINCH)
go func() {
    for range ch {
        pty.InheritSize(os.Stdin, ptmx)
    }
}()

// I/O: ptmx implements io.ReadWriteCloser
io.Copy(os.Stdout, ptmx)  // read output
ptmx.Write([]byte("ls\n")) // send input
```

### Existing PTY-WebSocket Bridges in Go

**gotty** (yudai/gotty, sorenisanerd/gotty fork):
- Mature WebSocket terminal server
- Defines a clean structured protocol (WebTTY):
  - Single-byte command prefix + payload
  - Input types: Input('1'), Ping('2'), ResizeTerminal('3')
  - Output types: Output('1'), Pong('2'), SetWindowTitle('3'), SetPreferences('4'), SetReconnect('5')
  - Terminal output is base64-encoded for safe text transmission
  - Resize sends JSON `{Columns: float64, Rows: float64}`
  - 1024-byte read buffer, mutex-serialized writes
  - No explicit backpressure (relies on blocking I/O)
- Read-only mode by default (must opt-in to permit writes)

**tty2web** (kost/tty2web):
- Fork of gotty with improvements: bind/reverse mode, bidirectional file transfer, basic Windows support
- Useful for NAT traversal scenarios

### Go Advantages for This Use Case
1. **Single binary**: No runtime dependencies. Deploy by copying a file.
2. **Goroutines**: Each PTY session is a goroutine (2KB stack). Thousands of concurrent sessions on modest hardware trivially.
3. **No native addon issues**: Pure Go PTY bindings, no CGo required on most platforms.
4. **Excellent concurrency primitives**: Channels, select, context cancellation map naturally to session lifecycle management.
5. **Low memory**: Typical Go WebSocket server handles 100K connections on modest hardware.
6. **Well-tested at scale**: gotty, tty2web, webkubectl all use this stack in production.

### Go Disadvantages
1. **GC pauses**: Can cause unpredictable latency spikes. For a PTY relay (not a financial trading system) this is not practically significant.
2. **Windows PTY**: creack/pty's Windows support is partial. If Windows is a hard requirement, this is a gap.
3. **Separate process**: If embedding in your Node.js app, you need IPC. If running as sidecar, this is an advantage.

### Verdict
Best overall choice for a standalone PTY-WebSocket bridge / sidecar. The gotty protocol is a proven design to adopt or adapt. Single-binary deployment is a major operational advantage.

---

## 3. Rust Approach

### Libraries
**portable-pty** (wezterm project):
- Cross-platform PTY: Linux, macOS, Windows (MSVC)
- Traits: PtySystem, MasterPty, SlavePty, Child, ChildKiller
- PtySize struct: rows, cols, pixel_width, pixel_height
- CommandBuilder for process spawning
- Reader/Writer pattern via `try_clone_reader()` / `take_writer()`
- Dev dependencies include futures and smol (async runtimes), but core API is synchronous

**tokio-tungstenite**:
- Async WebSocket on Tokio runtime
- Mature, well-maintained

**vte** (Alacritty project):
- State-machine ANSI escape sequence parser
- Useful for structured output extraction from PTY stream

### Existing Rust PTY-WebSocket Bridges
No established standalone project exists. You would build from scratch combining portable-pty + tokio-tungstenite (or axum with WebSocket support). This is viable but means writing and maintaining more code.

### Rust Advantages
1. **No GC, no runtime**: Lowest memory footprint, most predictable latency
2. **Safety guarantees**: Memory safety, thread safety enforced at compile time
3. **Excellent async ecosystem**: tokio is production-grade
4. **Single binary**: Like Go, deploy by copying a file
5. **Best ANSI parsing**: vte crate from Alacritty team is state of the art

### Rust Disadvantages
1. **Development velocity**: 2-3x slower than Go for this kind of systems glue code
2. **No existing bridge**: You're building from scratch, not adapting proven code
3. **Complexity overhead**: For an I/O-bound relay, Rust's performance ceiling doesn't materially help
4. **portable-pty API**: Synchronous core means you need to bridge to async (spawn_blocking or similar)
5. **Compile times**: Slower iteration during development

### Verdict
Makes sense only if: (a) you need to extract structured data from the PTY stream and want vte's ANSI parser, or (b) you're building a redistributable binary tool and want minimal resource footprint, or (c) the team already has Rust expertise. For a sidecar that primarily relays bytes, Go is more pragmatic.

---

## 4. Python Approach

### Libraries
**terminado** (Jupyter project):
- Tornado WebSocket handler for PTY processes
- Protocol: JSON arrays with message types ["stdout", data], ["stdin", data], ["set_size", rows, cols], ["setup", ...]
- Session management: Multiple clients per terminal, resize-to-smallest across clients
- Reconnection: Maintains a deque-based read_buffer, drains to reconnecting clients
- Uses ptyprocess (Unix) or pywinpty (Windows)
- Async writes via `@run_on_executor` to avoid blocking Tornado's event loop

**pexpect/ptyprocess**:
- Lower-level PTY management
- Primarily designed for process automation, not WebSocket bridging

### Python Advantages
1. **terminado is production-proven**: Powers Jupyter's terminal, massive user base
2. **Rich protocol**: JSON-based messages with proper session management
3. **Multi-client support**: Built-in handling of multiple clients per terminal with coordinated resize

### Python Disadvantages
1. **Performance**: Python's GIL and interpreter overhead make it the slowest option for throughput
2. **Deployment**: Requires Python runtime, virtualenv management
3. **Tornado coupling**: terminado is tightly coupled to Tornado; using with another framework requires significant adaptation
4. **Concurrency**: GIL limits true parallelism; asyncio helps but doesn't eliminate the fundamental constraint

### Verdict
Use terminado's protocol design as a reference implementation (particularly the multi-client session management and reconnection buffer), but don't adopt Python for a new PTY bridge.

---

## 5. Key Technical Challenges

### Session Management
- Each WebSocket connection needs a unique session ID mapped to a PTY process
- Sessions must track: PTY file descriptor, process PID, terminal dimensions, creation time, last activity
- Cleanup: PTY process must be killed and FDs closed when session ends
- Orphan detection: Background process to reap sessions where the WebSocket disconnected without clean close

### Reconnection / Session Persistence
Three approaches, in order of increasing capability:
1. **No persistence**: Session dies with WebSocket. Simplest.
2. **Replay buffer**: Maintain a circular buffer of recent PTY output. On reconnect, replay to restore visual state. VS Code uses headless xterm.js for this. terminado uses a deque.
3. **tmux/screen delegation**: Spawn the CLI inside tmux. The PTY bridge connects to the tmux session. Reconnection just reattaches to the existing tmux session. Most robust but adds a dependency.

The zmx project (Zig) is a notable lightweight alternative to tmux that provides only session persistence without window management, using Unix sockets.

### Terminal Resize
- Client sends resize message with new cols/rows
- Server calls pty.Setsize() (Go) or ptyProcess.resize() (Node) or equivalent
- This sends SIGWINCH to the child process
- Must coordinate if multiple clients share a terminal (terminado's "resize to smallest" approach)
- Pixel dimensions may also be relevant for sixel/image protocols

### Signal Forwarding
- Ctrl+C: Sends raw byte 0x03 through the PTY write side. The PTY's line discipline translates this to SIGINT for the foreground process group. No special handling needed if you're relaying raw bytes.
- Ctrl+D: Sends EOF (0x04). Same mechanism.
- Ctrl+Z: Sends SIGTSTP (0x1A).
- The PTY handles all of this natively as long as the bridge relays raw bytes faithfully. The key requirement is that the bridge must NOT interpret or filter these control characters.

### Output Parsing / Structured Event Extraction
This is the hardest problem and depends heavily on what you need:
- **Raw relay**: Just forward bytes. xterm.js on the client side handles all ANSI interpretation. Simplest and most common.
- **Structured extraction**: Parse the PTY output stream to identify prompts, command completions, error patterns, etc. Requires an ANSI state machine parser (vte in Rust, node-ansiparser in Node, stransi in Python). This is what makes tools like Claude Code's "read the terminal output" possible.
- **Hybrid**: Relay raw bytes to xterm.js AND run a parallel parser for event extraction. This is the architecture VS Code uses (headless xterm.js for state tracking, frontend xterm.js for rendering).

### Backpressure
- **Problem**: Fast-outputting commands (e.g., `cat /dev/urandom | xxd`) can overwhelm the WebSocket.
- **VS Code's approach**: Flow control with HighWatermarkChars / LowWatermarkChars. Server tracks bytes sent, pauses sending when above high watermark, resumes when client acknowledges processing. Client sends explicit ACK messages with character count.
- **gotty's approach**: No explicit backpressure. 1024-byte read buffer + mutex on writes. Relies on blocking I/O to naturally slow down.
- **WebSocket-level**: The ws library supports backpressure via `socket.bufferedAmount`. Check before sending; if above threshold, pause reading from PTY.

### Authentication
- @fastify/websocket supports `preValidation` hooks and `verifyClient` callback before WebSocket upgrade
- Token-based auth (query param or header) validated before upgrade is the standard pattern
- For sidecar pattern: the sidecar itself should validate tokens, not rely on the upstream proxy alone

### Binary vs Text Frame Handling
- **Text frames**: Simpler, but terminal output is not always valid UTF-8. gotty base64-encodes output to work around this.
- **Binary frames**: More efficient (no base64 overhead), handles raw terminal data natively. Use binary frames for PTY data, text frames for control messages.
- **Hybrid protocol**: Common pattern is to use a single byte prefix to distinguish message types (as gotty does), with the rest of the frame being either raw bytes (for PTY data) or JSON (for control messages).

---

## 6. Sidecar Pattern Analysis

### What VS Code Does
VS Code runs PTY operations in a **dedicated child process** (Pty Host) that communicates with the renderer via IPC. This is effectively an in-process sidecar. The Pty Host:
- Owns all PTY instances
- Has its own lifecycle (can crash without taking down the UI)
- Is monitored via heartbeat
- Can be restarted with session revival

### Advantages of a Sidecar PTY Bridge
1. **Isolation**: PTY crashes, memory leaks, or hangs don't affect the main application
2. **Language freedom**: Write the bridge in Go/Rust while the main app stays Node.js
3. **Independent scaling**: Can run multiple bridge instances if needed
4. **Independent updates**: Bridge binary can be updated without redeploying the main app
5. **Security boundary**: Tighter process permissions on the bridge
6. **Simpler main app**: No native addon complexity in the Node.js process

### Disadvantages
1. **IPC overhead**: Additional hop between main app and sidecar (typically negligible for PTY data volumes)
2. **Deployment complexity**: Two processes to manage instead of one
3. **Process lifecycle**: Need to start/stop/monitor the sidecar
4. **Configuration surface**: Two things to configure instead of one

### Communication Between Main App and Sidecar
Options:
1. **Direct WebSocket passthrough**: Client connects to sidecar directly. Main app just provides the sidecar URL. Simplest.
2. **WebSocket proxy**: Main app proxies WebSocket connections to sidecar. Adds latency but centralizes auth.
3. **Unix socket / IPC**: Sidecar listens on Unix socket, main app connects and relays to client WebSocket. Most isolated but most complex.
4. **Stdio**: Main app spawns sidecar as child process, communicates over stdin/stdout. Similar to VS Code's approach but simpler.

### Recommendation
For md-viewer's use case, **option 1 (direct connection)** or **option 4 (child process with stdio)** are most practical. Option 1 if the sidecar is a long-running service; option 4 if it should start/stop with the main app.

---

## 7. Performance Considerations

### The Reality: PTY Bridges Are I/O-Bound
The PTY read/write and WebSocket send/receive are the bottlenecks, not CPU. A typical terminal session produces kilobytes/second of output. Even `cat`-ing a large file through a PTY tops out at the PTY buffer size (typically 4KB-64KB per read). The performance differences between Go, Rust, and Node.js are **irrelevant** at these data rates.

### Where Performance Matters
1. **Latency**: Keystroke-to-echo round trip. All three languages can achieve sub-millisecond in-process latency. The network hop dominates.
2. **Concurrent sessions**: Go and Rust handle thousands of concurrent sessions with lower memory per session (~2KB goroutine stack vs ~1MB OS thread default). Node.js uses a single thread with event loop, which is fine for I/O but means a blocking PTY read (if it happens, as per the node-pty bug above) blocks ALL sessions.
3. **Memory per session**: Go ~10-50KB per session. Rust similar. Node.js with node-pty ~2-5MB per session (V8 overhead, native addon buffers, event emitter overhead).
4. **Startup time**: Go/Rust single binary starts in milliseconds. Node.js with native addon requires module loading (~100-500ms).

### Benchmark Reference Points (WebSocket servers generally)
- Rust: handles ~200K concurrent connections on modest hardware
- Go: handles ~100K concurrent connections on modest hardware
- Node.js: handles ~10-50K concurrent connections depending on payload (single-threaded constraint)

For a PTY bridge where you'll likely have 1-100 concurrent sessions, all three are wildly overprovisioned.

---

## 8. Protocol Design Recommendations

Based on gotty, ttyd, terminado, and VS Code's approaches, a recommended message protocol:

### Binary frame format (preferred)
```
[1 byte: message type][payload]
```

### Message Types (Client to Server)
| Type | Byte | Payload | Description |
|------|------|---------|-------------|
| INPUT | 0x01 | raw bytes | Keyboard input to PTY |
| RESIZE | 0x02 | JSON: {"cols": N, "rows": N} | Terminal resize |
| PING | 0x03 | empty | Keepalive |
| ACK | 0x04 | JSON: {"chars": N} | Flow control acknowledgment |

### Message Types (Server to Client)
| Type | Byte | Payload | Description |
|------|------|---------|-------------|
| OUTPUT | 0x01 | raw bytes | PTY output |
| PONG | 0x02 | empty | Keepalive response |
| EXIT | 0x03 | JSON: {"code": N} | Process exited |
| ERROR | 0x04 | JSON: {"message": "..."} | Error |
| SESSION | 0x05 | JSON: {"id": "...", "cols": N, "rows": N} | Session established |

Use binary frames throughout. No base64 encoding needed (that's a text-frame workaround). This is more efficient and handles raw terminal bytes correctly.

---

## Architecture Decision Matrix

| Factor | Node.js (in-process) | Node.js (sidecar) | Go (sidecar) | Rust (sidecar) |
|--------|----------------------|--------------------|--------------|----------------|
| Integration effort | Low | Medium | Medium | High |
| Operational complexity | Low | Medium | Medium | Medium |
| Native addon risk | High | High | None | None |
| Process isolation | None | Good | Good | Good |
| Distribution | Hard (gyp) | Hard (gyp) | Trivial | Trivial |
| Concurrent sessions | Limited | Limited | Excellent | Excellent |
| Memory per session | ~2-5MB | ~2-5MB | ~10-50KB | ~10-50KB |
| Development velocity | High | High | High | Low |
| Existing bridge code | None complete | None complete | gotty/tty2web | None |
| Windows support | Good (ConPTY) | Good (ConPTY) | Partial | Good (portable-pty) |

---

## Recommendation

**For md-viewer specifically**: Go sidecar binary is the strongest choice.

Rationale:
1. **gotty's WebTTY protocol** is a proven, battle-tested design you can adopt directly or fork
2. **Single binary** eliminates native addon build/distribution issues entirely
3. **Process isolation** means PTY problems never affect the Fastify server
4. **Goroutine-per-session** trivially handles concurrent terminals
5. **creack/pty** is the most mature PTY library across all languages (25K+ dependents)
6. **Development velocity** in Go for this kind of systems glue is comparable to Node.js
7. Your Fastify server can spawn the Go binary as a child process or connect to it as a service

The main tradeoff is adding Go to the project's build/deploy toolchain. If that's unacceptable, then Node.js with node-pty in a **separate child process** (VS Code's Pty Host pattern) is the second-best option -- but you should not run node-pty in the same process as your Fastify server.

---

## Sources

### Node.js / node-pty
- [microsoft/node-pty GitHub](https://github.com/microsoft/node-pty) - Official repository, v1.1.0, High authority
- [node-pty npm](https://www.npmjs.com/package/node-pty) - Package details and version history
- [VS Code Terminal Backend Architecture (DeepWiki)](https://deepwiki.com/microsoft/vscode/6.2-ai-agents-and-tool-integration) - Detailed Pty Host architecture
- [node-pty PR #831: Handle writes to non-blocking pty](https://github.com/microsoft/node-pty/pull/831) - Event loop blocking fix
- [VS Code PR #279172: Fix memory leak in terminal process](https://github.com/microsoft/vscode/pull/279172) - Memory leak fix
- [node-pty-prebuilt-multiarch](https://www.npmjs.com/package/@homebridge/node-pty-prebuilt-multiarch) - Prebuild distribution alternative
- [@fastify/websocket npm](https://www.npmjs.com/package/@fastify/websocket) - Official Fastify WebSocket plugin

### Go
- [creack/pty GitHub](https://github.com/creack/pty) - v1.1.24, 25K+ dependents, MIT license
- [gotty (yudai)](https://github.com/yudai/gotty) - Original PTY-WebSocket bridge
- [gotty (sorenisanerd fork)](https://github.com/sorenisanerd/gotty) - Maintained fork
- [gotty WebTTY protocol source](https://github.com/yudai/gotty/blob/master/webtty/webtty.go) - Protocol specification
- [tty2web](https://pkg.go.dev/github.com/kost/tty2web) - Extended gotty fork with reverse mode
- [creack/pty Go docs](https://pkg.go.dev/github.com/creack/pty) - API reference

### Rust
- [portable-pty (lib.rs)](https://lib.rs/crates/portable-pty) - Cross-platform PTY from wezterm
- [portable-pty docs.rs](https://docs.rs/portable-pty) - API documentation
- [tokio-tungstenite](https://lib.rs/crates/tokio-tungstenite) - Async WebSocket for Tokio
- [Build with Naz: PTY and OSC Sequences in Rust](https://developerlife.com/2025/08/10/pty-rust-osc-seq/) - Practical PTY usage, 2025

### Python
- [terminado GitHub](https://github.com/jupyter/terminado) - Jupyter's PTY-WebSocket bridge
- [terminado websocket.py](https://github.com/jupyter/terminado/blob/main/terminado/websocket.py) - Protocol implementation
- [terminado PyPI](https://pypi.org/project/terminado/) - Latest release March 2024

### C
- [ttyd GitHub](https://github.com/tsl0922/ttyd) - C-based PTY-WebSocket bridge, libwebsockets + libuv
- [ttyd project site](https://tsl0922.github.io/ttyd/) - Features and documentation

### Session Persistence
- [zmx GitHub](https://github.com/neurosnap/zmx) - Lightweight session persistence (Zig)
- [Claude Remote tmux architecture blog](https://clauderc.com/blog/2026-02-28-tmux-architecture-and-session-persistence/) - tmux for WebSocket session persistence

### Performance
- [WebSocket Performance Comparison (Medium)](https://matttomasetti.medium.com/websocket-performance-comparison-10dc89367055) - Cross-language benchmarks
- [Why I switched from Go to Rust for WebSocket servers](https://vhlam.com/article/why-i-switched-from-go-to-rust-for-extremily-high-performance-websocket-servers) - Go vs Rust analysis
- [WebSocket Shootout (Hashrocket)](https://hashrocket.com/blog/posts/websocket-shootout) - Multi-language comparison

### ANSI Parsing
- [vt100.net ANSI parser](https://vt100.net/emu/dec_ansi_parser) - Canonical state machine specification
- [node-ansiparser](https://github.com/netzkolchose/node-ansiparser) - Node.js ANSI parser
- [stransi (Python)](https://pypi.org/project/stransi/) - Python ANSI parser

## Confidence Assessment

- **Overall confidence**: High. This is a well-understood problem domain with multiple production implementations to reference.
- **Node.js/node-pty assessment**: High confidence. Based on primary sources (GitHub, npm, VS Code architecture docs).
- **Go assessment**: High confidence. creack/pty and gotty are extremely well-documented and widely used.
- **Rust assessment**: Medium-High confidence. Libraries exist but no integrated bridge; assessment of effort is based on API surface analysis rather than implementation experience.
- **Python assessment**: High confidence. terminado is well-documented and widely deployed via Jupyter.
- **Performance claims**: Medium confidence. Based on general WebSocket benchmarks, not PTY-specific measurements. The "I/O-bound so language doesn't matter" claim is well-supported by the data volumes involved.
- **Area of uncertainty**: Windows PTY support quality across Go and Rust. If Windows is a hard requirement, more investigation is needed.
