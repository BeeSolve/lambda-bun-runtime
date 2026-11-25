# How to: Stream responses with status code and headers

> Full working example: https://github.com/BeeSolve/lambda-bun-runtime/tree/main/examples/sample-app

Use this when a Function URL (`InvokeMode.RESPONSE_STREAM`) must stream the body and also set the HTTP status code and headers. The runtime provides the `awslambda` global of the Node.js managed runtime, so the same handler file runs on both.

## Prerequisites

- `@beesolve/lambda-bun-runtime` installed, with a function created by `BunFunction` or `BunFunctionWithLayer`
- Optional: `@beesolve/lambda-fetch-api` for the Fetch API handler in option A

## Steps

### 1. Write the handler

Option A, Fetch API (`@beesolve/lambda-fetch-api`):

```ts
import { asResponseStreamHandler } from "@beesolve/lambda-fetch-api";

export const handler = asResponseStreamHandler(async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("hello"));
      controller.close();
    },
  });
  return new Response(stream, { status: 201, headers: { "x-custom": "value" } });
});
```

Option B, the `awslambda` global directly:

```ts
export const handler = awslambda.streamifyResponse(async (event, responseStream) => {
  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 201,
    headers: { "content-type": "text/plain", "x-custom": "value" },
  });
  stream.write("hello ");
  stream.end("world");
});
```

The prelude has the Function URL payload v2 response shape: `statusCode`, `headers` and `cookies` (a string array).

### 2. Create the Function URL in streaming mode

```ts
import { FunctionUrlAuthType, InvokeMode } from "aws-cdk-lib/aws-lambda";
import { BunFunction } from "@beesolve/lambda-bun-runtime";

const streamingFn = new BunFunction(this, "StreamingFn", { entrypoint: "src/streaming.ts" });
streamingFn.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  invokeMode: InvokeMode.RESPONSE_STREAM,
});
```

### 3. Put CloudFront with OAC in front (optional)

```ts
import { Distribution, AllowedMethods, CachePolicy } from "aws-cdk-lib/aws-cloudfront";
import { FunctionUrlOrigin } from "aws-cdk-lib/aws-cloudfront-origins";

const url = streamingFn.addFunctionUrl({
  authType: FunctionUrlAuthType.AWS_IAM,
  invokeMode: InvokeMode.RESPONSE_STREAM,
});
new Distribution(this, "Distribution", {
  defaultBehavior: {
    origin: FunctionUrlOrigin.withOriginAccessControl(url),
    cachePolicy: CachePolicy.CACHING_DISABLED,
    allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
  },
});
```

## Verify

```sh
curl -sN -i https://<function-url>/
```

The status line and headers come from the prelude and the chunks arrive spaced in time.

## Behavior to know

- Without `HttpResponseStream.from`, the stream is sent as plain bytes with status 200.
- A handler that returns an async generator or a `ReadableStream` still streams plain bytes with no metadata.
- If the handler throws before the first write, the error is reported normally. If it throws after streaming started, the request is aborted, because Bun's `fetch` cannot send the error trailers.
