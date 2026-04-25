import { describe, expect, it } from "bun:test";
import eventV2 from "./fixtures/apigw-http-v2-event.json";
import {
  getCurrentAwsContext,
  getCurrentAwsEvent,
  LambdaServer,
  type LambdaRequest,
} from "../command/runtime";

function createRequest(event: unknown, id: string): LambdaRequest {
  return {
    requestId: id,
    traceId: `Root=1-${id}`,
    functionArn: "arn:aws:lambda:eu-central-1:123456789012:function:test",
    deadlineMs: Date.now() + 5_000,
    event,
  };
}

describe("runtime async invocation context", () => {
  it("is undefined outside invocation", () => {
    expect(getCurrentAwsEvent()).toBeUndefined();
    expect(getCurrentAwsContext()).toBeUndefined();
  });

  it("exposes event and context within async handler flow", async () => {
    const server = new LambdaServer({
      async fetch() {
        const eventBefore = getCurrentAwsEvent<any>();
        const contextBefore = getCurrentAwsContext();
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const eventAfter = getCurrentAwsEvent<any>();
        const contextAfter = getCurrentAwsContext();
        return Response.json({
          eventRequestId: eventBefore?.requestContext?.requestId,
          sameEventAfterAwait:
            eventBefore?.requestContext?.requestId ===
            eventAfter?.requestContext?.requestId,
          contextRequestId: contextBefore?.awsRequestId,
          sameContextAfterAwait:
            contextBefore?.awsRequestId === contextAfter?.awsRequestId,
          hasRemainingTime:
            (contextAfter?.getRemainingTimeInMillis() ?? 0) >= 0,
        });
      },
    } as any);

    const response = (await server.accept(
      createRequest(eventV2, "inv-1"),
    )) as any;

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body);
    expect(payload.eventRequestId).toBe("request-v2");
    expect(payload.sameEventAfterAwait).toBe(true);
    expect(payload.contextRequestId).toBe("inv-1");
    expect(payload.sameContextAfterAwait).toBe(true);
    expect(payload.hasRemainingTime).toBe(true);
  });

  it("isolates context between invocations", async () => {
    const seen: string[] = [];
    const server = new LambdaServer({
      async fetch() {
        const context = getCurrentAwsContext();
        seen.push(context?.awsRequestId ?? "missing");
        return new Response("ok", { status: 200 });
      },
    } as any);

    await server.accept(createRequest(eventV2, "inv-a"));
    await server.accept(createRequest(eventV2, "inv-b"));

    expect(seen).toEqual(["inv-a", "inv-b"]);
    expect(getCurrentAwsContext()).toBeUndefined();
    expect(getCurrentAwsEvent()).toBeUndefined();
  });
});
