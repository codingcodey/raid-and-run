---
kind: error_handling
name: Silent-fallback and fatal-throw pattern
category: error_handling
scope:
    - '**'
source_files:
    - src/main.ts
    - src/audio.ts
---

This browser-based arcade game uses a two-tier error strategy with no centralized error type system:

1. **Fatal initialization errors** — `main.ts` throws plain `Error`s for unrecoverable setup failures (missing DOM elements, missing Canvas 2D context). These are not caught; they crash the app at startup.

2. **Silent-fallback for non-critical failures** — All runtime operations that may fail in the browser are wrapped in try/catch blocks that swallow exceptions and degrade gracefully:
   - `audio.ts`: `AudioBufferSourceNode.stop()` calls are wrapped in try/catch because calling stop on an already-stopped node throws; audio loading via `fetch` + `decodeAudioData` returns `null` on failure instead of rejecting.
   - `main.ts`: `createRecordsStore` tries `window.localStorage`; if it throws (e.g. private browsing), it falls back to an in-memory store.

There is no custom error class, no sentinel error values, no Promise rejection propagation, and no middleware or global unhandled-rejection handler. Errors are either fatal (thrown at boot) or silently ignored so the game keeps running.