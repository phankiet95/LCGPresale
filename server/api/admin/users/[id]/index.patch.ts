import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'

const Body = UserFields.extend({ isActive: z.boolean() }).partial()

/** Edit role / market scope / profile / active flag. */
export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, Body.parse)
  const db = useDb(event)
  const u = await db.query.users.findFirst({ where: eq(tables.users.id, id) })
  if (!u) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  if (id === admin.id && ((body.role && body.role !== 'admin') || body.isActive === false)) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot remove your own admin role or deactivate yourself' })
  }
  if (body.account && body.account.toLowerCase() !== u.account.toLowerCase()) {
    const clash = await db.query.users.findFirst({
      where: and(sql`lower(${tables.users.account}) = lower(${body.account})`, ne(tables.users.id, id)),
    })
    if (clash) throw createError({ statusCode: 409, statusMessage: 'Account already exists' })
  }

  const { markets, ...fields } = body
  const audits = Object.entries(fields)
    .filter(([k, v]) => (u as Record<string, unknown>)[k] !== v)
    .map(([k, v]) => userAudit(id, admin.id, k, (u as Record<string, unknown>)[k], v))

  const ops: Parameters<typeof db.batch>[0][number][] = [
    db.update(tables.users).set({ ...fields, updatedAt: new Date().toISOString() }).where(eq(tables.users.id, id)),
  ]
  if (markets) {
    const before = (await db.select().from(tables.userMarkets).where(eq(tables.userMarkets.userId, id))).map(r => r.marketCode).sort()
    const scope = await marketScopeRows(db, id, markets)
    ops.push(db.delete(tables.userMarkets).where(eq(tables.userMarkets.userId, id)))
    if (scope.length) ops.push(db.insert(tables.userMarkets).values(scope))
    if (before.join(',') !== scope.map(s => s.marketCode).sort().join(',')) {
      audits.push(userAudit(id, admin.id, 'markets', before, scope.map(s => s.marketCode).sort()))
    }
  }
  if (audits.length) ops.push(db.insert(tables.auditLog).values(audits))
  await db.batch(ops as [typeof ops[number], ...typeof ops])
  return { ok: true }
})
