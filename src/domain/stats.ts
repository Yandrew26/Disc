export type StatLine = {
  goals: number;
  assists: number;
  blocks: number;
  turnovers: number;
  plusMinus: number;
};

type PointLite = { scoredBy: "us" | "them"; linePlayerIds: string[] };
type StatRow = { memberId: string; type: "goal" | "assist" | "block" | "turnover" };

const EMPTY: StatLine = { goals: 0, assists: 0, blocks: 0, turnovers: 0, plusMinus: 0 };

export function computeSeasonStats(
  points: PointLite[],
  stats: StatRow[],
): Record<string, StatLine> {
  const out: Record<string, StatLine> = {};
  const get = (id: string) => (out[id] ??= { ...EMPTY });

  for (const p of points) {
    const delta = p.scoredBy === "us" ? 1 : -1;
    for (const id of p.linePlayerIds) get(id).plusMinus += delta;
  }
  for (const s of stats) {
    const line = get(s.memberId);
    if (s.type === "goal") line.goals += 1;
    else if (s.type === "assist") line.assists += 1;
    else if (s.type === "block") line.blocks += 1;
    else line.turnovers += 1;
  }
  return out;
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function buildStatsCsv(rows: ({ name: string } & StatLine)[]): string {
  const header = "Name,Goals,Assists,Blocks,Turnovers,PlusMinus";
  const body = rows.map((r) =>
    [csvEscape(r.name), r.goals, r.assists, r.blocks, r.turnovers, r.plusMinus].join(","),
  );
  return [header, ...body].join("\n") + "\n";
}
