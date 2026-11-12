import { asc, eq } from 'drizzle-orm'
import type { MetaResponse } from '#shared/types'
import { CURRENCIES } from '#shared/constants'

/** Master data for dropdowns. Markets are limited to the user's scope. */
export default defineEventHandler(async (event): Promise<MetaResponse> => {
  const user = await requireUser(event)
  const db = useDb(event)
  const [markets, countries, partners, users, lookups, settings] = await Promise.all([
    db.select({ code: tables.markets.code, name: tables.markets.name }).from(tables.markets)
      .where(eq(tables.markets.isActive, true)).orderBy(asc(tables.markets.sortOrder)),
    db.select({ id: tables.countries.id, marketCode: tables.countries.marketCode, name: tables.countries.name })
      .from(tables.countries).orderBy(asc(tables.countries.name)),
    db.select({ id: tables.partners.id, name: tables.partners.name }).from(tables.partners)
      .where(eq(tables.partners.isActive, true)).orderBy(asc(tables.partners.name)),
    db.select({ id: tables.users.id, account: tables.users.account, displayName: tables.users.displayName, isActive: tables.users.isActive })
      .from(tables.users).orderBy(asc(tables.users.account)),
    db.select().from(tables.lookups).where(eq(tables.lookups.isActive, true)).orderBy(asc(tables.lookups.sortOrder)),
    loadSettings(db, todayJst()),
  ])
  const grouped: Record<string, string[]> = {}
  for (const l of lookups) (grouped[l.category] ??= []).push(l.value)
  return {
    markets: markets.filter(m => canSeeMarket(user, m.code)),
    countries,
    partners,
    users,
    lookups: grouped,
    defaultWinRate: settings.defaultWinRate,
    currencies: [...new Set([...Object.keys(settings.fxToUsd), ...CURRENCIES])],
  }
})
