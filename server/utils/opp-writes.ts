import { and, desc, eq, isNull, lte, ne } from 'drizzle-orm'
import { z } from 'zod'
import * as R from '#shared/rules'

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
export const optText = (max = 2000) => z.string().trim().max(max).nullish().transform(v => (v ? v : null))

/** SRS 5.11: open opps with same customer + partner and trigram name similarity >= 0.6. */
export async function findDuplicates(db: Db, input: { customerId: number, partnerId: number, name: string, excludeId?: number }) {
  const o = tables.opportunities
  const rows = await db.select({ id: o.id, oppCode: o.oppCode, name: o.name, stage: o.stage })
    .from(o)
    .where(and(eq(o.customerId, input.customerId), eq(o.partnerId, input.partnerId),
      ne(o.status, 'Closed'), isNull(o.deletedAt), isNull(o.mergedIntoId)))
  return rows
    .filter(r => r.id !== input.excludeId)
    .map(r => ({ ...r, similarity: Math.round(R.similarity(r.name, input.name) * 100) / 100 }))
    .filter(r => r.similarity >= 0.6)
}

/** Latest non-system activity on or before today (SRS 5.9). */
export async function latestPastActivity(db: Db, oppId: number, today: string) {
  const a = tables.activities
  const [row] = await db.select({ date: a.activityDate }).from(a)
    .where(and(eq(a.oppId, oppId), lte(a.activityDate, today), ne(a.source, 'system')))
    .orderBy(desc(a.activityDate), desc(a.createdAt)).limit(1)
  return row
}

/** Ensure the plan FX rate exists for the currency in this fiscal year (SRS 5.2: block save otherwise). */
export function assertFx(settings: R.Settings, currency: string) {
  if (settings.fxToUsd[currency] === undefined) {
    throw createError({ statusCode: 400, statusMessage: `No ${currency}→USD plan rate for this fiscal year. Ask an Admin to add it.` })
  }
}

/** Win-rate override differing from the stage default needs a reason (SRS 4.2 / 3.2). */
export function assertWinRateReason(settings: R.Settings, stage: R.Stage, override: number | null | undefined, reason: string | null | undefined) {
  if (override === null || override === undefined) return
  if (override !== settings.defaultWinRate[stage] && !reason) {
    throw createError({ statusCode: 400, statusMessage: 'A reason is required when the win rate differs from the stage default' })
  }
}

/** Builds the side-effect rows of a stage/status change: stage_history + Internal "Stage C → B" activity (SRS 5.8). */
export function transitionSideRows(oppId: number, userId: number, today: string,
  before: { stage: R.Stage, status: R.Status }, after: { stage: R.Stage, status: R.Status }, reason: string | null) {
  const now = new Date().toISOString()
  const history = { oppId, fromStage: before.stage, toStage: after.stage, fromStatus: before.status, toStatus: after.status, reason, changedBy: userId, changedAt: now }
  const parts: string[] = []
  if (before.stage !== after.stage) parts.push(`Stage ${before.stage} → ${after.stage}`)
  if (before.status !== after.status) parts.push(`Status ${before.status} → ${after.status}`)
  // source = 'system': documented choice — it does NOT refresh latest_update_date, otherwise
  // dragging a stage would turn an opp Green without real follow-up (same idea as SRS 5.9).
  const activity = {
    oppId, activityDate: today, type: 'Internal', isCustomerFacing: false,
    content: parts.join(' · ') + (reason ? ` — ${reason}` : ''), source: 'system', createdBy: userId, createdAt: now,
  }
  return { history, activity }
}

export function ensureCanEdit(item: { canEdit: boolean }) {
  if (!item.canEdit) throw createError({ statusCode: 403, statusMessage: 'You cannot edit this opportunity' })
}
