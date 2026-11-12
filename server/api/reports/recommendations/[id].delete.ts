import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb(event)
  const r = await db.query.weeklyRecommendations.findFirst({ where: eq(tables.weeklyRecommendations.id, id) })
  if (!r) throw createError({ statusCode: 404, statusMessage: 'Recommendation not found' })
  if (!canEditRecommendation(user, r)) throw createError({ statusCode: 403, statusMessage: 'You cannot delete this recommendation' })
  await db.delete(tables.weeklyRecommendations).where(eq(tables.weeklyRecommendations.id, id))
  return { ok: true }
})
