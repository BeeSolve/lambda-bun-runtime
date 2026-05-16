# Lambda bun runtime

[![View on Construct Hub](https://constructs.dev/badge?package=%40beesolve%2Flambda-bun-runtime)](https://constructs.dev/packages/@beesolve/lambda-bun-runtime)

A custom [Bun](https://bun.sh) runtime for AWS Lambda with CDK constructs for easy deployment.

Current bun version: [1.3.14](https://bun.sh/blog/bun-v1.3.14)

## Installation

```bash
npm i @beesolve/lambda-bun-runtime
```

## Quick Start

Two constructs are provided: `BunLambdaLayer` (the runtime layer) and `BunFunction` (a Lambda function that uses it).

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

`BunFunction` accepts `.ts` and `.js` entrypoints. TypeScript files are built with Bun automatically during CDK synth. JavaScript files are used as-is.

By default, the Lambda handler string is derived as `<filename>.handler`. Override with the `exportName` prop.

## Handler Signature

Handlers use the standard Node.js-style `(event, context) => response` signature — the same pattern used by all official AWS Lambda runtimes:

```ts
// api.ts
export const handler = async (event: unknown, context: unknown) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from Bun!" }),
  };
};
```

This is a deliberate design choice. See [Why raw events?](#why-raw-events) below.

## Fetch API Support

This runtime passes raw Lambda events directly to your handler. It does **not** convert events to Fetch API `Request`/`Response` objects.

If you want to write handlers using the Fetch API — for example to share code between Bun's native HTTP server and Lambda — use the companion package [`@beesolve/lambda-fetch-api`](https://github.com/BeeSolve/packages/tree/main/packages/lambda-fetch-api).

### Installation

```bash
npm i @beesolve/lambda-fetch-api
```

### Usage with `asHttpV2Handler`

The recommended pattern exports both a `fetch` function (for local development with `bun run --serve`) and a `handler` function (for Lambda) from the same file:

```ts
import { asHttpV2Handler } from '@beesolve/lambda-fetch-api';

const fetch = async (request: Request): Promise<Response> => {
  return new Response("Hello from Bun!");
};

export const handler = asHttpV2Handler(fetch);

export default { fetch };
```

This dual-export pattern lets you run the same file locally and deploy it to Lambda without changes.

## WebSocket Support

WebSocket handling is **not supported** out of the box. Lambda functions are request-response by nature and don't maintain persistent connections.

If you need WebSocket support, consider using [API Gateway WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html) with separate `$connect`, `$disconnect`, and `$default` route handlers — each deployed as a standard `BunFunction` with the raw event signature.

## Migration Guide

If you're migrating from the previous Fetch API-based runtime (or from the official `bun-lambda` package), here's what changed and how to adapt.

### What changed

The previous runtime converted Lambda events into Fetch API `Request` objects and expected a `Response` back. The new runtime passes raw `(event, context)` directly — no conversion layer.

### Option 1: Use raw events (recommended for new code)

Replace your Fetch-style handler with a standard Lambda handler:

**Before (Fetch API style):**
```ts
export default {
  fetch: async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    return new Response(`Path: ${url.pathname}`);
  },
};
```

**After (raw event style):**
```ts
import type { APIGatewayProxyEventV2 } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEventV2) => {
  return {
    statusCode: 200,
    body: `Path: ${event.rawPath}`,
  };
};
```

### Option 2: Keep Fetch API with the adapter (recommended for existing projects)

If you have existing Fetch-based handlers and want to keep them, install the companion package and wrap them:

```bash
npm i @beesolve/lambda-fetch-api
```

**Before (worked with old runtime directly):**
```ts
export default {
  fetch: async (request: Request): Promise<Response> => {
    return new Response("Hello!");
  },
};
```

**After (works with new runtime via adapter):**
```ts
import { asHttpV2Handler } from '@beesolve/lambda-fetch-api';

const fetch = async (request: Request): Promise<Response> => {
  return new Response("Hello!");
};

export const handler = asHttpV2Handler(fetch);

// Keep for local development with `bun run --serve`
export default { fetch };
```

### Summary of changes

| Aspect | Old runtime | New runtime |
|--------|-------------|-------------|
| Handler signature | `fetch(request: Request): Response` | `handler(event, context): any` |
| Event format | Converted to Fetch `Request` | Raw Lambda event (e.g., `APIGatewayProxyEventV2`) |
| Response format | Fetch `Response` | Lambda response object (e.g., `{ statusCode, body }`) |
| Fetch API support | Built-in | Via `@beesolve/lambda-fetch-api` adapter |
| WebSocket support | Built-in (via Bun.serve) | Not applicable (use API Gateway WebSocket APIs) |
| Local development | `bun run --serve` with same file | Same file works with dual-export pattern |

## Why Raw Events?

The previous approach (converting Lambda events to Fetch API objects) introduced complexity and overhead:

1. **Conversion cost** — every invocation paid the price of constructing a `Request` and parsing a `Response`, even for non-HTTP triggers (SQS, S3, EventBridge, etc.)
2. **Lossy abstraction** — Lambda events contain metadata (request context, authorizer claims, stage variables) that doesn't map cleanly to HTTP headers
3. **Trigger lock-in** — Fetch API only makes sense for HTTP triggers, but Lambda functions handle many event sources
4. **Debugging friction** — when something goes wrong, you're debugging two layers: the event-to-Request conversion and your actual logic

The raw event approach means:
- Zero overhead — events pass through untouched
- Works with any Lambda trigger (HTTP, SQS, S3, EventBridge, DynamoDB Streams, etc.)
- Standard Lambda patterns — all AWS documentation and examples apply directly
- Fetch API is opt-in via `@beesolve/lambda-fetch-api` for those who want the dual-environment pattern
