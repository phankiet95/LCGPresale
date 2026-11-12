import { z } from 'zod'
import { normalizeCustomerName } from '#shared/normalize'

const Body = z.object({
  customerId: z.number().int().positive().nullish(),
  newCustomerName: z.string().trim().max(200).nullish(),
  partnerId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  excludeId: z.number().int().positive().optional(),
})

/** Live duplicate check for the New Opp form (SRS 5.11). */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readValidatedBody(event, Body.parse)
  const db = useDb(event)
  let customerId = body.customerId ?? null
  if (!customerId && body.newCustomerName) {
    const c = await db.query.customers.findFirst({
      where: (t, { eq }) => eq(t.normalizedName, normalizeCustomerName(body.newCustomerName!)),
    })
    customerId = c?.id ?? null
  }
  if (!customerId) return { duplicates: [] }
  return { duplicates: await findDuplicates(db, { customerId, partnerId: body.partnerId, name: body.name, excludeId: body.excludeId }) }
})
