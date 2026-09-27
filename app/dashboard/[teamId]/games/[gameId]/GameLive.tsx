"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPoint, logTimeout, endGame } from "@/actions/game";
import { tagPointStat } from "@/actions/stat";
import { checkGenderRatio, DEFAULT_MIXED_RATIO, suggestSubs } from "@/domain/lines";
import { describePoint } from "@/domain/game";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type RosterMember = { id: string; label: string; gender: string | null };
type PointRow = { seq: number; side: "O" | "D"; scoredBy: "us" | "them"; linePlayerIds: string[] };
type SavedLineSet = { id: string; name: string; oLine: string[]; dLine: string[] };
type TimeoutRow = { type: "timeout_us" | "timeout_them"; at: string };

export default function GameLive({
  teamId,
  gameId,
  status,
  ourScore,
  theirScore,
  roster,
  pointHistory,
  savedLineSets,
  timeouts,
}: {
  teamId: string;
  gameId: string;
  status: "in_progress" | "final";
  ourScore: number;
  theirScore: number;
  roster: RosterMember[];
  pointHistory: PointRow[];
  savedLineSets: SavedLineSet[];
  timeouts: TimeoutRow[];
}) {
  const router = useRouter();
  const [side, setSide] = useState<"O" | "D">("O");
  const [onField, setOnField] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Post-point quick tag: which point we just recorded, who was on, what step.
  const [tagTarget, setTagTarget] = useState<{ pointId: string; lineIds: string[] } | null>(null);
  const [tagStep, setTagStep] = useState<"goal" | "assist" | "extra">("goal");
  const [extraMode, setExtraMode] = useState<"block" | "turnover">("block");

  const rosterById = useMemo(() => new Map(roster.map((m) => [m.id, m])), [roster]);

  const ratio = checkGenderRatio(
    onField.map((id) => rosterById.get(id)?.gender ?? null),
    DEFAULT_MIXED_RATIO,
  );

  const subOrder = suggestSubs(pointHistory, roster.map((m) => m.id))
    .filter((id) => !onField.includes(id))
    .slice(0, 3);

  function toggleOnField(id: string) {
    setOnField((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }

  function loadLineSet(ls: SavedLineSet) {
    setOnField(side === "O" ? ls.oLine : ls.dLine);
  }

  function score(scoredBy: "us" | "them") {
    const lineIds = [...onField];
    startTransition(async () => {
      const result = await recordPoint(gameId, teamId, { side, scoredBy, linePlayerIds: lineIds });
      setSide((s) => (s === "O" ? "D" : "O")); // possession flips after every point
      setOnField([]);
      if (result && lineIds.length > 0) {
        setTagTarget({ pointId: result.pointId, lineIds });
        setTagStep(scoredBy === "us" ? "goal" : "extra");
      }
      router.refresh(); // pull the new score/point-history server props in
    });
  }

  function tag(memberId: string, type: "goal" | "assist" | "block" | "turnover") {
    if (!tagTarget) return;
    const { pointId } = tagTarget;
    startTransition(async () => {
      await tagPointStat(teamId, pointId, memberId, type);
      router.refresh();
    });
    if (type === "goal") setTagStep("assist");
    else if (type === "assist") setTagStep("extra");
    // block/turnover: stay on "extra" so several can be tagged
  }

  function timeout(type: "timeout_us" | "timeout_them") {
    startTransition(async () => {
      await logTimeout(gameId, teamId, type);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-center gap-6 rounded-xl border bg-muted p-6">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Us</div>
          <div className="min-w-[3ch] text-center text-5xl font-extrabold leading-none">{ourScore}</div>
        </div>
        <div className="text-2xl text-muted-foreground">–</div>
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Them</div>
          <div className="min-w-[3ch] text-center text-5xl font-extrabold leading-none">{theirScore}</div>
        </div>
      </div>

      {status === "final" ? (
        <p className="empty">Game final.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="list-item-desc">Currently on:</span>
            <Button type="button" size="sm" variant={side === "O" ? "default" : "outline"} onClick={() => setSide("O")}>
              O
            </Button>
            <Button type="button" size="sm" variant={side === "D" ? "default" : "outline"} onClick={() => setSide("D")}>
              D
            </Button>
          </div>

          {savedLineSets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedLineSets.map((ls) => (
                <Button key={ls.id} type="button" variant="outline" size="sm" onClick={() => loadLineSet(ls)}>
                  Load {ls.name}
                </Button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {roster.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleOnField(m.id)}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-md border-[1.5px] border-input bg-background px-3 py-2 text-sm transition-colors hover:border-primary",
                  onField.includes(m.id) && (side === "O" ? "border-blue-600 bg-blue-600/10" : "border-red-600 bg-red-600/10"),
                )}
              >
                <span>{m.label}</span>
                <span className="text-[0.7rem] font-bold tracking-wide text-muted-foreground">{onField.includes(m.id) ? "ON" : "—"}</span>
              </button>
            ))}
          </div>

          {!ratio.valid && (
            <p className="rounded-md border border-decline bg-decline/10 px-3 py-2.5 text-[0.8125rem] text-decline">
              ⚠ {ratio.message}
            </p>
          )}

          {subOrder.length > 0 && (
            <p className="list-item-desc">
              Consider subbing in next: {subOrder.map((id) => rosterById.get(id)?.label ?? "?").join(", ")}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="button" className="h-13 flex-1 text-base font-bold" disabled={isPending} onClick={() => score("us")}>
              We scored
            </Button>
            <Button
              type="button"
              className="h-13 flex-1 bg-muted-foreground text-base font-bold text-white hover:bg-muted-foreground/85"
              disabled={isPending}
              onClick={() => score("them")}
            >
              They scored
            </Button>
          </div>

          {tagTarget && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted p-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.8125rem] font-semibold text-muted-foreground">
                  {tagStep === "goal" ? "Who scored?" : tagStep === "assist" ? "Who assisted?" : "Blocks / turnovers this point?"}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTagTarget(null)}>
                  Done
                </Button>
              </div>
              {tagStep === "extra" && (
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant={extraMode === "block" ? "default" : "outline"} onClick={() => setExtraMode("block")}>Block</Button>
                  <Button type="button" size="sm" variant={extraMode === "turnover" ? "default" : "outline"} onClick={() => setExtraMode("turnover")}>Turnover</Button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {tagTarget.lineIds.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => tag(id, tagStep === "extra" ? extraMode : tagStep)}
                  >
                    {rosterById.get(id)?.label ?? "?"}
                  </Button>
                ))}
                {tagStep !== "extra" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setTagStep(tagStep === "goal" ? "assist" : "extra")}>
                    Skip
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => timeout("timeout_us")}>
              Our timeout
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => timeout("timeout_them")}>
              Their timeout
            </Button>
          </div>

          <form action={endGame.bind(null, gameId, teamId)}>
            <Button type="submit" variant="destructive" size="sm">End game</Button>
          </form>
        </>
      )}

      <Separator className="my-3" />
      <h2 className="mb-3">Point history</h2>
      {pointHistory.length === 0 ? (
        <p className="empty">No points yet.</p>
      ) : (
        <ul className="list">
          {[...pointHistory].reverse().map((p) => (
            <li key={p.seq} className="list-row">
              <span className="list-item-title">
                Point {p.seq} · {describePoint(p.side, p.scoredBy)}
              </span>
              <span className="list-item-desc">
                {p.linePlayerIds.length} on the field
              </span>
            </li>
          ))}
        </ul>
      )}

      {timeouts.length > 0 && (
        <>
          <h3 className="mt-4 mb-2">Timeouts</h3>
          <ul className="list">
            {timeouts.map((t, i) => (
              <li key={i} className="list-row py-1.5">
                <span>{t.type === "timeout_us" ? "Us" : "Them"}</span>
                <span className="list-item-desc">
                  {new Date(t.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
