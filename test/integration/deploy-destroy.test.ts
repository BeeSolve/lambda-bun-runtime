import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  InvokeCommand,
  InvokeWithResponseStreamCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const runInteg = process.env.RUN_AWS_INTEG === "1";
const region = process.env.AWS_REGION ?? "eu-central-1";
const stackName = `BunLayerInteg-${Date.now()}`;
const sampleApp = join(__dirname, "../../examples/sample-app");
const outputsFile = join(sampleApp, "outputs.json");

function describeInteg(label: string, fn: () => void) {
  if (!runInteg) {
    describe.skip(`[skipped — set RUN_AWS_INTEG=1] ${label}`, fn);
  } else {
    describe(label, fn);
  }
}

interface StackOutputs {
  HttpV2FunctionUrl: string;
  HttpV2PlainFunctionUrl: string;
  HttpV1RestApiUrl: string;
  EchoFnArn: string;
  CmrEchoFnArn: string;
  S3WriterFnArn: string;
  TestBucketName: string;
  StreamingFnArn: string;
  StreamingHttpUrl: string;
  StreamingHttpLayerUrl: string;
  StreamingCloudFrontUrl: string;
}

function run(cmd: string, cwd = sampleApp) {
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, INTEG_STACK_NAME: stackName },
  });
}

async function invokeLambda(arn: string, payload: unknown): Promise<unknown> {
  const client = new LambdaClient({ region: region });
  const res = await client.send(
    new InvokeCommand({
      FunctionName: arn,
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );
  return JSON.parse(Buffer.from(res.Payload ?? new Uint8Array()).toString());
}

async function getS3Object(bucket: string, key: string): Promise<string> {
  const client = new S3Client({ region: region });
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (res.Body == null) throw new Error("S3 GetObject returned no body");
  return res.Body.transformToString();
}

function assertSetCookieHeader(headers: Headers) {
  const setCookie = headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  expect(setCookie).toContain("it_cookie=server-set");
}

describeInteg(
  "CDK deploy -> test -> destroy",
  () => {
    let outputs: StackOutputs;

    beforeAll(
      async () => {
        run("bun install");
        run(`bunx cdk deploy ${stackName} --require-approval never --outputs-file outputs.json`);
        const raw = JSON.parse(readFileSync(outputsFile, "utf8"));
        outputs = raw[stackName] as StackOutputs;
      },
      20 * 60 * 1000,
    );

    afterAll(
      async () => {
        try {
          run(`bunx cdk destroy ${stackName} --force`);
        } catch {
          console.warn(
            `Stack destroy failed — run 'bun run integ:cleanup' to clean up ${stackName}`,
          );
        }
      },
      15 * 60 * 1000,
    );

    test("HTTP v2 via Function URL handles cookies", async () => {
      const res = await fetch(`${outputs.HttpV2FunctionUrl}cookie-check`, {
        headers: { Cookie: "it_cookie=from-client" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.eventVersion).toBe("v2");
      expect(body.requestCookie).toBe("from-client");
      assertSetCookieHeader(res.headers);
    });

    test("HTTP v2 plain (raw event, no adapter) handles cookies", async () => {
      const res = await fetch(`${outputs.HttpV2PlainFunctionUrl}cookie-check`, {
        headers: { Cookie: "it_cookie=from-client" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.eventVersion).toBe("v2-plain");
      expect(body.requestCookie).toBe("from-client");
      assertSetCookieHeader(res.headers);
    });

    test("HTTP v1 via REST API handles cookies", async () => {
      const res = await fetch(`${outputs.HttpV1RestApiUrl}cookie-check`, {
        headers: { Cookie: "it_cookie=from-client" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.eventVersion).toBe("v1");
      expect(body.requestCookie).toBe("from-client");
      assertSetCookieHeader(res.headers);
    });

    test("direct invoke echo on the customer-managed runtime", async () => {
      const result = await invokeLambda(outputs.CmrEchoFnArn, { hello: "cmr" });
      expect((result as { echo: unknown }).echo).toEqual({ hello: "cmr" });
    });

    test("direct invoke echo", async () => {
      const result = await invokeLambda(outputs.EchoFnArn, { hello: "world" });
      expect((result as { echo: unknown }).echo).toEqual({ hello: "world" });
    });

    test("async generator handler streams response via InvokeWithResponseStream", async () => {
      const client = new LambdaClient({ region: region });
      const res = await client.send(
        new InvokeWithResponseStreamCommand({
          FunctionName: outputs.StreamingFnArn,
          Payload: Buffer.from("{}"),
        }),
      );
      const decoder = new TextDecoder();
      let body = "";
      if (res.EventStream == null)
        throw new Error("InvokeWithResponseStream returned no EventStream");
      for await (const chunk of res.EventStream) {
        if (chunk.PayloadChunk?.Payload) {
          body += decoder.decode(chunk.PayloadChunk.Payload);
        }
      }
      expect(body).toBe("hello from streaming");
    });

    for (const [label, urlKey] of [
      ["customer-managed runtime", "StreamingHttpUrl"],
      ["layer", "StreamingHttpLayerUrl"],
      ["customer-managed runtime behind CloudFront with OAC", "StreamingCloudFrontUrl"],
    ] as const) {
      test(`Function URL streaming keeps status, headers and chunk timing on the ${label}`, async () => {
        const startedAt = Date.now();
        const res = await fetch(outputs[urlKey]);
        expect(res.status).toBe(201);
        expect(res.headers.get("x-custom")).toBe("prelude");
        expect(res.headers.get("content-type")).toContain("text/plain");
        if (res.body == null) throw new Error("Response has no body");
        const decoder = new TextDecoder();
        const arrivals: Array<number> = [];
        let body = "";
        for await (const chunk of res.body) {
          arrivals.push(Date.now() - startedAt);
          body += decoder.decode(chunk, { stream: true });
        }
        expect(body).toBe("chunk 1\nchunk 2\nchunk 3\nchunk 4\nchunk 5\n");
        // Unbuffered: the first and last bytes are separated by about 4 x 300 ms.
        const first = arrivals[0] ?? 0;
        const last = arrivals[arrivals.length - 1] ?? 0;
        expect(last - first).toBeGreaterThan(900);
      });
    }

    test("Bun-native S3 write", async () => {
      await invokeLambda(outputs.S3WriterFnArn, {
        key: "integ-test.txt",
        content: "hello bun",
      });
      const content = await getS3Object(outputs.TestBucketName, "integ-test.txt");
      expect(content).toBe("hello bun");
    });
  },
  20 * 60 * 1000,
);
