# How to: Finish background work after the response with waitUntil

Use this when the handler can answer the caller first and still has work to do, such as writing logs, flushing metrics or updating a cache.

## Usage

```ts
export const handler = async (event: unknown, context: { waitUntil(promise: Promise<unknown>): void }) => {
  context.waitUntil(flushMetrics());
  return { ok: true };
};
```

`awslambda.waitUntil(promise)` does the same and is bound to the invocation that is currently running, so it works from code that has no access to `context`.

## How it works

1. The runtime posts the response. Lambda sends it to the caller at that point.
2. The runtime waits for every promise passed to `waitUntil`, including promises registered while it is already waiting.
3. Only then does it call `/runtime/invocation/next`. The invocation ends at that call, and Lambda may freeze the environment afterwards.

The same applies when the handler throws (the error is posted first) and to streaming handlers (the wait starts after `end()` and the stream is done). Verify the timing on real Lambda for your use case.

## Behavior to know

- Work that is neither awaited nor registered with `waitUntil` is still frozen by Lambda. The runtime cannot see it. A floating promise is not protected.
- The wait stops at the invocation deadline minus a margin. The default margin is 1000 ms. Set `BUN_LAMBDA_WAIT_UNTIL_MARGIN_MS` on the function to change it. When time runs out, the runtime logs a warning with the number of unfinished tasks and moves on.
- A rejected promise is logged with `console.error`. It does not change the result, because the response is already sent.
- Registered promises are not carried over to the next invocation.
- Handlers that never call `waitUntil` behave as before.
