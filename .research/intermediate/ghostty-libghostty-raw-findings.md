# Ghostty / libghostty Raw Research Findings

## Key Discovery: libghostty-vt is EXACTLY the terminal state machine layer

libghostty-vt is a zero-dependency C/Zig library that provides:
- VT sequence parsing (with SIMD optimization)
- Terminal state management (cursor, styles, scrollback, reflow)
- Input encoding (keys, mouse, focus)
- Output formatting (plain text, VT sequences, HTML)
- No renderer, no windowing, no GUI whatsoever

## Architecture Layers (from Ghostty source)

1. **libghostty-vt** - Terminal state machine, parser, state management (STANDALONE)
2. **libghostty** (full) - Adds font handling, rendering capabilities
3. **apprt** - App runtime abstraction (GTK, embedded/Swift, GLFW)
4. **Platform apps** - macOS Swift app, Linux GTK app

## API Surface (from vt.h headers)

- terminal.h - Complete terminal emulator state
- render.h - Incremental render state updates
- screen.h - Screen content management
- grid_ref.h - Grid reference traversal
- key.h - Key event encoding (Kitty protocol)
- mouse.h - Mouse event encoding
- focus.h - Focus in/out encoding
- osc.h - OSC sequence parser
- sgr.h - SGR parser
- formatter.h - Export as text/VT/HTML
- paste.h - Paste validation
- wasm.h - WASM convenience functions
- modes.h - Terminal mode flags

## Real-World Non-GUI Projects Using libghostty-vt

1. **zmx** (Zig) - Session persistence, ~1000 LoC tmux replacement, renders terminal state on reattach
2. **hauntty** (Go) - Terminal persistence using WASM-compiled libghostty VT parser
3. **ghostty-web** (TS/WASM) - Browser terminal, xterm.js API compat, ~400KB WASM
4. **webterm** - Web terminal server with dashboard mode, live terminal tiles
5. **vanish** - Lightweight session multiplexer
6. **ghostty-opentui** - VT parser with JSON output
7. **Trolley** - Terminal emulator runtime for TUI app distribution
8. **ghostling** (C) - Reference implementation, single-file, uses Raylib for rendering

## Performance Data

- 7.3x faster ASCII parsing with SIMD vs scalar (M3 Max)
- 16.6x faster UTF-8 to UTF-32 decoding with SIMD
- ~400KB WASM binary size
- Zero dependencies (not even libc)
- Fuzzed and Valgrind-tested

## FFI Integration Paths

- **C API** - Native, stable-ish, header in include/ghostty/vt.h
- **Zig API** - First-class
- **WASM** - Already working (ghostty-web, hauntty use it)
- **Node.js** - Via node-ffi-napi, N-API native addon, or Bun FFI
- **Go** - Via cgo calling C API, or WASM (hauntty does this)
- **Rust** - Via FFI to C ABI (standard pattern)
- **Dart** - libghostty-dart exists

## WASM Details

- Compiles to ~400KB
- Zero runtime dependencies
- ghostty-web uses RenderState API with dirty tracking
- Boundary crossing optimization: O(dirty_rows) per frame instead of O(cols*rows)
- getLine() returns entire rows as typed arrays

## xterm.js Comparison / Integration

- xterm.js issue #5686 explored adopting libghostty
- Performance "similar" despite UTF8->UTF32 conversion overhead
- Key concern: architectural mismatch (ghostty single-pass lexer vs xterm.js hookable DFA)
- Mitchell offered xterm.js maintainers co-maintainer status on libghostty
- ghostty-web provides drop-in xterm.js API compatibility

## Mitchell Hashimoto's Stated Goals

- Replace xterm.js with libghostty in VS Code
- WASM support for web frontends
- Stable C API release (within ~6 months of announcement)
- Ecosystem of third-party terminal emulators built on shared core
