import { asc, count } from 'drizzle-orm'
import { z } from 'zod'
import type { AdminUser } from '#shared/types'
import { ROLES } from '../database/schema'

export const UserFields = z.object({
  account: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash, underscore only'),
  displayName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(120).nullish().or(z.literal('').transform(() => null)),
  role: z.enum(ROLES),
  markets: z.array(z.string().length(2)).max(20).default([]),
})

export async function listAdminUsers(db: Db): Promise<AdminUser[]> {
  const u = tables.users
  const [rows, scopes, owned] = await Promise.all([
    db.select().from(u).orderBy(asc(u.account)),
    db.select().from(tables.userMarkets),
    db.select({ id: tables.opportunities.salesOwnerId, n: count() }).from(tables.opportunities).groupBy(tables.opportunities.salesOwnerId),
  ])
  const ownedBy = new Map(owned.map(o => [o.id, o.n]))
  return rows.map(r => ({
    id: r.id, account: r.account, email: r.email, displayName: r.displayName, role: r.role, isActive: r.isActive,
    hasPassword: !!r.passwordHash, mustChangePassword: r.mustChangePassword, lastLoginAt: r.lastLoginAt,
    markets: scopes.filter(s => s.userId === r.id).map(s => s.marketCode).sort(),
    ownedOpps: ownedBy.get(r.id) ?? 0,
  }))
}

export function userAudit(entityId: number, by: number, field: string, oldValue: unknown, newValue: unknown) {
  const s = (v: unknown) => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v))
  return { entity: 'user', entityId, field, oldValue: s(oldValue), newValue: s(newValue), changedBy: by, changedAt: new Date().toISOString() }
}

export async function marketScopeRows(db: Db, userId: number, markets: string[]) {
  const valid = new Set((await db.select({ code: tables.markets.code }).from(tables.markets)).map(m => m.code))
  const bad = markets.filter(m => !valid.has(m))
  if (bad.length) throw createError({ statusCode: 400, statusMessage: `Unknown market(s): ${bad.join(', ')}` })
  return [...new Set(markets)].map(marketCode => ({ userId, marketCode }))
}
