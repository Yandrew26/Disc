# Ultimate Frisbee SaaS — Phase 1 (Foundation) Design

**Date:** 2026-06-23
**Status:** Approved design — ready for implementation planning
**Scope:** Phase 1 only (Foundation). Phases 2 & 3 are roadmap headers.

---

## 1. Product Vision

A multi-tenant SaaS that any ultimate frisbee club or team worldwide can sign up
and use to manage their team. Web-first (responsive), with a native mobile app
(Expo / React Native) planned for a later milestone reusing the same API.

### Full roadmap (sequenced, each phase = its own spec → plan → build cycle)

- **Phase 1 — Foundation (this spec):** Multi-tenant accounts/roles + roster +
  scheduling + attendance/RSVP. A genuinely useful, shippable product on its own.
- **Phase 2 — Game-day stats & lines:** Line management with mixed gender-ratio
  (4:3) tracking, live point/stat tracking, Spirit of the Game scores.
- **Phase 3 — Play / Playbook designer:** Drag-and-drop field play designer and
  shareable playbook (canvas-heavy, its own data model).
- **AI layer (Phase 2+):** Smart lineups, coaching Q&A over stats, post-game
  recaps, NL scheduling. Phase 1 only ensures the schema/architecture won't block
  these — **no AI code in Phase 1.**

---

## 2. Tech Stack (zero-cost, scalable, AI-ready)

| Layer | Choice | Notes |
|---|---|---|
| Language | **TypeScript** | One language for web, backend, and future mobile |
| Framework | **Next.js 15** (App Router) | Frontend + backend in one codebase |
| Backend logic | **TypeScript** via Server Actions + Route Handlers | Route Handlers keep an API shape for the future mobile app |
| Database / Auth / Realtime / Storage | **Supabase** (managed Postgres) | Free tier; RLS for multi-tenancy; pgvector available for later AI |
| ORM | **Drizzle** | Lightweight, typesafe |
| Validation | **Zod** | Shared types at every API boundary |
| Hosting | **Cloudflare Pages** (or Vercel) | Free tier; Cloudflare allows commercial use |
| Future mobile | **Expo / React Native** | Reuses Supabase API + TS types |

**Architecture decision:** Unified TypeScript backend (no separate Java/Python
service). Supabase is infrastructure (DB/auth/storage), not business logic — the
business logic is TypeScript server code. A dedicated Python service can be
extracted later *only if* a compute-heavy feature (e.g. film analysis) demands it.

### Scalability hooks baked in from day one
- **Connection pooling** via Supabase's pooler (transaction mode) — critical for
  serverless + Postgres.
- **Background jobs** via Inngest or Trigger.dev (free tier) for async work
  (reminders, future AI/recaps) so heavy work never blocks a request.
- **Caching / rate-limiting** via Upstash Redis (free tier) when needed.
- Stateless server functions (autoscale), list pagination, indexes on hot paths.

### Cost
$0 to build and launch. ~$10/yr only if a custom domain is wanted. First real
cost (~$25/mo Supabase) appears only past free-tier limits (~500MB DB / 50k users).
AI usage (Phase 2+) is the only variable cost, kept near-zero early via model
tiering (Claude Haiku for routine calls) and caching.

---

## 3. Module Boundaries

Single Next.js app. Five clearly-bounded domain modules, each exposing a typed
interface; UI and other modules call those interfaces, never the DB directly.

1. **identity** — sign in/out, user profile (Supabase Auth)
2. **tenancy** — clubs, memberships, roles, RLS policies (the tenant boundary)
3. **roster** — teams, team members (players)
4. **scheduling** — events, recurrence
5. **attendance** — RSVP / attendance records

Each module is independently testable; internals can change without breaking
consumers.

---

## 4. Data Model

AI-readiness principle: keep the schema normalized and structured so attendance
history, positions, and ratio data are queryable later. Enable the `pgvector`
extension now; add embedding tables only when AI lands.

- **Club** (tenant root): `id`, `name`, `slug`, `created_at`
- **Profile**: `id` (= Supabase auth uid), `name`, `email`, `avatar`
- **ClubMembership**: `user_id`, `club_id`, `role` (`admin`)
- **Team**: `id`, `club_id`, `name`, `division` (`open` | `women` | `mixed`),
  `season`
- **TeamMember** (roster entry): `id`, `team_id`, `user_id` (**nullable** —
  captains can add a player before they sign up, then link on invite acceptance),
  `display_name`, `position` (`handler` | `cutter`), `gender_line` (for mixed
  4:3 ratio — stored now, used by Phase 2 lines & AI), `jersey_number`, `role`
  (`captain` | `player`), `status` (`active` | `inactive`)
- **Event**: `id`, `team_id`, `type` (`practice` | `game` | `tournament` |
  `social`), `title`, `location`, `starts_at`, `ends_at`, `recurrence_rule`
  (RRULE — store the rule, expand on read), `opponent`, `notes`, `created_by`
- **Attendance**: `id`, `event_id`, `team_member_id`, `status` (`going` |
  `not_going` | `maybe` | `no_response`), `note`, `responded_at`

**Invite linking flow:** a TeamMember with `user_id = null` carries an invite
token; when that person signs up, their new Profile is linked to the existing
roster row.

### Suggested indexes
- `Event (team_id, starts_at)`
- `Attendance (event_id)`, unique `(event_id, team_member_id)` for upsert
- `TeamMember (team_id)`, `ClubMembership (club_id)`

---

## 5. Roles & Multi-Tenancy

- **Club admin** → manage club, teams, members
- **Captain** → manage roster + events for their team
- **Player** → view schedule/roster, RSVP

Enforced two ways (defense-in-depth):
1. **App-level permission checks** for good UX and clear errors.
2. **Supabase Row-Level Security** on every table — Postgres itself refuses to
   return rows outside the user's club(s). Even an app-logic bug cannot leak
   another club's data. This is the core reliability guarantee of the product.

Every table carries `club_id` directly or via join; RLS policies scope all
reads/writes to the user's club memberships.

---

## 6. Backend Request Pipeline

Every backend operation (Server Action or Route Handler) flows through:

1. **Authenticate** — Supabase verifies session token → known user
2. **Validate** — Zod checks payload shape → reject bad input early
3. **Authorize** — permission check (role + club/team scope)
4. **Domain logic** — the rule (recurrence expansion, RSVP upsert, invite link)
5. **Persist** — Drizzle reads/writes Postgres
6. **RLS** — Postgres enforces tenant isolation (redundant with step 3 by design)
7. **Respond** — typed result, or a safe user-friendly error (never leak data)

### Key flows
- **Create recurring practice:** auth → validate → authorize captain → store event
  with RRULE → persist → RLS check. Calendar view expands the rule on read.
- **RSVP:** auth → validate → authorize team member → **upsert** attendance
  (changing answer updates, not duplicates) → persist → optional Supabase Realtime
  pushes updated "going" count live.
- **Add unregistered player:** auth → validate roster fields → authorize captain →
  create TeamMember with `user_id = null` + invite token → link Profile on signup.

---

## 7. Error Handling

- **Zod** validation at every API boundary; typed result errors.
- User-friendly messages that never leak tenant data.
- RLS as defense-in-depth even if app-level checks have a bug.
- Auth guard middleware; explicit 401/403 handling.

---

## 8. Testing

- **Vitest** — domain logic units: recurrence expansion, permission checks,
  invite-linking, RSVP upsert.
- **Playwright** — critical E2E flow: sign up → create club/team → add player →
  create event → RSVP.
- **RLS policy tests** — integration against a test Supabase/Postgres DB to prove
  cross-tenant isolation.
- TDD throughout (tests first).

---

## 9. Explicitly Out of Phase 1

- Game-day stats, lines, gender-ratio logic, Spirit scores (Phase 2)
- Play / playbook designer (Phase 3)
- Billing / payments / dues
- Native mobile app
- Any AI features / AI code
- Advanced notifications (email reminders are a Phase 1 *stretch* via Inngest,
  not core)

---

## 10. Assumptions (confirmed during brainstorming)

- Captains can add roster players who are not yet registered users (invite later).
- Recurring practices are needed in v1 (RRULE-based).
- The `mixed` division and `gender_line` field exist from day one even though the
  ratio logic itself ships in Phase 2.
