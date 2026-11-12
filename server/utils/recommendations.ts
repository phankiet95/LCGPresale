import { z } from 'zod'
import type { SessionUserInfo } from '#shared/types'
import { MARKET_CODES } from '#shared/constants'

/** Weekly Recommendations (SRS 7.1 §6): typed in by Admin, Market Leads and Sales/Presales; read-only for Management/Viewer. */
export const canWriteRecommendations = (u: SessionUserInfo) => ['admin', 'market_lead', 'sales'].includes(u.role)

/** Markets the user may file a recommendation under; '' = "All LCG" (Admin only). */
export function recommendationMarkets(u: SessionUserInfo): string[] {
  if (!canWriteRecommendations(u)) return []
  const ms = u.markets === null ? [...MARKET_CODES] : u.markets
  return u.role === 'admin' ? ['', ...ms] : ms
}

export function canEditRecommendation(u: SessionUserInfo, r: { marketCode: string | null, createdBy: number | null }) {
  if (u.role === 'admin') return true
  if (!canWriteRecommendations(u)) return false
  if (r.createdBy === u.id) return true
  return u.role === 'market_lead' && r.marketCode !== null && !!u.markets?.includes(r.marketCode)
}

const optText = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null))

export const RecommendationFields = z.object({
  marketCode: z.string().max(2).nullish().transform(v => (v ? v : null)),
  finding: z.string().trim().min(1, 'Finding is required').max(1000),
  impact: optText(1000),
  recommendation: optText(1000),
  ownerId: z.number().int().positive().nullish().transform(v => v ?? null),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be YYYY-MM-DD').nullish().or(z.literal('').transform(() => null)).transform(v => v ?? null),
})

export function assertRecommendationMarket(u: SessionUserInfo, market: string | null) {
  if (!recommendationMarkets(u).includes(market ?? '')) {
    throw createError({ statusCode: 403, statusMessage: market ? `You cannot add recommendations for ${market}` : 'Only Admin can add an "All LCG" recommendation' })
  }
}
