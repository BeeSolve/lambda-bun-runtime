/**
 * Minimal AWS Lambda Custom Runtime for Bun.
 * Implements the Lambda Runtime API loop with Node.js-style (event, context) handler signature.
 */

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

type Handler = (event: unknown, context: LambdaContext) => Promise<unknown> | unknown;

interface LambdaError {
  errorType: string;
  errorMessage: string;
  stackTrace?: string[];
}

const RUNTIME_API = process.env.AWS_LAMBDA_RUNTIME_API;
const BASE_URL = `http://${RUNTIME_API}/2018-06-01`;

function formatError(error: unknown): LambdaError {
  if (error instanceof Error) {
    return {
      errorType: error.name || "Error",
      errorMessage: error.message,
      ...(error.stack ? { stackTrace: error.stack.split("\n") } : {}),
    };
  }
  return {
    errorType: "Error",
    errorMessage: typeof error === "string" ? error : Bun.inspect(error),
  };
}

async function postError(path: string, error: unknown): Promise<void> {
  await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/vnd.aws.lambda.error+json" },
    body: JSON.stringify(formatError(error)),
  });
}

async function initError(error: unknown): Promise<never> {
  await postError("runtime/init/error", error);
  process.exit(1);
}

// --- Handler Resolution ---

const handlerEnv = process.env._HANDLER;
if (!handlerEnv || !handlerEnv.includes(".")) {
  await initError(
    new Error(
      `Invalid handler format: "${handlerEnv ?? ""}". Expected "filename.exportName".`,
    ),
  );
}

const lastDot = handlerEnv!.lastIndexOf(".");
const filename = handlerEnv!.substring(0, lastDot);
const exportName = handlerEnv!.substring(lastDot + 1);
const taskRoot = process.env.LAMBDA_TASK_ROOT ?? "/var/task";
const modulePath = `${taskRoot}/${filename}`;

let handler: Handler;
try {
  const mod = await import(modulePath);
  const fn = mod[exportName] ?? mod.default?.[exportName];
  if (typeof fn !== "function") {
    await initError(
      new Error(
        `Handler "${exportName}" is not a function in module "${filename}".`,
      ),
    );
  }
  handler = fn as Handler;
} catch (err: unknown) {
  await initError(err);
}

// --- Invocation Loop ---

const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME ?? "";
const functionVersion = process.env.AWS_LAMBDA_FUNCTION_VERSION ?? "";
const memoryLimitInMB = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ?? "";
const logGroupName = process.env.AWS_LAMBDA_LOG_GROUP_NAME ?? "";
const logStreamName = process.env.AWS_LAMBDA_LOG_STREAM_NAME ?? "";

while (true) {
  const res = await fetch(`${BASE_URL}/runtime/invocation/next`);

  const requestId = res.headers.get("Lambda-Runtime-Aws-Request-Id") ?? "";
  const invokedFunctionArn =
    res.headers.get("Lambda-Runtime-Invoked-Function-Arn") ?? "";
  const deadlineMs = Number(
    res.headers.get("Lambda-Runtime-Deadline-Ms") ?? "0",
  );

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

  try {
    const result = await handler(event, context);
    const body = result === undefined ? "null" : JSON.stringify(result);
    await fetch(`${BASE_URL}/runtime/invocation/${requestId}/response`, {
      method: "POST",
      body,
    });
  } catch (err: unknown) {
    await postError(`runtime/invocation/${requestId}/error`, err);
  }
}
