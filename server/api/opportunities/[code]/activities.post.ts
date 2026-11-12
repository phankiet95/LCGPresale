import { eq } from 'drizzle-orm'
import { z } from 'zod'
import * as R from '#shared/rules'

// S4 Quick Update: 1 activity + next step + optional stage / win rate (SRS 5.9, target ≤ 2 min per opp).
const Body = z.object({
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

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { db, settings, today, row, item } = await loadOppByCode(event, user, getRouterParam(event, 'code')!)
  ensureCanEdit(item)
  const b = await readValidatedBody(event, Body.parse)
  const o = row.o
  const now = new Date().toISOString()

  const oppUpdate: Record<string, unknown> = {}
  // 5.9 — a dated-today-or-earlier activity becomes "latest" if it is not older than the current latest
  // (same date: the newest created_at wins, and this one is the newest). Future dates only feed Highlight.
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
  // Next step from the form overwrites the opp's 3 fields when given
  if (b.nextAction) oppUpdate.nextAction = b.nextAction
  if (b.actionOwnerId) oppUpdate.actionOwnerId = b.actionOwnerId
  if (b.dueDate) oppUpdate.dueDate = b.dueDate

  const extra: Parameters<typeof db.batch>[0][number][] = []
  // Optional stage change (open stages only; Won / Lost / On hold use their own buttons)
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
  return { ok: true }
})
