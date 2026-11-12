/**
 * Admin: take this week's snapshot now (normally done by the Monday 00:05 JST cron, SRS 5.12).
 * Useful once after go-live so the first week already has a baseline. Existing rows are kept.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  return takeSnapshot(useDb(event))
})
