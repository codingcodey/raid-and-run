---
kind: build_system
name: Vite + TypeScript Build & GitHub Pages Deployment
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.ts
    - tsconfig.json
    - .github/workflows/deploy.yml
---

The project uses a minimal, modern browser-game build pipeline centered on Vite and TypeScript, with automated deployment to GitHub Pages via GitHub Actions.

**Build toolchain**
- **Vite 8** is the bundler and dev server. The config (`vite.config.ts`) sets `base: "./"` so assets resolve relative to the repository root — required for GitHub Pages subpath hosting.
- **TypeScript 6** compiles in strict mode (`strict`, `forceConsistentCasingInFileNames`, `isolatedModules`, `noEmit`). Output is emitted by Vite; `tsc` runs only as a type-check step before bundling.
- **Vitest 3** provides unit testing (`npm test` / `npm test:watch`), invoked from CI.
- Node ESM is enabled (`"type": "module"`); module resolution targets the Vite bundler.

**NPM scripts (entry points)**
- `npm run dev` — starts the Vite dev server bound to `0.0.0.0` for container/remote access.
- `npm run build` — runs `tsc` then `vite build`; produces static files under `dist/`.
- `npm test` / `npm test:watch` — Vitest runner.

**CI/CD (GitHub Actions)**
- `.github/workflows/deploy.yml` triggers on pushes to `main` and manual dispatch.
- Steps: checkout → setup Node 24 with npm cache → `npm ci` → `npm test` → `npm run build` → configure Pages → upload `dist/` artifact → deploy via `actions/deploy-pages@v4`.
- Concurrency group `pages` prevents overlapping deployments; no rollback strategy is configured.

**Artifacts & output**
- Production bundle lives in `dist/` (root-level directory, not nested under `public/`).
- Game assets (images, audio) are shipped under `public/assets/` and copied verbatim into the build output.
- No Dockerfile, Makefile, or cross-compilation target exists — this is a single-target (browser) SPA.

**Conventions developers should follow**
- Add new source files under `src/` following the existing flat layout (`*.ts` modules).
- Place static assets under `public/assets/` and reference them through Vite's asset pipeline.
- Keep `tsconfig.json` strict settings intact; do not disable `noEmit` since Vite owns emission.
- Run `npm test` locally before pushing; failing tests block the Pages deployment.