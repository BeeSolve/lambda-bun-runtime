# TypeScript Build Integration in CDK Synth

## Problem Statement

CDK construct constructors run synchronously during synthesis. `Bun.build()` is an async API that returns a `Promise`. This creates a fundamental tension: `BunFunction` needs to accept a `.ts` entrypoint and produce bundled JavaScript during `cdk synth`, but the async build cannot be awaited inside a synchronous constructor.

The question this research answers: can `BunFunction` accept a TypeScript handler path and build it during CDK synth, eliminating the need for a separate build step?

## Evaluated Approaches

Four approaches were evaluated for resolving the async `Bun.build()` operation within the synchronous CDK construct lifecycle:

| Approach | Viable | Execution Point |
|----------|--------|-----------------|
| (a) `Code.fromCustomCommand` with `bun build` CLI | Yes — primary | During CDK synth |
| (b) CDK Aspects | No | After construct tree is built |
| (c) Custom synthesis hooks | No | Before CloudFormation generation |
| (d) Pre-synth build step | Yes — fallback | Before CDK synth (separate invocation) |

## Implemented Approach: `Code.fromCustomCommand`

**Status:** Primary mechanism for `.ts` entrypoints.

### How It Works

When `BunFunction` receives a `.ts` entrypoint, it uses `Code.fromCustomCommand` to run the `bun build` CLI synchronously during CDK synth. The command produces a bundled `.js` file in an output directory, which CDK packages as a Lambda code asset.

```typescript
if (entrypoint.endsWith('.ts')) {
  code = Code.fromCustomCommand(outputDir, [
    'bun', 'build', entrypoint,
    '--outdir', outputDir,
    '--target', 'bun',
    '--minify',
  ]);
} else {
  code = Code.fromAsset(dirname(entrypoint));
}
```

### Why This Works

- `Code.fromCustomCommand` spawns a synchronous child process (uses `spawnSync` internally) — no async issues.
- It is a supported, public CDK API designed for exactly this use case: producing code assets via external build tools.
- Consumers of `BunFunction` already have Bun installed (they are deploying Bun Lambda functions), so the `bun` binary is available on the synth machine.
- The build runs during `cdk synth` with no separate step needed.
- Fully compatible with `cdk synth` and `cdk deploy` workflows.

### Trade-offs

| Aspect | Detail |
|--------|--------|
| **Bun required on synth machine** | Acceptable — users already have Bun installed to use this package |
| **Build runs every synth** | CDK caches via asset hash, so unchanged source won't re-upload to S3 |
| **Error reporting** | Build failures surface as CDK synthesis errors; messages may be less clear than a dedicated build step |
| **Plugin support** | Cannot use `Bun.build()` plugins that require the parent process context (the build runs in a child process) |
| **Output constraint** | Must produce a single file or directory that CDK can package as an asset |

### Constraints

- The `bun build` CLI is used (not the programmatic `Bun.build()` API), so only CLI-supported options are available.
- Source maps, if needed, must be configured via CLI flags.
- External modules cannot be specified via the programmatic `external` option — use `--external` CLI flag if needed.
- The output directory is managed by CDK; the construct cannot control its location.

## Fallback Approach: Pre-synth Build Step

**Status:** Documented fallback if `Code.fromCustomCommand` proves to have poor DX in practice.

### How It Works

A CLI command (e.g., `bun run build-handlers`) scans the project for `.ts` entrypoints referenced by `BunFunction` constructs and builds them to a `dist/` directory. The construct then references the pre-built `.js` files.

```bash
bun run build-handlers  # builds all .ts handlers to dist/
cdk synth               # references pre-built .js files
```

### When to Fall Back

- If `Code.fromCustomCommand` causes issues in CDK Pipelines (e.g., Bun not available in the pipeline environment).
- If synth times become unacceptable for large projects with many handlers.
- If error reporting from spawned builds is confusing or hard to debug.

### Trade-offs

| Aspect | Detail |
|--------|--------|
| **Separate step required** | Users must remember to run the build command before `cdk synth` |
| **Full Bun.build() API available** | Can use plugins, programmatic options, and custom logic |
| **Better error messages** | Build errors are reported directly in the terminal, not wrapped in CDK synthesis errors |
| **Stale output risk** | If the user forgets to rebuild, deployed code may be outdated |
| **CI/CD integration** | Straightforward — add the build step before `cdk synth` in the pipeline |

### Implementation Notes

- The build command would read a manifest or scan CDK code for `BunFunction` usage.
- Output goes to a conventional `dist/` directory.
- The construct accepts both `.ts` (for approach a) and `.js` (for pre-built) entrypoints — no code change needed to switch approaches.

## Why CDK Aspects Are Not Viable

CDK Aspects visit all constructs after the tree is built but before synthesis completes. They are designed for validation, tagging, and policy enforcement — not for modifying construct properties.

**Specific limitations:**

1. **Cannot modify `Code` after construction.** The `code` property of a Lambda function is set in the constructor via `super()`. Aspects cannot replace it after the fact.
2. **Synchronous execution.** Even if property modification were possible, Aspects run synchronously and cannot await `Bun.build()`.
3. **No output directory management.** Aspects have no mechanism to create temporary directories or manage build artifacts that CDK can package as assets.
4. **Intended use case mismatch.** Aspects are designed for cross-cutting concerns (adding tags, enforcing naming conventions), not for build orchestration.

## Why Custom Synthesis Hooks Are Not Viable

Overriding `synthesize()` on the stack or construct is technically possible but introduces significant problems.

**Specific limitations:**

1. **Not a supported public API pattern.** While `synthesize()` exists, overriding it for build orchestration is not documented or recommended by the CDK team.
2. **Breaks with CDK Pipelines.** CDK Pipelines has its own synthesis orchestration that assumes standard synthesis behavior. Custom hooks can conflict with pipeline stages.
3. **Fragile across CDK versions.** Internal synthesis lifecycle details may change between CDK versions without notice, breaking custom hooks.
4. **Asset path timing.** By the time `synthesize()` runs, asset paths must already be resolved. Building code during synthesis is too late — the asset hash has already been computed from the (not-yet-existing) output directory.
5. **Complexity.** Requires deep understanding of CDK internals and careful ordering of operations, making the construct harder to maintain.

## Recommendations

1. **Use `Code.fromCustomCommand` as the default.** It works out of the box for the common case: a developer with Bun installed running `cdk synth` or `cdk deploy` locally or in CI.

2. **Accept `.js` entrypoints for pre-built code.** This provides an escape hatch for users who prefer explicit build steps or whose environments don't have Bun available during synth.

3. **Document the fallback pattern.** Users with CDK Pipelines or complex CI setups may need the pre-synth build step. Make it easy to adopt without changing construct code.

4. **Do not invest in Aspects or synthesis hooks.** These approaches are fundamentally incompatible with the CDK lifecycle for build orchestration purposes.
