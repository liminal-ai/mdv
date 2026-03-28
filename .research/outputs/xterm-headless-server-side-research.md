# @xterm/headless as a Server-Side Terminal State Machine

Research completed 2026-03-25.

---

## Summary

`@xterm/headless` is a production-grade, officially supported package from the xterm.js project that provides a full terminal emulator running in Node.js without any DOM dependency. It is the same core terminal engine used in the browser — same parser, same buffer management, same escape sequence handling — with all rendering code stripped out. VS Code's Pty Host process is the reference implementation: every VS Code terminal session runs a headless xterm instance server-side to track state, enable reconnection, and power shell integration features like prompt detection and command tracking. The package is at version 6.0.0, has 149 dependents on npm, and is actively maintained as part of the xterm.js monorepo.

This is a viable, TypeScript-native solution for your use case. It stays entirely in the Node.js ecosystem — no FFI, no WASM, no native compilation. The tradeoff is that it is a JavaScript terminal emulator with JavaScript performance ceilings, but those ceilings are high (5-35 MB/s throughput, heavily optimized parser) and more than sufficient for interactive terminal session tracking.

---

## Key Findings

- **`@xterm/headless` is real, mature, and production-proven.** Version 6.0.0, actively maintained, used by VS Code itself.
- **Full terminal emulation in Node.js.** Same VT100/xterm parser as the browser version. CSI, OSC, DCS, ESC sequence handling. Normal and alternate screen buffers. Cursor tracking. All terminal state.
- **Rich buffer query API.** You can read any line of text, get cursor position, inspect cell attributes (colors, bold, etc.), detect line wrapping, and access both normal and alternate buffers.
- **Serialize addon works with headless.** `@xterm/addon-serialize` can export the entire terminal state as VT sequences for session persistence/restoration.
- **VS Code validates this exact architecture.** Their Pty Host runs headless xterm + SerializeAddon + ShellIntegrationAddon server-side for every terminal session.
- **Memory cost is non-trivial but manageable.** ~34MB for a 160x24 terminal with 5000 lines of scrollback filled. Scales with terminal width and scrollback depth.
- **Parser throughput is 5-35 MB/s.** The xterm.js maintainer says the JS parser has "hit hard limits around what's possible in JS," but for interactive terminal sessions this is far more than enough.
- **Custom escape sequence handlers are supported.** You can register hooks for CSI, OSC, DCS, ESC sequences to detect specific terminal events.
- **Prompt detection is not built-in to xterm.js itself** but VS Code implements it as a headless addon using OSC 633/133 shell integration sequences. You would need shell integration or heuristics.

---

## Detailed Analysis

### 1. Does @xterm/headless Exist and Work?

Yes. It is an official package in the xterm.js monorepo.

```
npm install @xterm/headless
```

Basic usage:

```typescript
import { Terminal } from '@xterm/headless';

const terminal = new Terminal({ cols: 80, rows: 24 });

// Feed PTY output into it
terminal.write(ptyOutputBytes);

// Read the screen
const buffer = terminal.buffer.active;
const line = buffer.getLine(0)?.translateToString(true);
console.log('Cursor:', buffer.cursorX, buffer.cursorY);
console.log('Buffer type:', buffer.type); // 'normal' or 'alternate'
```

The Terminal class exposes the same API as the browser version minus DOM-related properties (`element`, `textarea`, `open()`). Everything related to terminal state is present.

**Package details:**
- Current version: 6.0.0
- Published: ~3 months ago (as of March 2026)
- 149 dependents on npm
- Part of the xtermjs/xterm.js monorepo
- Same release cadence as the main xterm.js package

### 2. How VS Code Uses Headless xterm.js

VS Code's architecture is the canonical reference for this pattern. Here is how it works:

**Architecture:**
- The **Pty Host** is a dedicated Node.js process separate from the renderer and main process
- Each terminal session is wrapped in a `PersistentTerminalProcess`
- Each `PersistentTerminalProcess` contains a headless xterm.js `Terminal` instance
- All PTY output flows through this headless instance before being forwarded to the renderer

**What they use it for:**

1. **Session persistence / reconnection:** When a client disconnects and reconnects (e.g., window reload), the Pty Host serializes the headless terminal's state via `SerializeAddon` and replays it to the new client. This replaced an earlier approach of recording raw terminal events.

2. **Shell integration (prompt/command detection):** `ShellIntegrationAddon` runs as a headless addon in the Pty Host. It registers OSC sequence handlers (OSC 633 for VS Code's protocol, OSC 133 for FinalTerm) to detect:
   - Prompt start/end
   - Command start/execution/finish (with exit codes)
   - Current working directory changes
   - User input reconstruction via `PromptInputModel`

3. **Buffer state tracking:** The headless instance maintains accurate screen state so the Pty Host always knows what's on screen without asking the renderer.

4. **Flow control:** Multi-level flow control prevents buffer overflow — `FlowControlConstants.HighWatermarkChars` pauses data forwarding, `LowWatermarkChars` resumes.

**Key insight:** VS Code moved FROM recording raw terminal events TO maintaining a headless terminal instance. The headless approach is more accurate and uses less memory than event replay for long-running sessions.

### 3. Full API Surface

The headless Terminal provides:

**Terminal state:**
- `rows`, `cols` — current dimensions
- `buffer.active` — current buffer (normal or alternate)
- `buffer.normal`, `buffer.alternate` — direct buffer access
- `modes` — current terminal modes
- `options` — mutable terminal options
- `markers` — buffer position markers

**Buffer inspection:**
- `buffer.cursorX`, `buffer.cursorY` — cursor position
- `buffer.viewportY`, `buffer.baseY` — scroll position
- `buffer.length` — total lines including scrollback
- `buffer.getLine(y)` — get a specific line
- `line.translateToString(trimRight?, startCol?, endCol?)` — line as text
- `line.isWrapped` — line wrapping detection
- `line.getCell(x)` — individual cell access

**Cell inspection (per character):**
- `cell.getChars()`, `cell.getCode()`, `cell.getWidth()`
- `cell.getFgColor()`, `cell.getBgColor()`, `cell.getUnderlineColor()`
- `cell.isBold()`, `cell.isItalic()`, `cell.isDim()`, `cell.isUnderline()`, `cell.isStrikethrough()`, `cell.isInverse()`, `cell.isInvisible()`, `cell.isOverline()`, `cell.isBlink()`
- `cell.isFgRGB()`, `cell.isBgPalette()`, `cell.isFgDefault()` — color type detection

**Events:**
- `onData` — user input data
- `onCursorMove` — cursor position changed
- `onLineFeed` — newline processed
- `onScroll` — scroll position changed
- `onBell` — bell character received
- `onRender` — rows affected by a write (start/end row numbers)
- `onWriteParsed` — write fully parsed
- `onResize` — terminal dimensions changed
- `onTitleChange` — terminal title changed
- `onBufferChange` — switched between normal/alternate buffer

**Parser hooks:**
- `parser.registerCsiHandler()` — custom CSI sequence handler
- `parser.registerOscHandler()` — custom OSC sequence handler
- `parser.registerDcsHandler()` — custom DCS sequence handler
- `parser.registerEscHandler()` — custom ESC sequence handler

**Methods:**
- `write(data)`, `writeln(data)` — feed data in
- `input(data)` — simulate input
- `resize(cols, rows)` — resize terminal
- `reset()`, `clear()` — reset/clear state
- `registerMarker(cursorYOffset)` — mark buffer positions
- `loadAddon(addon)` — load addons (serialize, etc.)

### 4. What You Can Extract

**Current screen contents as text — YES:**
```typescript
function getScreenText(terminal: Terminal): string[] {
  const lines: string[] = [];
  const buffer = terminal.buffer.active;
  for (let i = 0; i < terminal.rows; i++) {
    const line = buffer.getLine(buffer.baseY + i);
    lines.push(line?.translateToString(true) ?? '');
  }
  return lines;
}
```

**Cursor position — YES:**
```typescript
const { cursorX, cursorY } = terminal.buffer.active;
```

**Prompt detection — PARTIALLY, requires work:**
- xterm.js itself does not detect prompts
- If your shell emits OSC 633/133 sequences (bash/zsh/fish with shell integration scripts), you can register OSC handlers to detect prompt boundaries — this is exactly what VS Code does
- Without shell integration sequences, you need heuristics (output quiescence + cursor position patterns)
- The `onCursorMove` and `onWriteParsed` events help with heuristic approaches

**Structured data from terminal state — YES:**
```typescript
// Rich cell-level data
const cell = buffer.getLine(y)?.getCell(x);
// Character, colors, attributes — all available
// Can detect which buffer (normal vs alternate) for full-screen app detection
terminal.buffer.onBufferChange(buf => {
  console.log('Switched to', buf.type); // detect vim, less, etc.
});
```

**Serialize/deserialize for session persistence — YES:**
```typescript
import { SerializeAddon } from '@xterm/addon-serialize';

const serialize = new SerializeAddon();
terminal.loadAddon(serialize);

// Save state
const state = serialize.serialize({ scrollback: 1000 });

// Restore on new terminal
const newTerminal = new Terminal({ cols: 80, rows: 24 });
newTerminal.write(state); // replays VT sequences to reconstruct state
```

### 5. Performance

**Parser throughput:** 5-35 MB/s depending on content complexity. The xterm.js parser is a hand-optimized DFA state machine. The maintainer states it has "hit hard limits around what's possible in JS." For context, interactive terminal sessions rarely produce sustained output above 1 MB/s, so this is more than sufficient.

**Memory per instance:**
- Baseline: A Terminal object itself is lightweight
- Filled buffer: ~34MB for a 160x24 terminal with 5000 lines of scrollback filled
- Per-cell cost: >12 bytes per cell (including blank cells to the right of content)
- Memory scales with: `cols × (rows + scrollback) × ~12+ bytes`
- For a typical 80x24 terminal with 1000 lines scrollback: roughly `80 × 1024 × 12 = ~1MB`
- Write buffer hard limit: 50MB to prevent OOM

**Practical estimate for your use case:**
- 80x24 terminal, 1000 line scrollback: ~1-2 MB per instance
- 80x24 terminal, 5000 line scrollback: ~5-7 MB per instance
- 10 concurrent sessions at 1000 scrollback: ~10-20 MB total
- 100 concurrent sessions at 1000 scrollback: ~100-200 MB total

**CPU cost:** The async WriteBuffer design processes data in chunks sized to complete within a single frame (~16ms). For headless mode without rendering, CPU overhead is primarily parser + buffer writes. Negligible for interactive sessions.

**Comparison to libghostty-vt:**
- The xterm.js maintainers evaluated libghostty (WASM) and found "similar performance to the current JavaScript parser" in early tests
- libghostty has "much better VT100 compatibility" in edge cases
- The xterm.js team decided against adoption, preferring targeted WASM optimizations for specific bottlenecks
- For your use case (interactive session tracking, not bulk parsing), the JS parser performance difference is irrelevant
- The xterm.js approach has no FFI/WASM complexity — pure TypeScript/JS

### 6. WebSocket Bridge Architecture

No one has published a widely-adopted open-source project doing exactly "headless xterm as structured event bridge." However, VS Code's Pty Host is functionally this pattern:

```
PTY output → headless xterm (state tracking) → IPC → renderer
```

The architecture you're considering would be:

```
PTY output → headless xterm → extract state/events → WebSocket → client
```

This is a natural extension of what VS Code already does. The key design decisions:

1. **Feed all PTY output into the headless terminal** via `terminal.write(data)`
2. **Listen for events** (`onCursorMove`, `onLineFeed`, `onWriteParsed`, `onRender`) to know when state changed
3. **Read buffer state** after events fire to extract meaningful data
4. **Send structured events** over WebSocket instead of raw terminal bytes
5. **Use SerializeAddon** for full state snapshots on reconnection

**Flow control consideration:** Over WebSocket, you need application-level flow control. xterm.js's `write()` callback tells you when data is processed. Use ACK messages between server and client to prevent buffer growth — this is documented in xterm.js's flow control guide.

### 7. Limitations

**Memory per instance:**
- Non-trivial. 1-7 MB per instance depending on scrollback. Not suitable for thousands of concurrent instances without careful scrollback management.
- Reduce scrollback to minimum needed. Default is 1000 lines.

**Terminal emulation accuracy:**
- Very good but not perfect. The xterm.js maintainers acknowledge libghostty has "much better VT100 compatibility" for edge cases.
- In practice, xterm.js handles all common terminal applications (vim, tmux, htop, etc.) correctly. Edge cases involve obscure DEC private modes or rare escape sequences.
- Full-screen application support (alternate buffer) works correctly.

**What's NOT built-in:**
- Prompt detection (need shell integration sequences or heuristics)
- Semantic understanding of output (it's a terminal emulator, not an output parser)
- Command boundary detection without shell integration
- Output format detection (tables, JSON, etc.) — you get raw terminal state

**Performance ceilings:**
- JS parser tops out at ~35 MB/s. Not relevant for interactive sessions but matters if you're processing bulk recorded output.
- Buffer reconstruction (`translateToString` across all lines) takes 30-60ms for a full buffer on mid-range hardware.

**Garbage collection:**
- Frequent buffer operations create GC pressure. In high-throughput scenarios, this can cause latency spikes.
- The headless variant has less GC pressure than the browser version (no rendering objects) but buffer operations still allocate.

**Missing vs. a real terminal emulator:**
- No sixel/image protocol support (addon exists but not for headless)
- No GPU-accelerated rendering (irrelevant for headless)
- C0/C1 single-byte control function hooks are not exposed via the parser API
- OSC and DCS handlers have a hardcoded 10MB payload limit

---

## Addons Compatible with Headless

| Addon | Package | Works Headless? | Purpose |
|-------|---------|-----------------|---------|
| Serialize | `@xterm/addon-serialize` | Yes | Export/restore terminal state as VT sequences or HTML |
| Unicode11 | `@xterm/addon-unicode11` | Yes | Extended Unicode width handling |
| Unicode GraphemeCluster | `@xterm/addon-unicode-graphemes` | Yes | Proper grapheme cluster support |
| Image | `@xterm/addon-image` | Unclear | Sixel/image protocol — likely needs rendering |
| Canvas/WebGL | `@xterm/addon-canvas`, `@xterm/addon-webgl` | No | Browser rendering only |
| Fit | `@xterm/addon-fit` | No | DOM-based auto-sizing |
| Web Links | `@xterm/addon-web-links` | No | DOM click handling |

---

## Recommendation

`@xterm/headless` is the right tool for your use case. It provides:

1. **Production-proven architecture** — VS Code validates this exact pattern at massive scale
2. **TypeScript-native** — no FFI, no WASM, no native compilation, stays in Node.js ecosystem
3. **Rich API** — full buffer inspection, cursor tracking, event system, custom sequence handlers
4. **Session persistence** — SerializeAddon handles save/restore
5. **Acceptable performance** — more than sufficient for interactive terminal session tracking

The main thing to design carefully is **prompt detection**. Your options:
- **Shell integration sequences** (OSC 633/133): Most reliable, but requires shell configuration. VS Code ships shell integration scripts for bash, zsh, fish, and PowerShell.
- **Heuristic detection**: Monitor `onWriteParsed` + output quiescence + cursor position patterns. Less reliable but works without shell configuration.
- **Hybrid**: Use shell integration when available, fall back to heuristics.

For memory management with multiple concurrent sessions, keep scrollback low (500-1000 lines) and dispose terminals when sessions end.

---

## Sources

- [@xterm/headless on npm](https://www.npmjs.com/package/@xterm/headless) — Official package, v6.0.0, 149 dependents
- [xterm.js GitHub Repository](https://github.com/xtermjs/xterm.js/) — Source code and headless README
- [xterm.js Headless README](https://github.com/xtermjs/xterm.js/blob/master/headless/README.md) — Official documentation
- [xterm.js Headless Type Definitions](https://github.com/xtermjs/xterm.js/blob/master/typings/xterm-headless.d.ts) — Full API surface
- [VS Code Pty Host Architecture (DeepWiki)](https://deepwiki.com/microsoft/vscode/6.2-ai-agents-and-tool-integration) — Detailed PersistentTerminalProcess + headless xterm usage
- [VS Code Shell Integration (DeepWiki)](https://deepwiki.com/microsoft/vscode/6.3-xterm.js-integration-and-rendering) — ShellIntegrationAddon, PromptInputModel, OSC 633 protocol
- [xterm.js Architecture (DeepWiki)](https://deepwiki.com/xtermjs/xterm.js/1-overview) — Core architecture, buffer internals, parser design
- [xterm.js Parser Hooks Guide](https://xtermjs.org/docs/guides/hooks/) — Custom escape sequence handler registration
- [xterm.js Flow Control Guide](https://xtermjs.org/docs/guides/flowcontrol/) — Write buffer behavior, WebSocket flow control
- [Buffer Performance Issue #791](https://github.com/xtermjs/xterm.js/issues/791) — Memory benchmarks, per-cell cost analysis
- [libghostty Adoption Discussion #5686](https://github.com/xtermjs/xterm.js/issues/5686) — Performance comparison, maintainer assessment of JS parser limits
- [xterm.js Official Site](https://xtermjs.org/) — Documentation hub
- [Terminal State Serialization Issue #595](https://github.com/xtermjs/xterm.js/issues/595) — History of save/restore terminal state feature
