import { eq } from 'drizzle-orm'

/**
 * Generate a new temporary password (shown once). Also activates the user —
 * this is how imported Excel owners (created inactive) get access.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'admin')
  const id = Number(getRouterParam(event, 'id'))
  const db = useDb(event)
  const u = await db.query.users.findFirst({ where: eq(tables.users.id, id) })
  if (!u) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  const password = generateTempPassword()
  await db.batch([
    db.update(tables.users).set({
      passwordHash: await hashUserPassword(password),
      mustChangePassword: true,
      isActive: true,
      updatedAt: new Date().toISOString(),
    }).where(eq(tables.users.id, id)),
    db.insert(tables.auditLog).values(userAudit(id, admin.id, 'password', null, 'reset by admin')),
  ])
  return { account: u.account, password }
})
