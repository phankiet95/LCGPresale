/// <reference types="@cloudflare/workers-types" />
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../database/schema'

/**
 * SRS 5.12 — the cron trigger in wrangler.jsonc ("5 15 * * SUN" = Monday 00:05 JST)
 * copies every opp's state into weekly_snapshots for the week that starts today.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:scheduled', async ({ env }) => {
    const binding = (env as { DB?: D1Database }).DB
    if (!binding) return console.error('[weekly-snapshot] D1 binding "DB" missing')
    const r = await takeSnapshot(drizzle(binding, { schema }))
    console.log(`[weekly-snapshot] week ${r.weekStart}: ${r.opps} opps`)
  })
})
