import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import * as R from '#shared/rules'
import type { SessionUserInfo } from '#shared/types'
import { normalizeCustomerName } from '#shared/normalize'

/**
 * Write operations on one opportunity, shared by the API endpoints and the Excel import,
 * so every path applies the same validation, permissions, audit and SRS 5.8 / 5.9 rules.
 */

type Row = Awaited<ReturnType<typeof loadOppByCode>>['row']
type Batch = Parameters<Db['batch']>[0][number]

export const ACCOUNT_RE = /^(?:[A-Za-z0-9._-]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})$/
const account = z.string().trim().min(2).max(120).regex(ACCOUNT_RE, 'Account must be an FPT account (e.g. SonTV16) or an email')

// ---------------------------------------------------------------- people by account

/**
 * FPT account -> user id. Unknown accounts become an inactive user (same rule as the Excel import, SRS 8.1),
 * so Sales can type the owner's account even when that person has no login yet.
 */
export async function resolveAccount(db: Db, acc: string, opts: { create?: boolean } = {}) {
  const u = await db.query.users.findFirst({ where: sql`lower(${tables.users.account}) = lower(${acc.trim()})` })
  if (u) return { id: u.id, created: false }
  if (opts.create === false) return { id: null, created: false }
  const now = new Date().toISOString()
  const [n] = await db.insert(tables.users).values({
    account: acc.trim(), displayName: acc.trim(), role: 'sales', isActive: false, createdAt: now, updatedAt: now,
  }).returning({ id: tables.users.id })
  return { id: n!.id, created: true }
}

// ---------------------------------------------------------------- edit fields (PATCH)

export const EditFields = z.object({
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
  /** alternative to salesOwnerId: the FPT account typed by the user */
  salesOwnerAccount: account,
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
  /** open stages only; Won / Lost / On hold use /transition */
  stage: z.enum(['O', 'D', 'C', 'B', 'A']),
}).partial()
export type EditInput = z.infer<typeof EditFields>

/** Apply field edits. Not an "update" for health (SRS 5.9): latest_update_date is untouched. Returns #changed fields. */
export async function editOpp(db: Db, user: SessionUserInfo, settings: R.Settings, today: string, row: Row, input: EditInput) {
  const before = row.o
  const { verified, salesOwnerAccount, stage, ...fields } = input

  if (salesOwnerAccount !== undefined) fields.salesOwnerId = (await resolveAccount(db, salesOwnerAccount)).id!
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

  const update: Record<string, unknown> = { ...fields }
  const extra: Batch[] = []

  // Stage change (open stages) — same rule as Quick Update (SRS 5.8): history + system activity
  let newStage = before.stage as R.Stage
  if (stage !== undefined && stage !== before.stage) {
    if (before.status === 'Closed') throw createError({ statusCode: 400, statusMessage: 'Reopen the opportunity before changing its stage' })
    const ruleOpp = toRuleOpp(row)
    const errors = R.validateTransition(ruleOpp, { stage }, user.role)
    if (errors.length) throw createError({ statusCode: 400, statusMessage: errors.join('; ') })
    const { opp: next } = R.applyTransition(ruleOpp, { stage }, today)
    update.stage = next.stage
    update.stageChangedAt = next.stage_changed_at
    newStage = next.stage
    const side = transitionSideRows(before.id, user.id, today, { stage: before.stage, status: before.status }, { stage: next.stage, status: next.status }, null)
    extra.push(db.insert(tables.stageHistory).values(side.history), db.insert(tables.activities).values(side.activity))
  }
  if (fields.winRateOverride !== undefined || stage !== undefined) {
    const raw = fields.winRateOverride !== undefined ? fields.winRateOverride : before.winRateOverride
    const override = raw === settings.defaultWinRate[newStage] ? null : raw
    assertWinRateReason(settings, newStage, override, fields.winRateReason ?? before.winRateReason)
    if (fields.winRateOverride !== undefined) {
      update.winRateOverride = override
      if (override === null) update.winRateReason = null
    }
  }
  if (verified !== undefined) {
    if (!['admin', 'market_lead'].includes(user.role)) throw createError({ statusCode: 403, statusMessage: 'Only Market Lead / Admin can verify' })
    if (verified !== !!before.verifiedAt) {
      update.verifiedAt = verified ? new Date().toISOString() : null
      update.verifiedBy = verified ? user.id : null
    }
  }
  const audits = auditRows(before.id, user.id, before as Record<string, unknown>, update)
  if (!audits.length && !extra.length) return 0
  await db.batch([
    db.update(tables.opportunities).set({ ...update, updatedAt: new Date().toISOString() }).where(eq(tables.opportunities.id, before.id)),
    ...(audits.length ? [db.insert(tables.auditLog).values(audits)] : []),
    ...extra,
  ] as [Batch, ...Batch[]])
  return audits.length
}

// ---------------------------------------------------------------- activity (Quick Update)

export const ActivityFields = z.object({
  type: z.string().trim().min(1).max(30),
  activityDate: isoDate,
  content: z.string().trim().min(1, 'Content is required').max(4000),
  isCustomerFacing: z.boolean().default(false),
  nextAction: optText(),
  actionOwnerId: z.number().int().positive().nullish(),
  dueDate: isoDate.nullish(),
  stage: z.enum(['O', 'D', 'C', 'B', 'A']).optional(),
  winRateOverride: z.number().int().min(0).max(100).nullish(),
  winRateReason: optText(300),
})
export type ActivityInput = z.infer<typeof ActivityFields>

/** 1 activity + next step + optional stage / win rate (SRS 5.9). */
export async function logActivity(db: Db, user: SessionUserInfo, settings: R.Settings, today: string, row: Row, b: ActivityInput) {
  const o = row.o
  const now = new Date().toISOString()
  const oppUpdate: Record<string, unknown> = {}
  // A dated-today-or-earlier activity becomes "latest" if not older than the current latest. Future dates only feed Highlight.
  if (b.activityDate <= today) {
    const prev = await latestPastActivity(db, o.id, today)
    if (!prev || b.activityDate >= prev.date) {
      oppUpdate.latestActivity = b.content
      oppUpdate.latestUpdateDate = b.activityDate
    }
    if (b.isCustomerFacing && (!o.lastContactDate || b.activityDate >= o.lastContactDate)) {
      oppUpdate.lastContactDate = b.activityDate
    }
  }
  if (b.nextAction) oppUpdate.nextAction = b.nextAction
  if (b.actionOwnerId) oppUpdate.actionOwnerId = b.actionOwnerId
  if (b.dueDate) oppUpdate.dueDate = b.dueDate

  const extra: Batch[] = []
  if (b.stage && b.stage !== o.stage) {
    if (o.status === 'Closed') throw createError({ statusCode: 400, statusMessage: 'Reopen the opportunity before changing its stage' })
    const ruleOpp = toRuleOpp(row)
    const errors = R.validateTransition(ruleOpp, { stage: b.stage }, user.role)
    if (errors.length) throw createError({ statusCode: 400, statusMessage: errors.join('; ') })
    const { opp: next } = R.applyTransition(ruleOpp, { stage: b.stage }, today)
    oppUpdate.stage = next.stage
    oppUpdate.stageChangedAt = next.stage_changed_at
    const side = transitionSideRows(o.id, user.id, today, { stage: o.stage, status: o.status }, { stage: next.stage, status: next.status }, null)
    extra.push(db.insert(tables.stageHistory).values(side.history), db.insert(tables.activities).values(side.activity))
  }
  if (b.winRateOverride !== undefined) {
    const stage = (oppUpdate.stage as R.Stage | undefined) ?? o.stage
    const override = b.winRateOverride === settings.defaultWinRate[stage] ? null : b.winRateOverride
    assertWinRateReason(settings, stage, override, b.winRateReason)
    oppUpdate.winRateOverride = override
    oppUpdate.winRateReason = override === null ? null : b.winRateReason
  }

  const audits = auditRows(o.id, user.id, o as Record<string, unknown>, oppUpdate)
  await db.batch([
    db.insert(tables.activities).values({
      oppId: o.id, activityDate: b.activityDate, type: b.type, isCustomerFacing: b.isCustomerFacing, content: b.content,
      nextAction: b.nextAction, actionOwnerId: b.actionOwnerId ?? null, dueDate: b.dueDate ?? null,
      source: 'app', createdBy: user.id, createdAt: now,
    }),
    db.update(tables.opportunities).set({ ...oppUpdate, updatedAt: now }).where(eq(tables.opportunities.id, o.id)),
    ...extra,
    ...(audits.length ? [db.insert(tables.auditLog).values(audits)] : []),
  ])
}

// ---------------------------------------------------------------- create

export const CreateFields = z.object({
  name: z.string().trim().min(1).max(200),
  customerId: z.number().int().positive().nullish(),
  newCustomerName: z.string().trim().max(200).nullish(),
  industry: optText(100),
  marketCode: z.string().length(2),
  countryId: z.number().int().positive(),
  partnerId: z.number().int().positive(),
  secondaryPartner: optText(100),
  solution: optText(200),
  isLaida: z.boolean().default(false),
  dealType: z.string().trim().min(1, 'Deal type is required').max(30),
  salesOwnerId: z.number().int().positive().nullish(),
  salesOwnerAccount: account.nullish(),
  viOwnerId: z.number().int().positive().nullish(),
  coordinatorId: z.number().int().positive().nullish(),
  amount: z.number().min(0).max(1e13),
  currency: z.string().length(3),
  stage: z.enum(['O', 'D', 'C', 'B', 'A']).default('O'),
  winRateOverride: z.number().int().min(0).max(100).nullish(),
  winRateReason: optText(300),
  priority: optText(10),
  expectedCloseDate: isoDate,
  nextAction: optText(),
  actionOwnerId: z.number().int().positive().nullish(),
  dueDate: isoDate.nullish(),
  blockingIssue: optText(4000),
  supportNeeded: optText(4000),
  backgroundNote: optText(4000),
  /** set after the user saw the duplicate warning and chose "save anyway" */
  confirmDuplicate: z.boolean().default(false),
})
export type CreateInput = z.infer<typeof CreateFields>

export async function createOpp(db: Db, user: SessionUserInfo, settings: R.Settings, today: string, body: CreateInput) {
  if (!canCreateIn(user, body.marketCode)) {
    throw createError({ statusCode: 403, statusMessage: `You cannot create opportunities in market ${body.marketCode}` })
  }
  assertFx(settings, body.currency)
  assertWinRateReason(settings, body.stage, body.winRateOverride, body.winRateReason)

  const country = await db.query.countries.findFirst({ where: eq(tables.countries.id, body.countryId) })
  if (!country || country.marketCode !== body.marketCode) {
    throw createError({ statusCode: 400, statusMessage: 'Country does not belong to the selected market' })
  }
  const salesOwnerId = body.salesOwnerAccount ? (await resolveAccount(db, body.salesOwnerAccount)).id! : body.salesOwnerId
  if (!salesOwnerId) throw createError({ statusCode: 400, statusMessage: 'Sales owner is required' })

  // Customer: pick from master, or quick-create (matched by normalised name first — SRS 3.7 / 8.1)
  let customerId = body.customerId ?? null
  let customerIndustry: string | null = null
  if (customerId) {
    const c = await db.query.customers.findFirst({ where: eq(tables.customers.id, customerId) })
    if (!c) throw createError({ statusCode: 400, statusMessage: 'Customer not found' })
    customerIndustry = c.industry
  }
  else if (body.newCustomerName) {
    const normalizedName = normalizeCustomerName(body.newCustomerName)
    const existing = await db.query.customers.findFirst({ where: eq(tables.customers.normalizedName, normalizedName) })
    customerId = existing?.id ?? (await db.insert(tables.customers)
      .values({ name: body.newCustomerName, normalizedName, industry: body.industry })
      .returning({ id: tables.customers.id }))[0]!.id
    customerIndustry = existing?.industry ?? body.industry
  }
  else {
    throw createError({ statusCode: 400, statusMessage: 'Customer is required' })
  }

  if (!body.confirmDuplicate) {
    const duplicates = await findDuplicates(db, { customerId, partnerId: body.partnerId, name: body.name })
    if (duplicates.length) throw createError({ statusCode: 409, statusMessage: 'POSSIBLE_DUPLICATE', data: { duplicates } })
  }

  const oppCode = await nextOppCode(db, Number(today.slice(0, 4)))
  const [created] = await db.insert(tables.opportunities).values({
    oppCode, name: body.name, customerId, industry: body.industry ?? customerIndustry,
    marketCode: body.marketCode, countryId: body.countryId, partnerId: body.partnerId,
    secondaryPartner: body.secondaryPartner, solution: body.solution, isLaida: body.isLaida, dealType: body.dealType,
    salesOwnerId, viOwnerId: body.viOwnerId ?? null, coordinatorId: body.coordinatorId ?? null,
    amount: body.amount, currency: body.currency,
    winRateOverride: body.winRateOverride ?? null, winRateReason: body.winRateReason, priority: body.priority,
    stage: body.stage, status: 'Active', stageChangedAt: today, statusChangedAt: today,
    nextAction: body.nextAction, actionOwnerId: body.actionOwnerId ?? null, dueDate: body.dueDate ?? null,
    expectedCloseDate: body.expectedCloseDate,
    blockingIssue: body.blockingIssue, supportNeeded: body.supportNeeded, backgroundNote: body.backgroundNote,
    createdBy: user.id,
  }).returning({ id: tables.opportunities.id, oppCode: tables.opportunities.oppCode })

  await db.insert(tables.auditLog).values({
    entity: 'opportunity', entityId: created!.id, field: 'created', oldValue: null,
    newValue: `${oppCode} · stage ${body.stage}`, changedBy: user.id,
  })
  return created!
}
