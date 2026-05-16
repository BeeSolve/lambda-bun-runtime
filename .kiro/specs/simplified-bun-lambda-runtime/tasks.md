# Implementation Plan: Simplified Bun Lambda Runtime

## Overview

This plan implements the modernization of `@beesolve/lambda-bun-runtime` in incremental steps: replacing the runtime with a minimal Node.js-style handler loop, replacing the shell build script with TypeScript, updating CDK constructs to use `filename.handler` convention with TypeScript build support via `Code.fromCustomCommand`, adding automated version tracking and release workflows, and documenting Fetch API companion package usage.

## Tasks

- [x] 1. Implement the simplified runtime
  - [x] 1.1 Create the minimal runtime loop (`command/runtime.ts`)
    - Replace the existing ~500-line Fetch API runtime with the minimal ~80-line implementation
    - Implement the Lambda Runtime API polling loop: `GET /runtime/invocation/next`
    - Implement handler resolution: split `_HANDLER` at last dot to derive `filename` and `exportName`
    - Import handler module from `$LAMBDA_TASK_ROOT/filename`
    - Construct the `LambdaContext` object from environment variables and response headers (`functionName`, `functionVersion`, `invokedFunctionArn`, `memoryLimitInMB`, `awsRequestId`, `logGroupName`, `logStreamName`, `getRemainingTimeInMillis()`)
    - Call `handler(event, context)` and serialize response as JSON to `POST /runtime/invocation/{requestId}/response`
    - Post `null` when handler returns `undefined`
    - Post errors to `POST /runtime/invocation/{requestId}/error` (invocation errors) or `POST /runtime/init/error` (init errors)
    - Handle missing/invalid `_HANDLER` (no dot) by posting init error and exiting
    - Handle module-not-found and export-not-a-function errors as init errors
    - Remove all Fetch API conversion, WebSocket handling, and `aws4fetch` dependency
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [x]* 1.2 Write property test: handler string resolution (Property 1)
    - **Property 1: Handler string resolution splits at last dot**
    - Generate strings containing at least one dot, verify split at last dot produces correct `filename` and `exportName`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 1.2**

  - [x]* 1.3 Write property test: context object construction (Property 3)
    - **Property 3: Context object construction**
    - Generate random environment variable values and response header values, verify all context fields match sources and `getRemainingTimeInMillis()` returns correct value within timing tolerance
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 1.5**

  - [x]* 1.4 Write property test: error formatting (Property 4)
    - **Property 4: Error formatting preserves error information**
    - Generate Error objects with random names/messages/stacks, verify `errorType`, `errorMessage`, and `stackTrace` output. For non-Error values, verify `errorType` is `"Error"` and `errorMessage` is the inspected representation
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 1.8**

  - [x]* 1.5 Write unit tests for runtime edge cases
    - Test missing `_HANDLER` env var → init error posted
    - Test `_HANDLER` with no dot → init error posted
    - Test handler returns `undefined` → `null` posted as response
    - Test handler module not found → init error posted
    - Test handler export is not a function → init error posted
    - Mock the Lambda Runtime API HTTP endpoints for testing
    - _Requirements: 1.3, 1.7, 1.8, 1.9_

- [x] 2. Implement the build layer script
  - [x] 2.1 Create the TypeScript build layer script (`command/buildLayer.ts`)
    - Replace `command/buildLayer.sh` with a TypeScript implementation executable with Bun
    - Accept version from CLI argument (precedence) or `BUN_VERSION` environment variable
    - Validate version format as semver
    - Download Bun binary from `https://github.com/oven-sh/bun/releases/download/bun-v{version}/bun-linux-aarch64.zip`
    - Extract the `bun` executable from the downloaded archive
    - Compile `command/runtime.ts` using `Bun.build()` with `target: "bun"` and `minify: true` producing a single `runtime.js`
    - Generate the bootstrap shell script (`#!/bin/sh\nexec /opt/bun /opt/runtime.js`)
    - Package `bootstrap`, `bun`, and `runtime.js` into a zip file at `lib/bun-lambda-layer-{version}.zip`
    - Ensure zip structure places all files at root level (extractable to `/opt`)
    - Exit with non-zero code and descriptive error messages on failure (download, compile, zip)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 2.2 Update `.projenrc.ts` to reference the new build layer script
    - Change the `build-layer` task from `./command/buildLayer.sh` to `bun command/buildLayer.ts`
    - Run `bunx projen` to regenerate project files
    - _Requirements: 2.8_

  - [x]* 2.3 Write property test: version parameter precedence (Property 6)
    - **Property 6: Version parameter precedence**
    - Generate pairs of version strings, verify CLI argument takes precedence over env var, and env var is used when CLI arg is absent
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.6**

  - [x]* 2.4 Write property test: semver validation (Property 7)
    - **Property 7: Semver validation**
    - Generate strings matching `{positive_integer}.{non_negative_integer}.{non_negative_integer}` pattern → accepted. Generate strings not matching → rejected
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 4.7**

  - [x]* 2.5 Write unit tests for build layer script
    - Test bootstrap script content is exactly `#!/bin/sh\nexec /opt/bun /opt/runtime.js`
    - Test zip structure has entries at root level (no subdirectories)
    - Test error handling for invalid version format
    - Test error handling for missing version (no CLI arg, no env var)
    - _Requirements: 2.5, 2.9, 2.10_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update CDK constructs
  - [x] 4.1 Update `BunFunction` construct in `src/index.ts`
    - Change default export name from `fetch` to `handler`
    - Add optional `exportName` prop to `BunFunctionProps`
    - Accept both `.ts` and `.js` entrypoints in the `entrypoint` prop type
    - Implement handler derivation: extract basename without extension, append `.` + exportName (default `"handler"`)
    - When `.ts` entrypoint is provided, use `Code.fromCustomCommand` to run `bun build <entrypoint> --outdir <output> --target bun --minify`
    - When `.js` entrypoint is provided, use `Code.fromAsset(dirname(entrypoint))` directly
    - Throw an error if entrypoint has no parseable basename
    - Remove the old `toEntry` helper function and replace with new derivation logic
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1, 7.2, 7.3_

  - [x] 4.2 Update `BunLambdaLayer` construct to use dynamic version
    - Ensure the layer references the correct zip file path pattern `lib/bun-lambda-layer-{version}.zip`
    - Keep ARM_64 architecture and PROVIDED_AL2023 runtime
    - _Requirements: 2.7_

  - [x]* 4.3 Write property test: BunFunction handler derivation (Property 5)
    - **Property 5: BunFunction handler derivation from entrypoint**
    - Generate valid file path strings ending in `.js` or `.ts` with parseable basenames, verify derived handler string equals `<basename_without_extension>.<exportName>` with default `"handler"`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x]* 4.4 Write unit tests for CDK constructs
    - Test BunFunction with `.js` entrypoint produces correct handler string
    - Test BunFunction with `.ts` entrypoint uses `Code.fromCustomCommand`
    - Test BunFunction with explicit `exportName` uses provided value
    - Test BunFunction with invalid entrypoint (empty, no basename) throws error
    - Test BunFunction does NOT use `.fetch` as default export
    - Synthesize a test stack and verify CloudFormation output
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add GitHub Actions workflows
  - [x] 6.1 Create version tracker workflow (`.github/workflows/bun-version-check.yml`)
    - Add scheduled trigger (daily cron, at least every 24 hours)
    - Add `workflow_dispatch` trigger with required `version` input
    - Fetch latest stable (non-prerelease, non-canary) release from `oven-sh/bun` GitHub API
    - Compare against current version to detect new releases
    - Validate manually dispatched version input matches semver format
    - Trigger the build-layer workflow with the new version number as input
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7_

  - [x] 6.2 Create build and release workflow (`.github/workflows/build-layer.yml`)
    - Add `workflow_dispatch` trigger with version input
    - Add `workflow_call` trigger (callable from version tracker)
    - Setup Bun, install dependencies
    - Set `BUN_VERSION` environment variable from input
    - Run `bun command/buildLayer.ts` to build the layer
    - Run `bunx projen build` to compile CDK constructs
    - On success, trigger package publish pipeline
    - On failure, report via workflow run status without triggering publish
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 6.3 Create release workflow with GitHub Release artifacts (`.github/workflows/release.yml`)
    - Create GitHub Release tagged with package version `v{major}.{minor}.{patch}`
    - Upload `bun-lambda-layer-{version}.zip` as a release asset
    - Include Bun version number in release notes body
    - Fail the workflow if zip upload fails (no release without artifact)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 6.4 Verify existing `upgrade-main.yml` workflow meets requirements
    - Confirm it uses `oven-sh/setup-bun`, `bun install --frozen-lockfile`, and `bunx projen upgrade`
    - Confirm daily schedule at midnight UTC and workflow_dispatch support
    - Confirm PR creation on `github-actions/upgrade-main` branch targeting `main`
    - Make adjustments if any requirement is not met
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Add Fetch API integration documentation
  - [x] 7.1 Add Fetch API integration section to README
    - Add a dedicated section for Fetch API integration in the package README
    - Document usage of `@beesolve/lambda-fetch-api` companion package with `asHttpV2Handler`
    - Show the dual-export pattern: `fetch` for Bun's native server + `handler` for Lambda
    - Include a complete code example showing the recommended usage pattern
    - Note that `@beesolve/lambda-fetch-api` is a separate package at `https://github.com/BeeSolve/packages/tree/main/packages/lambda-fetch-api`
    - State that this package does not re-implement or bundle Fetch API helpers
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.2 Document TypeScript build integration research findings
    - Document the `Code.fromCustomCommand` approach as the primary mechanism for `.ts` entrypoints
    - Document the pre-synth build step as the fallback approach
    - Document why CDK Aspects and custom synthesis hooks are not viable
    - Include trade-offs and constraints for each approach
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 8. Wire everything together and add fast-check devDependency
  - [x] 8.1 Add `fast-check` as a devDependency and configure test infrastructure
    - Add `fast-check` to devDependencies in `.projenrc.ts`
    - Run `bunx projen` to regenerate project files
    - Ensure `bun test` discovers and runs all test files
    - Create test directory structure if needed
    - _Requirements: (testing infrastructure)_

  - [x] 8.2 Delete the old `command/buildLayer.sh` shell script
    - Remove the obsolete shell script now replaced by `command/buildLayer.ts`
    - _Requirements: 2.8_

  - [x]* 8.3 Write property test: event passthrough (Property 2)
    - **Property 2: Event passthrough preserves data**
    - Generate arbitrary JSON-serializable values, verify the runtime passes the exact parsed object to the handler without modification
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 1.4, 1.6**

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Bun's test runner (`bun test`) and `fast-check` for property-based testing
- All workflows are projen-managed where possible; custom workflows are added alongside projen-generated ones
- The existing `upgrade-main.yml` already meets most of Requirement 5 — task 6.4 verifies and adjusts if needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "8.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "8.3"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["7.1", "7.2", "8.2"] }
  ]
}
```
