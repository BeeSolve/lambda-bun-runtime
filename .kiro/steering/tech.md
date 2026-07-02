# Tech Stack & Build System

## Core Technologies

- **Language**: TypeScript 6+ (strict mode)
- **Runtime**: Bun (package manager + test runner + bundler)
- **Build System**: Hand-written `command/build.ts` script
- **CDK Version**: aws-cdk-lib ^2.238.0, constructs ^10.4.5
- **Module**: ESM (`"type": "module"`)
- **Target**: ES2023, `module: Preserve`

## Key Libraries

| Library               | Purpose                                |
| --------------------- | -------------------------------------- |
| aws-cdk-lib           | CDK construct authoring                |
| @beesolve/lint-config | Shared oxlint rules + oxfmt config     |
| oxlint                | Linting                                |
| oxfmt                 | Formatting + import sorting            |
| fast-check            | Property-based testing                 |
| typescript            | Type checking + declaration generation |

## Common Commands

```bash
# Full build (layer + bundle + declarations + copy zip to dist/)
bun run build

# Build only the Lambda layer zip
bun run build:layer

# Check formatting and linting
bun run check

# Fix formatting and lint issues
bun run check:fix

# Format only
bun run fmt

# Lint only
bun run lint

# Run unit tests
bun test

# Type check (no emit)
bunx tsc --noEmit

# Run integration tests (requires AWS credentials)
bun run integ:deploy-test-destroy

# Install dependencies
bun install
```

## Build Pipeline (`command/build.ts`)

1. Runs `command/buildLayer.ts` → produces `lib/bun-lambda-layer-{version}.zip`
2. Bundles `src/index.ts` with `Bun.build` → `dist/index.js` (ESM, externals: aws-cdk-lib, constructs)
3. Runs `tsc --emitDeclarationOnly` → `dist/index.d.ts`
4. Copies layer zip from `lib/` to `dist/`

Published package contains only `dist/` (JS, declarations, layer zip).

## Versioning

`3.<bun_major * 10000 + bun_minor * 100 + bun_patch>.<internal_patch>`

- Major: `3` (post-projen era)
- Minor: encodes the full Bun version
- Patch: internal changes (resets to 0 on Bun version bump)

## Important Notes

- No projen, no jsii — all config is hand-written.
- `command/` scripts run directly with Bun (not part of the published package).
- `test/` uses `bun:test` and `fast-check` for property-based tests.
- `lib/` is gitignored — CI builds the layer fresh each time.
- `dist/` is gitignored — CI builds and publishes from fresh output.

## Coding Style & Conventions

### Variables & Immutability

- Always use `const`. Never use `let` unless there is no alternative (and explain why in a comment).
- Do not mutate arrays or objects. Use `.map()`, `.filter()`, spread, etc. to produce new values.
- All functions should be pure and side-effect-free where possible. When side effects are necessary (I/O, process.exit), isolate them at the edges.

### Control Flow

- Use early-return guard clauses instead of nested if/else blocks.
- Prefer extracting a helper function with guards over complex inline conditionals.
- Never use `!x` for null/undefined checks. Always use explicit `x == null` or `x != null` comparisons (loose equality intentionally catches both `null` and `undefined`).
- Never use `switch` statements or `if/else` chains for exhaustive matching. Use sequential `if` guards with an `assertUnreachable(value: never): never` call at the end.

### Iteration

- Use `for...of` loops. Do not use `.forEach()`.

### Function Signatures

- Every function accepts a single `props` object parameter — even if there is only one argument.
- Do not destructure `props` in the function signature or body. Access fields as `props.name` directly.
- All dependencies a function needs must be passed explicitly through `props` (dependency injection via props).

### Exports & File Organization

- Only export what other modules actually need. Keep everything else private (unexported).
- Exported members go at the top of the file; private helpers go at the bottom.
- Do not use unnamed default exports unless a framework explicitly requires it.
- Do not use barrel files (re-export index files).

### File Naming

- All filenames use camelCase (e.g., `buildLayer.ts`, `runtimeHelpers.ts`). Never PascalCase.

### Comments

- Do not add comments that merely restate what the code does.
- Do not add section-separator comments.
- Add comments only when there is a tradeoff, non-obvious reasoning, or a "why not the obvious approach" explanation.

### Testing

- Test only the public interface. Do not extract private functions into separate modules solely to make them testable.
- For scripts and runtimes without exports, use integration tests (spawn the process, mock external APIs, verify observable behavior).
