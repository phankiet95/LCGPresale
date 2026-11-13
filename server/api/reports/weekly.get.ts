import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as R from '#shared/rules'
import type { MarketHealthRow, OppItem, SummaryRow, WeeklyReportResponse } from '#shared/types'
import { HEALTH_BUCKET, MARKET_CODES } from '#shared/constants'
import { parseFilterQuery } from '#shared/filters'

/** S5 Weekly Report (SRS 7.1): the Excel report sections + week-over-week Δ (SRS 5.12). */
export default defineEventHandler(async (event): Promise<WeeklyReportResponse> => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const filter = parseFilterQuery(query)
  const db = useDb(event)
  const { items, today, settings, marketCounts } = await loadOpps(event, user, filter)

  const thisMonday = R.weekStart(today)
  const asked = typeof query.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.week) ? R.weekStart(query.week) : thisMonday
  const start = asked > thisMonday ? thisMonday : asked
  const end = R.addDays(start, 6)
  const prevStart = R.addDays(start, -7)
  const isCurrent = start === thisMonday

  // State at the end of the week (live / next Monday's snapshot) and at its start (this Monday's snapshot)
  const endState = await stateAt(db, items, end, today)
  const startSnap = await loadSnapshot(db, start)
  const startItems = startSnap ? itemsAtSnapshot(items, startSnap) : null
  const stateItems = endState.items ?? items // sections fall back to live data, flagged in `source`
  const open = openOf(stateItems)

  const ev = periodEvents(items, start, end)
  const prevEv = periodEvents(items, prevStart, R.addDays(start, -1))
  const ids = items.map(i => i.id)
  const changes = await changesInPeriod(db, ids, start, end)

  const pipe = (xs: OppItem[] | null) => (xs ? sum(openOf(xs).map(i => i.amountUsd)) : null)
  const weighted = (xs: OppItem[] | null) => (xs ? sum(openOf(xs).map(i => i.weightedUsd)) : null)
  const openCount = (xs: OppItem[] | null) => (xs ? openOf(xs).length : null)
  const endItems = endState.items

  const summary: SummaryRow[] = [
    { key: 'total', label: 'Total opps', money: false, current: ev.totalAtEnd, previous: prevEv.totalAtEnd },
    { key: 'new', label: 'New this week', money: false, current: ev.created.length, previous: prevEv.created.length },
    { key: 'won', label: 'Won this week', money: false, current: ev.won.length, previous: prevEv.won.length, link: { stage: 'W' } },
    { key: 'lost', label: 'Lost this week', money: false, current: ev.lost.length, previous: prevEv.lost.length, link: { stage: 'L' } },
    { key: 'open', label: 'Open opps', money: false, current: openCount(endItems), previous: openCount(startItems) },
    { key: 'pipeline', label: 'Total pipeline', money: true, current: pipe(endItems), previous: pipe(startItems) },
    { key: 'weighted', label: 'Weighted forecast', money: true, current: weighted(endItems), previous: weighted(startItems) },
  ]

  let stageUp = 0
  let stageDown = 0
  for (const m of changes.stageMoves.values()) {
    const a = stageRank(m.first)
    const b = stageRank(m.last)
    if (a >= 0 && b >= 0 && b > a && m.last !== 'W') stageUp++
    if (a >= 0 && b >= 0 && b < a) stageDown++
  }
  const pEnd = pipe(endItems)
  const pStart = pipe(startItems)

  // 2. Highlight — the window is "this week + next" relative to the report week
  const hl = computeHighlights(open, isCurrent ? today : start)

  // 3. Market health
  const visible = MARKET_CODES.filter(m => user.markets === null || user.markets.includes(m))
    .filter(m => !filter.market?.length || filter.market.includes(m))
  const pct = (n: number, d: number) => (d ? Math.round(n / d * 100) : null)
  const marketHealth: MarketHealthRow[] = visible.map((code) => {
    const all = stateItems.filter(i => i.marketCode === code)
    const o = openOf(all)
    return {
      code,
      active: o.filter(i => i.status === 'Active').length,
      onHold: o.filter(i => i.status === 'On Hold').length,
      won: all.filter(isWon).length,
      lost: all.filter(isLost).length,
      pipelineUsd: sum(o.map(i => i.amountUsd)),
      weightedUsd: sum(o.map(i => i.weightedUsd)),
      pctGreen: pct(o.filter(i => HEALTH_BUCKET(i.health) === 'Green').length, o.length),
      pctVerified: pct(o.filter(i => i.verifiedAt).length, o.length),
    }
  })

  // 5. Top management concerns: open > topMgmtUsd, with what changed this week
  const createdIds = new Set(ev.created.map(i => i.id))
  const topMgmt = open.filter(i => i.amountUsd > settings.topMgmtUsd)
    .sort((a, b) => b.amountUsd - a.amountUsd)
    .map((i) => {
      const c = [...(createdIds.has(i.id) ? ['New this week'] : []), ...(changes.out.get(i.id) ?? [])]
      if (i.latestUpdateDate && inRange(i.latestUpdateDate, start, end) && i.latestActivity) c.push(`Update: ${i.latestActivity}`)
      return { opp: i, changes: c }
    })

  // 7. Project vs License
  const dtMap = new Map<string, WeeklyReportResponse['projectVsLicense'][number]>()
  for (const i of stateItems) {
    const k = i.dealType ?? '(not set)'
    const g = dtMap.get(k) ?? { dealType: k, open: 0, pipelineUsd: 0, weightedUsd: 0, wonInWeek: 0 }
    if (i.status !== 'Closed') {
      g.open++
      g.pipelineUsd += i.amountUsd
      g.weightedUsd += i.weightedUsd
    }
    if (isWon(i) && inRange(i.closedAt, start, end)) g.wonInWeek++
    dtMap.set(k, g)
  }

  // 6. Recommendations of this week, for the markets in view (+ "All LCG" rows)
  const rec = tables.weeklyRecommendations
  const ow = alias(tables.users, 'ow')
  const cb = alias(tables.users, 'cb')
  const recRows = await db.select({ r: rec, owner: ow.account, createdBy: cb.account })
    .from(rec).leftJoin(ow, eq(ow.id, rec.ownerId)).leftJoin(cb, eq(cb.id, rec.createdBy))
    .where(and(eq(rec.weekStart, start), or(isNull(rec.marketCode), inArray(rec.marketCode, visible.length ? visible : ['-']))))
    .orderBy(rec.marketCode, desc(rec.id))

  const latest = await db.select({ w: tables.weeklySnapshots.weekStart }).from(tables.weeklySnapshots)
    .orderBy(desc(tables.weeklySnapshots.weekStart)).limit(1)

  const weeks = Array.from({ length: 26 }, (_, k) => R.addDays(thisMonday, -7 * k))

  return {
    today,
    week: { start, end, isCurrent },
    weeks,
    marketCounts,
    source: { end: endState.source, start: !!startSnap, latestSnapshot: latest[0]?.w ?? null },
    summary,
    changes: {
      newOpps: ev.created.length, won: ev.won.length, lost: ev.lost.length, stageUp, stageDown,
      slipped: changes.slipped.size,
      pipelineDeltaUsd: pEnd !== null && pStart !== null ? Math.round((pEnd - pStart) * 100) / 100 : null,
    },
    highlights: hl.items,
    highlightPeriod: hl.period,
    marketHealth,
    warningList: warningList(open),
    topMgmt,
    topMgmtUsd: settings.topMgmtUsd,
    projectVsLicense: [...dtMap.values()].map(g => ({ ...g, pipelineUsd: sum([g.pipelineUsd]), weightedUsd: sum([g.weightedUsd]) }))
      .sort((a, b) => b.pipelineUsd - a.pipelineUsd),
    recommendations: recRows.map(({ r, owner, createdBy }) => ({
      id: r.id, weekStart: r.weekStart, marketCode: r.marketCode, finding: r.finding, impact: r.impact,
      recommendation: r.recommendation, ownerId: r.ownerId, owner, targetDate: r.targetDate, createdBy,
      canEdit: canEditRecommendation(user, r),
    })),
    canAddRecommendation: canWriteRecommendations(user),
    recommendationMarkets: recommendationMarkets(user),
  }
})
