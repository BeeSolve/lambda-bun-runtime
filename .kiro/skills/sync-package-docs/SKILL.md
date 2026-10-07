---
name: sync-package-docs
description: Keep this package's agentic documentation (DOCS.md + docs/how-to/ guides) in sync with the code. Use when the public CDK construct API changes (exports, props), a how-to workflow changes, or the sample app changes. Internal to the @beesolve/lambda-bun-runtime repo.
---

## Overview

This is the `@beesolve/lambda-bun-runtime` binding for the generic `agentic-package-docs` skill. The method, the non-negotiable rules, the DOCS.md / how-to templates, and the sync procedure live in that user-level skill - **read and follow it.** This file only supplies the concrete values for THIS repo. Where they overlap, these repo-specific values win.

## Repo-Specific Bindings

- **Package:** `@beesolve/lambda-bun-runtime` - a SINGLE published package (not a monorepo). Docs live at the repo root (`DOCS.md`, `docs/how-to/`), not under `packages/`.
- **Scope / repo / branch:** `@beesolve`, `https://github.com/BeeSolve/lambda-bun-runtime`, branch `main`. Org casing is `BeeSolve`.
- **Install command:** `bun add` (primary); mention `npm install` as an alternative. `aws-cdk-lib` and `constructs` are peer dependencies.
- **Public API (verify in `src/index.ts` before writing):** constructs `BunFunction`, `BunLambdaLayer`; types `BunFunctionProps`, `BunLambdaLayerProps`. These are CDK constructs - samples are CDK stack code, not SDK calls.
- **Example:** `examples/sample-app/` (a deployable CDK app, workspace member). It is the one Working Examples link. Confirm construct usage in `examples/sample-app/lib/sample-stack.ts`.
- **Publish mechanism:** the `files` array in `package.json`. It must include `"dist/"`, `"docs/how-to"`, `"DOCS.md"`. There is no `.npmignore`.
- **Keep OUT of the tarball:** `docs/adr-*.md` and any other `docs/*.md` that are not under `docs/how-to/` (e.g. `docs/aws-oidc-setup.md`). Never add the whole `"docs"` folder to `files`.

## Verification Gates (this repo)

```bash
bun run check        # oxfmt --check && oxlint . (run `bun run fmt` first if markdown tables need realignment)
bun test

# tarball check
bun pm pack --dry-run
```

Note: there is NO `type-check` script in this repo (declarations are emitted by the build). The gates are `check` and `test` only. The pack output must include `DOCS.md` and `docs/how-to/*.md` and must NOT include `docs/adr-*.md` or `docs/aws-oidc-setup.md`.

## Audit

```bash
grep -c "Coming soon" DOCS.md                   # expect 0
grep -c "Keywords:" DOCS.md                      # expect 1
grep -c "matches the installed version" DOCS.md  # expect 1
ls docs/how-to/                                   # guides linked from DOCS.md must exist here
```

## Release Note (important - no changesets)

This repo does NOT use changesets. Releases are Bun-version-driven: the `release.yml`
workflow computes the package version as `3.X.Y` from `.bun-version` and publishes on
`workflow_dispatch` or a push to `.bun-version`. A docs-only change ships with the next
release automatically because `files` now includes the docs - there is no changeset to
create. Do not add a `.changeset/` file here.

## Scope Note

Internal tooling for `@beesolve/lambda-bun-runtime`. Not published to npm, not referenced from the package README.
