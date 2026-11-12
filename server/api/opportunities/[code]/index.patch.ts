import { eq } from 'drizzle-orm'
import { z } from 'zod'

// Field edits. Stage/status changes go through /transition, activities through /activities.
// Editing these fields is NOT an "update" for health (SRS 5.9): latest_update_date is untouched.
const Body = z.object({
  name: z.string().trim().min(1).max(200),
  industry: optText(100),
  marketCode: z.string().length(2),
  countryId: z.number().int().positive().nullable(),
  partnerId: z.number().int().positive(),
  secondaryPartner: optText(100),
  solution: optText(200),
  isLaida: z.boolean(),
  dealType: optText(30),
  salesOwnerId: z.number().int().positive(),
  viOwnerId: z.number().int().positive().nullable(),
  coordinatorId: z.number().int().positive().nullable(),
  amount: z.number().min(0).max(1e13),
  currency: z.string().length(3),
  winRateOverride: z.number().int().min(0).max(100).nullable(),
  winRateReason: optText(300),
  priority: optText(10),
  expectedCloseDate: isoDate,
  nextAction: optText(),
  actionOwnerId: z.number().int().positive().nullable(),
  dueDate: isoDate.nullable(),
  blockingIssue: optText(4000),
  supportNeeded: optText(4000),
  backgroundNote: optText(4000),
  isFocusPinned: z.boolean(),
  verified: z.boolean(),
}).partial()

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { db, settings, row, item } = await loadOppByCode(event, user, getRouterParam(event, 'code')!)
  ensureCanEdit(item)
  const body = await readValidatedBody(event, Body.parse)
  const before = row.o
  const { verified, ...fields } = body

  if (fields.marketCode !== undefined && fields.marketCode !== before.marketCode && user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only Admin can change the market (SRS 5.8)' })
  }
  if (fields.salesOwnerId !== undefined && fields.salesOwnerId !== before.salesOwnerId && !['admin', 'market_lead'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Only Market Lead / Admin can change the sales owner' })
  }
  if (fields.amount !== undefined && before.stage === 'W' && !(fields.amount > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'A won opportunity must keep an amount > 0' })
  }
  if (fields.countryId) {
    const c = await db.query.countries.findFirst({ where: eq(tables.countries.id, fields.countryId) })
    if (!c || c.marketCode !== (fields.marketCode ?? before.marketCode)) {
      throw createError({ statusCode: 400, statusMessage: 'Country does not belong to the market' })
    }
  }
  if (fields.currency) assertFx(settings, fields.currency)
  if (fields.winRateOverride !== undefined) {
    assertWinRateReason(settings, before.stage, fields.winRateOverride, fields.winRateReason ?? before.winRateReason)
  }

  const update: Record<string, unknown> = { ...fields }
  if (verified !== undefined) {
    if (!['admin', 'market_lead'].includes(user.role)) throw createError({ statusCode: 403, statusMessage: 'Only Market Lead / Admin can verify' })
    update.verifiedAt = verified ? new Date().toISOString() : null
    update.verifiedBy = verified ? user.id : null
  }
  const audits = auditRows(before.id, user.id, before as Record<string, unknown>, update)
  if (!audits.length) return { ok: true, changed: 0 }

  await db.batch([
    db.update(tables.opportunities).set({ ...update, updatedAt: new Date().toISOString() }).where(eq(tables.opportunities.id, before.id)),
    db.insert(tables.auditLog).values(audits),
  ])
  return { ok: true, changed: audits.length }
})
