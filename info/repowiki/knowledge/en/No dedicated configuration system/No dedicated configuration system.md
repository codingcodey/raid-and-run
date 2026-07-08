---
kind: configuration_system
name: No dedicated configuration system
category: configuration_system
scope:
    - '**'
source_files:
    - vite.config.ts
    - src/asset-path.ts
---

This repository does not implement a configuration system. The project is a small browser-based arcade game with no runtime configuration loading, feature flags, environment-specific settings, or secrets management. The only build-time configuration present is Vite's `base` path set to `./` in `vite.config.ts`, and the source code reads that value via `import.meta.env.BASE_URL` in `src/asset-path.ts`. `.env*` files are ignored by `.gitignore` but are never referenced anywhere in the source. There is no config file format (YAML/TOML/JSON), no config loader, no env-var parsing library, and no convention for overriding behavior at runtime.