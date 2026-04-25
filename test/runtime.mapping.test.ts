import { describe, expect, it } from "bun:test";
import eventV1 from "./fixtures/apigw-http-v1-event.json";
import eventV2 from "./fixtures/apigw-http-v2-event.json";
import {
  formatHttpEventV1,
  formatHttpEventV2,
  formatRequest,
  formatResponse,
  formatUnknownEvent,
  isHttpEventV1,
  isHttpEventV2,
  type LambdaRequest,
} from "../command/runtime";

describe("runtime http event mappings", () => {
  it("detects v1 and v2 events", () => {
    expect(isHttpEventV1(eventV1)).toBe(true);
    expect(isHttpEventV1(eventV2)).toBe(false);
    expect(isHttpEventV2(eventV2)).toBe(true);
    expect(isHttpEventV2(eventV1)).toBe(false);
  });

  it("maps v1 request fields and decodes base64 body", async () => {
    const request = formatHttpEventV1(eventV1 as any);

    expect(request.method).toBe("POST");
    expect(request.url).toContain("https://example.execute-api.eu-central-1.amazonaws.com/pets/42");
    expect(request.url).toContain("foo=bar");
    expect(request.url).toContain("foo=baz");
    expect(request.url).toContain("flag=1");
    expect(request.headers.get("x-test")).toBe("a, b");
    expect(request.headers.get("x-amzn-authorizer")).toContain("principalId");
    expect(await request.text()).toBe("hello-v1");
  });

  it("maps v2 request fields and cookie array", async () => {
    const request = formatHttpEventV2(eventV2 as any);

    expect(request.method).toBe("GET");
    expect(request.url).toBe("https://api.example.com/orders/123?q=one%2Ctwo");
    expect(request.headers.get("x-test")).toBe("v1, v2");
    expect(request.headers.get("set-cookie")).toBe("session=abc, theme=dark");
    expect(request.headers.get("x-amzn-authorizer")).toContain("jwt");
    expect(await request.text()).toBe("{\"ok\":true}");
  });

  it("attaches lambda metadata headers in formatRequest", () => {
    const requestInput: LambdaRequest = {
      requestId: "req-1",
      traceId: "Root=1-abc",
      functionArn: "arn:aws:lambda:eu-central-1:123456789012:function:test",
      deadlineMs: Date.now() + 1_000,
      event: eventV1,
    };
    const request = formatRequest(requestInput);

    expect(request).toBeDefined();
    expect(request?.headers.get("x-amzn-requestid")).toBe("req-1");
    expect(request?.headers.get("x-amzn-trace-id")).toBe("Root=1-abc");
    expect(request?.headers.get("x-amzn-function-arn")).toContain(":function:test");
    expect(request?.headers.get("x-amzn-deadline-ms")).toBeTruthy();
    expect((request as any)?.aws).toBeUndefined();
    expect((request as any)?.awsContext).toBeUndefined();
  });
});

describe("runtime response and unknown event mapping", () => {
  it("maps set-cookie to v1 multiValueHeaders", async () => {
    const headers = new Headers({ "Content-Type": "text/plain" });
    headers.append("Set-Cookie", "a=1");
    headers.append("Set-Cookie", "b=2");
    const response = new Response("ok", { status: 200, headers });
    const mapped = await formatResponse(response, "v1");

    expect(mapped.statusCode).toBe(200);
    expect(mapped.multiValueHeaders?.["Set-Cookie"]).toEqual(["a=1", "b=2"]);
  });

  it("maps set-cookie to v2 cookies", async () => {
    const headers = new Headers({ "Content-Type": "text/plain" });
    headers.append("Set-Cookie", "a=1");
    headers.append("Set-Cookie", "b=2");
    const response = new Response("ok", { status: 200, headers });
    const mapped = await formatResponse(response, "v2");

    expect(mapped.statusCode).toBe(200);
    expect(mapped.cookies).toEqual(["a=1", "b=2"]);
    expect(mapped.multiValueHeaders).toBeUndefined();
  });

  it("normalizes websocket 101 response", async () => {
    const response = new Response(null, {
      status: 101,
      headers: {
        "Sec-WebSocket-Protocol": "chat",
      },
    });
    const mapped = await formatResponse(response, "v2");

    expect(mapped).toEqual({
      statusCode: 200,
      headers: {
        "Sec-WebSocket-Protocol": "chat",
      },
    });
  });

  it("base64 encodes binary responses", async () => {
    const response = new Response(new Uint8Array([0, 1, 2]), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });
    const mapped = await formatResponse(response, "v2");

    expect(mapped.isBase64Encoded).toBe(true);
    expect(mapped.body).toBe("AAEC");
  });

  it("wraps unknown event as synthetic request", async () => {
    const request = formatUnknownEvent({ message: "hello" });
    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://lambda/");
    expect(request.headers.get("content-type")).toContain("application/json");
    expect(await request.text()).toBe("{\"message\":\"hello\"}");
  });
});
