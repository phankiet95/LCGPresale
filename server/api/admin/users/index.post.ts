import { or, sql } from 'drizzle-orm'

/** Create a user with a generated temporary password (shown once to the Admin). */
export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'admin')
  const body = await readValidatedBody(event, UserFields.parse)
  const db = useDb(event)
  const clash = await db.query.users.findFirst({
    where: or(
      sql`lower(${tables.users.account}) = lower(${body.account})`,
      body.email ? sql`lower(${tables.users.email}) = lower(${body.email})` : undefined,
    ),
  })
  if (clash) throw createError({ statusCode: 409, statusMessage: `Account or email already exists (${clash.account})` })

  const password = generateTempPassword()
  const [created] = await db.insert(tables.users).values({
    account: body.account,
    displayName: body.displayName,
    email: body.email ?? null,
    role: body.role,
    isActive: true,
    passwordHash: await hashUserPassword(password),
    mustChangePassword: true,
  }).returning({ id: tables.users.id })
  const scope = await marketScopeRows(db, created!.id, body.markets)
  await db.batch([
    db.insert(tables.auditLog).values(userAudit(created!.id, admin.id, 'created', null, `${body.account} · ${body.role}`)),
    ...(scope.length ? [db.insert(tables.userMarkets).values(scope)] : []),
  ])
  return { id: created!.id, account: body.account, password }
})
