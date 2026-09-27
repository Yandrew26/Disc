"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Two-level team navigation: main tabs across the top, section tabs down the side.
 * `also` lists segments that belong to a group but have no tab of their own
 * (detail routes reached from a list, e.g. /games/[gameId]).
 */
const NAV_GROUPS = [
  {
    id: "team",
    label: "Team",
    tabs: [
      { seg: "", label: "Overview" },
      { seg: "feed", label: "Feed" },
      { seg: "money", label: "Money" },
      { seg: "settings", label: "Settings" },
    ],
    also: ["members"],
  },
  {
    id: "play",
    label: "Play",
    tabs: [
      { seg: "events", label: "Schedule" },
      { seg: "lines", label: "Lines" },
      { seg: "stats", label: "Stats" },
    ],
    also: ["games"],
  },
  {
    id: "playbook",
    label: "Playbook",
    tabs: [
      { seg: "plays", label: "Plays" },
      { seg: "drills", label: "Drills" },
    ],
    also: [],
  },
] as const;

function groupForSegment(seg: string) {
  return (
    NAV_GROUPS.find(
      (g) =>
        g.tabs.some((t) => t.seg === seg) ||
        (g.also as readonly string[]).includes(seg),
    ) ?? NAV_GROUPS[0]
  );
}

export default function DashboardNav({
  userEmail,
  children,
}: {
  userEmail: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean); // ["dashboard", teamId?, sub?, ...]
  const teamId =
    parts[1] && !["new-team", "profile"].includes(parts[1]) ? parts[1] : null;
  const activeSeg = teamId ? (parts[2] ?? "") : null;
  const activeGroup = activeSeg === null ? null : groupForSegment(activeSeg);

  const teamHref = (seg: string) =>
    `/dashboard/${teamId}${seg ? `/${seg}` : ""}`;
  const initial = (userEmail?.[0] ?? "?").toUpperCase();

  return (
    <div className="flex min-h-full flex-col">
      {/* One bar: brand, main tabs, account. Tabs underline against the bar's
          own bottom border so this never reads as two stacked menu bars. */}
      <header className="sticky top-0 z-20 flex h-(--header-h) items-stretch gap-6 border-b bg-background px-6">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center text-[1.0625rem] font-bold tracking-tight text-primary transition-colors hover:text-primary/80"
        >
          Disc
        </Link>

        <nav aria-label="Sections" className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {teamId &&
            NAV_GROUPS.map((g) => {
              const active = g.id === activeGroup?.id;
              return (
                <Link
                  key={g.id}
                  href={teamHref(g.tabs[0].seg)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                    active && "border-primary font-semibold text-foreground",
                  )}
                >
                  {g.label}
                </Link>
              );
            })}
        </nav>

        <div className="flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-full bg-primary text-[0.8125rem] font-bold text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50">
              {initial}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">Profile</Link>
              </DropdownMenuItem>
              <form action={signOut}>
                <DropdownMenuItem variant="destructive" asChild>
                  <button type="submit" className="w-full">Sign out</button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar stretches with the row so its divider never stops mid-page. */}
      <div className="flex flex-1">
        {activeGroup && (
          <aside className="w-(--sidebar-w) shrink-0 border-r">
            <nav
              aria-label={`${activeGroup.label} pages`}
              className="sticky top-(--header-h) flex flex-col gap-0.5 px-3 pt-8 pb-6"
            >
              {activeGroup.tabs.map((t) => (
                <Link
                  key={t.seg}
                  href={teamHref(t.seg)}
                  aria-current={activeSeg === t.seg ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeSeg === t.seg &&
                      "bg-accent font-semibold text-accent-foreground",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          </aside>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
