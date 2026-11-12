import type { OppListResponse } from '#shared/types'
import { parseFilterQuery } from '#shared/filters'

export default defineEventHandler(async (event): Promise<OppListResponse> => {
  const user = await requireUser(event)
  const { today, items, marketCounts } = await loadOpps(event, user, parseFilterQuery(getQuery(event)))
  return { today, items, marketCounts }
})
