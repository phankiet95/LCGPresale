import type { DashboardInsights, OppItem } from '#shared/types'

/**
 * Sales-team dashboard sections (feedback 2026-11-14). All on the filtered, market-scoped opps.
 *  1. Amount by sales stage (open: O, D, C, B, A)
 *  2. Open opps by P&L (market) stacked by stage
 *  3. Deal tiers: Mega >= $10M, Large >= $1M (< $10M)          [open opps]
 *  4. Partner resell / license deals: deal type contains "License", not lost, by partner
 *  5. Platforms: stages A+B (late / "won" side) and C+D+O (open side) by partner
 *  6. Forecast by expected-close month for stages C, D, O
 */
export const OPEN_STAGE_ORDER = ['O', 'D', 'C', 'B', 'A'] as const
export const MEGA_USD = 10_000_000
export const LARGE_USD = 1_000_000

const r2 = (n: number) => Math.round(n * 100) / 100

function byPartner(xs: OppItem[]) {
  const m = new Map<string, { name: string, count: number, amountUsd: number }>()
  for (const i of xs) {
    const g = m.get(i.partner) ?? { name: i.partner, count: 0, amountUsd: 0 }
    g.count++
    g.amountUsd += i.amountUsd
    m.set(i.partner, g)
  }
  return [...m.values()].map(g => ({ ...g, amountUsd: r2(g.amountUsd) })).sort((a, b) => b.amountUsd - a.amountUsd || b.count - a.count)
}

export function computeInsights(items: OppItem[], markets: string[], year: number, today: string): DashboardInsights {
  const open = items.filter(i => i.status !== 'Closed')
  const stageSums = (xs: OppItem[]) => Object.fromEntries(OPEN_STAGE_ORDER.map(s => [s, r2(xs.filter(i => i.stage === s).reduce((a, i) => a + i.amountUsd, 0))])) as Record<(typeof OPEN_STAGE_ORDER)[number], number>

  const byStage = OPEN_STAGE_ORDER.map((stage) => {
    const xs = open.filter(i => i.stage === stage)
    return { stage, count: xs.length, amountUsd: r2(xs.reduce((a, i) => a + i.amountUsd, 0)), weightedUsd: r2(xs.reduce((a, i) => a + i.weightedUsd, 0)) }
  })

  const byPnl = markets.map((code) => {
    const xs = open.filter(i => i.marketCode === code)
    return { code, count: xs.length, amountUsd: r2(xs.reduce((a, i) => a + i.amountUsd, 0)), stages: stageSums(xs) }
  }).sort((a, b) => b.amountUsd - a.amountUsd)

  const tier = (min: number, max: number) => {
    const xs = open.filter(i => i.amountUsd >= min && i.amountUsd < max).sort((a, b) => b.amountUsd - a.amountUsd)
    return { count: xs.length, amountUsd: r2(xs.reduce((a, i) => a + i.amountUsd, 0)), opps: xs.slice(0, 8) }
  }

  const license = items.filter(i => i.stage !== 'L' && /license/i.test(i.dealType ?? ''))

  const months = Array.from({ length: 12 }, (_, k) => `${year}-${String(k + 1).padStart(2, '0')}`)
  const cdo = open.filter(i => ['C', 'D', 'O'].includes(i.stage))
  const monthly = months.map((month) => {
    const xs = cdo.filter(i => i.expectedCloseDate.startsWith(month))
    const st = stageSums(xs)
    return {
      month, count: xs.length,
      amountUsd: r2(xs.reduce((a, i) => a + i.amountUsd, 0)),
      weightedUsd: r2(xs.reduce((a, i) => a + i.weightedUsd, 0)),
      stages: { O: st.O, D: st.D, C: st.C },
      past: month < today.slice(0, 7),
    }
  })
  const years = [...new Set(cdo.map(i => Number(i.expectedCloseDate.slice(0, 4))).concat(Number(today.slice(0, 4))))].sort()

  return {
    byStage,
    byPnl,
    tiers: { mega: { minUsd: MEGA_USD, ...tier(MEGA_USD, Infinity) }, large: { minUsd: LARGE_USD, ...tier(LARGE_USD, MEGA_USD) } },
    resell: { byPartner: byPartner(license), count: license.length, amountUsd: r2(license.reduce((a, i) => a + i.amountUsd, 0)) },
    platforms: {
      late: byPartner(open.filter(i => i.stage === 'A' || i.stage === 'B')),
      early: byPartner(open.filter(i => ['C', 'D', 'O'].includes(i.stage))),
    },
    forecast: { year, years, months: monthly },
  }
}
