import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { spawn } from "bun";
import * as fc from "fast-check";

// Mock Lambda Runtime API server for integration tests
function createMockRuntimeApi(props: {
  port: number;
  event?: unknown;
  onInitError?: (body: unknown) => void;
  onResponse?: (body: unknown) => void;
  onInvocationError?: (body: unknown) => void;
}) {
  const server = Bun.serve({
    port: props.port,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/2018-06-01/runtime/invocation/next") {
        return new Response(JSON.stringify(props.event ?? { test: true }), {
          headers: {
            "Lambda-Runtime-Aws-Request-Id": "test-request-id",
            "Lambda-Runtime-Invoked-Function-Arn": "arn:aws:lambda:us-east-1:123:function:test",
            "Lambda-Runtime-Deadline-Ms": String(Date.now() + 30000),
          },
        });
      }

      if (url.pathname === "/2018-06-01/runtime/init/error") {
        return req.json().then((body) => {
          props.onInitError?.(body);
          return new Response("OK");
        });
      }

      if (url.pathname.endsWith("/response")) {
        return req.text().then((body) => {
          props.onResponse?.(JSON.parse(body));
          return new Response("OK");
        });
      }

      if (url.pathname.endsWith("/error")) {
        return req.json().then((body) => {
          props.onInvocationError?.(body);
          return new Response("OK");
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
  return server;
}

describe("runtime edge cases", () => {
  test("missing _HANDLER posts init error", async () => {
    const port = 19100;
    let initError: unknown = null;

    const server = createMockRuntimeApi({
      port,
      onInitError: (body) => { initError = body; },
    });

    try {
      const proc = spawn(["bun", "command/runtime.mts"], {
        env: {
          ...process.env,
          AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
          _HANDLER: undefined,
          LAMBDA_TASK_ROOT: "/tmp/nonexistent",
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;

      expect(initError).not.toBeNull();
      expect((initError as { errorType: string }).errorType).toBe("Error");
      expect((initError as { errorMessage: string }).errorMessage).toContain("Invalid handler format");
    } finally {
      server.stop();
    }
  });

  test("_HANDLER with no dot posts init error", async () => {
    const port = 19101;
    let initError: unknown = null;

    const server = createMockRuntimeApi({
      port,
      onInitError: (body) => { initError = body; },
    });

    try {
      const proc = spawn(["bun", "command/runtime.mts"], {
        env: {
          ...process.env,
          AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
          _HANDLER: "nodothere",
          LAMBDA_TASK_ROOT: "/tmp/nonexistent",
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;

      expect(initError).not.toBeNull();
      expect((initError as { errorMessage: string }).errorMessage).toContain("Invalid handler format");
    } finally {
      server.stop();
    }
  });

  test("handler module not found posts init error", async () => {
    const port = 19102;
    let initError: unknown = null;

    const server = createMockRuntimeApi({
      port,
      onInitError: (body) => { initError = body; },
    });

    try {
      const proc = spawn(["bun", "command/runtime.mts"], {
        env: {
          ...process.env,
          AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
          _HANDLER: "nonexistent_module.handler",
          LAMBDA_TASK_ROOT: "/tmp/nonexistent",
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;

      expect(initError).not.toBeNull();
    } finally {
      server.stop();
    }
  });

  test("handler export not a function posts init error", async () => {
    const port = 19103;
    let initError: unknown = null;

    // Create a temp module that exports a non-function
    const tmpDir = "/tmp/test-runtime-export";
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { rmSync } = await import("node:fs");
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/badhandler.js`, "export const handler = 'not a function';");

    const server = createMockRuntimeApi({
      port,
      onInitError: (body) => { initError = body; },
    });

    try {
      const proc = spawn(["bun", "command/runtime.mts"], {
        env: {
          ...process.env,
          AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${port}`,
          _HANDLER: "badhandler.handler",
          LAMBDA_TASK_ROOT: tmpDir,
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;

      expect(initError).not.toBeNull();
      expect((initError as { errorMessage: string }).errorMessage).toContain("not a function");
    } finally {
      server.stop();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("handler returning undefined posts null as response", async () => {
    const port = 19104;
    let response: unknown = null;
    let invocationCount = 0;

    // Create a temp module that returns undefined
    const tmpDir = "/tmp/test-runtime-undefined";
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/undef.js`, "export const handler = async () => undefined;");

    const server = Bun.serve({
      port,
      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === "/2018-06-01/runtime/invocation/next") {
          invocationCount++;
          // Only serve one invocation, then hang to let process be killed
          if (invocationCount > 1) {
            return new Promise(() => {}); // hang
          }
          return new Response(JSON.stringify({ test: true }), {
            headers: {
              "Lambda-Runtime-Aws-Request-Id": "req-1",
              "Lambda-Runtime-Invoked-Function-Arn": "arn:test",
              "Lambda-Runtime-Deadline-Ms": String(Date.now() + 30000),
            },
          });
        }

        if (url.pathname.endsWith("/response")) {
          return req.text().then((body) => {
            response = body;
            return new Response("OK");
          });
        }

        return new Response("OK");
      },
    });

    try {
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

      // Wait for the response to be posted
      const deadline = Date.now() + 5000;
      while (response == null && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }

      proc.kill();
      await proc.exited;

      expect(response).toBe("null");
    } finally {
      server.stop();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("event passthrough (Property 2)", () => {
  test("preserves arbitrary JSON data through handler", async () => {
    const port = 19105;
    const tmpDir = "/tmp/test-runtime-passthrough";
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    mkdirSync(tmpDir, { recursive: true });
    // Handler that echoes the event back
    writeFileSync(`${tmpDir}/echo.js`, "export const handler = async (event) => event;");

    // Run a few samples (not 100 — integration tests are slow)
    const samples = fc.sample(fc.jsonValue(), 5);

    for (const [i, event] of samples.entries()) {
      const testPort = port + i;
      let response: unknown = null;
      let invocationCount = 0;

      const server = Bun.serve({
        port: testPort,
        fetch(req) {
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
            return req.text().then((body) => {
              response = body;
              return new Response("OK");
            });
          }

          return new Response("OK");
        },
      });

      try {
        const proc = spawn(["bun", "command/runtime.mts"], {
          env: {
            ...process.env,
            AWS_LAMBDA_RUNTIME_API: `127.0.0.1:${testPort}`,
            _HANDLER: "echo.handler",
            LAMBDA_TASK_ROOT: tmpDir,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const deadline = Date.now() + 5000;
        while (response == null && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 50));
        }

        proc.kill();
        await proc.exited;

        // The response should be the JSON-serialized event
        const expected = event === undefined ? "null" : JSON.stringify(event);
        expect(response).toBe(expected);
      } finally {
        server.stop();
      }
    }

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
