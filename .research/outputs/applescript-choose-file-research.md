# AppleScript `choose file` with File Type Filtering

Research completed 2026-03-19 for md-viewer Epic 2 file-picker implementation.

---

## Summary

The AppleScript `choose file` command supports file type filtering via the `of type` parameter and works well as a direct parallel to the `choose folder` pattern already established in Epic 1. The `of type` parameter accepts both Uniform Type Identifiers (UTIs) and bare file extensions (without the leading period). For markdown files, you can use either bare extensions `{"md", "markdown"}` or the UTI `"net.daringfireball.markdown"`. The return value requires wrapping with `POSIX path of` to get a slash-delimited path, and cancellation produces exit code 1 from `osascript`, identical to `choose folder`.

---

## 1. `choose file` Syntax

The basic syntax mirrors `choose folder`:

```
choose file with prompt "Select a Markdown file"
```

Full syntax with all optional parameters:

```
choose file
    [with prompt text]
    [of type list_of_text]
    [default location alias]
    [invisibles boolean]
    [multiple selections allowed boolean]
    [showing package contents boolean]
```

The one-liner equivalent to the established folder-picker pattern:

```bash
osascript -e 'POSIX path of (choose file with prompt "Select Markdown File" of type {"md", "markdown"})'
```

---

## 2. Type Filter — Extension-Based Approach

The `of type` parameter accepts a list of bare extensions **without the leading period**:

```applescript
choose file of type {"md", "markdown"} with prompt "Select Markdown File"
```

This is confirmed working by:
- **Apple's Mac Automation Scripting Guide** (developer.apple.com): "Types may be specified as extension strings without the leading period (such as `"jpg"` or `"png"`) or as uniform type identifiers"
- **MacScripter community testing** on Mojave+: `choose file of type {"pdf", "scpt", "txt", "png"}` confirmed working

**Important**: Do NOT include the period. Use `"md"` not `".md"`. Including the period breaks the filter.

---

## 3. UTI vs Extension

Both approaches work in the `of type` parameter:

| Approach | Example | Notes |
|----------|---------|-------|
| Bare extensions | `{"md", "markdown"}` | Simpler, documented by Apple |
| UTI identifiers | `{"net.daringfireball.markdown"}` | More precise, but markdown UTI is not system-defined |
| Broad UTI | `{"public.plain-text"}` | Would match ALL plain text files, too broad |

### Markdown-Specific UTIs

- **`net.daringfireball.markdown`** — The canonical UTI for markdown, declared by John Gruber himself (daringfireball.net, updated March 2014). Conforms to `public.plain-text`.
- However, this UTI is **not system-declared** — it is an imported/third-party UTI. Whether it works in `choose file of type` depends on whether an app on the system has registered it. Many markdown editors (iA Writer, Marked 2, MacDown, etc.) do register it.

### Recommendation

**Use bare extensions `{"md", "markdown"}` for the file picker.** Rationale:
- Works regardless of whether any markdown editor is installed
- Explicitly documented in Apple's scripting guide as a supported approach
- Simpler and more predictable
- Covers both common markdown extensions

If you wanted to also catch `.mdown`, `.mkdn`, `.mkd`, `.mdwn` (other markdown extensions), just add them to the list.

---

## 4. Multiple Extensions

Yes, multiple extensions work in a single call. The `of type` parameter takes a **list**:

```applescript
choose file of type {"md", "markdown"} with prompt "Select Markdown File"
```

You can freely mix extensions and UTIs in the same list:

```applescript
choose file of type {"md", "markdown", "public.plain-text"} with prompt "Select a text file"
```

---

## 5. Return Value

`choose file` returns an **alias** in HFS path format:

```
alias "Macintosh HD:Users:yourUserName:Documents:notes.md"
```

To get a POSIX path (slash-delimited), wrap with `POSIX path of`:

```applescript
POSIX path of (choose file with prompt "Select Markdown File" of type {"md", "markdown"})
```

Returns:

```
/Users/yourUserName/Documents/notes.md
```

This is the **same pattern** as the established `choose folder` usage:

```applescript
-- Folder (Epic 1 pattern)
POSIX path of (choose folder with prompt "Select Folder")

-- File (new pattern)
POSIX path of (choose file with prompt "Select Markdown File" of type {"md", "markdown"})
```

---

## 6. Cancel Behavior

Cancellation behavior is **identical to `choose folder`**:

- AppleScript throws **error number -128** ("User canceled.")
- When run via `osascript`, this translates to **exit code 1**
- stderr will contain: `execution error: User canceled. (-128)`
- stdout will be empty

This means the same error-handling pattern works:

```bash
FILE=$(osascript -e 'POSIX path of (choose file with prompt "Select Markdown File" of type {"md", "markdown"})' 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "User cancelled"
    exit 0
fi
echo "Selected: $FILE"
```

---

## Recommended One-Liner

The direct equivalent of the Epic 1 folder picker, filtered to markdown files:

```bash
osascript -e 'POSIX path of (choose file with prompt "Select Markdown File" of type {"md", "markdown"})'
```

### With default location (optional):

```bash
osascript -e 'POSIX path of (choose file with prompt "Select Markdown File" of type {"md", "markdown"} default location (path to documents folder))'
```

### Multiple file selection (if ever needed):

```bash
osascript -e 'set theFiles to choose file with prompt "Select Markdown Files" of type {"md", "markdown"} with multiple selections allowed
set output to ""
repeat with f in theFiles
    set output to output & POSIX path of f & linefeed
end repeat
return output'
```

---

## Sources

- [Apple Mac Automation Scripting Guide — Prompting for Files or Folders](https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/PromptforaFileorFolder.html) — Official Apple documentation. Explicitly states extensions without periods and UTIs both work in `of type`. Highly authoritative.
- [Apple AppleScript Language Guide — Commands Reference](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/reference/ASLR_cmds.html) — Official reference for `choose file` parameters, return type (alias), and error -128 on cancel. Highly authoritative.
- [Daring Fireball — Uniform Type Identifier for Markdown](https://daringfireball.net/linked/2011/08/05/markdown-uti) — John Gruber's canonical declaration of `net.daringfireball.markdown` as the markdown UTI, conforming to `public.plain-text`. Updated March 2014. Primary source.
- [MacScripter — choosing a file by extension rather than type](https://www.macscripter.net/t/choosing-a-file-by-extension-rather-than-type/73038) — Community confirmation that bare extensions work in `of type` on Mojave+. Period must be omitted.
- [Ask Different — JSON file grayed out in choose file](https://apple.stackexchange.com/questions/443322/) — Demonstrates that some extensions (like `"json"`) do NOT work as bare extensions and require the UTI (`"public.json"`). Relevant caveat.
- [AppleScript Tutorial Wiki — Choose File](https://applescript.fandom.com/wiki/Choose_File) — Community reference for all parameters.

---

## Confidence Assessment

- **Overall confidence: High** — The core syntax is well-documented by Apple and confirmed by multiple community sources.
- **Extension-based filtering for `md`/`markdown`: High confidence** — Apple explicitly documents bare extensions as supported. The only risk is if macOS has no UTI mapping for `.md` files, but markdown is universally recognized on modern macOS.
- **One caveat worth noting**: A 2022 Stack Exchange answer showed that `choose file of type {"json"}` did NOT work (files were grayed out) and required the UTI `"public.json"` instead. This suggests bare extensions work for most common types but may not work for all. If `.md` extension filtering ever fails on a user's machine, falling back to `"net.daringfireball.markdown"` or `"public.plain-text"` would be the fix. In practice, markdown files are well-recognized on macOS and this is unlikely to be an issue.
- **Cancel exit code: High confidence** — Error -128 is the universal AppleScript cancellation error and always maps to exit code 1 from `osascript`.
