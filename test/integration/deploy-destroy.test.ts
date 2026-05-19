import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InvokeCommand, InvokeWithResponseStreamCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const RUN_INTEG = process.env.RUN_AWS_INTEG === "1";
const REGION = process.env.AWS_REGION ?? "eu-central-1";
const STACK_NAME = `BunLayerInteg-${Date.now()}`;
const SAMPLE_APP = join(__dirname, "../../examples/sample-app");
const OUTPUTS_FILE = join(SAMPLE_APP, "outputs.json");

function describeInteg(label: string, fn: () => void) {
  if (!RUN_INTEG) {
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
  S3WriterFnArn: string;
  TestBucketName: string;
  StreamingFnArn: string;
}

function run(cmd: string, cwd = SAMPLE_APP) {
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, INTEG_STACK_NAME: STACK_NAME },
  });
}

async function invokeLambda(arn: string, payload: unknown): Promise<unknown> {
  const client = new LambdaClient({ region: REGION });
  const res = await client.send(
    new InvokeCommand({
      FunctionName: arn,
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );
  return JSON.parse(Buffer.from(res.Payload!).toString());
}

async function getS3Object(bucket: string, key: string): Promise<string> {
  const client = new S3Client({ region: REGION });
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return res.Body!.transformToString();
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
        run(
          `bunx cdk deploy ${STACK_NAME} --require-approval never --outputs-file outputs.json`,
        );
        const raw = JSON.parse(readFileSync(OUTPUTS_FILE, "utf8"));
        outputs = raw[STACK_NAME] as StackOutputs;
      },
      20 * 60 * 1000,
    );

    afterAll(
      async () => {
        try {
          run(`bunx cdk destroy ${STACK_NAME} --force`);
        } catch {
          console.warn(
            `Stack destroy failed — run 'bun run integ:cleanup' to clean up ${STACK_NAME}`,
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

    test("direct invoke echo", async () => {
      const result = await invokeLambda(outputs.EchoFnArn, { hello: "world" });
      expect((result as { echo: unknown }).echo).toEqual({ hello: "world" });
    });

    test("async generator handler streams response via InvokeWithResponseStream", async () => {
      const client = new LambdaClient({ region: REGION });
      const res = await client.send(
        new InvokeWithResponseStreamCommand({
          FunctionName: outputs.StreamingFnArn,
          Payload: Buffer.from("{}"),
        }),
      );
      const decoder = new TextDecoder();
      let body = "";
      for await (const chunk of res.EventStream!) {
        if (chunk.PayloadChunk?.Payload) {
          body += decoder.decode(chunk.PayloadChunk.Payload);
        }
      }
      expect(body).toBe("hello from streaming");
    });

    test("Bun-native S3 write", async () => {
      await invokeLambda(outputs.S3WriterFnArn, {
        key: "integ-test.txt",
        content: "hello bun",
      });
      const content = await getS3Object(
        outputs.TestBucketName,
        "integ-test.txt",
      );
      expect(content).toBe("hello bun");
    });
  },
  20 * 60 * 1000,
);
