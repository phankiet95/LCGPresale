import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import type { Role } from '#shared/rules'
import type { SessionUserInfo } from '#shared/types'
import { ALL_MARKET_ROLES } from '#shared/constants'

declare module '#auth-utils' {
  interface User {
    id: number
    account: string
  }
}

/**
 * Loads the logged-in user fresh from the DB on every request, so deactivation,
 * role and market-scope changes take effect immediately (not only at next login).
 */
export async function getCurrentUser(event: H3Event): Promise<SessionUserInfo | null> {
  if (event.context.currentUser !== undefined) return event.context.currentUser
  const session = await getUserSession(event)
  let result: SessionUserInfo | null = null
  if (session.user?.id) {
    const db = useDb(event)
    const u = await db.query.users.findFirst({ where: eq(tables.users.id, session.user.id) })
    if (u && u.isActive && u.passwordHash) {
      const markets = ALL_MARKET_ROLES.includes(u.role)
        ? null
        : (await db.select({ m: tables.userMarkets.marketCode }).from(tables.userMarkets)
            .where(eq(tables.userMarkets.userId, u.id))).map(r => r.m)
      result = {
        id: u.id, account: u.account, displayName: u.displayName, role: u.role,
        markets, mustChangePassword: u.mustChangePassword,
      }
    }
  }
  event.context.currentUser = result
  return result
}

export async function requireUser(event: H3Event, opts: { allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser(event)
  if (!user) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Not logged in' })
  }
  if (user.mustChangePassword && !opts.allowPasswordChange) {
    throw createError({ statusCode: 403, statusMessage: 'PASSWORD_CHANGE_REQUIRED' })
  }
  return user
}

export async function requireRole(event: H3Event, ...roles: Role[]) {
  const user = await requireUser(event)
  if (!roles.includes(user.role)) throw createError({ statusCode: 403, statusMessage: 'Not allowed for your role' })
  return user
}

/** Markets the user may see; null = all. */
export const canSeeMarket = (user: SessionUserInfo, market: string) =>
  user.markets === null || user.markets.includes(market)

export function canCreateIn(user: SessionUserInfo, market: string) {
  if (user.role === 'admin') return true
  if (user.role === 'market_lead' || user.role === 'sales') return canSeeMarket(user, market)
  return false
}

/** SRS §2: who may edit an opp. Management (Q2 default) and Viewer are read-only. */
export function canEditOpp(user: SessionUserInfo, opp: {
  marketCode: string, salesOwnerId: number, viOwnerId: number | null, actionOwnerId: number | null
}) {
  if (user.role === 'admin') return true
  if (!canSeeMarket(user, opp.marketCode)) return false
  if (user.role === 'market_lead') return true
  if (user.role === 'sales') return [opp.salesOwnerId, opp.viOwnerId, opp.actionOwnerId].includes(user.id)
  return false
}

export const canReopen = (user: SessionUserInfo) => user.role === 'admin' || user.role === 'market_lead'

declare module 'h3' {
  interface H3EventContext {
    currentUser?: SessionUserInfo | null
  }
}
