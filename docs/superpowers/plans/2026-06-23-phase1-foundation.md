# Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the multi-tenant foundation — a Next.js + TypeScript app with a Drizzle/Postgres schema for clubs/profiles/memberships, tested pure domain logic for roles and tenancy, and the validated "create a club" onboarding action.

**Architecture:** Single Next.js 15 (App Router) app. Backend logic is TypeScript (Server Actions + Route Handlers) over Supabase Postgres via Drizzle. Pure domain logic (roles, permissions, validation) lives in framework-free modules so it is unit-testable without a database. Supabase-dependent integration (live auth, RLS enforcement) is split into a later sub-plan that requires a provisioned Supabase project.

**Tech Stack:** TypeScript, Next.js 15, Drizzle ORM, Zod, Vitest, pnpm. (Supabase client + RLS wiring deferred to the integration sub-plan once a Supabase project exists.)

## Global Constraints

- Package manager: **pnpm** (10.x). Node 24.x.
- Language: **TypeScript**, strict mode on.
- Test runner: **Vitest**.
- Every backend operation boundary validates input with **Zod**.
- Roles are exactly: `admin` (club), `captain` (team), `player` (team).
- Tenant root is **Club**; every tenant-scoped row resolves to a `club_id`.
- All work happens inside `ultimate-frisbee-app/`.

---

### Task 1: Scaffold the Next.js + TypeScript project with Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `app/page.tsx`, `app/layout.tsx`, `src/lib/health.ts`, `src/lib/health.test.ts`, `.gitignore`

**Interfaces:**
- Produces: `pnpm test` runs Vitest; `pnpm dev` runs Next.js. Exported `health(): { ok: true }` from `src/lib/health.ts` proves the test pipeline works end to end.

- [ ] **Step 1: Scaffold Next.js**

```bash
cd ultimate-frisbee-app
pnpm dlx create-next-app@latest . --ts --app --src-dir=false --eslint --no-tailwind --import-alias "@/*" --use-pnpm --yes
```
Expected: Next.js files created in the existing folder (keep the `docs/` folder).

- [ ] **Step 2: Add Vitest**

```bash
pnpm add -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 4: Add the test script to `package.json`**

Add to `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 5: Write the failing health test**

`src/lib/health.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { health } from "./health";

describe("health", () => {
  it("reports ok", () => {
    expect(health()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module `./health`.

- [ ] **Step 7: Implement `src/lib/health.ts`**

```ts
export function health(): { ok: true } {
  return { ok: true };
}
```

- [ ] **Step 8: Run tests to verify pass**

Run: `pnpm test`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: Define role & tenancy domain types with permission logic (pure, no DB)

**Files:**
- Create: `src/domain/roles.ts`, `src/domain/roles.test.ts`

**Interfaces:**
- Produces:
  - `type ClubRole = "admin"`
  - `type TeamRole = "captain" | "player"`
  - `canManageClub(role: ClubRole | null): boolean`
  - `canManageTeam(role: TeamRole | null): boolean` (true only for `captain`)
  - `canRsvp(role: TeamRole | null): boolean` (true for `captain` and `player`)

- [ ] **Step 1: Write the failing tests**

`src/domain/roles.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canManageClub, canManageTeam, canRsvp } from "./roles";

describe("permissions", () => {
  it("only club admins manage the club", () => {
    expect(canManageClub("admin")).toBe(true);
    expect(canManageClub(null)).toBe(false);
  });
  it("only captains manage a team", () => {
    expect(canManageTeam("captain")).toBe(true);
    expect(canManageTeam("player")).toBe(false);
    expect(canManageTeam(null)).toBe(false);
  });
  it("captains and players can rsvp; non-members cannot", () => {
    expect(canRsvp("captain")).toBe(true);
    expect(canRsvp("player")).toBe(true);
    expect(canRsvp(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module `./roles`.

- [ ] **Step 3: Implement `src/domain/roles.ts`**

```ts
export type ClubRole = "admin";
export type TeamRole = "captain" | "player";

export function canManageClub(role: ClubRole | null): boolean {
  return role === "admin";
}
export function canManageTeam(role: TeamRole | null): boolean {
  return role === "captain";
}
export function canRsvp(role: TeamRole | null): boolean {
  return role === "captain" || role === "player";
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add role permission domain logic"
```

---

### Task 3: Add Drizzle and define the foundation schema

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema.ts`, `src/db/schema.test.ts`, `.env.local.example`

**Interfaces:**
- Produces Drizzle table objects: `clubs`, `profiles`, `clubMemberships`. Columns per the spec data model. `clubMemberships.role` is a pg enum `club_role` with value `admin`.

- [ ] **Step 1: Install Drizzle**

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

- [ ] **Step 2: Create `.env.local.example`**

```
# Supabase Postgres connection string (pooled, transaction mode)
DATABASE_URL=postgresql://user:pass@host:6543/postgres
```

- [ ] **Step 3: Write the failing schema test**

`src/db/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { clubs, clubMemberships, profiles } from "./schema";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("schema", () => {
  it("clubs has a slug column", () => {
    const cols = getTableConfig(clubs).columns.map((c) => c.name);
    expect(cols).toContain("slug");
  });
  it("club_memberships links user, club and role", () => {
    const cols = getTableConfig(clubMemberships).columns.map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(["user_id", "club_id", "role"]),
    );
  });
  it("profiles keyed by auth uid", () => {
    const cols = getTableConfig(profiles).columns.map((c) => c.name);
    expect(cols).toContain("id");
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module `./schema`.

- [ ] **Step 5: Implement `src/db/schema.ts`**

```ts
import {
  pgTable, uuid, text, timestamp, pgEnum, primaryKey,
} from "drizzle-orm/pg-core";

export const clubRole = pgEnum("club_role", ["admin"]);

export const clubs = pgTable("clubs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = Supabase auth.users.id
  name: text("name"),
  email: text("email"),
  avatar: text("avatar"),
});

export const clubMemberships = pgTable(
  "club_memberships",
  {
    userId: uuid("user_id").notNull(),
    clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
    role: clubRole("role").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.clubId] }) }),
);
```

- [ ] **Step 6: Create `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 7: Run tests to verify pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add Drizzle foundation schema (clubs, profiles, memberships)"
```

---

### Task 4: Validated club-creation input + slug logic (pure)

**Files:**
- Create: `src/domain/club.ts`, `src/domain/club.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createClubInput` — a Zod schema requiring `name` (1–80 chars).
  - `slugify(name: string): string` — lowercase, hyphenated, alphanumeric only.
  - `type CreateClubInput = { name: string }`

- [ ] **Step 1: Install Zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Write the failing tests**

`src/domain/club.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createClubInput, slugify } from "./club";

describe("club input", () => {
  it("rejects empty names", () => {
    expect(createClubInput.safeParse({ name: "" }).success).toBe(false);
  });
  it("accepts valid names", () => {
    expect(createClubInput.safeParse({ name: "Sky Dogs" }).success).toBe(true);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Sky Dogs Ultimate!")).toBe("sky-dogs-ultimate");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot find module `./club`.

- [ ] **Step 4: Implement `src/domain/club.ts`**

```ts
import { z } from "zod";

export const createClubInput = z.object({
  name: z.string().trim().min(1).max(80),
});
export type CreateClubInput = z.infer<typeof createClubInput>;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add club input validation and slugify"
```

---

## Stops here (foundation, locally testable)

The next tasks require a **provisioned Supabase project** (URL + keys) and are
covered by the integration sub-plan:

- Supabase server/browser clients + auth middleware
- `createClub` Server Action (auth → validate via `createClubInput` → insert club
  + `admin` membership in a transaction → revalidate)
- RLS policies migration + cross-tenant isolation integration test
- Minimal UI: sign-in page, create-club page, dashboard listing the user's clubs

**Action required from you:** create a free Supabase project at supabase.com and
provide the project URL, anon key, and pooled `DATABASE_URL`, then we continue
with the integration sub-plan.

## Self-Review notes

- Spec coverage: tenancy data model (clubs/profiles/memberships) ✓; roles ✓;
  Zod validation boundary ✓; Vitest unit tests ✓. RLS, auth, UI, and the
  create-club action are explicitly deferred to the integration sub-plan (gated
  on Supabase provisioning) — documented above, not dropped.
- No placeholders: all code shown in full.
- Type consistency: `ClubRole`/`TeamRole` in roles.ts match `clubRole` pg enum;
  `createClubInput` reused by the future action.
