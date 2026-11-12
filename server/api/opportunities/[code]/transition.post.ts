import { eq } from 'drizzle-orm'
import { z } from 'zod'
import * as R from '#shared/rules'

// SRS 5.8 state machine: Won / Lost / On hold / Resume / Reopen. Validation is Kim's rules.validateTransition.
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('won'), closedAt: isoDate, amount: z.number().positive('Won needs the final contract value > 0') }),
  z.object({ action: z.literal('lost'), closedAt: isoDate, lostReason: z.string().trim().min(1, 'Lost reason is required').max(300) }),
  z.object({ action: z.literal('hold'), pendingReason: z.string().trim().min(1, 'On hold reason is required').max(300) }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('reopen'), stage: z.enum(['O', 'D', 'C', 'B', 'A']), reason: z.string().trim().min(1, 'Reopen reason is required').max(300) }),
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { db, today, settings, row, item } = await loadOppByCode(event, user, getRouterParam(event, 'code')!)
  const b = await readValidatedBody(event, Body.parse)
  const o = row.o

  if (b.action === 'reopen') {
    if (!canReopen(user)) throw createError({ statusCode: 403, statusMessage: 'Only Admin / Market Lead can reopen a closed opportunity' })
    if (o.status !== 'Closed') throw createError({ statusCode: 400, statusMessage: 'Opportunity is not closed' })
  }
  else {
    ensureCanEdit(item)
  }
  if (b.action === 'resume' && o.status !== 'On Hold') throw createError({ statusCode: 400, statusMessage: 'Opportunity is not on hold' })
  if (b.action === 'hold' && o.status !== 'Active') throw createError({ statusCode: 400, statusMessage: 'Only an active opportunity can be put on hold' })
  if (b.action === 'won') assertFx(settings, o.currency)

  const t: R.Transition
    = b.action === 'won' ? { stage: 'W', closed_at: b.closedAt, amount: b.amount }
      : b.action === 'lost' ? { stage: 'L', closed_at: b.closedAt, lost_reason: b.lostReason }
        : b.action === 'hold' ? { status: 'On Hold', pending_reason: b.pendingReason }
          : b.action === 'resume' ? { status: 'Active' }
            : { stage: b.stage, reason: b.reason }

  const ruleOpp = toRuleOpp(row)
  const errors = R.validateTransition(ruleOpp, t, user.role)
  if (errors.length) throw createError({ statusCode: 400, statusMessage: errors.join('; ') })
  const { opp: next, history } = R.applyTransition(ruleOpp, t, today)

  const update = {
    stage: next.stage,
    status: next.status,
    stageChangedAt: next.stage_changed_at!,
    statusChangedAt: next.status_changed_at!,
    closedAt: next.closed_at ?? null,
    lostReason: next.lost_reason ?? null,
    pendingReason: next.pending_reason ?? null,
    amount: next.amount,
  }
  const audits = auditRows(o.id, user.id, o as Record<string, unknown>, update)
  const side = history
    ? transitionSideRows(o.id, user.id, today, { stage: o.stage, status: o.status }, { stage: next.stage, status: next.status }, history.reason)
    : null

  await db.batch([
    db.update(tables.opportunities).set({ ...update, updatedAt: new Date().toISOString() }).where(eq(tables.opportunities.id, o.id)),
    ...(side ? [db.insert(tables.stageHistory).values(side.history), db.insert(tables.activities).values(side.activity)] : []),
    ...(audits.length ? [db.insert(tables.auditLog).values(audits)] : []),
  ])
  return { ok: true, stage: next.stage, status: next.status }
})
