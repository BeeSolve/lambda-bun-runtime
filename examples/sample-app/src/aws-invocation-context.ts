import { AsyncLocalStorage } from "node:async_hooks";

export type AwsEvent = {
  version?: string;
  requestContext?: {
    requestId?: string;
  };
};

export type AwsContext = {
  awsRequestId: string;
};

type InvocationStore = {
  event: AwsEvent;
  context: AwsContext;
};

const invocationStorageKey = Symbol.for("bun.lambda.invocationStorage");

function getInvocationStorage():
  | AsyncLocalStorage<InvocationStore>
  | undefined {
  return (globalThis as Record<PropertyKey, unknown>)[
    invocationStorageKey
  ] as AsyncLocalStorage<InvocationStore> | undefined;
}

export function getCurrentAwsEvent(): AwsEvent | undefined {
  return getInvocationStorage()?.getStore()?.event;
}

export function getCurrentAwsContext(): AwsContext | undefined {
  return getInvocationStorage()?.getStore()?.context;
}
