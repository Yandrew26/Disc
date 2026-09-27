import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPE_BADGE: Record<string, string> = {
  practice: "bg-accent text-accent-foreground",
  game: "bg-maybe/15 text-maybe",
  tournament: "bg-decline/15 text-decline",
};

function MockupShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background shadow-lg shadow-foreground/5">
      <div className="flex h-9 items-center gap-1.5 border-b bg-muted px-3.5">
        <span className="inline-block size-2 rounded-full bg-border" />
        <span className="inline-block size-2 rounded-full bg-border" />
        <span className="inline-block size-2 rounded-full bg-border" />
      </div>
      <div className="flex flex-col px-5 py-4">{children}</div>
    </div>
  );
}

function ScheduleMockup() {
  const events = [
    { type: "practice", title: "Tuesday Training",  date: "Tue Dec 5 · 6:30 PM" },
    { type: "game",     title: "Holiday Classic",   date: "Sat Dec 9 · 10:00 AM" },
    { type: "practice", title: "Thursday Drills",   date: "Thu Dec 14 · 6:30 PM" },
  ];
  return (
    <MockupShell>
      {events.map((e) => (
        <div key={e.title} className="flex items-center gap-2.5 border-b py-2.5 text-sm last:border-b-0 last:pb-0">
          <Badge className={`uppercase ${TYPE_BADGE[e.type]}`}>{e.type}</Badge>
          <span className="flex-1 font-medium">{e.title}</span>
          <span className="whitespace-nowrap text-xs text-muted-foreground">{e.date}</span>
        </div>
      ))}
    </MockupShell>
  );
}

function RosterMockup() {
  const members = [
    { name: "Alex Chen",  role: "captain" },
    { name: "Jordan Kim", role: "player" },
    { name: "Sam Rivera", role: "player" },
    { name: "Morgan Lee", role: "player" },
  ];
  return (
    <MockupShell>
      {members.map((m) => (
        <div key={m.name} className="flex items-center gap-2.5 border-b py-2 text-sm font-medium last:border-b-0 last:pb-0">
          <div className="size-[1.875rem] shrink-0 rounded-full bg-accent" />
          <span className="flex-1">{m.name}</span>
          <Badge className={`uppercase ${m.role === "captain" ? TYPE_BADGE.game : TYPE_BADGE.practice}`}>
            {m.role}
          </Badge>
        </div>
      ))}
    </MockupShell>
  );
}

function RsvpMockup() {
  return (
    <MockupShell>
      <div className="flex items-center gap-2.5 pb-4 text-sm">
        <Badge className={`uppercase ${TYPE_BADGE.practice}`}>practice</Badge>
        <span className="flex-1 font-semibold">Tuesday Training</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button disabled className="border-2 border-going bg-going text-white disabled:opacity-100">Coming</Button>
        <Button disabled variant="outline" className="border-2 border-maybe text-maybe disabled:opacity-100">Late</Button>
        <Button disabled variant="outline" className="border-2 border-decline text-decline disabled:opacity-100">Absent</Button>
      </div>
      <p className="mt-3 text-[0.8125rem] text-muted-foreground">
        8 coming · 2 late · 1 absent
      </p>
    </MockupShell>
  );
}

const features = [
  {
    heading: "Stop hucking dates into the group chat.",
    body: "Create practices, games, and tournaments once. Members see what's coming and can RSVP without digging through messages.",
    visual: <ScheduleMockup />,
  },
  {
    heading: "Know your stack before the pull.",
    body: "Invite players by email. When they join, their profile shows up automatically — name, role, and contact info in one place.",
    visual: <RosterMockup />,
  },
  {
    heading: "RSVP faster than a stall count.",
    body: "One tap: coming, late, or absent. Players respond in seconds. Captains see real attendance counts before every event — no chasing down the group chat.",
    visual: <RsvpMockup />,
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-white">
        <div className="pointer-events-none absolute -right-[8%] -bottom-[28%] w-1/2 max-w-[480px] opacity-10 max-[680px]:-right-[20%] max-[680px]:-bottom-[10%] max-[680px]:w-4/5" aria-hidden="true">
          <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full">
            <circle cx="200" cy="200" r="190" stroke="white" strokeWidth="10" />
            <ellipse cx="200" cy="200" rx="190" ry="64" stroke="white" strokeWidth="5" />
            <circle cx="200" cy="200" r="64" fill="white" opacity="0.5" />
          </svg>
        </div>

        <nav className="relative z-1 mx-auto flex max-w-[1100px] items-center justify-between px-8 py-6 max-[680px]:px-6 max-[680px]:py-5">
          <span className="text-[1.0625rem] font-bold tracking-tight">Disc</span>
          <Button asChild variant="outline" className="border-2 border-white/35 bg-transparent text-white hover:border-white/65 hover:bg-white/10 hover:text-white">
            <Link href="/login">Sign in</Link>
          </Button>
        </nav>

        <div className="relative z-1 mx-auto max-w-[680px] px-8 pt-14 pb-24 text-center max-[680px]:px-6 max-[680px]:pt-10 max-[680px]:pb-20">
          <h1 className="mb-5 text-balance leading-[1.08] font-extrabold tracking-tighter" style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}>
            Bring some discipline<br />to your disc.
          </h1>
          <p className="mx-auto mb-10 max-w-[48ch] leading-relaxed text-white/90" style={{ fontSize: "clamp(1rem, 2vw, 1.125rem)" }}>
            Run your club, not your inbox. Disc handles schedules, rosters, RSVPs, and plays so your team can focus on the game.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-white px-6 text-primary hover:bg-white/90">
              <Link href="/login">Get started free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-2 border-white/35 bg-transparent px-6 text-white hover:border-white/65 hover:bg-white/10 hover:text-white">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <main>
        <div className="mx-auto max-w-[1100px] px-8 py-20 max-[680px]:px-6 max-[680px]:py-12">
          {features.map((f, i) => (
            <div
              key={i}
              className="grid grid-cols-2 items-center gap-16 border-b py-18 first:pt-0 last:border-b-0 last:pb-0 max-[680px]:grid-cols-1 max-[680px]:gap-8 max-[680px]:py-12"
            >
              <div className={i % 2 === 1 ? "max-[680px]:order-1 min-[681px]:order-2" : ""}>
                <h2 className="mb-3.5 text-balance leading-tight font-bold tracking-tight" style={{ fontSize: "clamp(1.375rem, 2.5vw, 1.875rem)" }}>
                  {f.heading}
                </h2>
                <p className="max-w-[38ch] leading-relaxed text-muted-foreground max-[680px]:max-w-none">{f.body}</p>
              </div>
              <div className={i % 2 === 1 ? "max-[680px]:order-2 min-[681px]:order-1" : ""} aria-hidden="true">
                {f.visual}
              </div>
            </div>
          ))}
        </div>

        <section className="bg-muted px-8 py-20 text-center">
          <p className="mx-auto max-w-[560px] text-balance font-semibold tracking-tight leading-normal" style={{ fontSize: "clamp(1.125rem, 2.5vw, 1.5rem)" }}>
            &ldquo;The group chat can&apos;t tell you who&apos;s coming to Thursday practice. Disc can.&rdquo;
          </p>
        </section>

        <section className="bg-primary px-8 py-20 text-center text-white">
          <h2 className="mb-3 text-balance leading-tight font-extrabold tracking-tight" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.625rem)" }}>
            Ready for the pull?
          </h2>
          <p className="mb-8 text-[1.0625rem] leading-relaxed text-white/90">
            Set up your club in minutes. All the discipline, none of the drills. (Okay, the drills are in there too.)
          </p>
          <Button asChild size="lg" className="bg-white px-6 text-primary hover:bg-white/90">
            <Link href="/login">Get started free</Link>
          </Button>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1100px] items-center justify-between border-t px-8 py-7 text-sm text-muted-foreground max-[680px]:flex-col max-[680px]:gap-2 max-[680px]:text-center">
        <span>
          <strong className="font-bold text-foreground">Disc</strong>
          {": Ultimate Team Manager · Discipline, with spirit."}
        </span>
        <span>© 2026</span>
      </footer>
    </>
  );
}
