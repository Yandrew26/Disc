import { describe, it, expect } from "vitest";
import { spiritTotal } from "./spirit";

describe("spiritTotal", () => {
  it("sums the five WFDF categories", () => {
    expect(
      spiritTotal({ rules: 2, fouls: 2, fairMindedness: 3, attitude: 4, communication: 1 }),
    ).toBe(12);
  });
  it("treats missing categories as 0", () => {
    expect(spiritTotal({ rules: 2 } as never)).toBe(2);
  });
});
