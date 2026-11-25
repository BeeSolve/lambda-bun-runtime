interface LambdaContext {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis(): number;
}

type StreamChunk = Uint8Array | string;
type StreamResponse = ReadableStream<StreamChunk> | AsyncIterable<StreamChunk>;
type Handler = (
  event: unknown,
  context: LambdaContext,
) => Promise<StreamResponse | unknown> | StreamResponse | unknown;

interface ResponseStream {
  write(chunk: StreamChunk): void;
  end(chunk?: StreamChunk): void;
  setContentType(type: string): void;
  _onBeforeFirstWrite?: (write: (chunk: StreamChunk) => void) => void;
}

interface LambdaError {
  errorType: string;
  errorMessage: string;
  stackTrace?: Array<string>;
}

const runtimeApi = process.env.AWS_LAMBDA_RUNTIME_API;
const baseUrl = `http://${runtimeApi}/2018-06-01`;

const handlerEnv = process.env._HANDLER;
if (handlerEnv == null || !handlerEnv.includes(".")) {
  await initError({
    error: new Error(
      `Invalid handler format: "${handlerEnv ?? ""}". Expected "filename.exportName".`,
    ),
  });
  process.exit(1);
}

const lastDot = handlerEnv.lastIndexOf(".");
const filename = handlerEnv.substring(0, lastDot);
const exportName = handlerEnv.substring(lastDot + 1);
const taskRoot = process.env.LAMBDA_TASK_ROOT ?? "/var/task";
const modulePath = `${taskRoot}/${filename}`;

const streamingMarker = Symbol.for("aws.lambda.runtime.handler.streaming");
const httpResponseContentType = "application/vnd.awslambda.http-integration-response";

// Mirrors the awslambda global of the Node.js managed runtime so that code written for it
// (e.g. asResponseStreamHandler from @beesolve/lambda-fetch-api) runs unchanged.
Object.assign(globalThis, {
  awslambda: {
    streamifyResponse: (fn: object) => Object.assign(fn, { [streamingMarker]: "response" }),
    HttpResponseStream: {
      from: (stream: ResponseStream, prelude: object) => {
        stream.setContentType(httpResponseContentType);
        stream._onBeforeFirstWrite = (write) => {
          write(JSON.stringify(prelude));
          write(new Uint8Array(8));
        };
        return stream;
      },
    },
  },
});

const handler: Handler = await resolveHandler({ modulePath, exportName });

const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME ?? "";
const functionVersion = process.env.AWS_LAMBDA_FUNCTION_VERSION ?? "";
const memoryLimitInMB = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ?? "";
const logGroupName = process.env.AWS_LAMBDA_LOG_GROUP_NAME ?? "";
const logStreamName = process.env.AWS_LAMBDA_LOG_STREAM_NAME ?? "";

while (true) {
  const res = await fetch(`${baseUrl}/runtime/invocation/next`);

  const requestId = res.headers.get("Lambda-Runtime-Aws-Request-Id") ?? "";
  const invokedFunctionArn = res.headers.get("Lambda-Runtime-Invoked-Function-Arn") ?? "";
  const deadlineMs = Number(res.headers.get("Lambda-Runtime-Deadline-Ms") ?? "0");

  const event: unknown = await res.json();

  const context: LambdaContext = {
    functionName,
    functionVersion,
    invokedFunctionArn,
    memoryLimitInMB,
    awsRequestId: requestId,
    logGroupName,
    logStreamName,
    getRemainingTimeInMillis: () => deadlineMs - Date.now(),
  };

  const isStreamifiedHandler =
    (handler as unknown as Record<symbol, unknown>)[streamingMarker] === "response";
  if (isStreamifiedHandler) {
    const responseStream = createResponseStream({
      url: `${baseUrl}/runtime/invocation/${requestId}/response`,
    });
    try {
      await (handler as unknown as StreamifiedHandler)(event, responseStream.stream, context);
      responseStream.stream.end();
      await responseStream.done();
    } catch (err: unknown) {
      if (!responseStream.started()) {
        await postError({ path: `runtime/invocation/${requestId}/error`, error: err });
        continue;
      }
      // Bun's fetch has no request trailers, so a mid-stream failure can only abort the request.
      responseStream.abort({ error: err });
      await responseStream.done().catch(() => undefined);
    }
    continue;
  }

  try {
    const result = await handler(event, context);
    if (isStream(result)) {
      await fetch(`${baseUrl}/runtime/invocation/${requestId}/response`, {
        method: "POST",
        headers: {
          "Lambda-Runtime-Function-Response-Mode": "streaming",
          "Transfer-Encoding": "chunked",
        },
        body: toReadableStream(result),
      });
    } else {
      const body = result === undefined ? "null" : JSON.stringify(result);
      await fetch(`${baseUrl}/runtime/invocation/${requestId}/response`, {
        method: "POST",
        body,
      });
    }
  } catch (err: unknown) {
    await postError({
      path: `runtime/invocation/${requestId}/error`,
      error: err,
    });
  }
}

async function resolveHandler(props: { modulePath: string; exportName: string }): Promise<Handler> {
  try {
    const mod = await import(props.modulePath);
    const fn = mod[props.exportName] ?? mod.default?.[props.exportName];
    if (typeof fn !== "function") {
      await initError({
        error: new Error(
          `Handler "${props.exportName}" is not a function in module "${props.modulePath}".`,
        ),
      });
    }
    return fn as Handler;
  } catch (err: unknown) {
    await initError({ error: err });
  }
  // Unreachable — initError calls process.exit, but TS needs a return
  throw new Error("Unreachable");
}

function formatError(props: { error: unknown }): LambdaError {
  if (props.error instanceof Error) {
    return {
      errorType: props.error.name || "Error",
      errorMessage: props.error.message,
      ...(props.error.stack != null ? { stackTrace: props.error.stack.split("\n") } : {}),
    };
  }
  return {
    errorType: "Error",
    errorMessage: typeof props.error === "string" ? props.error : Bun.inspect(props.error),
  };
}

type StreamifiedHandler = (
  event: unknown,
  responseStream: ResponseStream,
  context: LambdaContext,
) => Promise<unknown> | unknown;

function createResponseStream(props: { url: string }) {
  const encoder = new TextEncoder();
  const state: {
    contentType?: string;
    started: boolean;
    ended: boolean;
    post?: Promise<Response>;
    controller?: ReadableStreamDefaultController<Uint8Array>;
  } = { started: false, ended: false };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      state.controller = controller;
    },
  });

  const enqueue = (chunk: StreamChunk) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    if (bytes.length === 0) return;
    state.controller?.enqueue(bytes);
  };

  // The content type is a request header, so the POST can only start once it is final.
  const start = () => {
    if (state.started) return;
    state.started = true;
    stream._onBeforeFirstWrite?.(enqueue);
    state.post = fetch(props.url, {
      method: "POST",
      headers: {
        "Lambda-Runtime-Function-Response-Mode": "streaming",
        "Transfer-Encoding": "chunked",
        ...(state.contentType != null ? { "Content-Type": state.contentType } : {}),
      },
      body,
    });
  };

  const stream: ResponseStream = {
    write(chunk) {
      start();
      enqueue(chunk);
    },
    end(chunk) {
      if (state.ended) return;
      start();
      if (chunk != null) enqueue(chunk);
      state.ended = true;
      state.controller?.close();
    },
    setContentType(type) {
      state.contentType = type;
    },
  };

  return {
    stream,
    started: () => state.started,
    done: async () => {
      await state.post;
    },
    abort: (abortProps: { error: unknown }) => {
      if (state.ended) return;
      state.ended = true;
      state.controller?.error(abortProps.error);
    },
  };
}

function isStream(value: unknown): value is StreamResponse {
  return (
    value instanceof ReadableStream ||
    (value != null && typeof value === "object" && Symbol.asyncIterator in value)
  );
}

function toReadableStream(value: StreamResponse): ReadableStream<Uint8Array> {
  if (value instanceof ReadableStream) {
    return value as ReadableStream<Uint8Array>;
  }
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of value) {
          controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

async function postError(props: { path: string; error: unknown }): Promise<void> {
  await fetch(`${baseUrl}/${props.path}`, {
    method: "POST",
    headers: { "Content-Type": "application/vnd.aws.lambda.error+json" },
    body: JSON.stringify(formatError({ error: props.error })),
  });
}

async function initError(props: { error: unknown }): Promise<never> {
  await postError({ path: "runtime/init/error", error: props.error });
  process.exit(1);
}
