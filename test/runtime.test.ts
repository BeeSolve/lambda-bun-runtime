import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import { parseHandlerString, buildContext, formatError } from "../command/runtimeHelpers.mts";

describe("handler string resolution (Property 1)", () => {
  test("splits at last dot for strings containing at least one dot", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => !s.includes(".")),
        fc.string({ minLength: 1 }).filter((s) => !s.includes(".")),
        (filename, exportName) => {
          const handler = `${filename}.${exportName}`;
          const result = parseHandlerString({ handler });
          expect(result).not.toBeNull();
          expect(result!.filename).toBe(filename);
          expect(result!.exportName).toBe(exportName);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("splits at last dot when multiple dots present", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => !s.includes(".")),
        fc.string({ minLength: 1 }).filter((s) => !s.includes(".")),
        fc.string({ minLength: 1 }).filter((s) => !s.includes(".")),
        (part1, part2, exportName) => {
          const handler = `${part1}.${part2}.${exportName}`;
          const result = parseHandlerString({ handler });
          expect(result).not.toBeNull();
          expect(result!.filename).toBe(`${part1}.${part2}`);
          expect(result!.exportName).toBe(exportName);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("returns null for strings without a dot", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0 }).filter((s) => !s.includes(".")),
        (handler) => {
          const result = parseHandlerString({ handler });
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("context object construction (Property 3)", () => {
  test("all context fields match source values", () => {
    fc.assert(
      fc.property(
        fc.record({
          functionName: fc.string(),
          functionVersion: fc.string(),
          invokedFunctionArn: fc.string(),
          memoryLimitInMB: fc.string(),
          logGroupName: fc.string(),
          logStreamName: fc.string(),
          requestId: fc.string(),
          deadlineMs: fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        }),
        (props) => {
          const context = buildContext(props);
          expect(context.functionName).toBe(props.functionName);
          expect(context.functionVersion).toBe(props.functionVersion);
          expect(context.invokedFunctionArn).toBe(props.invokedFunctionArn);
          expect(context.memoryLimitInMB).toBe(props.memoryLimitInMB);
          expect(context.awsRequestId).toBe(props.requestId);
          expect(context.logGroupName).toBe(props.logGroupName);
          expect(context.logStreamName).toBe(props.logStreamName);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("getRemainingTimeInMillis returns deadline minus current time", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.now(), max: Date.now() + 900000 }),
        (deadlineMs) => {
          const context = buildContext({
            functionName: "",
            functionVersion: "",
            invokedFunctionArn: "",
            memoryLimitInMB: "",
            logGroupName: "",
            logStreamName: "",
            requestId: "",
            deadlineMs,
          });
          const before = Date.now();
          const remaining = context.getRemainingTimeInMillis();
          const after = Date.now();
          // remaining should be between (deadline - after) and (deadline - before)
          expect(remaining).toBeGreaterThanOrEqual(deadlineMs - after);
          expect(remaining).toBeLessThanOrEqual(deadlineMs - before);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("error formatting (Property 4)", () => {
  test("preserves Error name, message, and stack", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (name, message) => {
          const error = new Error(message);
          error.name = name;
          const result = formatError({ error });
          expect(result.errorType).toBe(name);
          expect(result.errorMessage).toBe(message);
          expect(result.stackTrace).toBeDefined();
          expect(Array.isArray(result.stackTrace)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("uses 'Error' as errorType when Error.name is empty", () => {
    const error = new Error("test");
    error.name = "";
    const result = formatError({ error });
    expect(result.errorType).toBe("Error");
  });

  test("handles Error without stack", () => {
    const error = new Error("no stack");
    error.stack = undefined;
    const result = formatError({ error });
    expect(result.errorType).toBe("Error");
    expect(result.errorMessage).toBe("no stack");
    expect(result.stackTrace).toBeUndefined();
  });

  test("formats string errors directly", () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        const result = formatError({ error: message });
        expect(result.errorType).toBe("Error");
        expect(result.errorMessage).toBe(message);
        expect(result.stackTrace).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  test("formats non-Error non-string values via inspect", () => {
    fc.assert(
      fc.property(fc.integer(), (value) => {
        const result = formatError({ error: value });
        expect(result.errorType).toBe("Error");
        expect(result.errorMessage).toBe(Bun.inspect(value));
        expect(result.stackTrace).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});
