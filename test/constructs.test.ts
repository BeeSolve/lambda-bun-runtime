import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as fc from "fast-check";

import { BunFunction, BunFunctionWithLayer, BunLambdaLayer } from "../src/index";

const testLayerArn = "arn:aws:lambda:eu-central-1:123456789012:layer:BunRuntime:7";

// CDK's Code.fromAsset requires the zip to exist on disk during synth
const dummyZipPath = resolve(tmpdir(), `bun-lambda-layer-test-${process.pid}.zip`);

beforeAll(() => {
  const proc = Bun.spawnSync(["zip", "-j", dummyZipPath, "/dev/null"]);
  if (proc.exitCode !== 0) {
    writeFileSync(dummyZipPath, Buffer.alloc(0));
  }
});

afterAll(() => {
  if (existsSync(dummyZipPath)) {
    unlinkSync(dummyZipPath);
  }
});

function deriveBasename(props: { entrypoint: string }): string {
  const { basename } = require("node:path");
  const base = basename(props.entrypoint);
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex <= 0) {
    throw new Error(`Cannot derive handler from entrypoint: ${props.entrypoint}`);
  }
  return base.substring(0, dotIndex);
}

describe("BunFunction handler derivation (Property 5)", () => {
  test("derives handler as basename.handler for .js files", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
        (name) => {
          const entrypoint = `/path/to/${name}.js`;
          const result = deriveBasename({ entrypoint });
          expect(result).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("derives handler as basename.handler for .ts files", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
        (name) => {
          const entrypoint = `/path/to/${name}.ts`;
          const result = deriveBasename({ entrypoint });
          expect(result).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("handles nested paths correctly", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 5 },
        ),
        fc
          .string({ minLength: 1, maxLength: 10 })
          .filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
        (dirs, name) => {
          const entrypoint = `/${dirs.join("/")}/${name}.ts`;
          const result = deriveBasename({ entrypoint });
          expect(result).toBe(name);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("CDK construct unit tests", () => {
  test("BunFunctionWithLayer with .js entrypoint produces correct handler string", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer", { layerVersionArn: testLayerArn });

    new BunFunctionWithLayer(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/api.js`,
      bunLayer,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "api.handler",
    });
  });

  test("BunFunctionWithLayer with .ts entrypoint uses Code.fromCustomCommand", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer", { layerVersionArn: testLayerArn });

    new BunFunctionWithLayer(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/handler.ts`,
      bunLayer,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "handler.handler",
    });
  });

  test("BunFunctionWithLayer with explicit exportName uses provided value", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer", { layerVersionArn: testLayerArn });

    new BunFunctionWithLayer(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/api.js`,
      exportName: "myExport",
      bunLayer,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "api.myExport",
    });
  });

  test("BunFunctionWithLayer does NOT use .fetch as default export", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer", { layerVersionArn: testLayerArn });

    new BunFunctionWithLayer(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/api.js`,
      bunLayer,
    });

    const template = Template.fromStack(stack);
    const functions = template.findResources("AWS::Lambda::Function");
    for (const fn of Object.values(functions)) {
      const handler = (fn as { Properties: { Handler: string } }).Properties.Handler;
      expect(handler).not.toContain(".fetch");
    }
  });

  test("BunLambdaLayer with assetZipPath creates a layer with correct properties", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    new BunLambdaLayer(stack, "Layer", { assetZipPath: dummyZipPath });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::LayerVersion", {
      CompatibleArchitectures: ["arm64"],
      CompatibleRuntimes: ["provided.al2023"],
      LayerName: "BunRuntime",
    });
  });

  test("BunLambdaLayer with layerVersionArn creates no layer and attaches the ARN", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer", { layerVersionArn: testLayerArn });

    new BunFunctionWithLayer(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/api.js`,
      bunLayer,
    });

    const template = Template.fromStack(stack);
    template.resourceCountIs("AWS::Lambda::LayerVersion", 0);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Layers: [testLayerArn],
    });
  });

  test("BunLambdaLayer without props throws for a region with no published layer", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack", {
      env: { account: "123456789012", region: "eu-west-3" },
    });

    expect(() => new BunLambdaLayer(stack, "Layer")).toThrow(
      /No published Bun layer for region "eu-west-3"/,
    );
  });

  test("BunLambdaLayer without props throws for an environment-agnostic stack", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    expect(() => new BunLambdaLayer(stack, "Layer")).toThrow(/needs a concrete region/);
  });

  test("BunFunctionWithLayer uses PROVIDED_AL2023 runtime and ARM_64 architecture", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer", { layerVersionArn: testLayerArn });

    new BunFunctionWithLayer(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/api.js`,
      bunLayer,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "provided.al2023",
      Architectures: ["arm64"],
    });
  });
});

describe("BunFunction on a customer-managed runtime", () => {
  const runtimeArn = "arn:aws:lambda:eu-central-1:123456789012:runtime/bun";
  const entrypoint = `${import.meta.dir}/fixtures/api.js` as const;

  test("sets runtimeConfig, the custom runtime and no layer", () => {
    const stack = new Stack(new App(), "Cmr", { env: { region: "eu-central-1" } });
    new BunFunction(stack, "Fn", {
      entrypoint,
      bunRuntime: { runtimeArn, runtimeAlias: "stable" },
    });
    Template.fromStack(stack).hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "custom",
      Architectures: ["arm64"],
      RuntimeConfig: { RuntimeArn: runtimeArn, RuntimeAlias: "stable" },
      Layers: Match.absent(),
    });
  });

  test("alias defaults to latest when only the ARN is given", () => {
    const stack = new Stack(new App(), "CmrDefault", { env: { region: "eu-central-1" } });
    new BunFunction(stack, "Fn", { entrypoint, bunRuntime: { runtimeArn } });
    Template.fromStack(stack).hasResourceProperties("AWS::Lambda::Function", {
      RuntimeConfig: { RuntimeArn: runtimeArn, RuntimeAlias: "latest" },
    });
  });

  test("without an override it needs a published runtime for the region", () => {
    const stack = new Stack(new App(), "CmrNone", { env: { region: "eu-central-1" } });
    expect(() => new BunFunction(stack, "Fn", { entrypoint })).toThrow("No published Bun layer");
  });
});
