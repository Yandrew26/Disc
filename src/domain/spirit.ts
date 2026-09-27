// WFDF Spirit of the Game: five categories, each scored 0-4, total out of 20.
export const SPIRIT_CATEGORIES = [
  "rules",
  "fouls",
  "fairMindedness",
  "attitude",
  "communication",
] as const;

type SpiritCategory = (typeof SPIRIT_CATEGORIES)[number];
export type SpiritScores = Record<SpiritCategory, number>;

export function spiritTotal(scores: SpiritScores): number {
  return SPIRIT_CATEGORIES.reduce((sum, c) => sum + (scores[c] ?? 0), 0);
}
