# Research: Debounce/Throttle, Chat Auto-Scroll, and DOM Diffing for Vanilla JS

**Date**: 2025-03-23
**Question**: Should any npm packages be added for debounce/throttle, chat auto-scroll, or DOM diffing in a vanilla JS streaming chat renderer, or are hand-written implementations sufficient?

---

## Summary

For debounce/throttle and auto-scroll, hand-written vanilla JS implementations are clearly the right call -- no library adds meaningful value over 5-20 lines of code. For DOM diffing, the picture is more nuanced: **morphdom** is the one library that has a legitimate case for inclusion, specifically because it preserves DOM state (scroll positions, input focus, CSS transitions) during streaming HTML updates. A real-world chat UI project (oobabooga/text-generation-webui) adopted morphdom specifically for streaming and reported dramatic improvements. However, if your streaming content is append-only chat messages where you only update the final message bubble, the benefit over surgical innerHTML on just that element is small.

---

## 1. Debounce/Throttle for Streaming Re-Rendering

### Verdict: Hand-write it. No library needed.

**Package landscape:**
- `lodash.debounce` -- 26.6M weekly downloads, but last published **10 years ago** (v4.0.8). Bundle: ~1.4 kB min+gz. Still widely used due to inertia.
- `throttle-debounce` -- 5-6.4M weekly downloads, v5.0.2, more actively maintained. Provides both throttle and debounce.
- `debounce` (standalone) -- smaller download numbers.

**Why a library is unnecessary:**
- A basic debounce is 5 lines. A basic throttle is 5 lines.
- Lodash's `debounce` adds `leading`, `trailing`, and `maxWait` options. For streaming re-rendering, you don't need `leading` edge or `maxWait` -- you need a simple trailing-edge throttle keyed to animation frames.
- The LogRocket article on "JavaScript evolution from Lodash to vanilla" (2024) explicitly states that with ES2015+, utility libraries like Lodash are unnecessary for basic operations.

**requestAnimationFrame-based throttling -- edge cases to know:**

A rAF-based throttle is the natural fit for DOM update batching during streaming. The pattern:

```js
let pending = false;
function throttledUpdate(fn) {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { fn(); pending = false; });
}
```

Known edge cases from the Motion.dev analysis:

1. **Background tabs**: All major browsers throttle rAF to 0-1fps in background tabs. This is actually *desirable* for streaming -- no wasted renders when the tab isn't visible.
2. **iOS Low Power Mode**: WebKit throttles rAF to 30fps (from 60fps). For streaming text, 30fps is still far more than sufficient.
3. **Cross-origin iframes (Safari/WebKit)**: rAF throttled to 30fps until user interacts with the iframe. Not relevant if your chat UI is the main document.
4. **Chromium cross-origin iframes**: Similar throttling for cross-origin iframes specifically.
5. **Same-timestamp batching**: Multiple rAF callbacks in the same frame receive the same timestamp. Not an issue for "update the DOM with latest state" patterns.

**None of these edge cases are problematic for streaming chat rendering.** Background tab throttling is a feature. iOS 30fps is fine for text. The cross-origin iframe issues don't apply to a main-document chat UI.

**Recommendation**: Write a 5-line rAF throttle. No dependency warranted.

---

## 2. Chat Auto-Scroll (Scroll Up to Disengage, Scroll Back to Re-Engage)

### Verdict: Hand-write it. No framework-agnostic library exists for this.

**What exists in npm:**
- `react-scroll-to-bottom` -- React-specific
- `vue-chat-scroll` -- Vue-specific
- `react-chatview` -- React-specific, infinite scroll oriented

**No vanilla JS library exists** for this pattern. Every implementation found is either framework-bound or a code snippet/gist.

**The universal pattern** (used by ChatGPT, Claude.ai, and every chat UI reviewed):

Two approaches, both ~10-15 lines:

**Approach A: scrollTop threshold check**
```js
const isNearBottom = (el, threshold = 50) =>
  el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

// On new content:
if (isNearBottom(container)) {
  container.scrollTop = container.scrollHeight;
}
```

**Approach B: IntersectionObserver with sentinel element**
- Place an invisible sentinel `<div>` at the bottom of the scroll container.
- Use IntersectionObserver to track whether it's visible.
- If visible (user is at bottom), auto-scroll on new content. If not visible (user scrolled up), don't scroll.
- When sentinel re-enters viewport, re-engage.

The IntersectionObserver approach is slightly more elegant because:
- It doesn't require listening to scroll events (no debouncing needed).
- It handles the re-engage case automatically -- when the user scrolls back down and the sentinel becomes visible, the next content append will auto-scroll.
- `trackVisibility: true` option provides additional fidelity.

**Real-world observation**: Claude.ai's own chat UI has had multiple bugs filed about scroll behavior during streaming (issues #11578, #826, #18404, #16911, #34845 on the claude-code repo), confirming this is a UX-sensitive area that benefits from thoughtful implementation but does NOT benefit from a library.

**Recommendation**: Implement with IntersectionObserver + sentinel element pattern. ~15 lines of vanilla JS. No dependency warranted.

---

## 3. DOM Diffing for Streaming HTML Updates

### Verdict: morphdom has a legitimate use case. Evaluate based on your update pattern.

**Library landscape:**

| Library | Weekly Downloads | Last Publish | Stars | Status |
|---------|-----------------|-------------|-------|--------|
| morphdom | 140K-400K (varies by source) | ~1 month ago (v2.7.8) | 3.5K | Active, sustainable maintenance |
| idiomorph | Newer, lower downloads | Active (htmx ecosystem) | Growing | Active, bigskysoftware/basecamp |
| diffhtml | Low (~18 dependents) | 3 years ago (1.0.0-beta.30) | Low | Dormant/abandoned |
| nanomorph | Moderate | Less active | ~700 | Choo ecosystem |

**morphdom** is the clear leader. It's actively maintained, has meaningful adoption, and is specifically designed for the "morph one real DOM tree into another" use case without a virtual DOM.

**Key morphdom capability**: It preserves DOM state -- scroll positions, input caret positions, CSS transition states, selection state. This is the killer feature vs. innerHTML replacement.

**Real-world chat streaming case study**: The oobabooga/text-generation-webui project (a popular LLM chat interface) merged PR #6653 in January 2025 specifically to adopt morphdom for streaming chat rendering. Their findings:
- **Before**: Replaced entire HTML structure on each streaming token, causing lag in long conversations.
- **After**: morphdom diffs and patches only changed nodes.
- **Result**: "Drastically, noticeably faster" -- users could now select/copy text from previous messages during streaming, which was impossible when innerHTML was replacing everything.

**idiomorph** is interesting as the htmx-affiliated alternative. It uses a more sophisticated matching algorithm (id-set based, considers children's IDs for parent matching) at a ~10% performance cost vs. morphdom for large DOMs. It's the default morph strategy in htmx. Less proven for the streaming-tokens use case specifically.

**When morphdom matters vs. when it doesn't:**

morphdom is valuable when:
- You are re-rendering a multi-message chat history where only the last message changes
- You want to preserve scroll position, text selection, or input state within the rendered content
- Messages contain interactive elements (code blocks with copy buttons, expandable sections)
- You're rendering a full HTML string from markdown on each token

morphdom is unnecessary when:
- You only ever update the *last* message element's innerHTML (append-only pattern)
- There are no interactive/stateful elements in the rendered messages
- You can surgically update only the streaming message container

**The vanilla JS alternative** (from Go Make Things): A ~70-line recursive diff algorithm using DOMParser, comparing child nodes recursively. It works but doesn't handle edge cases like keyed element reordering or state preservation as robustly as morphdom.

**Size**: morphdom's unpacked size is 203 kB on npm; the UMD minified bundle (`morphdom-umd.min.js`) is reportedly ~15 kB minified / ~4 kB gzipped based on typical references in the ecosystem. Zero dependencies.

**Recommendation**: If your architecture re-renders the full chat message HTML (all messages or the current streaming message's full HTML) on each update, morphdom is worth the dependency. If you can scope updates to only the actively-streaming message element and use innerHTML on just that one element, you can skip it.

---

## Decision Matrix

| Capability | Library? | Lines of Vanilla JS | Recommendation |
|-----------|----------|-------------------|----------------|
| Debounce/throttle for streaming | No | 5-8 lines (rAF throttle) | Hand-write |
| Auto-scroll disengage/engage | No | 10-15 lines (IntersectionObserver) | Hand-write |
| DOM diffing for streaming HTML | **Maybe** (morphdom) | 70+ lines for a proper implementation | Depends on update architecture |

---

## Sources

- [LogRocket: JavaScript Evolution from Lodash to Vanilla](https://blog.logrocket.com/javascript-evolution-lodash-underscore-vanilla/) - Blog post, 2024, on dropping Lodash for native JS
- [lodash.debounce on npm](https://www.npmjs.com/package/lodash.debounce) - Package page, last published 10 years ago
- [throttle-debounce on npm](https://www.npmjs.com/package/throttle-debounce) - Package page, actively maintained
- [npmtrends: debounce vs lodash.debounce vs throttle-debounce](https://npmtrends.com/debounce-vs-lodash.debounce-vs-throttle-debounce) - Download comparison
- [Motion.dev: When Browsers Throttle requestAnimationFrame](https://motion.dev/blog/when-browsers-throttle-requestanimationframe) - Authoritative deep-dive on rAF throttling edge cases
- [WebKit Bug 168837: iOS rAF throttling in low power mode](https://bugs.webkit.org/show_bug.cgi?id=168837) - Primary source
- [WebKit Bug 213344: Cross-domain iframe animation throttling](https://bugs.webkit.org/show_bug.cgi?id=213344) - Primary source
- [Chat auto-scroll gist (simonewebdesign)](https://gist.github.com/simonewebdesign/6447080) - Vanilla JS auto-scroll with threshold detection
- [Intuitive Scrolling for Chatbot Message Streaming](https://tuffstuff9.hashnode.dev/intuitive-scrolling-for-chatbot-message-streaming) - IntersectionObserver + sentinel pattern for chat streaming
- [morphdom GitHub](https://github.com/patrick-steele-idem/morphdom) - 3.5K stars, actively maintained
- [morphdom on npm](https://www.npmjs.com/package/morphdom) - v2.7.8, 140K-400K weekly downloads
- [Snyk: morphdom package health](https://snyk.io/advisor/npm-package/morphdom) - "Sustainable" maintenance classification
- [oobabooga/text-generation-webui PR #6653](https://github.com/oobabooga/text-generation-webui/pull/6653) - Real-world morphdom adoption for chat streaming, merged Jan 2025
- [idiomorph GitHub](https://github.com/bigskysoftware/idiomorph) - htmx-affiliated DOM morphing, bigskysoftware
- [diffhtml on npm](https://www.npmjs.com/package/diffhtml) - Last published 3 years ago, effectively dormant
- [Go Make Things: DOM Diffing with Vanilla JS](https://gomakethings.com/dom-diffing-with-vanilla-js/) - ~70 line vanilla implementation
- [leafac morphdom research notes](https://gist.github.com/leafac/57e61d8e1ce6a6b67298adacd52c2668) - Notes morphdom limitation: insertions in middle lose sibling state
- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) - Authoritative API reference
- [MDN: Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) - Authoritative API reference

---

## Confidence Assessment

- **Debounce/throttle**: **High confidence**. The consensus is universal -- no library needed for basic debounce/throttle in 2024-2025.
- **Auto-scroll**: **High confidence**. No vanilla JS library exists; the IntersectionObserver pattern is well-established and used across production chat UIs.
- **DOM diffing**: **Medium-high confidence**. morphdom is clearly the leading library and the oobabooga case study directly validates the streaming chat use case. The uncertainty is whether *your specific* update architecture needs it -- if you can scope innerHTML replacement to just the active message element, you may not need it. The morphdom bundle size numbers (~4 kB gzipped) are inferred from ecosystem references rather than directly verified from bundlephobia (which blocked automated fetches).
