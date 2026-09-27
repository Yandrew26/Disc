// Play canvas model — stored as a JSON text blob in plays.canvas.
export type PlayerType = "O" | "D";
export type Player = { id: string; x: number; y: number; type: PlayerType; num: number };
export type Point = { x: number; y: number };
export type Step = { id: string; note: string; players: Player[]; disc: Point | null };
// Cones are static field setup, so they live on the play, not on each step.
// Field is drawn to official WFDF proportions: 37 m × 100 m, 18 m end zones,
// brick marks 18 m from each goal line. 400 units wide → 1 m ≈ 10.8 units.
// v3 = that field. Older canvases: unversioned 400×1100, v2 400×880.
export type CanvasState = { v: 3; steps: Step[]; cones: Point[] };

const M = 400 / 37;
export const FIELD = { W: 400, H: 100 * M, EZ: 18 * M, BRICK: 18 * M } as const;
const HEIGHT_BY_VERSION: Record<string, number> = { "2": 880 };
const LEGACY_H = 1100;

export function uid() { return Math.random().toString(36).slice(2, 9); }

export function emptyStep(): Step {
  return { id: uid(), note: "", players: [], disc: null };
}

// Accepts every shape we've ever saved: current, legacy single-frame
// ({ players, disc }), legacy steps with a `routes` field, "{}" and garbage.
export function parseCanvas(raw: string): CanvasState {
  try {
    const p = JSON.parse(raw);
    // Rescale y from whatever field height the canvas was saved on, so every
    // marker keeps its place relative to the lines (end zones are ~18% in all).
    const k = p.v === 3 ? 1 : FIELD.H / (HEIGHT_BY_VERSION[p.v] ?? LEGACY_H);
    const sy = <T extends Point>(pt: T): T => ({ ...pt, y: pt.y * k });
    const cones: Point[] = Array.isArray(p.cones) ? p.cones.map(sy) : [];
    const step = ({ id, note, players, disc }: Partial<Step>): Step => ({
      id: id ?? uid(), note: note ?? "", players: (players ?? []).map(sy), disc: disc ? sy(disc) : null,
    });
    if (p.steps?.length) return { v: 3, steps: p.steps.map(step), cones };
    if (p.players || p.disc) return { v: 3, steps: [step(p)], cones };
    return { v: 3, steps: [emptyStep()], cones };
  } catch {
    return { v: 3, steps: [emptyStep()], cones: [] };
  }
}

export type Box = { x0: number; y0: number; x1: number; y1: number };

// Box-erase: remove everything inside the box as it appears on `stepIdx`.
// Players exist on every step, so one inside the box is removed from all steps;
// the disc is per-step; cones are play-level.
export function eraseInBox(state: CanvasState, stepIdx: number, b: Box): CanvasState {
  const minX = Math.min(b.x0, b.x1), maxX = Math.max(b.x0, b.x1);
  const minY = Math.min(b.y0, b.y1), maxY = Math.max(b.y0, b.y1);
  const inside = (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  const gone = new Set(state.steps[stepIdx]?.players.filter(inside).map((p) => p.id));
  return {
    ...state,
    cones: state.cones.filter((c) => !inside(c)),
    steps: state.steps.map((s, i) => ({
      ...s,
      players: s.players.filter((p) => !gone.has(p.id)),
      disc: i === stepIdx && s.disc && inside(s.disc) ? null : s.disc,
    })),
  };
}
