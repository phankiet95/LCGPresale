/** Log an activity + next step (+ optional stage / win rate), SRS 5.9. Logic: server/utils/opp-ops.ts. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { db, settings, today, row, item } = await loadOppByCode(event, user, getRouterParam(event, 'code')!)
  ensureCanEdit(item)
  const body = await readValidatedBody(event, ActivityFields.parse)
  await logActivity(db, user, settings, today, row, body)
  return { ok: true }
})
