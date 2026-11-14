import { asc, eq, sql } from 'drizzle-orm'
import type { MetaResponse } from '#shared/types'
import { CURRENCIES } from '#shared/constants'

/** Master data for dropdowns. Markets are limited to the user's scope. */
/** case-insensitive distinct, sorted */
const distinct = (xs: string[]) => [...new Map(xs.map(v => [v.toLowerCase(), v])).values()].sort((a, b) => a.localeCompare(b))

export default defineEventHandler(async (event): Promise<MetaResponse> => {
  const user = await requireUser(event)
  const db = useDb(event)
  const [markets, countries, partners, users, lookups, settings, vis, bls] = await Promise.all([
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
    db.selectDistinct({ v: sql<string>`trim(${tables.opportunities.viOwner})` }).from(tables.opportunities)
      .where(sql`${tables.opportunities.viOwner} IS NOT NULL AND trim(${tables.opportunities.viOwner}) <> '' AND ${tables.opportunities.deletedAt} IS NULL`),
    db.selectDistinct({ v: sql<string>`trim(${tables.opportunities.biddingLead})` }).from(tables.opportunities)
      .where(sql`${tables.opportunities.biddingLead} IS NOT NULL AND trim(${tables.opportunities.biddingLead}) <> '' AND ${tables.opportunities.deletedAt} IS NULL`),
  ])
  const grouped: Record<string, string[]> = {}
  for (const l of lookups) (grouped[l.category] ??= []).push(l.value)
  return {
    markets: markets.filter(m => canSeeMarket(user, m.code)),
    allMarkets: markets.map(m => ({ ...m, inScope: canSeeMarket(user, m.code) })),
    countries,
    partners,
    users,
    lookups: grouped,
    defaultWinRate: settings.defaultWinRate,
    currencies: [...new Set([...Object.keys(settings.fxToUsd), ...CURRENCIES])],
    viOwners: distinct(vis.map(r => r.v)),
    biddingLeads: distinct(bls.map(r => r.v)),
  }
})
