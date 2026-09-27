import { describe, it, expect } from "vitest";
import { computeSeasonStats, buildStatsCsv } from "./stats";

describe("computeSeasonStats", () => {
  it("counts tagged stats per member", () => {
    const points = [{ scoredBy: "us" as const, linePlayerIds: ["a", "b"] }];
    const stats = [
      { memberId: "a", type: "goal" as const },
      { memberId: "b", type: "assist" as const },
      { memberId: "b", type: "turnover" as const },
    ];
    const result = computeSeasonStats(points, stats);
    expect(result.a).toEqual({ goals: 1, assists: 0, blocks: 0, turnovers: 0, plusMinus: 1 });
    expect(result.b.assists).toBe(1);
    expect(result.b.turnovers).toBe(1);
  });

  it("derives plus/minus from on-field presence, not tags", () => {
    const points = [
      { scoredBy: "us" as const, linePlayerIds: ["a"] },
      { scoredBy: "them" as const, linePlayerIds: ["a"] },
      { scoredBy: "them" as const, linePlayerIds: ["a"] },
    ];
    expect(computeSeasonStats(points, []).a.plusMinus).toBe(-1);
  });

  it("includes members who only appear in tags", () => {
    const result = computeSeasonStats([], [{ memberId: "x", type: "block" as const }]);
    expect(result.x.blocks).toBe(1);
    expect(result.x.plusMinus).toBe(0);
  });
});

describe("buildStatsCsv", () => {
  it("escapes quotes and commas in names", () => {
    const csv = buildStatsCsv([
      { name: 'Sam "Huck" O\'Neil, Jr.', goals: 2, assists: 1, blocks: 0, turnovers: 3, plusMinus: -1 },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("Name,Goals,Assists,Blocks,Turnovers,PlusMinus");
    expect(lines[1]).toBe('"Sam ""Huck"" O\'Neil, Jr.",2,1,0,3,-1');
  });
});
