"use client";

import { useState, useRef, useEffect } from "react";
import { savePlayCanvas } from "@/actions/play";
import { Button } from "@/components/ui/button";
import {
  FIELD, eraseInBox, parseCanvas, uid,
  type Box, type CanvasState, type Player, type PlayerType, type Point as Disc, type Step,
} from "@/domain/play";

type Mode = "select" | "addO" | "addD" | "addDisc" | "addCone" | "erase";

const { W: VW, H: VH, EZ, BRICK } = FIELD;

// Brick mark: small ✕ centred on the field width.
function Brick({ y }: { y: number }) {
  const r = 7;
  return (
    <g stroke="white" strokeWidth={2.5} opacity={0.7} style={{ pointerEvents: "none" }}>
      <line x1={VW / 2 - r} y1={y - r} x2={VW / 2 + r} y2={y + r} />
      <line x1={VW / 2 + r} y1={y - r} x2={VW / 2 - r} y2={y + r} />
    </g>
  );
}
const STEP_ANIM = 900; // ms for one step-to-step move
// Markers are drawn in field units, so they'd grow with the field. The field was
// enlarged from 420px to 540px wide; scale markers back so they keep their size.
const K = 420 / 540;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; }

function arrowHead(x1: number, y1: number, x2: number, y2: number, len = 13 * K) {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 0.42;
  // Round: server and browser trig differ in the last digit → hydration mismatch.
  const r = (n: number) => n.toFixed(2);
  return `${r(x2)},${r(y2)} ${r(x2 - len * Math.cos(a - s))},${r(y2 - len * Math.sin(a - s))} ${r(x2 - len * Math.cos(a + s))},${r(y2 - len * Math.sin(a + s))}`;
}

function shortenLine(x1: number, y1: number, x2: number, y2: number, r = 16 * K) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy);
  if (d < r * 2) return { x1, y1, x2, y2 };
  const ratio = (d - r) / d;
  return { x1: x1 + (dx / d) * r, y1: y1 + (dy / d) * r, x2: x1 + dx * ratio, y2: y1 + dy * ratio };
}

// All editor buttons share the app Button (outline, sm); the selected one uses "secondary".
function ToolBtn({ m, label, mode, setMode }: { m: Mode; label: string; mode: Mode; setMode: (m: Mode) => void }) {
  const active = mode === m;
  return (
    <Button onClick={() => setMode(m)} variant={active ? "secondary" : "outline"} size="sm" aria-pressed={active}>
      {label}
    </Button>
  );
}

export default function PlayEditor({
  playId, initialCanvas, canEdit,
}: {
  playId: string; initialCanvas: string; canEdit: boolean;
}) {
  const [state, setState] = useState<CanvasState>(() => parseCanvas(initialCanvas));
  const [savedJSON, setSavedJSON] = useState(() => JSON.stringify(state));
  const dirty = canEdit && JSON.stringify(state) !== savedJSON;

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [stepIdx, setStepIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("select");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [animating, setAnimating] = useState(false);
  const [animPos, setAnimPos] = useState<{ players: Player[]; disc: Disc | null } | null>(null);
  const [animFromIdx, setAnimFromIdx] = useState(0);
  const [animProgress, setAnimProgress] = useState(1);
  const rafRef = useRef<number | null>(null);
  const animStartRef = useRef(0);

  const svgRef = useRef<SVGSVGElement>(null);

  // The step panel pins just under the toolbar, whose height changes as buttons wrap.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarH, setToolbarH] = useState(0);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setToolbarH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dragging = useRef<{ id: string; kind: "player" | "disc"; ox: number; oy: number; moved?: boolean } | null>(null);

  // Undo: snapshot the whole canvas before each edit (not per drag frame).
  // ponytail: full-state snapshots capped at 50; fine for plays this size.
  const [past, setPast] = useState<CanvasState[]>([]);
  const [eraseBox, setEraseBox] = useState<Box | null>(null);
  const noteSnapshotted = useRef(false);
  function commit() { setPast((p) => [...p.slice(-49), state]); }
  function undo() {
    if (animating || past.length === 0) return;
    setState(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }

  const step = state.steps[Math.min(stepIdx, state.steps.length - 1)];
  const atLastStep = stepIdx >= state.steps.length - 1;

  function stopAnimation() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setAnimating(false);
    setAnimPos(null);
    setAnimProgress(1);
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // Step-by-step playback: animate the current step into the next one, then stop there.
  function startAnimation() {
    const steps0 = stateRef.current.steps;
    const fromIdx = Math.min(stepIdx, steps0.length - 1);
    if (fromIdx >= steps0.length - 1) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current); // never run two at once (e.g. Space key repeat)
    setAnimating(true);
    setAnimFromIdx(fromIdx);
    animStartRef.current = performance.now();

    function frame(now: number) {
      const from = stateRef.current.steps[fromIdx];
      const to = stateRef.current.steps[fromIdx + 1];
      // rAF timestamps are frame-start times and can predate performance.now() above.
      const t = Math.min(1, Math.max(0, now - animStartRef.current) / STEP_ANIM);
      if (!from || !to || t >= 1) {
        stopAnimation();
        setStepIdx(Math.min(fromIdx + 1, stateRef.current.steps.length - 1));
        return;
      }
      const progress = easeInOut(t);
      setAnimProgress(progress);
      const players = from.players.map((p) => {
        const np = to.players.find((q) => q.id === p.id);
        return np ? { ...p, x: lerp(p.x, np.x, progress), y: lerp(p.y, np.y, progress) } : p;
      });
      const disc =
        from.disc && to.disc
          ? { x: lerp(from.disc.x, to.disc.x, progress), y: lerp(from.disc.y, to.disc.y, progress) }
          : (to.disc ?? from.disc ?? null);
      setAnimPos({ players, disc });
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
  }

  function toSVG(e: React.MouseEvent | MouseEvent) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = (e as MouseEvent).clientX;
    pt.y = (e as MouseEvent).clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  }

  function patchStep(patch: Partial<Step>) {
    setState((s) => ({
      ...s,
      steps: s.steps.map((st, i) => i === stepIdx ? { ...st, ...patch } : st),
    }));
  }

  function addStep() {
    const prev = state.steps[state.steps.length - 1];
    const newStep: Step = {
      id: uid(), note: "",
      players: prev.players.map((p) => ({ ...p })),
      disc: prev.disc ? { ...prev.disc } : null,
    };
    const nextIdx = state.steps.length;
    commit();
    setState((s) => ({ ...s, steps: [...s.steps, newStep] }));
    setStepIdx(nextIdx);
  }

  function deleteStep(idx: number) {
    if (state.steps.length <= 1) return;
    commit();
    setState((s) => ({ ...s, steps: s.steps.filter((_, i) => i !== idx) }));
    setStepIdx((i) => Math.min(i, state.steps.length - 2));
  }

  function onSVGClick(e: React.MouseEvent) {
    if (animating) return;
    const { x, y } = toSVG(e);
    if (mode === "addO" || mode === "addD") {
      const type: PlayerType = mode === "addO" ? "O" : "D";
      const num = step.players.filter((p) => p.type === type).length + 1;
      const np: Player = { id: uid(), x, y, type, num };
      commit();
      setState((s) => ({
        ...s,
        steps: s.steps.map((st) => ({ ...st, players: [...st.players, { ...np }] })),
      }));
    } else if (mode === "addDisc") {
      commit();
      patchStep({ disc: { x, y } });
      setMode("select");
    } else if (mode === "addCone") {
      commit();
      setState((s) => ({ ...s, cones: [...s.cones, { x, y }] }));
    }
  }

  // Pointer events (not mouse) so dragging works on phones/tablets at the field.
  function startDrag(e: React.PointerEvent, drag: NonNullable<typeof dragging.current>) {
    svgRef.current?.setPointerCapture(e.pointerId);
    dragging.current = drag;
  }

  function onConePointerDown(e: React.PointerEvent, idx: number) {
    if (animating || mode !== "erase") return;
    e.stopPropagation();
    commit();
    setState((s) => ({ ...s, cones: s.cones.filter((_, i) => i !== idx) }));
  }

  function onPlayerPointerDown(e: React.PointerEvent, player: Player) {
    if (animating) return;
    e.stopPropagation();
    if (mode === "erase") {
      commit();
      setState((s) => ({
        ...s,
        steps: s.steps.map((st) => ({ ...st, players: st.players.filter((p) => p.id !== player.id) })),
      }));
      return;
    }
    if (mode === "select") {
      const { x, y } = toSVG(e);
      startDrag(e, { id: player.id, kind: "player", ox: x - player.x, oy: y - player.y });
    }
  }

  function onDiscPointerDown(e: React.PointerEvent) {
    if (animating) return;
    e.stopPropagation();
    if (mode === "erase") { commit(); patchStep({ disc: null }); return; }
    if (mode === "select" && step.disc) {
      const { x, y } = toSVG(e);
      startDrag(e, { id: "disc", kind: "disc", ox: x - step.disc.x, oy: y - step.disc.y });
    }
  }

  // Erase mode: drag on empty field to draw a box; release deletes what's inside.
  // (Item handlers stopPropagation, so tapping a single item still erases just it.)
  function onSVGPointerDown(e: React.PointerEvent) {
    if (animating || mode !== "erase") return;
    const { x, y } = toSVG(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    setEraseBox({ x0: x, y0: y, x1: x, y1: y });
  }

  function onSVGPointerMove(e: React.PointerEvent) {
    if (eraseBox) {
      const { x, y } = toSVG(e);
      setEraseBox({ ...eraseBox, x1: x, y1: y });
      return;
    }
    if (animating || !dragging.current) return;
    const { x, y } = toSVG(e);
    if (!dragging.current.moved) { commit(); dragging.current.moved = true; } // one undo step per drag
    const { id, kind, ox, oy } = dragging.current;
    if (kind === "player") {
      patchStep({ players: step.players.map((p) => p.id === id ? { ...p, x: x - ox, y: y - oy } : p) });
    } else {
      patchStep({ disc: { x: x - ox, y: y - oy } });
    }
  }

  function onSVGPointerUp() {
    dragging.current = null;
    if (!eraseBox) return;
    setEraseBox(null);
    if (Math.abs(eraseBox.x1 - eraseBox.x0) < 4 && Math.abs(eraseBox.y1 - eraseBox.y0) < 4) return; // a tap, not a box
    const next = eraseInBox(state, stepIdx, eraseBox);
    if (JSON.stringify(next) === JSON.stringify(state)) return; // nothing inside → no empty undo step
    commit();
    setState(next);
  }

  async function handleSave() {
    const json = JSON.stringify(state);
    setSaving(true);
    try {
      const res = await savePlayCanvas(playId, json);
      if (res && "error" in res) setSaveError(res.error ?? "Save failed");
      else { setSavedJSON(json); setSaveError(null); }
    } catch {
      setSaveError("Save failed — check your connection");
    }
    setSaving(false);
  }

  // Autosave shortly after edits stop; re-runs if edits land mid-save.
  useEffect(() => {
    if (!dirty || saving || saveError) return;
    const t = setTimeout(handleSave, 1500);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function goToStep(i: number) {
    if (!animating) setStepIdx(Math.max(0, Math.min(state.steps.length - 1, i)));
  }

  // ← → change step, Space plays the next move (or restarts at the end), ⌘/Ctrl+Z undoes (ignored while typing a note,
  // where the textarea's own undo applies).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === " " && t.closest("button")) return; // let Space click the focused button
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); if (canEdit) undo(); }
      else if (e.key === "ArrowLeft") goToStep(stepIdx - 1);
      else if (e.key === "ArrowRight") goToStep(stepIdx + 1);
      else if (e.key === " ") { e.preventDefault(); if (animating) return; if (atLastStep) goToStep(0); else startAnimation(); }
      else return;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const displayPlayers = animPos?.players ?? step.players;
  const displayDisc = animPos?.disc ?? step.disc;
  const activePill = animating ? animFromIdx : stepIdx;
  const cursor = mode === "select" ? "default" : mode === "erase" ? "crosshair" : "copy";

  // Movement lines during animation transition
  const _animFrom = state.steps[animFromIdx];
  const _animTo = state.steps[(animFromIdx + 1) % state.steps.length];
  const animLines = animating && animPos && _animFrom && _animTo
    ? { from: _animFrom, to: _animTo }
    : null;

  // Static movement preview in edit mode (dashed arrows to next step)
  const previewNext = !animating && stepIdx < state.steps.length - 1
    ? state.steps[stepIdx + 1]
    : null;

  const hints: Record<Mode, string> = {
    select: "Drag players or disc — arrows auto-show movement to next step.",
    addO: "Click to place an offense player (blue).",
    addD: "Click to place a defense player (red).",
    addDisc: "Click to place the disc.",
    addCone: "Click to place a cone (shown on every step).",
    erase: "Click an item to remove it, or drag a box to remove everything inside.",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {/* Pinned under the app header so tools stay reachable while scrolling the field. */}
      <div ref={toolbarRef} style={{
        position: "sticky", top: "var(--header-h)", zIndex: 10,
        display: "flex", flexDirection: "column", gap: "0.5rem",
        padding: "0.5rem 0", background: "var(--background)", borderBottom: "1px solid var(--border)",
      }}>
      {canEdit && !animating && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
          <ToolBtn m="select" label="✥ Move" mode={mode} setMode={setMode} />
          <ToolBtn m="addO" label="● O" mode={mode} setMode={setMode} />
          <ToolBtn m="addD" label="○ D" mode={mode} setMode={setMode} />
          <ToolBtn m="addDisc" label="Disc" mode={mode} setMode={setMode} />
          <ToolBtn m="addCone" label="▲ Cone" mode={mode} setMode={setMode} />
          <ToolBtn m="erase" label="✕ Erase" mode={mode} setMode={setMode} />
          <Button onClick={undo} disabled={past.length === 0} variant="outline" size="sm"
            title="Undo (⌘Z / Ctrl+Z)">Undo</Button>
          <div style={{ flex: 1 }} />
          {saveError && (
            <span role="alert" style={{ fontSize: "0.75rem", color: "var(--destructive)" }}>{saveError}</span>
          )}
          <Button onClick={handleSave} disabled={saving || (!dirty && !saveError)} size="sm">
            {saving ? "Saving…" : saveError ? "Retry save" : dirty ? "Save" : "Saved ✓"}
          </Button>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
        <Button onClick={() => goToStep(stepIdx - 1)} disabled={animating || stepIdx === 0}
          variant="outline" size="sm" aria-label="Previous step">◀</Button>
        {state.steps.map((s, i) => (
          <Button key={s.id} onClick={() => goToStep(i)} aria-label={`Step ${i + 1}`}
            aria-current={activePill === i ? "step" : undefined}
            variant={activePill === i ? "secondary" : "outline"} size="sm">
            {i + 1}{s.note ? " ·" : ""}
          </Button>
        ))}
        {canEdit && !animating && (
          <Button onClick={addStep} variant="outline" size="sm" className="border-dashed text-muted-foreground">+ Add step</Button>
        )}
        <Button onClick={() => goToStep(stepIdx + 1)} disabled={animating || stepIdx === state.steps.length - 1}
          variant="outline" size="sm" aria-label="Next step">▶</Button>
        <div style={{ flex: 1 }} />
        {!animating
          ? atLastStep && state.steps.length > 1
            ? <Button onClick={() => goToStep(0)} variant="outline" size="sm">↺ Restart</Button>
            : <Button onClick={startAnimation} disabled={state.steps.length < 2} variant="outline" size="sm"
                title="Animate to the next step (Space)">▶ Play step {stepIdx + 1}→{stepIdx + 2}</Button>
          : <Button disabled variant="outline" size="sm">Playing…</Button>
        }
      </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>

        <div style={{ flex: "0 1 540px", minWidth: 0, borderRadius: "10px", border: "1px solid var(--border)", overflow: "hidden" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VW} ${VH}`}
            style={{ display: "block", width: "100%", height: "auto", cursor, touchAction: "none", userSelect: "none" }}
            onClick={onSVGClick}
            onPointerDown={onSVGPointerDown}
            onPointerMove={onSVGPointerMove}
            onPointerUp={onSVGPointerUp}
            onPointerCancel={onSVGPointerUp}
          >
            {/* Field */}
            <rect x={0} y={0} width={VW} height={VH} fill="#16a34a" />
            <rect x={0} y={0} width={VW} height={EZ} fill="#15803d" />
            <rect x={0} y={VH - EZ} width={VW} height={EZ} fill="#15803d" />
            <rect x={0} y={0} width={VW} height={VH} fill="none" stroke="white" strokeWidth={5} />
            <line x1={0} y1={EZ} x2={VW} y2={EZ} stroke="white" strokeWidth={3} />
            <line x1={0} y1={VH - EZ} x2={VW} y2={VH - EZ} stroke="white" strokeWidth={3} />
            <Brick y={EZ + BRICK} />
            <Brick y={VH - EZ - BRICK} />
            <text x={VW / 2} y={EZ / 2} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={22} fontWeight="bold" opacity={0.35}>END ZONE</text>
            <text x={VW / 2} y={VH - EZ / 2} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={22} fontWeight="bold" opacity={0.35}>END ZONE</text>
            <text x={VW - 8} y={EZ + 40} textAnchor="end" fill="white" fontSize={15} opacity={0.45} fontWeight="bold">▲ attack</text>

            {/* Static preview arrows (edit mode → next step) */}
            {previewNext && step.players.map((p) => {
              const np = previewNext.players.find((q) => q.id === p.id);
              if (!np || (Math.abs(np.x - p.x) < 4 && Math.abs(np.y - p.y) < 4)) return null;
              const ln = shortenLine(p.x, p.y, np.x, np.y);
              const color = p.type === "O" ? "#93c5fd" : "#fca5a5";
              return (
                <g key={p.id} style={{ pointerEvents: "none" }}>
                  <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                    stroke={color} strokeWidth={2.5 * K} strokeDasharray={`${8 * K},${6 * K}`} opacity={0.65} />
                  <polygon points={arrowHead(ln.x1, ln.y1, ln.x2, ln.y2)} fill={color} opacity={0.65} />
                </g>
              );
            })}
            {previewNext && step.disc && previewNext.disc && (() => {
              const { x: dx, y: dy } = step.disc!;
              const { x: nx, y: ny } = previewNext.disc;
              if (Math.abs(nx - dx) < 4 && Math.abs(ny - dy) < 4) return null;
              const ln = shortenLine(dx, dy, nx, ny, 10 * K);
              return (
                <g style={{ pointerEvents: "none" }}>
                  <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                    stroke="#fbbf24" strokeWidth={2.5 * K} strokeDasharray={`${8 * K},${6 * K}`} opacity={0.65} />
                  <polygon points={arrowHead(ln.x1, ln.y1, ln.x2, ln.y2)} fill="#fbbf24" opacity={0.65} />
                </g>
              );
            })()}

            {/* Animated movement lines */}
            {animLines && animLines.from.players.map((p) => {
              const np = animLines.to.players.find((q) => q.id === p.id);
              if (!np || (Math.abs(np.x - p.x) < 4 && Math.abs(np.y - p.y) < 4)) return null;
              const ln = shortenLine(p.x, p.y, np.x, np.y);
              const color = p.type === "O" ? "#93c5fd" : "#fca5a5";
              const pathLen = Math.sqrt((ln.x2 - ln.x1) ** 2 + (ln.y2 - ln.y1) ** 2);
              const tipX = ln.x1 + (ln.x2 - ln.x1) * animProgress;
              const tipY = ln.y1 + (ln.y2 - ln.y1) * animProgress;
              return (
                <g key={p.id} style={{ pointerEvents: "none" }}>
                  <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                    stroke={color} strokeWidth={3.5 * K}
                    strokeDasharray={pathLen}
                    strokeDashoffset={pathLen * (1 - animProgress)} />
                  {animProgress > 0.05 && (
                    <polygon points={arrowHead(ln.x1, ln.y1, tipX, tipY)} fill={color} />
                  )}
                </g>
              );
            })}
            {animLines && (() => {
              const fd = animLines.from.disc, td = animLines.to.disc;
              if (!fd || !td || (Math.abs(td.x - fd.x) < 4 && Math.abs(td.y - fd.y) < 4)) return null;
              const ln = shortenLine(fd.x, fd.y, td.x, td.y, 10 * K);
              const pathLen = Math.sqrt((ln.x2 - ln.x1) ** 2 + (ln.y2 - ln.y1) ** 2);
              const tipX = ln.x1 + (ln.x2 - ln.x1) * animProgress;
              const tipY = ln.y1 + (ln.y2 - ln.y1) * animProgress;
              return (
                <g style={{ pointerEvents: "none" }}>
                  <line x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                    stroke="#fbbf24" strokeWidth={3.5 * K}
                    strokeDasharray={pathLen}
                    strokeDashoffset={pathLen * (1 - animProgress)} />
                  {animProgress > 0.05 && (
                    <polygon points={arrowHead(ln.x1, ln.y1, tipX, tipY)} fill="#fbbf24" />
                  )}
                </g>
              );
            })()}

            {/* Cones */}
            {state.cones.map((c, i) => (
              <g key={i} onPointerDown={(e) => onConePointerDown(e, i)}
                style={{ cursor: mode === "erase" ? "pointer" : undefined }}>
                <circle cx={c.x} cy={c.y} r={18 * K} fill="transparent" />
                <polygon points={`${c.x},${c.y - 11 * K} ${c.x - 10 * K},${c.y + 8 * K} ${c.x + 10 * K},${c.y + 8 * K}`}
                  fill="#f97316" stroke="#c2410c" strokeWidth={2 * K} />
              </g>
            ))}

            {/* Players */}
            {displayPlayers.map((p) => (
              <g key={p.id} onPointerDown={(e) => onPlayerPointerDown(e, p)}
                style={{ cursor: mode === "select" ? "grab" : mode === "erase" ? "pointer" : "crosshair" }}>
                {/* Invisible 44px hit target — larger than the visible circle for touch dragging */}
                <circle cx={p.x} cy={p.y} r={22 * K} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={16 * K}
                  fill={p.type === "O" ? "#2563eb" : "white"}
                  stroke={p.type === "O" ? "#1d4ed8" : "#dc2626"}
                  strokeWidth={3 * K} />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                  fill={p.type === "O" ? "white" : "#dc2626"}
                  fontSize={12 * K} fontWeight="bold"
                  style={{ pointerEvents: "none", userSelect: "none" }}>
                  {p.num}
                </text>
              </g>
            ))}
            {/* Disc — drawn last so it is always on top of players and cones */}
            {displayDisc && (
              <g onPointerDown={onDiscPointerDown}
                style={{ cursor: mode === "select" ? "grab" : mode === "erase" ? "pointer" : "default" }}>
                {/* Invisible 44px hit target — larger than the visible disc for touch dragging */}
                <circle cx={displayDisc.x} cy={displayDisc.y} r={22 * K} fill="transparent" />
                <ellipse cx={displayDisc.x} cy={displayDisc.y} rx={18 * K} ry={9 * K}
                  fill="white" stroke="#9ca3af" strokeWidth={2.5 * K} />
              </g>
            )}
            {/* Erase selection box */}
            {eraseBox && (
              <rect
                x={Math.min(eraseBox.x0, eraseBox.x1)} y={Math.min(eraseBox.y0, eraseBox.y1)}
                width={Math.abs(eraseBox.x1 - eraseBox.x0)} height={Math.abs(eraseBox.y1 - eraseBox.y0)}
                fill="rgba(220,38,38,0.18)" stroke="#dc2626" strokeWidth={2 * K} strokeDasharray={`${6 * K},${4 * K}`}
                style={{ pointerEvents: "none" }}
              />
            )}
          </svg>
        </div>

        {/* Step note + step list follow the field while scrolling, pinned under the toolbar;
            scrolls internally if there are more steps than fit on screen. */}
        <div style={{
          flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: "0.6rem",
          position: "sticky", top: `calc(var(--header-h) + ${toolbarH}px + 0.75rem)`,
          maxHeight: `calc(100vh - var(--header-h) - ${toolbarH}px - 1.5rem)`, overflowY: "auto",
        }}>

          {animating && state.steps[animFromIdx]?.note && (
            <div style={{
              padding: "0.6rem 0.75rem", borderRadius: "8px",
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
              border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--primary)", marginRight: "0.5rem" }}>
                STEP {animFromIdx + 1}
              </span>
              <span style={{ fontSize: "0.85rem" }}>{state.steps[animFromIdx].note}</span>
            </div>
          )}

          {canEdit && !animating && (
            <div>
              <label style={{ fontSize: "0.78rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Step {stepIdx + 1} note
              </label>
              <textarea
                value={step.note}
                onFocus={() => { noteSnapshotted.current = false; }}
                onChange={(e) => {
                  if (!noteSnapshotted.current) { commit(); noteSnapshotted.current = true; } // one undo step per edit session
                  patchStep({ note: e.target.value });
                }}
                placeholder="e.g. O1 cuts deep, handler hits the open lane..."
                rows={2}
                style={{
                  width: "100%", fontSize: "0.78rem", borderRadius: "6px",
                  border: "1px solid var(--border)", padding: "0.4rem",
                  background: "transparent", color: "var(--foreground)", resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {state.steps.map((s, i) => (
              <div key={s.id}
                onClick={() => goToStep(i)}
                style={{
                  padding: "0.4rem 0.65rem", borderRadius: "6px",
                  border: "1.5px solid",
                  borderColor: "var(--border)",
                  background: activePill === i ? "color-mix(in srgb, var(--foreground) 8%, transparent)" : "transparent",
                  cursor: animating ? "default" : "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem",
                }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>Step {i + 1}</div>
                  {s.note && (
                    <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {s.note}
                    </div>
                  )}
                </div>
                {canEdit && !animating && state.steps.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); deleteStep(i); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: "0.75rem" }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {!animating && (
            <p style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", margin: 0 }}>{hints[mode]}</p>
          )}

        </div>
      </div>
    </div>
  );
}
