import { describe, it, expect } from "vitest";
import { describePoint } from "./game";

describe("describePoint", () => {
  it("we scored on offense = Hold", () => {
    expect(describePoint("O", "us")).toBe("Hold");
  });
  it("we scored on defense = Break", () => {
    expect(describePoint("D", "us")).toBe("Break");
  });
  it("they scored while we were on offense = Broken", () => {
    expect(describePoint("O", "them")).toBe("Broken");
  });
  it("they scored while we were on defense = Opp. hold", () => {
    expect(describePoint("D", "them")).toBe("Opp. hold");
  });
});
