import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Body = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`).max(200),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { allowPasswordChange: true })
  const body = await readValidatedBody(event, Body.parse)
  if (body.newPassword === body.currentPassword) {
    throw createError({ statusCode: 400, statusMessage: 'New password must differ from the current one' })
  }
  const db = useDb(event)
  const u = await db.query.users.findFirst({ where: eq(tables.users.id, user.id) })
  if (!u || !(await verifyUserPassword(body.currentPassword, u.passwordHash))) {
    throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect' })
  }
  await db.update(tables.users).set({
    passwordHash: await hashUserPassword(body.newPassword),
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  }).where(eq(tables.users.id, user.id))
  return { ok: true }
})
