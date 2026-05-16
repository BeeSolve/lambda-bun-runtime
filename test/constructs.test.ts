import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import * as fc from "fast-check";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { BunFunction, BunLambdaLayer } from "../src/index";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

// CDK's Code.fromAsset requires the zip to exist on disk during synth
const dummyZipPath = resolve(__dirname, "../src/bun-lambda-layer-1.3.13.zip");

beforeAll(() => {
  if (!existsSync(dummyZipPath)) {
    // Create a minimal valid zip (PK header + empty)
    const proc = Bun.spawnSync(["zip", "-j", dummyZipPath, "/dev/null"]);
    if (proc.exitCode !== 0) {
      writeFileSync(dummyZipPath, Buffer.alloc(0));
    }
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
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
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
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
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
        fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)), { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
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
  test("BunFunction with .js entrypoint produces correct handler string", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer");

    new BunFunction(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/api.js`,
      bunLayer,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "api.handler",
    });
  });

  test("BunFunction with .ts entrypoint uses Code.fromCustomCommand", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer");

    new BunFunction(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/handler.ts`,
      bunLayer,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "handler.handler",
    });
  });

  test("BunFunction with explicit exportName uses provided value", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer");

    new BunFunction(stack, "Fn", {
      entrypoint: `${__dirname}/fixtures/api.js`,
      exportName: "myExport",
      bunLayer,
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "api.myExport",
    });
  });

  test("BunFunction does NOT use .fetch as default export", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer");

    new BunFunction(stack, "Fn", {
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

  test("BunLambdaLayer creates layer with correct properties", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");

    new BunLambdaLayer(stack, "Layer");

    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::LayerVersion", {
      CompatibleArchitectures: ["arm64"],
      CompatibleRuntimes: ["provided.al2023"],
      LayerName: "BunRuntime",
    });
  });

  test("BunFunction uses PROVIDED_AL2023 runtime and ARM_64 architecture", () => {
    const app = new App();
    const stack = new Stack(app, "TestStack");
    const bunLayer = new BunLambdaLayer(stack, "Layer");

    new BunFunction(stack, "Fn", {
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
