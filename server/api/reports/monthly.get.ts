import { and, gte, lte } from 'drizzle-orm'
import * as R from '#shared/rules'
import type { MonthlyReportResponse, OppItem, SummaryRow } from '#shared/types'
import { MARKET_CODES } from '#shared/constants'
import { parseFilterQuery } from '#shared/filters'

const monthStart = (key: string) => `${key}-01`
const monthEnd = (key: string) => {
  const [y, m] = key.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

/** S6 Monthly Report (SRS 7.2). */
export default defineEventHandler(async (event): Promise<MonthlyReportResponse> => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const filter = parseFilterQuery(query)
  const db = useDb(event)
  const { items, today, marketCounts } = await loadOpps(event, user, filter)

  const thisMonth = today.slice(0, 7)
  const asked = typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month) ? query.month : thisMonth
  const key = asked > thisMonth ? thisMonth : asked
  const start = monthStart(key)
  const end = monthEnd(key)
  const prevKey = shiftMonth(key, -1)

  const ev = periodEvents(items, start, end)
  const prevEv = periodEvents(items, monthStart(prevKey), monthEnd(prevKey))
  const endState = await stateAt(db, items, end, today)
  const prevState = await stateAt(db, items, monthEnd(prevKey), today)
  const pipe = (xs: OppItem[] | null) => (xs ? sum(openOf(xs).map(i => i.amountUsd)) : null)
  const weighted = (xs: OppItem[] | null) => (xs ? sum(openOf(xs).map(i => i.weightedUsd)) : null)

  // KPI by market
  const visible = MARKET_CODES.filter(m => user.markets === null || user.markets.includes(m))
    .filter(m => !filter.market?.length || filter.market.includes(m))
  const byMarket = visible.map((code) => {
    const mine = (xs: OppItem[]) => xs.filter(i => i.marketCode === code)
    const o = endState.items ? openOf(mine(endState.items)) : null
    return {
      code,
      created: mine(ev.created).length,
      won: mine(ev.won).length,
      lost: mine(ev.lost).length,
      wonUsd: sum(mine(ev.won).map(i => i.amountUsd)),
      open: o ? o.length : null,
      pipelineUsd: o ? sum(o.map(i => i.amountUsd)) : null,
    }
  })

  // KPI by partner (open at month end)
  const pm = new Map<string, { name: string, count: number, pipelineUsd: number, winSum: number }>()
  for (const i of openOf(endState.items ?? items)) {
    const g = pm.get(i.partner) ?? { name: i.partner, count: 0, pipelineUsd: 0, winSum: 0 }
    g.count++
    g.pipelineUsd += i.amountUsd
    g.winSum += i.winRate
    pm.set(i.partner, g)
  }
  const byPartner = [...pm.values()]
    .map(g => ({ name: g.name, count: g.count, pipelineUsd: sum([g.pipelineUsd]), avgWinRate: Math.round(g.winSum / g.count) }))
    .sort((a, b) => b.pipelineUsd - a.pipelineUsd)

  // Trend: this month vs last month
  const trend: SummaryRow[] = [
    { key: 'new', label: 'New opps', money: false, current: ev.created.length, previous: prevEv.created.length },
    { key: 'won', label: 'Won', money: false, current: ev.won.length, previous: prevEv.won.length, link: { stage: 'W' } },
    { key: 'wonUsd', label: 'Won value', money: true, current: ev.wonUsd, previous: prevEv.wonUsd },
    { key: 'lost', label: 'Lost', money: false, current: ev.lost.length, previous: prevEv.lost.length, link: { stage: 'L' } },
    { key: 'pipeline', label: 'Pipeline (month end)', money: true, current: pipe(endState.items), previous: pipe(prevState.items) },
    { key: 'weighted', label: 'Weighted (month end)', money: true, current: weighted(endState.items), previous: weighted(prevState.items) },
  ]
  const series = Array.from({ length: 6 }, (_, k) => shiftMonth(key, k - 5)).map((m) => {
    const e = periodEvents(items, monthStart(m), monthEnd(m))
    return { key: m, created: e.created.length, won: e.won.length, lost: e.lost.length, wonUsd: e.wonUsd }
  })

  // Weekly pipeline from snapshots, last ~13 weeks up to month end
  // D1 allows only 100 bound parameters: filter opps in JS instead of `IN (…ids)`.
  const ids = new Set(items.map(i => i.id))
  const from13 = R.addDays(R.weekStart(end), -7 * 12)
  const snaps = ids.size
    ? (await db.select({ w: tables.weeklySnapshots.weekStart, oppId: tables.weeklySnapshots.oppId, status: tables.weeklySnapshots.status, amountUsd: tables.weeklySnapshots.amountUsd, weightedUsd: tables.weeklySnapshots.weightedUsd })
        .from(tables.weeklySnapshots)
        .where(and(gte(tables.weeklySnapshots.weekStart, from13), lte(tables.weeklySnapshots.weekStart, R.addDays(end, 7)))))
        .filter(s => ids.has(s.oppId))
    : []
  const wk = new Map<string, { weekStart: string, pipelineUsd: number, weightedUsd: number }>()
  for (const s of snaps) {
    const g = wk.get(s.w) ?? { weekStart: s.w, pipelineUsd: 0, weightedUsd: 0 }
    if (s.status !== 'Closed') {
      g.pipelineUsd += s.amountUsd
      g.weightedUsd += s.weightedUsd
    }
    wk.set(s.w, g)
  }
  const pipelineWeeks = [...wk.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map(g => ({ ...g, pipelineUsd: sum([g.pipelineUsd]), weightedUsd: sum([g.weightedUsd]) }))

  // Funnel O→D→C→B→A→W from stage_history + current stage (opps created up to month end)
  const cohort = items.filter(i => jstDate(i.createdAt) <= end)
  const cohortIds = new Set(cohort.map(i => i.id))
  const hist = cohort.length
    ? (await db.select({ oppId: tables.stageHistory.oppId, from: tables.stageHistory.fromStage, to: tables.stageHistory.toStage, at: tables.stageHistory.changedAt })
        .from(tables.stageHistory)).filter(h => cohortIds.has(h.oppId))
    : []
  const maxRank = new Map<number, number>()
  const bump = (id: number, s: string | null | undefined) => maxRank.set(id, Math.max(maxRank.get(id) ?? -1, stageRank(s)))
  for (const i of cohort) bump(i.id, i.stage)
  for (const h of hist) {
    if (jstDate(h.at) > end) continue
    bump(h.oppId, h.from)
    bump(h.oppId, h.to)
  }
  const stages = R.STAGE_ORDER
  const reached = stages.map((_, r) => cohort.filter(i => (maxRank.get(i.id) ?? -1) >= r).length)
  const funnel = stages.map((stage, k) => ({
    stage, reached: reached[k]!,
    conversion: k < stages.length - 1 && reached[k] ? Math.round(reached[k + 1]! / reached[k]! * 100) : null,
  }))

  // Risk — current state (as of today)
  const open = openOf(items)
  const stale = (i: OppItem, d: number) => i.daysSinceUpdate === null || i.daysSinceUpdate > d
  const risk = [
    { key: 'stalled30', label: 'Stalled 31–60 days (no update)', opps: open.filter(i => stale(i, 30) && !stale(i, 60)) },
    { key: 'stalled60', label: 'Stalled > 60 days (no update)', opps: open.filter(i => stale(i, 60)) },
    { key: 'onHold30', label: 'On hold > 30 days', opps: open.filter(i => i.warnings.includes('W2')) },
    { key: 'overdue', label: 'Overdue close date', opps: open.filter(i => i.warnings.includes('W3')) },
  ].map(r => ({ ...r, opps: r.opps.sort((a, b) => b.amountUsd - a.amountUsd) }))

  // Win / loss
  const wl = (won: OppItem[], lost: OppItem[]) => ({
    won: won.length, lost: lost.length,
    wonUsd: sum(won.map(i => i.amountUsd)), lostUsd: sum(lost.map(i => i.amountUsd)),
    winRate: won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) : null,
  })
  const ytdFrom = `${key.slice(0, 4)}-01-01`
  const ytdWon = items.filter(i => isWon(i) && inRange(i.closedAt, ytdFrom, end))
  const ytdLost = items.filter(i => isLost(i) && inRange(i.closedAt, ytdFrom, end))
  const rm = new Map<string, { reason: string, count: number, usd: number }>()
  for (const i of ytdLost) {
    const k = i.lostReason?.trim() || '(no reason)'
    const g = rm.get(k) ?? { reason: k, count: 0, usd: 0 }
    g.count++
    g.usd += i.amountUsd
    rm.set(k, g)
  }

  return {
    today,
    month: { key, start, end, isCurrent: key === thisMonth },
    months: Array.from({ length: 12 }, (_, k) => shiftMonth(thisMonth, -k)),
    marketCounts,
    source: endState.source,
    byMarket,
    byPartner,
    trend,
    series,
    pipelineWeeks,
    funnel,
    risk,
    winLoss: {
      month: wl(ev.won, ev.lost),
      ytd: wl(ytdWon, ytdLost),
      reasons: [...rm.values()].map(r => ({ ...r, usd: sum([r.usd]) })).sort((a, b) => b.count - a.count || b.usd - a.usd),
    },
  }
})
