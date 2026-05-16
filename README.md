# Lambda bun runtime

[![View on Construct Hub](https://constructs.dev/badge?package=%40beesolve%2Flambda-bun-runtime)](https://constructs.dev/packages/@beesolve/lambda-bun-runtime)

This repository contains custom built bun runtime for AWS Lambda. It also contains CDK constructs for `BunFunction` which uses `BunLambdaLayer`.

[Bun](https://bun.com) is a fast JavaScript runtime.

Current bun version: [1.3.13](https://bun.com/blog/bun-v1.3.13)

## Installation

You can install current version of our Lambda bun runtime from `npm` like this:

```bash
npm i @beesolve/lambda-bun-runtime
```

## Usage

There are two constructs which you can use right ahead - `BunFunction` which depends on `BunLambdaLayer`:

```ts
import { BunLambdaLayer, BunFunction } from '@beesolve/lambda-bun-runtime';
import { Duration } from "aws-cdk-lib";

const bunLayer = new BunLambdaLayer(this, "BunLayer");

const apiHandler = new BunFunction(this, "ApiHandler", {
  entrypoint: `${__dirname}/api.ts`,
  memorySize: 1024,
  timeout: Duration.seconds(10),
  environment: {
    STAGE: 'prod',
  },
  bunLayer,
});
```

You can pass additional properties to both `BunLambdaLayer` and `BunFunction`.

`BunFunction` accepts both `.ts` and `.js` entrypoints. When a `.ts` file is provided, the construct builds it with Bun during CDK synth automatically. When a `.js` file is provided, it is used directly (pre-compiled).

Handlers use the standard Node.js-style `(event, context) => response` signature:

```ts
// api.ts
export const handler = async (event: unknown, context: unknown) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from Bun!" }),
  };
};
```

By default, `BunFunction` derives the Lambda handler string as `<filename>.handler`. You can override the export name with the `exportName` prop.

## Fetch API Integration

This package uses a minimal runtime that passes raw Lambda events to your handler. It does **not** re-implement or bundle Fetch API conversion helpers.

If you want to write handlers using the Fetch API (`Request`/`Response`) that work both in Bun's native HTTP server and in Lambda, use the companion package [`@beesolve/lambda-fetch-api`](https://github.com/BeeSolve/packages/tree/main/packages/lambda-fetch-api).

### Installation

```bash
npm i @beesolve/lambda-fetch-api
```

### Usage with `asHttpV2Handler`

The recommended pattern exports both a `fetch` function (for Bun's native server / local development) and a `handler` function (for Lambda invocation via this runtime) from the same file:

```ts
import { asHttpV2Handler } from '@beesolve/lambda-fetch-api';

const fetch = async (request: Request): Promise<Response> => {
  return new Response("Hello from Bun!");
};

// Export handler for Lambda (used by the Bun runtime)
export const handler = asHttpV2Handler(fetch);

// Export fetch for Bun's native HTTP server (local development)
export default { fetch };
```

This dual-export pattern lets you run the same file locally with `bun run --serve` and deploy it to Lambda without changes.

### Important notes

- `@beesolve/lambda-fetch-api` is a **separate package** maintained at [`https://github.com/BeeSolve/packages/tree/main/packages/lambda-fetch-api`](https://github.com/BeeSolve/packages/tree/main/packages/lambda-fetch-api). Future enhancements to Fetch API helpers will be made in that package independently.
- Users who need Fetch API support must install `@beesolve/lambda-fetch-api` as a separate dependency.
- This package (`@beesolve/lambda-bun-runtime`) does not re-implement or bundle Fetch API conversion helpers.

## Why not the official bun-lambda?

This runtime was originally a fork of the official [`bun-lambda`](https://github.com/oven-sh/bun/tree/main/packages/bun-lambda) package. It has since been rewritten as a minimal Node.js-style runtime (~80 lines) that passes raw `(event, context)` to handlers instead of converting Lambda events to Fetch API `Request`/`Response` objects.

The simplified approach means:
- No Fetch API conversion overhead
- Standard Lambda handler signature — same as Node.js runtimes
- Fetch API support is available via the companion [`@beesolve/lambda-fetch-api`](https://github.com/BeeSolve/packages/tree/main/packages/lambda-fetch-api) package for those who need it


## Roadmap

- [x] keep in sync with latest versions of Bun
- [ ] investigate https://github.com/oven-sh/bun/pull/20825
- [ ] investigate https://github.com/oven-sh/bun/issues/14139
- [ ] investigate https://github.com/oven-sh/bun/issues/6003
- [ ] investigate https://github.com/oven-sh/bun/issues?q=is%3Aissue%20state%3Aopen%20label%3Alambda
- [ ] implement automatic code bundling with `BunFunction`
