import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

import { spawn } from "bun";
import * as fc from "fast-check";

setDefaultTimeout(60000);

// Spawns the runtime with a mock Lambda Runtime API and returns observed behavior
function createMockServer(props: {
  port: number;
  event?: unknown;
  onInitError?: (body: unknown) => void;
  onResponse?: (body: string) => void;
  onInvocationError?: (body: unknown) => void;
  maxInvocations?: number;
}) {
  const state = { invocationCount: 0 };
  const server = Bun.serve({
    port: props.port,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/2018-06-01/runtime/invocation/next") {
        state.invocationCount++;
        if (state.invocationCount > (props.maxInvocations ?? 1)) {
          return new Promise(() => {});
        }
        return new Response(JSON.stringify(props.event ?? { test: true }), {
          headers: {
            "Lambda-Runtime-Aws-Request-Id": `req-${state.invocationCount}`,
            "Lambda-Runtime-Invoked-Function-Arn": "arn:aws:lambda:us-east-1:123:function:test",
            "Lambda-Runtime-Deadline-Ms": String(Date.now() + 30000),
          },
        });
      }

      if (url.pathname === "/2018-06-01/runtime/init/error") {
        const body = await req.json();
        props.onInitError?.(body);
        return new Response("OK");
      }

      if (url.pathname.endsWith("/response")) {
        const body = await req.text();
        props.onResponse?.(body);
        return new Response("OK");
      }

      if (url.pathname.endsWith("/error")) {
        const body = await req.json();
        props.onInvocationError?.(body);
        return new Response("OK");
      }

      return new Response("Not Found", { status: 404 });
    },
  });
  return server;
}

async function waitFor(props: { condition: () => boolean; timeoutMs: number }): Promise<void> {
  const deadline = Date.now() + props.timeoutMs;
  while (!props.condition() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe("handler string resolution (Property 1)", () => {
  test("resolves filename.exportName and calls the correct export", async () => {
    // Test through the runtime: create handlers with various names and verify they get called
    const tmpDir = "/tmp/test-handler-resolution";
    mkdirSync(tmpDir, { recursive: true });

    const samples = fc.sample(
      fc.tuple(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
      ),
      10,
    );

    for (const [i, [filename, exportName]] of samples.entries()) {
      const port = 19200 + i;
      writeFileSync(
        `${tmpDir}/${filename}.js`,
        `export const ${exportName} = async (event) => ({ resolved: "${filename}.${exportName}" });`,
      );

      let response: string | null = null;
      const server = createMockServer({
        port,
        event: {},
        onResponse: (body) => {
          response = body;
        },
      });

      const proc = spawn(["bun", "command/runtime.mts"], {
        env: {
          ...process.env,
          AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
          _HANDLER: `${filename}.${exportName}`,
          LAMBDA_TASK_ROOT: tmpDir,
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      await waitFor({ condition: () => response != null, timeoutMs: 15000 });
      proc.kill();
      await proc.exited;
      server.stop();

      expect(response).not.toBeNull();
      const parsed = JSON.parse(response as string);
      expect(parsed.resolved).toBe(`${filename}.${exportName}`);
    }

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("context object construction (Property 3)", () => {
  test("context fields match environment variables and headers", async () => {
    const tmpDir = "/tmp/test-context-construction";
    mkdirSync(tmpDir, { recursive: true });
    // Handler that returns the context object
    writeFileSync(
      `${tmpDir}/ctx.js`,
      `export const handler = async (event, context) => ({
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        memoryLimitInMB: context.memoryLimitInMB,
        logGroupName: context.logGroupName,
        logStreamName: context.logStreamName,
        awsRequestId: context.awsRequestId,
        invokedFunctionArn: context.invokedFunctionArn,
      });`,
    );

    const samples = fc.sample(
      fc.record({
        functionName: fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
        functionVersion: fc
          .string({ minLength: 1, maxLength: 10 })
          .filter((s) => /^[a-zA-Z0-9.$]+$/.test(s)),
        memoryLimitInMB: fc.integer({ min: 128, max: 10240 }).map(String),
        logGroupName: fc
          .string({ minLength: 1, maxLength: 30 })
          .filter((s) => /^[a-zA-Z0-9/_-]+$/.test(s)),
        logStreamName: fc
          .string({ minLength: 1, maxLength: 30 })
          .filter((s) => /^[a-zA-Z0-9/_-]+$/.test(s)),
      }),
      5,
    );

    for (const [i, env] of samples.entries()) {
      const port = 19220 + i;
      const requestId = `req-ctx-${i}`;
      const arn = `arn:aws:lambda:us-east-1:123:function:${env.functionName}`;

      let response: string | null = null;
      const server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === "/2018-06-01/runtime/invocation/next") {
            return new Response(JSON.stringify({}), {
              headers: {
                "Lambda-Runtime-Aws-Request-Id": requestId,
                "Lambda-Runtime-Invoked-Function-Arn": arn,
                "Lambda-Runtime-Deadline-Ms": String(Date.now() + 30000),
              },
            });
          }
          if (url.pathname.endsWith("/response")) {
            response = await req.text();
            return new Response("OK");
          }
          return new Response("OK");
        },
      });

      const proc = spawn(["bun", "command/runtime.mts"], {
        env: {
          ...process.env,
          AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
          _HANDLER: "ctx.handler",
          LAMBDA_TASK_ROOT: tmpDir,
          AWS_LAMBDA_FUNCTION_NAME: env.functionName,
          AWS_LAMBDA_FUNCTION_VERSION: env.functionVersion,
          AWS_LAMBDA_FUNCTION_MEMORY_SIZE: env.memoryLimitInMB,
          AWS_LAMBDA_LOG_GROUP_NAME: env.logGroupName,
          AWS_LAMBDA_LOG_STREAM_NAME: env.logStreamName,
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      await waitFor({ condition: () => response != null, timeoutMs: 15000 });
      proc.kill();
      await proc.exited;
      server.stop();

      expect(response).not.toBeNull();
      const ctx = JSON.parse(response as string);
      expect(ctx.functionName).toBe(env.functionName);
      expect(ctx.functionVersion).toBe(env.functionVersion);
      expect(ctx.memoryLimitInMB).toBe(env.memoryLimitInMB);
      expect(ctx.logGroupName).toBe(env.logGroupName);
      expect(ctx.logStreamName).toBe(env.logStreamName);
      expect(ctx.awsRequestId).toBe(requestId);
      expect(ctx.invokedFunctionArn).toBe(arn);
    }

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("error formatting (Property 4)", () => {
  test("handler throwing Error produces correct error response", async () => {
    const tmpDir = "/tmp/test-error-formatting";
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      `${tmpDir}/thrower.js`,
      `export const handler = async () => { const e = new Error("test message"); e.name = "CustomError"; throw e; };`,
    );

    const port = 19230;
    let errorBody: unknown = null;
    const server = createMockServer({
      port,
      event: {},
      onInvocationError: (body) => {
        errorBody = body;
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: "thrower.handler",
        LAMBDA_TASK_ROOT: tmpDir,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    await waitFor({ condition: () => errorBody != null, timeoutMs: 15000 });
    proc.kill();
    await proc.exited;
    server.stop();

    expect(errorBody).not.toBeNull();
    const err = errorBody as {
      errorType: string;
      errorMessage: string;
      stackTrace?: Array<string>;
    };
    expect(err.errorType).toBe("CustomError");
    expect(err.errorMessage).toBe("test message");
    expect(err.stackTrace).toBeDefined();
    expect(Array.isArray(err.stackTrace)).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("handler throwing string produces Error type with string message", async () => {
    const tmpDir = "/tmp/test-error-string";
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      `${tmpDir}/strthrower.js`,
      `export const handler = async () => { throw "something went wrong"; };`,
    );

    const port = 19231;
    let errorBody: unknown = null;
    const server = createMockServer({
      port,
      event: {},
      onInvocationError: (body) => {
        errorBody = body;
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: "strthrower.handler",
        LAMBDA_TASK_ROOT: tmpDir,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    await waitFor({ condition: () => errorBody != null, timeoutMs: 15000 });
    proc.kill();
    await proc.exited;
    server.stop();

    expect(errorBody).not.toBeNull();
    const err = errorBody as { errorType: string; errorMessage: string };
    expect(err.errorType).toBe("Error");
    expect(err.errorMessage).toBe("something went wrong");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("runtime edge cases (Task 1.5)", () => {
  test("missing _HANDLER posts init error", async () => {
    const port = 19240;
    let initError: unknown = null;
    const server = createMockServer({
      port,
      onInitError: (body) => {
        initError = body;
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: undefined,
        LAMBDA_TASK_ROOT: "/tmp",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    server.stop();

    expect(initError).not.toBeNull();
    expect((initError as { errorMessage: string }).errorMessage).toContain(
      "Invalid handler format",
    );
  });

  test("_HANDLER with no dot posts init error", async () => {
    const port = 19241;
    let initError: unknown = null;
    const server = createMockServer({
      port,
      onInitError: (body) => {
        initError = body;
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: "nodot",
        LAMBDA_TASK_ROOT: "/tmp",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    server.stop();

    expect(initError).not.toBeNull();
    expect((initError as { errorMessage: string }).errorMessage).toContain(
      "Invalid handler format",
    );
  });

  test("handler module not found posts init error", async () => {
    const port = 19242;
    let initError: unknown = null;
    const server = createMockServer({
      port,
      onInitError: (body) => {
        initError = body;
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: "nonexistent.handler",
        LAMBDA_TASK_ROOT: "/tmp/nonexistent",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    server.stop();

    expect(initError).not.toBeNull();
  });

  test("handler export not a function posts init error", async () => {
    const port = 19243;
    const tmpDir = "/tmp/test-not-fn";
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/bad.js`, "export const handler = 42;");

    let initError: unknown = null;
    const server = createMockServer({
      port,
      onInitError: (body) => {
        initError = body;
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: "bad.handler",
        LAMBDA_TASK_ROOT: tmpDir,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    server.stop();

    expect(initError).not.toBeNull();
    expect((initError as { errorMessage: string }).errorMessage).toContain("not a function");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("handler returning undefined posts null as response", async () => {
    const port = 19244;
    const tmpDir = "/tmp/test-undef-response";
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/undef.js`, "export const handler = async () => undefined;");

    let response: string | null = null;
    const server = createMockServer({
      port,
      event: {},
      onResponse: (body) => {
        response = body;
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: "undef.handler",
        LAMBDA_TASK_ROOT: tmpDir,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    await waitFor({ condition: () => response != null, timeoutMs: 15000 });
    proc.kill();
    await proc.exited;
    server.stop();

    expect(response).toBe("null");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("streaming response", () => {
  test("ReadableStream return value sends streaming headers and body", async () => {
    const tmpDir = "/tmp/test-streaming-readable";
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      `${tmpDir}/streamer.js`,
      `export const handler = async () => {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        writer.write(encoder.encode("hello "));
        writer.write(encoder.encode("world"));
        writer.close();
        return readable;
      };`,
    );

    const port = 19260;
    let responseBody: string | null = null;
    let streamingHeader: string | null = null;

    const server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/2018-06-01/runtime/invocation/next") {
          return new Response(JSON.stringify({}), {
            headers: {
              "Lambda-Runtime-Aws-Request-Id": "req-stream-1",
              "Lambda-Runtime-Invoked-Function-Arn": "arn:test",
              "Lambda-Runtime-Deadline-Ms": String(Date.now() + 30000),
            },
          });
        }
        if (url.pathname.endsWith("/response")) {
          streamingHeader = req.headers.get("Lambda-Runtime-Function-Response-Mode");
          responseBody = await req.text();
          return new Response("OK");
        }
        return new Response("OK");
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: "streamer.handler",
        LAMBDA_TASK_ROOT: tmpDir,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    await waitFor({ condition: () => responseBody != null, timeoutMs: 15000 });
    proc.kill();
    await proc.exited;
    server.stop();

    expect(streamingHeader).toBe("streaming");
    expect(responseBody).toBe("hello world");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("AsyncGenerator return value sends streaming headers and body", async () => {
    const tmpDir = "/tmp/test-streaming-generator";
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      `${tmpDir}/gen.js`,
      `export async function* handler() {
        yield "chunk1";
        yield "chunk2";
        yield "chunk3";
      }`,
    );

    const port = 19261;
    let responseBody: string | null = null;
    let streamingHeader: string | null = null;

    const server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/2018-06-01/runtime/invocation/next") {
          return new Response(JSON.stringify({}), {
            headers: {
              "Lambda-Runtime-Aws-Request-Id": "req-stream-2",
              "Lambda-Runtime-Invoked-Function-Arn": "arn:test",
              "Lambda-Runtime-Deadline-Ms": String(Date.now() + 30000),
            },
          });
        }
        if (url.pathname.endsWith("/response")) {
          streamingHeader = req.headers.get("Lambda-Runtime-Function-Response-Mode");
          responseBody = await req.text();
          return new Response("OK");
        }
        return new Response("OK");
      },
    });

    const proc = spawn(["bun", "command/runtime.mts"], {
      env: {
        ...process.env,
        AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
        _HANDLER: "gen.handler",
        LAMBDA_TASK_ROOT: tmpDir,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    await waitFor({ condition: () => responseBody != null, timeoutMs: 15000 });
    proc.kill();
    await proc.exited;
    server.stop();

    expect(streamingHeader).toBe("streaming");
    expect(responseBody).toBe("chunk1chunk2chunk3");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("event passthrough (Property 2)", () => {
  test("preserves arbitrary JSON data through handler", async () => {
    const tmpDir = "/tmp/test-passthrough";
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/echo.js`, "export const handler = async (event) => event;");

    const samples = fc.sample(fc.jsonValue(), 5);

    for (const [i, event] of samples.entries()) {
      const port = 19250 + i;
      let response: string | null = null;
      let invocationCount = 0;

      const server = Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url);
          if (url.pathname === "/2018-06-01/runtime/invocation/next") {
            invocationCount++;
            if (invocationCount > 1) return new Promise(() => {});
            return new Response(JSON.stringify(event), {
              headers: {
                "Lambda-Runtime-Aws-Request-Id": `req-${i}`,
                "Lambda-Runtime-Invoked-Function-Arn": "arn:test",
                "Lambda-Runtime-Deadline-Ms": String(Date.now() + 30000),
              },
            });
          }
          if (url.pathname.endsWith("/response")) {
            response = await req.text();
            return new Response("OK");
          }
          return new Response("OK");
        },
      });

      const proc = spawn(["bun", "command/runtime.mts"], {
        env: {
          ...process.env,
          AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
          _HANDLER: "echo.handler",
          LAMBDA_TASK_ROOT: tmpDir,
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      await waitFor({ condition: () => response != null, timeoutMs: 15000 });
      proc.kill();
      await proc.exited;
      server.stop();

      const expected = event === undefined ? "null" : JSON.stringify(event);
      expect(response).toBe(expected);
    }

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
