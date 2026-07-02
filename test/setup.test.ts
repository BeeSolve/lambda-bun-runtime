import { describe, expect, test } from "bun:test";

import * as fc from "fast-check";

describe("test infrastructure", () => {
  test("fast-check is available and runs property tests", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { numRuns: 100 },
    );
  });

  test("bun test runner works with expect assertions", () => {
    expect(1 + 1).toBe(2);
    expect("hello").toContain("ell");
    expect([1, 2, 3]).toHaveLength(3);
  });
});
