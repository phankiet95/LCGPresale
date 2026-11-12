import { z } from 'zod'
import * as R from '#shared/rules'

/** Add a recommendation to a week (stored per week + market, SRS 7.1 §6). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!canWriteRecommendations(user)) throw createError({ statusCode: 403, statusMessage: 'Not allowed for your role' })
  const body = await readValidatedBody(event, RecommendationFields.extend({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse)
  assertRecommendationMarket(user, body.marketCode)
  const [row] = await useDb(event).insert(tables.weeklyRecommendations).values({
    ...body, weekStart: R.weekStart(body.weekStart), createdBy: user.id,
  }).returning({ id: tables.weeklyRecommendations.id })
  return { id: row!.id }
})
