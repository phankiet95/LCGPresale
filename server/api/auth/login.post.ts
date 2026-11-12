import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const Body = z.object({
  account: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
})

// Used when the account does not exist, so response time does not reveal valid accounts.
const DUMMY_HASH = 'pbkdf2_sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, Body.parse)
  const db = useDb(event)
  const u = await db.query.users.findFirst({
    where: sql`lower(${tables.users.account}) = lower(${body.account})`,
  })
  const ok = await verifyUserPassword(body.password, u?.passwordHash ?? DUMMY_HASH)
  if (!u || !ok || !u.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid account or password' })
  }
  await db.update(tables.users).set({ lastLoginAt: new Date().toISOString() }).where(eq(tables.users.id, u.id))
  await replaceUserSession(event, { user: { id: u.id, account: u.account }, loggedInAt: Date.now() })
  return { mustChangePassword: u.mustChangePassword }
})
