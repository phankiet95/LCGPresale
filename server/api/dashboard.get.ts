import { and, gte, inArray, lte } from 'drizzle-orm'
import * as R from '#shared/rules'
import type { DashboardResponse, OppItem } from '#shared/types'
import { HEALTH_BUCKET, MARKET_CODES } from '#shared/constants'
import { parseFilterQuery } from '#shared/filters'

/** S1 Dashboard — every number computed server-side on the market-scoped, filtered set (SRS 5.10). */
export default defineEventHandler(async (event): Promise<DashboardResponse> => {
  const user = await requireUser(event)
  const filter = parseFilterQuery(getQuery(event))
  // Market bars always show every visible market, so load without the market filter first.
  const all = await loadOpps(event, user, { ...filter, market: undefined })
  const { today, settings, marketCounts } = all
  const items = filter.market?.length ? all.items.filter(i => filter.market!.includes(i.marketCode)) : all.items
  const open = items.filter(i => i.status !== 'Closed')
  const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100
  const has = (code: R.WarningCode) => open.filter(i => i.warnings.includes(code)).length

  const byMarket = MARKET_CODES.filter(m => user.markets === null || user.markets.includes(m)).map((code) => {
    const o = all.items.filter(i => i.marketCode === code && i.status !== 'Closed')
    return {
      code, count: o.length,
      pipelineUsd: sum(o.map(i => i.amountUsd)), weightedUsd: sum(o.map(i => i.weightedUsd)),
      selected: !filter.market?.length || filter.market.includes(code),
    }
  })

  const partnerMap = new Map<string, { name: string, pipelineUsd: number, weightedUsd: number, count: number }>()
  for (const i of open) {
    const p = partnerMap.get(i.partner) ?? { name: i.partner, pipelineUsd: 0, weightedUsd: 0, count: 0 }
    p.count++
    p.pipelineUsd += i.amountUsd
    p.weightedUsd += i.weightedUsd
    partnerMap.set(i.partner, p)
  }

  const health = { Green: 0, Amber: 0, Red: 0 }
  for (const i of open) {
    const b = HEALTH_BUCKET(i.health)
    if (b !== 'Closed') health[b]++
  }

  const warnCodes: R.WarningCode[] = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']

  // Highlight of the week (SRS 5.7): scheduled key activities / due dates / pinned in [Mon, next Sun]
  const [from, to] = R.highlightWindow(today)
  const db = useDb(event)
  const ids = open.map(i => i.id)
  const acts = ids.length
    ? await db.select({ oppId: tables.activities.oppId, date: tables.activities.activityDate, type: tables.activities.type })
        .from(tables.activities)
        .where(and(inArray(tables.activities.oppId, ids), gte(tables.activities.activityDate, from), lte(tables.activities.activityDate, to)))
    : []
  const codeById = new Map(open.map(i => [i.id, i.oppCode]))
  const ruleActs: R.Activity[] = acts.map(a => ({ opp_code: codeById.get(a.oppId)!, activity_date: a.date, type: a.type, content: '' }))
  const highlights = open
    .map(i => ({
      opp: i,
      reasons: R.highlightReasons({
        opp_code: i.oppCode, name: i.name, customer: i.customer, market_code: i.marketCode, partner: i.partner,
        sales_owner: i.salesOwner, amount: i.amount, currency: i.currency, status: i.status, stage: i.stage,
        due_date: i.dueDate, next_action: i.nextAction, is_focus_pinned: i.isFocusPinned,
      }, ruleActs, today, settings),
    }))
    .filter(h => h.reasons.length)
    .sort((a, b) => a.reasons[0]!.date.localeCompare(b.reasons[0]!.date))

  const top10: OppItem[] = [...open]
    .sort((a, b) => b.amountUsd - a.amountUsd || a.expectedCloseDate.localeCompare(b.expectedCloseDate))
    .slice(0, 10)

  return {
    today,
    marketCounts,
    kpis: {
      totalOpps: items.length,
      openOpps: open.length,
      totalPipelineUsd: sum(open.map(i => i.amountUsd)),
      weightedForecastUsd: sum(open.map(i => i.weightedUsd)),
      withWarnings: open.filter(i => i.warnings.length).length,
      onHoldOver30: has('W2'),
      noUpdateOver14: has('W1'),
      overdueClose: has('W3'),
    },
    byMarket,
    byPartner: [...partnerMap.values()].sort((a, b) => b.pipelineUsd - a.pipelineUsd),
    health,
    warnings: warnCodes.map(code => ({ code, count: has(code) })).filter(w => w.count),
    top10,
    highlights,
  }
})
