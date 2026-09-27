export type RatioRule = { lineSize: number; maxSameGender: number };

// USAU-style mixed default: no more than 4 of one matched-gender group on a 7-person line.
export const DEFAULT_MIXED_RATIO: RatioRule = { lineSize: 7, maxSameGender: 4 };

export function checkGenderRatio(
  genders: (string | null)[],
  rule: RatioRule = DEFAULT_MIXED_RATIO,
): { valid: boolean; counts: Record<string, number>; message?: string } {
  const counts: Record<string, number> = {};
  for (const g of genders) {
    const key = g?.trim().toLowerCase() || "unspecified";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const over = Object.entries(counts).find(([, n]) => n > rule.maxSameGender);
  if (over) {
    return {
      valid: false,
      counts,
      message: `${over[1]} players are "${over[0]}" — max is ${rule.maxSameGender} per gender on a ${rule.lineSize}-person line.`,
    };
  }
  return { valid: true, counts };
}

// ponytail: streak-from-most-recent-point heuristic, not true elapsed playing
// time. Good enough to answer "who's been out there longest without a rest";
// upgrade to minutes-on-field if games start tracking point duration.
export function suggestSubs(
  pointHistory: { seq: number; linePlayerIds: string[] }[],
  rosterIds: string[],
): string[] {
  const sorted = [...pointHistory].sort((a, b) => b.seq - a.seq);
  const streak: Record<string, number> = {};
  for (const id of rosterIds) streak[id] = 0;

  for (const point of sorted) {
    const onField = new Set(point.linePlayerIds);
    for (const id of rosterIds) {
      if (streak[id] === -1) continue; // already hit a rest point, streak is fixed
      if (onField.has(id)) streak[id] += 1;
      else streak[id] = -1;
    }
  }

  return [...rosterIds].sort((a, b) => streak[b] - streak[a]);
}
