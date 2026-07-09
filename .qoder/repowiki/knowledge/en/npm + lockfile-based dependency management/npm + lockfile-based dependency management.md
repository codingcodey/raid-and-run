---
kind: dependency_management
name: npm + lockfile-based dependency management
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - .gitignore
---

This project uses the standard npm ecosystem for dependency management with no vendoring or private registry configuration.

**System and tools**
- Package manager: npm (lockfileVersion 3 in `package-lock.json`).
- Runtime/build toolchain declared as devDependencies only: TypeScript, Vite, Vitest, and `@types/node`.
- The package is marked `"private": true`, so it is not intended to be published to a public registry.
- No runtime dependencies — all third-party code is used at build/test time only.

**Key files**
- `package.json` — declares the four devDependencies and scripts (`dev`, `build`, `test`, `test:watch`).
- `package-lock.json` — deterministic lockfile that pins every transitive dependency tree; committed to version control.
- `.gitignore` — excludes `node_modules/` and `dist/` from the repository.
- `vite.config.ts` / `tsconfig.json` — configure how the declared packages are consumed during build.

**Architecture and conventions**
- All third-party packages live under `node_modules/` (standard npm layout); nothing is vendored into source.
- Version ranges use caret (`^`) semantics, allowing minor/patch upgrades while keeping major versions locked.
- There is no `.npmrc`, no `GOFLAGS`, no `GOPRIVATE`, and no custom registry configured — everything resolves against the default npm registry.
- The CI workflow (`deploy.yml`) installs dependencies via npm before building, relying on the committed lockfile for reproducibility.

**Rules developers should follow**
- Add new build/test-only packages exclusively under `devDependencies`; this project has zero runtime deps.
- Commit `package-lock.json` alongside any change to `package.json` to keep the lockfile in sync.
- Do not commit `node_modules/` or `dist/` — they are ignored by `.gitignore`.
- Avoid adding a `.npmrc` or publishing the package unless there is a clear need for a private registry or publish target.