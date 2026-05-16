# Integration Tests Plan

## Context

This plan merges the approach from PR #1 (now closed) with the full set of requirements. The goal is a real-resource integration test suite that:

- Deploys actual Lambda functions using `BunFunction` with `.ts` entrypoints — this intentionally tests the CDK synth-time `bun build` step, not just the runtime
- Exercises HttpV2 (Function URL via `@beesolve/lambda-fetch-api`), HttpV1 (REST API raw), direct Lambda invoke, and Bun-native S3 write
- Uses cookie handling as the HTTP test scenario (carried over from PR #1 — practical and realistic)
- Runs on PRs that touch relevant paths, and as a required gate before `release.yml` publishes to npm
- Uses OIDC (`AWS_INTEG_ROLE_ARN` secret, `eu-central-1` region — already established in PR #1)

**AsyncLocalStorage context is out of scope** — the `aws-invocation-context.ts` pattern from PR #1 is not included.

---

## AWS OIDC (already established)

PR #1 already set up the infrastructure:
- Secret: `AWS_INTEG_ROLE_ARN`
- Region: `eu-central-1`
- Action: `aws-actions/configure-aws-credentials@v5`

No new AWS setup required.

---

## Directory Structure (`examples/sample-app/`)

Structure taken from PR #1, handlers changed to `.ts` entrypoints (no pre-build), and new handlers added:

```
examples/sample-app/
├── cdk.json                     # { "app": "bun run ./bin/app.ts" }
├── package.json                 # deps: aws-cdk-lib, constructs, @beesolve/lambda-fetch-api
│                                # "@beesolve/lambda-bun-runtime": "file:../.."
├── bin/
│   └── app.ts                   # CDK app; stack name from INTEG_STACK_NAME env var
├── lib/
│   └── sample-stack.ts          # SampleStack definition
└── src/
    ├── http-v2.ts               # asHttpV2Handler wrapper — Function URL target
    ├── http-v1.ts               # raw APIGatewayProxyEvent handler — REST API target
    ├── echo.ts                  # echoes event — direct invoke target
    └── s3-writer.ts             # Bun-native S3 write — direct invoke target
```

`test/integration/deploy-destroy.test.ts` (from PR #1, expanded) stays in `test/integration/`.

---

## CDK Stack (`lib/sample-stack.ts`)

Single stack `BunLayerInteg-<timestamp>` with:

| Construct | Handler | Invocation | Purpose |
|-----------|---------|------------|---------|
| `BunLambdaLayer` | — | — | Shared runtime |
| `HttpV2Fn` + `FunctionUrl` | `src/http-v2.ts` | HTTPS | Tests `asHttpV2Handler` + cookie handling |
| `HttpV1Fn` + `LambdaRestApi` | `src/http-v1.ts` | HTTPS | Tests raw v1 handler + cookie handling |
| `EchoFn` | `src/echo.ts` | `Lambda.invoke` | Tests direct invoke |
| `S3WriterFn` | `src/s3-writer.ts` | `Lambda.invoke` | Tests Bun-native S3 write |
| `TestBucket` | — | — | Target for S3 write test; `autoDeleteObjects: true`, `removalPolicy: DESTROY` |

**Stack outputs:**
- `HttpV2FunctionUrl`
- `HttpV1RestApiUrl`
- `EchoFnArn`
- `S3WriterFnArn`
- `TestBucketName`

**Lambda execution roles:**
- `HttpV2Fn`, `HttpV1Fn`, `EchoFn` — default (CloudWatch Logs only)
- `S3WriterFn` — `s3:PutObject` on `TestBucket`

---

## Lambda Handlers

### `src/http-v2.ts` — validates `@beesolve/lambda-fetch-api` README example
```typescript
import { asHttpV2Handler } from "@beesolve/lambda-fetch-api";

const fetch = async (request: Request): Promise<Response> => {
  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  return new Response(
    JSON.stringify({ ok: true, eventVersion: "v2", requestCookie: cookies["it_cookie"] }),
    {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "it_cookie=server-set; Path=/; HttpOnly",
      },
    }
  );
};

export const handler = asHttpV2Handler(fetch);
export default { fetch };
```

### `src/http-v1.ts` — validates raw v1 handler
```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const cookies = parseCookies(event.headers["Cookie"] ?? event.headers["cookie"] ?? "");
  return {
    statusCode: 200,
    headers: { "Set-Cookie": "it_cookie=server-set; Path=/" },
    body: JSON.stringify({ ok: true, eventVersion: "v1", requestCookie: cookies["it_cookie"] }),
  };
};
```

### `src/echo.ts`
```typescript
export const handler = async (event: unknown) => ({ echo: event });
```

### `src/s3-writer.ts` — Bun-native S3, no AWS SDK
```typescript
import { S3Client } from "bun";  // available since Bun 1.2.0

export const handler = async (event: { key: string; content: string }) => {
  const client = new S3Client({ bucket: process.env.BUCKET_NAME });
  await client.write(event.key, event.content);
  return { written: true, key: event.key };
};
```

> **Note:** Verify the exact `S3Client` import path against Bun 1.3.14 release notes before coding. Alternative: `await Bun.write(`s3://${process.env.BUCKET_NAME}/${event.key}`, event.content)` using Bun's s3:// URL scheme.

---

## Integration Test (`test/integration/deploy-destroy.test.ts`)

Structure carried over from PR #1. The `RUN_AWS_INTEG=1` guard is kept — the test is skipped unless the env var is set.

```typescript
describeInteg("CDK deploy -> test -> destroy", () => {
  test("deploys stack and validates all Lambda scenarios", async () => {
    // 1. bun run build-layer   (build the layer zip)
    // 2. bun run compile       (compile lib/ so sample-app can import it)
    // 3. NO build:handler step — BunFunction builds .ts during cdk deploy
    // 4. cdk deploy with unique stack name, --outputs-file outputs.json

    // HTTP v2 via Function URL (asHttpV2Handler)
    const v2Res = await fetch(`${outputs.HttpV2FunctionUrl}cookie-check`, {
      headers: { Cookie: "it_cookie=from-client" },
    });
    expect(v2Res.status).toBe(200);
    expect(body.eventVersion).toBe("v2");
    expect(body.requestCookie).toBe("from-client");
    assertSetCookieHeader(v2Res.headers);

    // HTTP v1 via REST API
    const v1Res = await fetch(`${outputs.HttpV1RestApiUrl}cookie-check`, {
      headers: { Cookie: "it_cookie=from-client" },
    });
    expect(v1Res.status).toBe(200);
    expect(body.eventVersion).toBe("v1");
    expect(body.requestCookie).toBe("from-client");
    assertSetCookieHeader(v1Res.headers);

    // Direct invoke echo
    const echoRes = await invokeLambda(outputs.EchoFnArn, { hello: "world" });
    expect(echoRes.echo).toEqual({ hello: "world" });

    // Bun S3 write — invoke Lambda, read back via AWS SDK
    await invokeLambda(outputs.S3WriterFnArn, { key: "integ-test.txt", content: "hello bun" });
    const s3Content = await getS3Object(outputs.TestBucketName, "integ-test.txt");
    expect(s3Content).toBe("hello bun");

    // cdk destroy (in finally block)
  }, 20 * 60 * 1000);
});
```

AWS SDK calls (`invokeLambda`, `getS3Object`) live in the test file itself using `@aws-sdk/client-lambda` and `@aws-sdk/client-s3` — only in the test runner, not in the Lambda functions.

---

## `package.json` for `examples/sample-app/`

```json
{
  "name": "sample-app",
  "private": true,
  "type": "module",
  "scripts": {
    "synth": "bunx cdk synth",
    "deploy": "bunx cdk deploy --require-approval never",
    "destroy": "bunx cdk destroy --force"
  },
  "dependencies": {
    "@beesolve/lambda-bun-runtime": "file:../..",
    "@beesolve/lambda-fetch-api": "latest",
    "aws-cdk-lib": "^2.238.0",
    "constructs": "^10.4.5"
  },
  "devDependencies": {
    "@aws-sdk/client-lambda": "^3",
    "@aws-sdk/client-s3": "^3",
    "aws-cdk": "^2.238.0"
  }
}
```

Note: `build:handler` script removed — `.ts` entrypoints are built by `BunFunction` during `cdk deploy`.

---

## `.projenrc.ts` changes

```typescript
project.addTask("integ:deploy-test-destroy", {
  description: "Deploy sample app, run e2e checks, then destroy stack.",
  exec: "RUN_AWS_INTEG=1 bun test test/integration/deploy-destroy.test.ts",
});

project.addTask("integ:cleanup", {
  description: "Best-effort cleanup of integration stacks by prefix.",
  exec: `bash -lc "set -euo pipefail; stacks=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE ROLLBACK_COMPLETE --query 'StackSummaries[].StackName' --output text); for stack in $stacks; do case \\"$stack\\" in BunLayerInteg-*) echo \\"Destroying $stack\\"; (cd examples/sample-app && INTEG_STACK_NAME=\\"$stack\\" bunx cdk destroy \\"$stack\\" --force);; esac; done"`,
});
```

Also add `@types/bun` to `devDeps` (from PR #1).

---

## GitHub Actions Workflow (`.github/workflows/integration.yml`)

Based directly on PR #1 with one change: remove the `build:handler` step.

```yaml
name: integration

on:
  workflow_call: {}           # called by release.yml before publish
  workflow_dispatch: {}
  pull_request:
    paths:
      - "command/**"
      - "src/**"
      - "examples/sample-app/**"
      - "test/integration/**"
      - ".github/workflows/integration.yml"

concurrency:
  group: integration-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy-test-destroy:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    permissions:
      id-token: write
      contents: read
    env:
      AWS_REGION: eu-central-1
      CI: "true"
    steps:
      - uses: actions/checkout@v6
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - uses: aws-actions/configure-aws-credentials@v5
        with:
          role-to-assume: ${{ secrets.AWS_INTEG_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - run: bun install --frozen-lockfile
      - run: bun run integ:deploy-test-destroy
      - name: Cleanup leftover stacks
        if: always()
        run: bun run integ:cleanup
```

---

## Changes to `release.yml`

Add integration tests as a required predecessor to the publish job:

```yaml
jobs:
  integration_test:
    uses: ./.github/workflows/integration.yml
    secrets: inherit
  release:
    needs: integration_test
    # ... existing release job unchanged
```

---

## Projen Compatibility

`examples/sample-app/` and `test/integration/` are not managed by projen. `integration.yml` is a new workflow file — verify it survives a `projen` run (if projen deletes it, add to `.projenrc.ts`):

```typescript
project.addGitIgnore("!.github/workflows/integration.yml");
```

---

## Verification

**Local run (requires AWS credentials + CDK bootstrap in eu-central-1):**
```bash
bun run build-layer
bun run compile
cd examples/sample-app && bun install
cd ../..
bun run integ:deploy-test-destroy
```

**CI:** trigger `integration` workflow via `workflow_dispatch` and verify all five assertions pass in GitHub Actions logs.
