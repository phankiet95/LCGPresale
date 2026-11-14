/**
 * Edit an opportunity's fields (and, for open opps, its stage). Logic lives in server/utils/opp-ops.ts,
 * shared with the Excel import. Won / Lost / On hold go through /transition, activities through /activities.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { db, settings, today, row, item } = await loadOppByCode(event, user, getRouterParam(event, 'code')!)
  ensureCanEdit(item)
  const body = await readValidatedBody(event, EditFields.parse)
  const changed = await editOpp(db, user, settings, today, row, body)
  return { ok: true, changed }
})
