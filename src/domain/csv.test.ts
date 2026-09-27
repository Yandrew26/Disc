import { describe, it, expect } from "vitest";
import { parseRosterCsv } from "./csv";

describe("parseRosterCsv", () => {
  it("parses name,email lines and skips the header", () => {
    const rows = parseRosterCsv("Name,Email\nAlex Chen,alex@example.com\nSam Lee,SAM@example.com\n");
    expect(rows).toEqual([
      { name: "Alex Chen", email: "alex@example.com" },
      { name: "Sam Lee", email: "sam@example.com" },
    ]);
  });

  it("handles quoted names containing commas", () => {
    const rows = parseRosterCsv('"Chen, Alex",alex@example.com');
    expect(rows).toEqual([{ name: "Chen, Alex", email: "alex@example.com" }]);
  });

  it("skips blank and malformed lines", () => {
    const rows = parseRosterCsv("\nnot-an-email-row\nAlex,alex@example.com\n\n");
    expect(rows).toHaveLength(1);
  });
});
