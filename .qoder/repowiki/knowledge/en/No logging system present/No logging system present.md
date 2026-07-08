---
kind: logging_system
name: No logging system present
category: logging_system
scope:
    - '**'
---

This repository contains no logging infrastructure. The codebase is a self-contained browser-based Canvas arcade game with zero usage of any logging framework, console output, or structured logging utilities. All modules (main.ts, game.ts, render.ts, audio.ts, input.ts, records.ts) operate without emitting logs — error handling uses synchronous `throw new Error(...)` calls in main.ts for fatal setup failures, and runtime state transitions are handled purely through immutable state updates rather than log emission. There are no log levels, sinks, formatters, or logger initialization anywhere in the project.