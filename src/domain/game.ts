export type PointSide = "O" | "D";
export type ScoredBy = "us" | "them";

export function describePoint(side: PointSide, scoredBy: ScoredBy): string {
  if (side === "O" && scoredBy === "us") return "Hold";
  if (side === "D" && scoredBy === "us") return "Break";
  if (side === "O" && scoredBy === "them") return "Broken";
  return "Opp. hold";
}
