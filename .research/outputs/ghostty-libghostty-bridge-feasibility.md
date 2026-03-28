# Ghostty / libghostty: Feasibility for CLI-to-WebSocket Bridge

**Date:** 2026-03-25
**Research scope:** Architecture, standalone library capabilities, headless usage, FFI integration, performance, and real-world non-GUI usage patterns.

---

## Summary

Ghostty's core terminal emulation is factored into **libghostty-vt**, a zero-dependency C/Zig library that provides VT sequence parsing, terminal state management, input encoding, and output formatting -- with no renderer, no windowing, and no GUI code whatsoever. It is explicitly designed for embedding. The library is already being used in production for exactly the kinds of use cases relevant to a CLI-to-WebSocket bridge: session multiplexers (zmx, vanish), web terminal servers (ghostty-web, webterm), session persistence daemons (hauntty), and embedded terminals in editors (emacs-libgterm, VS Code extensions).

The WASM compilation target is mature (~400KB binary, used by ghostty-web with xterm.js API compatibility), and the C API is functional though not yet API-stable. Real projects are building on it today across Zig, C, Go (via WASM), TypeScript (via WASM), Dart (via FFI), Swift, and .NET. The library's SIMD-optimized parser delivers 7.3x faster ASCII parsing than scalar implementations on Apple Silicon.

For a CLI-to-WebSocket bridge, libghostty-vt is the most capable option available. It solves the hardest problem (correct, fast VT state management) and leaves the transport layer (WebSocket, PTY management) to the consumer.

---

## Key Findings

- **libghostty-vt is a standalone, zero-dependency library** -- no libc required, no GUI, no renderer. It handles VT parsing, terminal state (cursor, styles, scrollback, reflow), and input/output encoding. This is the exact layer needed for a terminal bridge.

- **The C API is functional but unstable.** Headers exist at `include/ghostty/vt.h` covering terminal state, screen management, render state, key/mouse/focus encoding, OSC/SGR parsing, and formatters (text, VT, HTML output). API signatures are still changing.

- **WASM is a first-class target.** ghostty-web compiles to ~400KB WASM, provides xterm.js API compatibility, and is used in production by Coder. The RenderState API with dirty tracking reduces JS/WASM boundary crossings to O(dirty_rows) per frame.

- **Multiple real projects use libghostty-vt without a GUI today:**
  - **zmx** (Zig): tmux-lite in ~1000 LoC, session persistence via Unix sockets, renders terminal state on reattach
  - **hauntty** (Go): Uses WASM-compiled libghostty for terminal session persistence
  - **ghostty-web** (TypeScript/WASM): Browser terminal with WebSocket PTY integration
  - **webterm**: Web terminal server with dashboard mode and live terminal tiles for AI agent workflows
  - **vanish**: Lightweight session multiplexer
  - **ghostty-opentui**: VT parser with JSON output (headless parsing utility)

- **Performance advantages are real and measured:** 7.3x faster ASCII input processing with SIMD (M3 Max), 16.6x faster UTF-8 to UTF-32 decoding, fuzzed and Valgrind-tested.

- **Mitchell Hashimoto's stated goal is to replace xterm.js in VS Code** with libghostty via WASM. This signals long-term investment in the embeddable library use case.

---

## Detailed Analysis

### 1. Architecture

Ghostty is structured in clean layers:

| Layer | What it does | Standalone? |
|-------|-------------|-------------|
| **libghostty-vt** | VT parsing, terminal state, input encoding | Yes -- zero deps |
| **libghostty** (full) | Adds font handling, rendering state, glyph management | Partially -- needs font deps |
| **apprt** | App runtime abstraction (GTK, embedded/Swift, GLFW) | No -- platform-specific |
| **Platform apps** | macOS Swift GUI, Linux GTK GUI | No |

For a bridge, only libghostty-vt matters. It is the terminal state machine without any rendering or windowing opinions.

### 2. libghostty-vt API Surface

The C API headers cover:

- **`terminal.h`** -- Complete terminal emulator state creation and management
- **`screen.h`** -- Screen content access (cells, lines, attributes)
- **`render.h`** -- Incremental render state for building custom renderers
- **`grid_ref.h`** -- Grid traversal for reading terminal content
- **`key.h`** -- Key event to escape sequence encoding (supports Kitty keyboard protocol)
- **`mouse.h`** -- Mouse event encoding (SGR, URxvt, UTF8, X10 modes)
- **`focus.h`** -- Focus in/out event encoding
- **`osc.h`** -- OSC sequence parser
- **`sgr.h`** -- SGR (Select Graphic Rendition) parser
- **`formatter.h`** -- Export terminal content as plain text, VT sequences, or HTML
- **`paste.h`** -- Paste data safety validation
- **`modes.h`** -- Terminal mode flags
- **`wasm.h`** -- WebAssembly convenience functions
- **`allocator.h`** -- Custom memory allocator support

The formatter API is particularly relevant -- it can serialize terminal state to HTML, enabling server-side rendering of terminal output for initial page loads or snapshots.

### 3. Headless / Embedded Usage Model

libghostty-vt explicitly supports headless operation. The library's contract:

**Library provides:** VT parsing, state tracking, scrollback, reflow, input encoding
**Consumer provides:** PTY management, rendering (if any), windowing (if any), transport

This is confirmed by Ghostling (the reference implementation), which demonstrates that the consumer is responsible for all I/O and rendering. libghostty-vt is purely a state machine.

For a WebSocket bridge, the data flow would be:

```
CLI process <-> PTY <-> [your bridge code] <-> libghostty-vt <-> WebSocket <-> browser
```

libghostty-vt sits in the middle, maintaining accurate terminal state. The bridge code manages PTY I/O and WebSocket transport. The browser receives either:
- Raw VT sequences (if using ghostty-web/xterm.js on client side)
- Formatted HTML (using the formatter API for server-side rendering)
- Render state diffs (using the RenderState API for efficient updates)

### 4. VT/ANSI Parsing Quality

Ghostty's parser is a single-pass lexer/tokenizer optimized for the common case. Key characteristics:

- **SIMD-optimized**: Uses CPU-specific vector instructions for scanning input bytes
- **Handles all standard VT sequences**: CSI, OSC, ESC, DCS, plus modern extensions
- **Kitty keyboard protocol**: Full support for modern keyboard handling
- **Kitty graphics protocol**: Image display support
- **tmux control mode**: Integration with tmux
- **Comprehensive Unicode**: Full grapheme cluster support, bidirectional text
- **Fuzz-tested**: Robust against malformed input

**Comparison with alternatives:**

| Feature | libghostty-vt | xterm.js | VTE (GNOME/Rust) |
|---------|--------------|---------|-----------------|
| Language | Zig (C API) | JavaScript | Rust (C API) |
| SIMD optimization | Yes | No | No |
| Zero dependencies | Yes | No (DOM) | No (glib) |
| WASM target | Yes (~400KB) | N/A (already JS) | Not designed for it |
| Headless capable | Yes | Requires DOM shim | Yes (as parser only) |
| Standards compliance | Excellent | Good | Good |
| Kitty protocol | Full | Partial | Partial |

The xterm.js comparison is notable: when the xterm.js team evaluated libghostty, they found parsing performance "similar" despite the overhead of UTF-8 to UTF-32 conversion at the WASM boundary -- meaning libghostty's parser is doing the same work faster but losing some of that advantage to marshaling costs. For a native (non-WASM) integration, the speed advantage would be more pronounced.

### 5. Performance Characteristics

Specific measurements (from Mitchell Hashimoto's benchmarks on M3 Max):

- **ASCII parsing**: 7.3x faster with SIMD vs scalar
- **UTF-8 decoding**: 16.6x faster with SIMD
- **Memory**: Highly optimized page-based allocation for scrollback
- **Binary size**: ~400KB as WASM (entire parser + state machine)

For a bridge use case, the parsing speed matters when handling high-throughput CLI output (build logs, large file operations, streaming data). The memory efficiency matters for maintaining many concurrent terminal sessions.

### 6. Integration Feasibility (FFI)

Since libghostty-vt exposes a C ABI, it can be called from any language that supports C FFI:

**Node.js options:**
- `node-ffi-napi` -- Pure JS FFI, no compilation needed, dynamic loading of .so/.dylib
- N-API native addon -- Compile a thin C/C++ wrapper, most performant
- Bun FFI -- Built-in, zero-overhead for Bun runtime
- WASM -- Load the WASM build directly (ghostty-web proves this works)

**Go options:**
- `cgo` -- Standard C interop, link against libghostty-vt
- WASM via `wazero` or similar -- hauntty project demonstrates this approach

**Rust options:**
- Standard FFI via `extern "C"` -- Link against C library
- `bindgen` -- Auto-generate Rust bindings from C headers

**Practical recommendation for Node.js:** The WASM path is the most proven and portable. ghostty-web already does this. For maximum performance, a N-API native addon linking the C library would be faster but adds build complexity.

**Practical recommendation for a server-side bridge:** The native C library (not WASM) would give the best performance since you avoid WASM/JS boundary crossing overhead. Build libghostty-vt as a shared library, call via node-ffi-napi or N-API addon.

### 7. Existing Bridge-Like Projects

Several projects have already built variations of what you're considering:

**ghostty-web + webterm (closest to your use case):**
- Server spawns PTY per WebSocket connection
- PTY output -> WebSocket -> browser
- Browser uses WASM-compiled libghostty for rendering
- WebSocket on same HTTP port, supports reverse proxies
- webterm adds dashboard mode with live terminal tiles -- designed for running multiple AI coding agents

**zmx (session persistence angle):**
- Manages terminal sessions as Unix socket connections
- Stores terminal state via libghostty-vt
- On reattach, renders saved terminal state
- Supports sending commands without attaching (headless exec)
- Exports scrollback as plain text, VT, or HTML

**hauntty (Go + WASM approach):**
- Go application using WASM-compiled libghostty
- Terminal session persistence
- Demonstrates Go -> WASM -> libghostty integration path

### 8. The apprt Abstraction

Ghostty's `apprt` (app runtime) is its platform abstraction layer for windowing and event handling. It defines `App` and `Surface` interfaces with methods like `init()`, `terminate()`, `wakeup()`, `performAction()`, `getSize()`, and clipboard operations.

Current implementations: **embedded** (macOS Swift via C API) and **GTK** (Linux).

The embedded runtime operates in two modes:
- **Managed**: Host provides event loop, Ghostty calls `tick()` each frame
- **Unmanaged**: Ghostty runs its own event loop

**For a headless bridge, apprt is NOT what you want.** apprt is the GUI abstraction layer for the full Ghostty terminal emulator. For a bridge, you'd use **libghostty-vt directly**, which sits below apprt and has no opinions about windowing or event loops.

---

## Recommended Architecture for CLI-to-WebSocket Bridge

Based on this research, two viable architectures emerge:

### Option A: Server-side libghostty-vt (native)

```
CLI -> PTY -> Bridge Server -> libghostty-vt (C/Zig, native) -> WebSocket -> Browser (xterm.js or ghostty-web)
```

- Build libghostty-vt as shared library
- Bridge server in Node.js (via N-API addon or ffi-napi) or Go (via cgo)
- Server maintains terminal state per session
- Server can serialize state (HTML/VT/text) for snapshots, reconnection
- Client renders using ghostty-web (WASM) or xterm.js

### Option B: Client-side libghostty-vt (WASM)

```
CLI -> PTY -> Bridge Server (thin, no parsing) -> WebSocket (raw bytes) -> Browser -> ghostty-web (WASM libghostty-vt)
```

- Server is a thin PTY-to-WebSocket relay (no terminal state)
- All VT parsing and state management in browser WASM
- This is exactly what ghostty-web + webterm already implement
- Simpler server, but no server-side state for reconnection

### Hybrid (best of both)

- Thin server relays PTY bytes via WebSocket
- Client uses ghostty-web WASM for rendering
- Optionally, server also runs libghostty-vt for state snapshots on reconnection

---

## Sources

- [Ghostty GitHub Repository](https://github.com/ghostty-org/ghostty) -- Primary source, MIT licensed
- [Libghostty Is Coming (Mitchell Hashimoto)](https://mitchellh.com/writing/libghostty-is-coming) -- Authoritative announcement of libghostty-vt
- [Ghostling Reference Implementation](https://github.com/ghostty-org/ghostling) -- Official minimal terminal emulator on libghostty C API
- [ghostty-web (Coder)](https://github.com/coder/ghostty-web) -- Production WASM terminal with xterm.js compatibility
- [Ghostty About Page](https://ghostty.org/docs/about) -- Official architecture documentation
- [libghostty-vt API Documentation](https://libghostty.tip.ghostty.org/) -- Per-commit API docs
- [libghostty-vt Header (vt.h)](https://github.com/ghostty-org/ghostty/blob/main/include/ghostty/vt.h) -- C API surface
- [xterm.js Issue #5686](https://github.com/xtermjs/xterm.js/issues/5686) -- xterm.js team's evaluation of adopting libghostty
- [zmx Session Persistence](https://github.com/neurosnap/zmx) -- Real-world headless libghostty-vt usage
- [awesome-libghostty](https://github.com/Uzaaft/awesome-libghostty) -- Ecosystem catalog of 50+ projects
- [emacs-libgterm](https://github.com/rwc9u/emacs-libgterm) -- Emacs terminal using libghostty-vt
- [Ghostty DeepWiki](https://deepwiki.com/ghostty-org/ghostty) -- Architecture analysis with apprt details
- [ghostty-web DeepWiki](https://deepwiki.com/coder/ghostty-web) -- WASM compilation and RenderState API details
- [Ghostty Discussion #3599](https://github.com/ghostty-org/ghostty/discussions/3599) -- Web/WASM embeddable terminal discussion
- [Kytos Terminal](https://jwintz.gitlabpages.inria.fr/jwintz/blog/2026-03-14-kytos-terminal-on-ghostty/) -- Third-party macOS terminal built on libghostty

---

## Confidence Assessment

- **Overall confidence: High.** The research is based on primary sources (official repos, Mitchell Hashimoto's writings, API headers, working projects).
- **libghostty-vt capability for headless use: Confirmed.** Multiple production projects demonstrate this (zmx, hauntty, ghostty-web, webterm).
- **API stability: Low confidence.** The API is explicitly unstable and expected to change. Building on it today means accepting migration costs.
- **WASM maturity: Medium-High.** ghostty-web is in production use by Coder, but the WASM target is still evolving.
- **Node.js native FFI path: Medium confidence.** No known project does Node.js -> native libghostty-vt via N-API yet. The WASM path is more proven for JS runtimes.
- **Performance claims: High confidence.** SIMD benchmarks are from the library author but are consistent with known SIMD capabilities on the measured hardware.

### Areas of Uncertainty

- Exact API surface stability timeline -- Mitchell said "6 months" in his blog post but that was relative to an uncertain publication date
- Whether the formatter API (HTML/VT/text export) is sufficient for server-side state serialization in a reconnection scenario
- Memory footprint per terminal session for high-concurrency server use (hundreds of sessions)
- Whether libghostty-vt's WASM build supports server-side Node.js usage (vs browser-only assumptions in wasm.h)
