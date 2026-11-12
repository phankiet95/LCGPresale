/// <reference types="@cloudflare/workers-types" />
import type { H3Event } from 'h3'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../database/schema'

export { schema as tables }

/** Drizzle client over the Cloudflare D1 binding "DB" (local SQLite in dev, D1 in production). */
export function useDb(event: H3Event) {
  const binding = (event.context.cloudflare?.env as { DB?: D1Database } | undefined)?.DB
  if (!binding) {
    throw createError({ statusCode: 500, statusMessage: 'D1 binding "DB" is not available. Check wrangler.jsonc.' })
  }
  return drizzle(binding, { schema })
}

export type Db = ReturnType<typeof useDb>
