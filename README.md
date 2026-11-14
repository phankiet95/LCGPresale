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
- **S5 Weekly Report** (SRS 7.1): pick a week (‹ › or the list). It has seven sections:
  1. Summary with a last-week column and Δ.
  2. "What changed" counts: new, won, lost, stage up/down, slipped close date, pipeline Δ.
  3. Highlight.
  4. Market health with % Green and % Verified.
  5. Warning list.
  6. Top management concerns, with each opp's changes this week.
  7. Recommendations stored per week and market (Admin, Market Lead and Sales can add them), and Project vs License.
- **S6 Monthly Report** (SRS 7.2): pick a month. It shows:
  - KPIs vs the previous month.
  - 6-month New / Won / Lost charts.
  - Pipeline by week from snapshots.
  - KPI by market and by partner.
  - The O→W funnel with conversion rates, from stage history.
  - Risk lists, plus win/loss with lost reasons.
- **Weekly snapshot** (SRS 5.12): a Cloudflare cron trigger (`5 15 * * SUN` = Monday 00:05 JST) runs
  `server/plugins/weekly-snapshot.ts`. On the Weekly Report, Admin can also take this week's baseline right away.
  - New, Won, Lost, stage moves and close-date slips come from the records, so they work for any week.
  - Last-week columns for open opps, pipeline and weighted need snapshots, so those columns fill in from the first Monday on.
- **Print / PDF** on both reports, with a print stylesheet set to A4 landscape.
- **Motion**: page blocks and cards fade in one after another, numbers count up, bars grow, modals pop and the drawer slides in, with a loading bar between pages.
  All of it switches off when the OS asks for reduced motion.

### Sales-team feedback (2026-11-13)
- **Highlight of the week** replaces SRS 5.7. An open opp is highlighted if either:
  - it was **created in the report period** (previous Thursday < created ≤ report Thursday), or
  - its **revenue is above $200K**.

  The report date is the Thursday on or after today; a past week's report uses that week's Thursday. The code is in `shared/highlight.ts`.
- **Delete** is a soft delete (`deleted_at` + an audit row with the reason). Who can delete: Admin, the Market Lead of that market, or the Sales who own or created the opp.
  Edit and Delete are on every Pipeline row and on the detail page.
- **Date range filter**: choose Expected close, Created or Last update, then a from–to range. It's kept in the URL (`dateBy`, `dateFrom`, `dateTo`).
- **Market chips**: every market is always shown. Markets with no opp are grey, and markets outside the user's scope are greyed out and disabled.
- **New partners**: Intra-mart and Workato, in migration `0002_partners_intramart_workato.sql`.

### Sales-team feedback, round 2
- **One "Update" editor** (`OppUpdateDrawer.vue`) replaces Quick Update and Edit. It has two tabs: "Activity & next step" (activity, next step, stage, win rate) and "All details".
  One Save sends only the changed fields to `PATCH`, plus `POST /activities` when an activity was written.
  Write logic lives in `server/utils/opp-ops.ts`, shared by the endpoints and the Excel import.
  `PATCH` now also accepts `stage` for open opps.
- **Sales owner** is typed as an FPT account (`salesOwnerAccount`), with suggestions. An unknown account becomes an inactive user, as in SRS 8.1.
- **Excel round-trip**: Pipeline → **Export Excel** (the listed opps, a hidden list sheet for drop-downs, and a "How to import" sheet).
  Then **Import Excel** shows a preview and applies it through `POST /api/opportunities/import`.
  - Rows with a code update that opp, only the cells that changed.
  - Rows without a code create a new opp, after a duplicate check.
  - Read-only (grey) columns are ignored, and nothing is ever deleted.
  - The column definitions are in `shared/excel-columns.ts`.
  - exceljs is loaded only on demand.
- **Filters**: Partner, Owner, Stage, Deal type and Health are multi-select (`MultiSelect.vue`).
- **Overview**: a summary strip above the Pipeline table that follows the tab and filters. The detail page has Stage and Team cards.
  `v-tip` shows the full text of any truncated cell on hover.
- **Still open**: "Bidding lead" and what "VI owner" should hold. To confirm with the sales team.

### Decisions worth knowing
- **SPA (`ssr: false`)**: this is an internal tool behind a login, and SPA mode avoids SSR-internal fetches losing the D1 binding.
- The automatic "Stage C → B" Internal activity (SRS 5.8) is stored with `source = 'system'`. It does **not** refresh Latest Update Date, so changing a stage cannot turn an opp Green without a real follow-up.
- Kim's `rules.ts` is used verbatim. The only change is a `!` on one line, needed for strict TypeScript.
- Export is CSV for now (it opens in Excel). The Excel template layout (A–AN) is still to do.

### Not built yet
Excel export of the reports (Print/PDF works) · Kanban · Excel import screen
· master data / FX / threshold screens · opp merge · login rate-limiting · i18n (JA).
