# Ultimate Frisbee Team App

A multi-tenant team hub for ultimate frisbee clubs: rosters, schedule and RSVPs, live game stats, line building, a plays board, practice plans, and shared expenses — in one place instead of group chats and spreadsheets.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 + shadcn/ui · Supabase (Auth, Postgres, Storage) · Drizzle ORM · Vitest

## Features

- **Teams & roster** — create teams, invite members by email, admin/player roles
- **Feed** — announcements and shout-outs
- **Events** — calendar, RSVPs, carpools, photos, practice plans
- **Games** — live scoring, per-point stats, spirit scores, tournaments
- **Lines** — build and save line sets
- **Plays & drills** — plays editor, drill library
- **Stats** — season stats with CSV export
- **Money** — expense splitting and settlements
- **Waivers** — sign and track waivers

## Getting started

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm db:migrate              # apply drizzle/ migrations to your database
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase setup

1. Create a Supabase project.
2. Copy the API URL, anon key, and service-role key (Project Settings → API) and the pooled connection string (Connect) into `.env.local`.
3. Auth → URL Configuration: set the Site URL to `NEXT_PUBLIC_APP_URL` and add `<NEXT_PUBLIC_APP_URL>/auth/callback` to the redirect allow-list (invite emails land there).
4. Create a Storage bucket named `event-photos` (used for event photos).
5. Run `pnpm db:migrate`. Keep RLS **enabled** on all tables: the app reads and writes through its server-side `DATABASE_URL` connection, so no policies are needed and the public anon key can't access table data.

### Environment variables

See [`.env.example`](.env.example). `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are secrets — server only, never `NEXT_PUBLIC_`. Real `.env*` files are git-ignored.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations (uses `DIRECT_URL`, falling back to `DATABASE_URL`) |

## Deploying to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new) (framework preset: Next.js, defaults are fine).
2. Add every variable from `.env.example` in Project → Settings → Environment Variables. Set `NEXT_PUBLIC_APP_URL` to the production URL.
3. Use the **pooled** (port 6543) `DATABASE_URL` — serverless functions need it.
4. Run `pnpm db:migrate` against the production database (from your machine) before the first visit.
5. Deploy, then add the production URL to Supabase's auth redirect allow-list (see above).

Or from the CLI: `npx vercel` (preview) / `npx vercel --prod`.

## Project layout

```
app/            routes (login, auth callback, dashboard/[teamId]/…)
src/actions/    server actions — each re-checks team membership server-side
src/domain/     pure logic + unit tests (stats, lines, debt, roles…)
src/db/         Drizzle schema and client
src/lib/supabase/  browser / server / admin clients
drizzle/        SQL migrations
proxy.ts        auth gate for /dashboard
```
