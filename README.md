# LCG Opportunity Management

Web tool that replaces the "LCG Opportunity Management" Excel file (SRS v0.1, `../requirement/`).
Nuxt 4 + Cloudflare Workers + **Cloudflare D1 (SQLite)**, Drizzle ORM, username/password login.

## Run locally

```bash
npm install
cp .env.example .env                 # then put a random 32+ char string in NUXT_APP_SECRET
npm run db:migrate:local             # create tables + master data in .wrangler/state (local SQLite)
npm run db:seed:local                # 51 opps + 48 activities from Kim's seed_opportunities.json
npm run user:create -- admin --role admin --name "Administrator"   # prints a temporary password
npm run dev                          # http://localhost:3000
```

Log in as `admin`, set your own password, then create users in **Admin**.

- `npm test`: Kim's 16 business-rule tests (`tests/rules.test.ts`), run against `shared/rules.ts`.
- `npm run typecheck`.
- To use the **real D1 in Cloudflare** during `npm run dev`, add `"remote": true` to the D1 binding in
  `wrangler.jsonc`. ⚠️ That reads and writes real data, so point it at a separate dev database.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create lcg-opp-db            # copy the database_id into wrangler.jsonc
npm run db:migrate:remote
npm run db:seed:remote                       # once, only on an empty DB
npm run user:create -- admin --role admin --name "Administrator" --remote
npx wrangler secret put NUXT_APP_SECRET      # random 32+ chars
npm run deploy
```

Custom domain: Workers & Pages → the worker → Settings → Domains & Routes (the domain must be on Cloudflare DNS).
Backups: `npm run db:export:remote` writes a full SQL dump (D1 also has Time Travel: 30-day point-in-time restore).

## Database & migrations (portable on purpose)

- Schema source: `server/database/schema.ts`. **Migrations: `server/database/migrations/*.sql`** (plain SQL, committed).
- Change the schema → `npm run db:generate` → review the new `.sql` → `db:migrate:local` / `db:migrate:remote`.
- Hand-written data migrations: `npx drizzle-kit generate --custom --name=<name>`.

Rules that keep a later move to **Azure SQL / Azure PostgreSQL** mechanical:

| Concept | SQLite / D1 (now) | PostgreSQL | Azure SQL |
| --- | --- | --- | --- |
| Auto id | `INTEGER PRIMARY KEY AUTOINCREMENT` | `serial` / identity | `INT IDENTITY` |
| Date | `TEXT 'YYYY-MM-DD'` | `date` | `date` |
| Timestamp | `TEXT` ISO-8601 UTC (set by the app) | `timestamptz` | `datetime2` |
| Boolean | `INTEGER 0/1` | `boolean` | `bit` |
| Enum | `TEXT` + `CHECK (x IN (...))` | same, or enum type | same |
| Money | `REAL` | `numeric(15,2)` | `decimal(15,2)` |
| JSON | `TEXT` | `jsonb` | `nvarchar(max)` |
| Case-insensitive unique | index on `lower(account)` | same | computed column + index |

No triggers, views or DB-specific functions: all business logic lives in TypeScript (`shared/rules.ts`, `server/`).
Moving later means: export (`db:export:remote`), translate the DDL with the table above (or point drizzle-kit
at a `pg` schema), load the data, and swap `drizzle-orm/d1` for the Postgres / MSSQL driver in `server/utils/db.ts`.

## Roles & market scope (SRS §2)

| Role | Sees | Can edit |
| --- | --- | --- |
| Admin | all markets | everything + users, market change, reopen |
| Management | all markets | read-only |
| Market Lead | assigned markets | any opp there, reopen, verify, change owner |
| Sales / Presales | assigned markets | opps where they are Sales / VI / Action owner; create opps |
| Viewer | assigned markets | read-only |

Market scope is enforced in the SQL query (`server/utils/opportunities.ts`), not only in the UI.
Excel owners imported by the seed start **inactive with no password**. Admin → "Activate + password".

## What is built (this iteration)

- Login with Admin-generated temporary passwords, a forced password change, and 12h sealed-cookie sessions. Hashing is PBKDF2-SHA256 via WebCrypto.
- **Admin · Users & roles**: create, edit role and markets, activate/deactivate, generate a password (shown once), audit log.
- **S1 Dashboard**: 6 KPIs, pipeline by market and partner, health and warnings, Highlight, Top 10. Every number links into Pipeline.
- **S2 Pipeline**: market chips, filters kept in the URL and remembered per user, quick tabs, sortable columns, overdue rows, CSV export.
- **S3 Opportunity detail**: stepper, warnings, KPIs, timeline, details, history (stage + field audit). Won / Lost / On hold / Resume / Reopen ask for their required reason.
- **S4 Quick Update** drawer: from the row button or the `U` key. Follows SRS 5.9.
- **New opportunity**: customer search or quick-create, live duplicate warning (SRS 5.11), atomic OPP-YYYY-NNN numbering.
- **My Actions**.

### Decisions worth knowing
- **SPA (`ssr: false`)**: this is an internal tool behind a login, and SPA mode avoids SSR-internal fetches losing the D1 binding.
- The automatic "Stage C → B" Internal activity (SRS 5.8) is stored with `source = 'system'`. It does **not** refresh Latest Update Date, so changing a stage cannot turn an opp Green without a real follow-up.
- Kim's `rules.ts` is used verbatim. The only change is a `!` on one line, needed for strict TypeScript.
- Export is CSV for now (it opens in Excel). The Excel template layout (A–AN) is still to do.

### Not built yet
Weekly / Monthly reports and the Monday snapshot job (the tables already exist) · Kanban · Excel import screen
· master data / FX / threshold screens · opp merge · login rate-limiting · i18n (JA).
