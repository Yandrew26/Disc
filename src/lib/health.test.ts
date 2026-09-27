import { describe, it, expect } from "vitest";
import { health } from "./health";

describe("health", () => {
  it("reports ok", () => {
    expect(health()).toEqual({ ok: true });
  });
});
