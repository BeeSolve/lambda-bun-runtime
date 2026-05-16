export interface LambdaError {
  errorType: string;
  errorMessage: string;
  stackTrace?: string[];
}

export function parseHandlerString(props: { handler: string }): { filename: string; exportName: string } | null {
  if (!props.handler.includes(".")) return null;
  const lastDot = props.handler.lastIndexOf(".");
  return {
    filename: props.handler.substring(0, lastDot),
    exportName: props.handler.substring(lastDot + 1),
  };
}

export interface LambdaContext {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  getRemainingTimeInMillis(): number;
}

export function buildContext(props: {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  logGroupName: string;
  logStreamName: string;
  requestId: string;
  deadlineMs: number;
}): LambdaContext {
  return {
    functionName: props.functionName,
    functionVersion: props.functionVersion,
    invokedFunctionArn: props.invokedFunctionArn,
    memoryLimitInMB: props.memoryLimitInMB,
    awsRequestId: props.requestId,
    logGroupName: props.logGroupName,
    logStreamName: props.logStreamName,
    getRemainingTimeInMillis: () => props.deadlineMs - Date.now(),
  };
}

export function formatError(props: { error: unknown }): LambdaError {
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

export function validateVersion(props: { version: string }): boolean {
  const semverPattern = /^([1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  return semverPattern.test(props.version);
}

export function resolveVersion(props: { cliArg: string | undefined; envVar: string | undefined }): string | null {
  const version = props.cliArg ?? props.envVar;
  if (version == null) return null;
  return version;
}
