# Product Overview

`@beesolve/lambda-bun-runtime` is an open-source npm package that provides a custom AWS Lambda runtime for [Bun](https://bun.sh) along with AWS CDK constructs.

## What It Does

- Packages the Bun binary into a Lambda Layer for ARM64/AL2023
- Provides a minimal custom runtime (~80 lines) that implements the Lambda Runtime API loop
- Exposes two CDK constructs: `BunLambdaLayer` and `BunFunction`
- Handlers use the standard Node.js-style `(event, context) => response` signature (not Fetch API)
- `.ts` entrypoints are automatically built with Bun during CDK synth; `.js` files are used directly

## Key Design Decisions

- No Fetch API conversion — raw Lambda events are passed directly to handlers
- Fetch API support is a separate companion package (`@beesolve/lambda-fetch-api`)
- ARM64-only architecture
- Published as a jsii library (polyglot CDK construct)
- MIT licensed, published to npm under `@beesolve` scope
