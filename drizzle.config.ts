import { defineConfig } from 'drizzle-kit'

// `npm run db:generate` diffs server/database/schema.ts against the last snapshot
// and writes a new plain-SQL migration into server/database/migrations/.
// Those .sql files are the source of truth for the DB structure (also for a future Azure move).
export default defineConfig({
  dialect: 'sqlite',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
})
