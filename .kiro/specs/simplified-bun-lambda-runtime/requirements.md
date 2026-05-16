# Requirements Document

## Introduction

This feature modernizes and simplifies the `@beesolve/lambda-bun-runtime` package across multiple phases. The core change replaces the current Fetch API-based runtime (~500 lines) with a minimal Node.js-style runtime that passes `(event, context)` to handlers. Additional phases add a self-contained build layer script (no longer requiring a full git clone), automated version tracking, dependency updates via projen's existing mechanism, a Bun-compiled runtime, TypeScript build integration research for the CDK construct, documentation for using the companion `@beesolve/lambda-fetch-api` package for Fetch API integration, and GitHub Release artifacts.

## Glossary

- **Runtime**: The custom Lambda runtime script (`runtime.ts`) that implements the AWS Lambda Runtime API loop (polling for invocations, invoking the handler, posting responses).
- **Handler**: A user-provided function exported from a module that processes Lambda invocations. Uses the signature `(event, context) => response`.
- **Lambda_Runtime_API**: The HTTP API provided by AWS at `AWS_LAMBDA_RUNTIME_API` for custom runtimes to receive invocations and post responses.
- **BunFunction**: A CDK construct that creates an AWS Lambda function configured to use the Bun runtime layer.
- **BunLambdaLayer**: A CDK construct that provisions the custom Bun Lambda layer containing the Bun binary and the runtime script.
- **Build_Layer_Script**: A TypeScript script that downloads the Bun release binary, bundles the custom runtime, and produces the layer zip file. Replaces the previous shell script that cloned the full Bun repository.
- **Version_Tracker**: A GitHub Actions workflow that detects new Bun releases and triggers a layer build with the new version.
- **Fetch_API_Helpers**: The companion package `@beesolve/lambda-fetch-api` that provides utility functions (e.g., `asHttpV2Handler`) to wrap Fetch API handlers into standard Lambda handlers, enabling dual-environment compatibility for Bun's native server and Lambda.
- **Documentation**: The package README and associated documentation that describes usage patterns, integration with companion packages, and configuration options.
- **CDK_Synth**: The CDK synthesis process that generates CloudFormation templates from construct code. Runs synchronously in construct constructors.
- **Bootstrap**: The shell script included in the Lambda layer that starts the Bun process and executes the runtime script.

## Requirements

### Requirement 1: Simplified Runtime Loop

**User Story:** As a Lambda developer, I want the runtime to use a minimal Node.js-style handler signature, so that I can write handlers with `(event, context) => response` without needing to understand the Fetch API conversion layer.

#### Acceptance Criteria

1. THE Runtime SHALL implement the AWS Lambda Runtime API loop by polling `GET /runtime/invocation/next` and posting responses to `POST /runtime/invocation/{requestId}/response`.
2. WHEN an invocation is received, THE Runtime SHALL resolve the handler module by splitting the `_HANDLER` environment variable at the last dot character to derive `filename` and `exportName`, then importing the file at `$LAMBDA_TASK_ROOT/filename`.
3. IF the `_HANDLER` environment variable is missing or does not contain a dot separator, THEN THE Runtime SHALL post an initialization error to `POST /runtime/init/error` with an error indicating the handler format is invalid.
4. WHEN an invocation is received, THE Runtime SHALL invoke the resolved handler function with two arguments: the parsed JSON event object and a context object.
5. THE Runtime SHALL construct the context object containing `functionName`, `functionVersion`, `invokedFunctionArn`, `memoryLimitInMB`, `awsRequestId`, `logGroupName`, `logStreamName`, and a `getRemainingTimeInMillis()` method that returns the number of milliseconds remaining before invocation timeout based on the `Lambda-Runtime-Deadline-Ms` response header from the invocation.
6. WHEN the handler returns a value that is not `undefined`, THE Runtime SHALL serialize the return value as JSON and post it to the Lambda Runtime API response endpoint.
7. WHEN the handler returns `undefined` or returns a resolved Promise with no value, THE Runtime SHALL post `null` to the Lambda Runtime API response endpoint.
8. IF the handler throws an error, THEN THE Runtime SHALL post a JSON object containing `errorType` (the error name or "Error"), `errorMessage` (the error message or inspected value), and optionally `stackTrace` (array of stack frame strings) to `POST /runtime/invocation/{requestId}/error`.
9. IF the handler module cannot be found or imported, THEN THE Runtime SHALL post an initialization error to `POST /runtime/init/error`.
10. THE Runtime SHALL NOT perform any conversion between Lambda events and Fetch API Request/Response objects.

### Requirement 2: Self-Contained Build Layer Script

**User Story:** As a package maintainer, I want the build layer script to download the Bun binary directly from a release URL and package it with the runtime, so that the build process is faster and does not require cloning the entire Bun repository.

#### Acceptance Criteria

1. THE Build_Layer_Script SHALL download the Bun binary from the GitHub releases URL matching the pattern `https://github.com/oven-sh/bun/releases/download/bun-v{version}/bun-linux-aarch64.zip` for the specified version.
2. THE Build_Layer_Script SHALL target only the Linux ARM64 (aarch64) architecture.
3. THE Build_Layer_Script SHALL extract the `bun` executable from the downloaded release archive.
4. THE Build_Layer_Script SHALL bundle the runtime script (compiled from `command/runtime.ts` using Bun's bundler into a single JavaScript file) into the layer zip alongside the Bun binary and bootstrap script.
5. THE Build_Layer_Script SHALL include a bootstrap shell script at the root of the zip that invokes the Bun binary to execute the compiled runtime script.
6. THE Build_Layer_Script SHALL accept a version parameter via an environment variable named `BUN_VERSION`, with an optional override via a command-line argument, where the command-line argument takes precedence.
7. WHEN the build completes successfully, THE Build_Layer_Script SHALL produce a zip file named `bun-lambda-layer-{version}.zip` in the `lib/` directory.
8. THE Build_Layer_Script SHALL be implemented in TypeScript and executable with Bun.
9. IF the download fails due to a non-existent version or network error, THEN THE Build_Layer_Script SHALL exit with a non-zero exit code and print an error message indicating the failure reason.
10. THE Build_Layer_Script SHALL structure the zip contents so that when extracted to `/opt` by Lambda, the bootstrap script, Bun binary, and compiled runtime are all located within `/opt`.

### Requirement 3: BunFunction Construct Handler Derivation

**User Story:** As a CDK user, I want BunFunction to derive the Lambda handler string from the entrypoint prop and default the export name to `handler`, so that my handlers use the standard Node.js-style `(event, context)` signature without requiring a `.fetch` export.

#### Acceptance Criteria

1. THE BunFunction SHALL derive the Lambda handler string from the `entrypoint` prop by extracting the file name without extension and appending a dot followed by the export name, defaulting the export name to `handler` when not explicitly provided by the user.
2. THE BunFunction SHALL set the Lambda function's handler property to the value `<filename>.handler`, where `<filename>` is the base name (without path or extension) of the `entrypoint` prop, when no explicit export name is provided.
3. WHEN the user provides an explicit export name, THE BunFunction SHALL set the Lambda function's handler property to `<filename>.<exportName>` using the user-provided export name instead of the default.
4. THE BunFunction SHALL NOT use `.fetch` as the default export name.
5. IF the `entrypoint` prop value does not contain a parseable file name, THEN THE BunFunction SHALL throw an error indicating that the handler path cannot be resolved from the provided entrypoint.
6. THE BunFunction SHALL pass the event and context objects to the handler in the same format as the standard Node.js Lambda runtime, requiring no handler signature changes from Node.js conventions.

### Requirement 4: Automated Bun Version Tracking

**User Story:** As a package maintainer, I want new Bun releases to automatically trigger a layer build and package publish, so that the package stays current without manual intervention.

#### Acceptance Criteria

1. THE Version_Tracker SHALL check for new stable (non-prerelease, non-canary) Bun releases from the official Bun GitHub repository (oven-sh/bun) on a scheduled interval of no less than once every 24 hours.
2. WHEN a new stable Bun release is detected that has not already been processed, THE Version_Tracker SHALL trigger a GitHub Actions workflow with the new version number as an input parameter.
3. WHEN a workflow is triggered, THE Version_Tracker SHALL set the Bun version as an environment variable named BUN_VERSION available to the Build_Layer_Script.
4. WHEN the layer build succeeds, THE Version_Tracker SHALL trigger the package publish pipeline.
5. IF the layer build fails, THEN THE Version_Tracker SHALL not trigger the package publish pipeline and SHALL report the failure via the workflow run status.
6. THE Version_Tracker SHALL support manual workflow_dispatch with a required version input that accepts a valid semantic version string (e.g., "1.3.13") for on-demand builds.
7. IF a manually dispatched version input does not match a valid semantic version format, THEN THE Version_Tracker SHALL fail the workflow with an error indicating the version format is invalid.

### Requirement 5: Automated Dependency Updates

**User Story:** As a package maintainer, I want package dependencies to be updated automatically on a regular schedule, so that the project stays current with security patches and improvements.

#### Acceptance Criteria

1. THE Version_Tracker SHALL use projen's built-in `upgrade` task via the existing `upgrade-main` workflow for dependency updates.
2. THE Version_Tracker SHALL run the upgrade workflow on a daily schedule at midnight UTC (cron: `0 0 * * *`) and support manual triggering via workflow_dispatch.
3. WHEN the `bunx projen upgrade` command produces file changes in the repository, THE Version_Tracker SHALL create a pull request targeting the `main` branch with the updated dependencies on the `github-actions/upgrade-main` branch.
4. IF the `bunx projen upgrade` command produces no file changes, THEN THE Version_Tracker SHALL skip pull request creation.
5. THE Version_Tracker SHALL configure the upgrade workflow to use `oven-sh/setup-bun` for Bun installation, run `bun install --frozen-lockfile` for dependency resolution, and execute `bunx projen upgrade` for the dependency update step.

### Requirement 6: Bun-Compiled Runtime

**User Story:** As a package maintainer, I want the runtime.ts to be compiled with Bun before inclusion in the layer, so that the layer ships optimized code rather than raw TypeScript.

#### Acceptance Criteria

1. THE Build_Layer_Script SHALL compile runtime.ts using Bun's bundler with all imported dependencies bundled inline, producing a self-contained output with no external module dependencies.
2. WHEN the runtime is compiled, THE Build_Layer_Script SHALL produce a single JavaScript output file named runtime.js.
3. THE Build_Layer_Script SHALL target the Bun runtime environment during compilation.
4. THE Build_Layer_Script SHALL enable minification for the compiled runtime output.
5. IF runtime.ts compilation fails, THEN THE Build_Layer_Script SHALL exit with a non-zero exit code and produce no output file.

### Requirement 7: BunFunction TypeScript Build Integration (Research)

**User Story:** As a CDK user, I want to understand whether BunFunction can accept a TypeScript handler path and build it during CDK synth, so that a separate build step may be eliminated in the future.

#### Acceptance Criteria

1. THE BunFunction SHALL document the feasibility of accepting a TypeScript file path as the entrypoint by evaluating whether each candidate approach can produce a bundled JavaScript output compatible with the existing `Code.fromAsset` deployment mechanism without requiring the user to run a separate build command.
2. THE BunFunction SHALL evaluate at least the following approaches for resolving the asynchronous Bun.build operation within the synchronous CDK construct lifecycle: (a) Bun.spawnSync running a build script synchronously, (b) CDK Aspects that execute after all constructs are created, (c) custom synthesis hooks that run before CloudFormation generation, and (d) a pre-synth build step that traverses all BunFunction constructs. For each approach, the evaluation SHALL document: whether it executes within CDK synth or requires a separate invocation, whether it maintains compatibility with `cdk synth` and `cdk deploy` workflows, and what limitations or failure modes it introduces.
3. IF the research determines that at least one approach can produce bundled output during or before CDK synthesis without breaking the standard `cdk synth` and `cdk deploy` workflow, THEN THE BunFunction SHALL document the recommended approach including: the integration point in the CDK lifecycle, the trade-offs relative to the current pre-build approach, and any constraints on supported Bun.build options (e.g., target, external modules, source maps).
4. IF the research determines that no evaluated approach can produce bundled output without breaking the standard `cdk synth` and `cdk deploy` workflow or introducing unacceptable constraints, THEN THE BunFunction SHALL document the specific limitation that blocks each approach and confirm that the current pre-build pattern (requiring `entrypoint` to reference a pre-compiled `.js` file) remains the recommended usage.

### Requirement 8: Fetch API Integration Documentation

**User Story:** As a Lambda developer, I want documentation showing how to use `@beesolve/lambda-fetch-api` alongside this runtime, so that I can write Fetch API-style handlers that work both in Bun's native server and in Lambda without this package re-implementing those helpers.

#### Acceptance Criteria

1. THE Documentation SHALL describe how to use the companion package `@beesolve/lambda-fetch-api` to wrap a Fetch API handler into a standard Lambda handler using the `asHttpV2Handler` function.
2. THE Documentation SHALL show the pattern of exporting both a `fetch` function (for Bun's native HTTP server) and a `handler` function (for Lambda invocation via this runtime) from the same file, demonstrating dual-environment compatibility.
3. THE Documentation SHALL include a complete code example showing the recommended usage pattern: defining a `fetch` handler that accepts a `Request` and returns a `Response`, wrapping it with `asHttpV2Handler` to produce the `handler` export, and exporting both from the same module.
4. THE Documentation SHALL note that `@beesolve/lambda-fetch-api` is a separate package maintained at `https://github.com/BeeSolve/packages/tree/main/packages/lambda-fetch-api` and that future enhancements to Fetch API helpers will be made in that package independently.
5. THE Documentation SHALL state that this package (`@beesolve/lambda-bun-runtime`) does not re-implement or bundle Fetch API conversion helpers and that users who need Fetch API support must install `@beesolve/lambda-fetch-api` as a separate dependency.
6. THE Documentation SHALL be included in the package README under a dedicated section for Fetch API integration.

### Requirement 9: GitHub Release Artifacts

**User Story:** As a consumer of this package, I want prebuilt layer zip files available as GitHub Release artifacts, so that I can download and use the layer without installing the npm package.

#### Acceptance Criteria

1. WHEN the release workflow is triggered on the main branch, THE Version_Tracker SHALL create a GitHub Release tagged with the package version in the format `v{major}.{minor}.{patch}`.
2. WHEN a GitHub Release is created, THE Version_Tracker SHALL upload the built `bun-lambda-layer-{version}.zip` file as a GitHub Release asset, where `{version}` matches the Bun version used to build the layer.
3. WHEN a GitHub Release is created, THE Version_Tracker SHALL include the Bun version number in the release notes body.
4. IF the zip file upload to the GitHub Release fails, THEN THE Version_Tracker SHALL fail the release workflow and report the failure without publishing a release that has no attached artifact.
