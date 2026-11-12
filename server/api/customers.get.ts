import { asc, like, or } from 'drizzle-orm'

/** Customer master search for the New Opp form. */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const q = String(getQuery(event).q ?? '').trim()
  const db = useDb(event)
  const c = tables.customers
  return db.select({ id: c.id, name: c.name, nameJa: c.nameJa, industry: c.industry, isStrategic: c.isStrategic })
    .from(c)
    .where(q ? or(like(c.name, `%${q}%`), like(c.nameJa, `%${q}%`)) : undefined)
    .orderBy(asc(c.name))
    .limit(30)
})
