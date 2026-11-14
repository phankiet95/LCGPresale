/** Create an opportunity (SRS 5.1, duplicate check 5.11). Logic: server/utils/opp-ops.ts (shared with the Excel import). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, CreateFields.parse)
  const db = useDb(event)
  const today = todayJst()
  const settings = await loadSettings(db, today)
  return createOpp(db, user, settings, today, body)
})
