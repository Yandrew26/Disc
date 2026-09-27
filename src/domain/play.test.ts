import { describe, it, expect } from "vitest";
import { parseCanvas, FIELD, eraseInBox } from "./play";

describe("parseCanvas", () => {
  it("returns one empty step for empty or invalid input", () => {
    for (const raw of ["{}", "not json", ""]) {
      const c = parseCanvas(raw);
      expect(c.steps).toHaveLength(1);
      expect(c.steps[0].players).toEqual([]);
      expect(c.cones).toEqual([]);
    }
  });

  it("field matches WFDF proportions (37 m × 100 m, 18 m end zones)", () => {
    expect(FIELD.H / FIELD.W).toBeCloseTo(100 / 37);
    expect(FIELD.EZ / FIELD.H).toBeCloseTo(0.18);
  });

  it("rescales a legacy 1100-tall single-frame canvas to the real field", () => {
    const c = parseCanvas(JSON.stringify({ players: [{ id: "a", x: 1, y: 1100, type: "O", num: 1 }], disc: { x: 3, y: 550 } }));
    expect(c.steps).toHaveLength(1);
    expect(c.steps[0].players[0]).toMatchObject({ id: "a", x: 1 });
    expect(c.steps[0].players[0].y).toBeCloseTo(FIELD.H);
    expect(c.steps[0].disc!.y).toBeCloseTo(FIELD.H / 2);
  });

  it("rescales v2 (880-tall) canvases and legacy cones, strips routes", () => {
    const c = parseCanvas(JSON.stringify({
      v: 2, steps: [{ id: "s1", note: "go", players: [], disc: { x: 0, y: 440 }, routes: [1] }], cones: [{ x: 5, y: 880 }],
    }));
    expect(c.steps[0]).toMatchObject({ id: "s1", note: "go", players: [] });
    expect(c.steps[0]).not.toHaveProperty("routes");
    expect(c.steps[0].disc!.y).toBeCloseTo(FIELD.H / 2);
    expect(c.cones[0].y).toBeCloseTo(FIELD.H);
  });

  it("leaves v3 canvases unscaled (round-trips)", () => {
    const v3 = { v: 3, steps: [{ id: "s", note: "", players: [{ id: "a", x: 1, y: 500, type: "O", num: 1 }], disc: null }], cones: [] };
    expect(parseCanvas(JSON.stringify(v3))).toEqual(v3);
  });
});

describe("eraseInBox", () => {
  const p = (id: string, x: number, y: number) => ({ id, x, y, type: "O" as const, num: 1 });
  const state = {
    v: 3 as const,
    cones: [{ x: 10, y: 10 }, { x: 500, y: 500 }],
    steps: [
      { id: "s1", note: "", players: [p("a", 20, 20), p("b", 300, 300)], disc: { x: 25, y: 25 } },
      { id: "s2", note: "", players: [p("a", 900, 900), p("b", 30, 30)], disc: { x: 30, y: 30 } },
    ],
  };

  it("removes items inside the box on the current step (players from every step)", () => {
    const out = eraseInBox(state, 0, { x0: 50, y0: 50, x1: 0, y1: 0 }); // box drawn in any direction
    expect(out.cones).toEqual([{ x: 500, y: 500 }]);
    expect(out.steps[0].players.map((q) => q.id)).toEqual(["b"]);
    expect(out.steps[1].players.map((q) => q.id)).toEqual(["b"]); // "a" gone everywhere
    expect(out.steps[0].disc).toBeNull();
    expect(out.steps[1].disc).toEqual({ x: 30, y: 30 }); // other step's disc untouched
  });
});
