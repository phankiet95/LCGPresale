import { and, eq, gte, inArray, isNull, like, lte, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as R from '#shared/rules'
import type { OppFilter, OppItem, SessionUserInfo } from '#shared/types'
import { HEALTH_BUCKET } from '#shared/constants'

/** "Today" is the JST calendar date (SRS 5.0). */
export const todayJst = () => R.todayJst()

const so = alias(tables.users, 'so')
const vo = alias(tables.users, 'vo')
const co = alias(tables.users, 'co')
const ao = alias(tables.users, 'ao')
const cb = alias(tables.users, 'cb')

function baseQuery(db: Db) {
  const o = tables.opportunities
  return db.select({
    o,
    customer: tables.customers.name,
    partner: tables.partners.name,
    country: tables.countries.name,
    salesOwner: so.account,
    viOwner: vo.account,
    coordinator: co.account,
    actionOwner: ao.account,
    createdBy: cb.account,
  })
    .from(o)
    .innerJoin(tables.customers, eq(tables.customers.id, o.customerId))
    .innerJoin(tables.partners, eq(tables.partners.id, o.partnerId))
    .leftJoin(tables.countries, eq(tables.countries.id, o.countryId))
    .innerJoin(so, eq(so.id, o.salesOwnerId))
    .leftJoin(vo, eq(vo.id, o.viOwnerId))
    .leftJoin(co, eq(co.id, o.coordinatorId))
    .leftJoin(ao, eq(ao.id, o.actionOwnerId))
    .leftJoin(cb, eq(cb.id, o.createdBy))
}
type Row = Awaited<ReturnType<ReturnType<typeof baseQuery>['where']>>[number]

/** Shape expected by shared/rules.ts */
export function toRuleOpp(r: Row): R.Opportunity {
  const o = r.o
  return {
    opp_code: o.oppCode, name: o.name, customer: r.customer, market_code: o.marketCode, partner: r.partner,
    deal_type: o.dealType, sales_owner: r.salesOwner, amount: o.amount, currency: o.currency,
    win_rate_override: o.winRateOverride, status: o.status, stage: o.stage,
    latest_activity: o.latestActivity, latest_update_date: o.latestUpdateDate, next_action: o.nextAction,
    action_owner: r.actionOwner, due_date: o.dueDate, expected_close_date: o.expectedCloseDate,
    closed_at: o.closedAt, pending_reason: o.pendingReason, lost_reason: o.lostReason,
    stage_changed_at: o.stageChangedAt, status_changed_at: o.statusChangedAt,
    is_focus_pinned: o.isFocusPinned, created_at: o.createdAt.slice(0, 10),
  }
}

/** amount_usd without throwing: a missing FX rate shows as 0 (and is blocked on save, SRS 5.2). */
const safeUsd = (ro: R.Opportunity, s: R.Settings) => (s.fxToUsd[ro.currency] === undefined ? 0 : R.amountUsd(ro, s))

export function toItem(r: Row, s: R.Settings, today: string, user: SessionUserInfo): OppItem {
  const o = r.o
  const ro = toRuleOpp(r)
  const amountUsd = safeUsd(ro, s)
  const winRate = R.winRate(ro, s)
  return {
    id: o.id, oppCode: o.oppCode, name: o.name, customerId: o.customerId, customer: r.customer,
    industry: o.industry, marketCode: o.marketCode, countryId: o.countryId, country: r.country,
    partnerId: o.partnerId, partner: r.partner, secondaryPartner: o.secondaryPartner, solution: o.solution,
    isLaida: o.isLaida, dealType: o.dealType, salesOwnerId: o.salesOwnerId, salesOwner: r.salesOwner,
    viOwnerId: o.viOwnerId, viOwner: r.viOwner, coordinatorId: o.coordinatorId, coordinator: r.coordinator,
    amount: o.amount, currency: o.currency, winRateOverride: o.winRateOverride, winRateReason: o.winRateReason,
    priority: o.priority, status: o.status, stage: o.stage, stageChangedAt: o.stageChangedAt,
    statusChangedAt: o.statusChangedAt, latestActivity: o.latestActivity, latestUpdateDate: o.latestUpdateDate,
    lastContactDate: o.lastContactDate, nextAction: o.nextAction, actionOwnerId: o.actionOwnerId,
    actionOwner: r.actionOwner, dueDate: o.dueDate, expectedCloseDate: o.expectedCloseDate, closedAt: o.closedAt,
    pendingReason: o.pendingReason, lostReason: o.lostReason, blockingIssue: o.blockingIssue,
    supportNeeded: o.supportNeeded, backgroundNote: o.backgroundNote, isFocusPinned: o.isFocusPinned,
    verifiedAt: o.verifiedAt, importNeedsConfirm: o.importNeedsConfirm ? JSON.parse(o.importNeedsConfirm) : [],
    createdAt: o.createdAt, createdBy: r.createdBy,
    amountUsd,
    winRate,
    weightedUsd: Math.round(amountUsd * winRate) / 100,
    dealSize: !o.amount ? 'No estimate' : amountUsd > 200_000 ? '>200K' : amountUsd >= 50_000 ? '50-200K' : '<50K',
    health: R.health(ro, today, s),
    daysSinceUpdate: R.daysSinceUpdate(ro, today),
    daysSinceContact: o.lastContactDate ? R.daysBetween(o.lastContactDate, today) : null,
    warnings: R.warnings(ro, today, s),
    isKeyDeal: R.isOpen(ro) && (amountUsd > s.keyDealUsd || winRate >= s.keyDealWinRate),
    isTopMgmt: R.isOpen(ro) && amountUsd > s.topMgmtUsd,
    canEdit: canEditOpp(user, o),
  }
}

/**
 * Opps visible to the user (market scope enforced HERE, at query level — SRS §2),
 * with every filter except market applied. The market filter is applied afterwards so
 * the same rows also produce the per-market chip counts.
 */
export async function loadOpps(event: Parameters<typeof useDb>[0] | Db, user: SessionUserInfo, f: OppFilter) {
  const db = 'select' in event ? event : useDb(event)
  const today = todayJst()
  const settings = await loadSettings(db, today)
  const o = tables.opportunities
  const conds: (SQL | undefined)[] = [isNull(o.deletedAt), isNull(o.mergedIntoId)]
  if (user.markets !== null) {
    if (!user.markets.length) return { today, settings, items: [] as OppItem[], marketCounts: {} as Record<string, number> }
    conds.push(inArray(o.marketCode, user.markets))
  }
  if (f.partner?.length) conds.push(inArray(tables.partners.name, f.partner))
  if (f.owner?.length) conds.push(inArray(so.account, f.owner))
  if (f.stage?.length) conds.push(inArray(o.stage, f.stage))
  if (f.dealType?.length) conds.push(inArray(o.dealType, f.dealType))
  if (f.closeFrom) conds.push(gte(o.expectedCloseDate, f.closeFrom))
  if (f.closeTo) conds.push(lte(o.expectedCloseDate, f.closeTo))
  if (f.q) {
    const p = `%${f.q}%`
    conds.push(or(like(o.oppCode, p), like(o.name, p), like(tables.customers.name, p), like(tables.customers.nameJa, p)))
  }
  const rows = await baseQuery(db).where(and(...conds))
  let items = rows.map(r => toItem(r, settings, today, user))
  if (f.health?.length) items = items.filter(i => f.health!.includes(HEALTH_BUCKET(i.health)) || f.health!.includes(i.health))

  const marketCounts: Record<string, number> = {}
  for (const i of items) if (i.status !== 'Closed') marketCounts[i.marketCode] = (marketCounts[i.marketCode] ?? 0) + 1
  if (f.market?.length) items = items.filter(i => f.market!.includes(i.marketCode))
  return { today, settings, items, marketCounts }
}

/** One opp by code, 404 when missing or outside the user's market scope (no existence leak). */
export async function loadOppByCode(event: Parameters<typeof useDb>[0], user: SessionUserInfo, code: string) {
  const db = useDb(event)
  const today = todayJst()
  const settings = await loadSettings(db, today)
  const [row] = await baseQuery(db).where(and(eq(tables.opportunities.oppCode, code), isNull(tables.opportunities.deletedAt)))
  if (!row || !canSeeMarket(user, row.o.marketCode)) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
  return { db, today, settings, row, item: toItem(row, settings, today, user) }
}

/** Atomically allocate the next OPP-YYYY-NNN (SRS 5.1). Single UPSERT statement = safe under concurrency. */
export async function nextOppCode(db: Db, year: number) {
  const rows = await db.all<{ last_no: number }>(sql`INSERT INTO opp_code_seq (year, last_no) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET last_no = last_no + 1 RETURNING last_no`)
  const lastNo = Number(rows[0]!.last_no)
  return R.formatOppCode(year, lastNo)
}

/** Audit rows for changed fields (SRS §2: who, when, field, old -> new). */
export function auditRows(entityId: number, userId: number, before: Record<string, unknown>, after: Record<string, unknown>) {
  const now = new Date().toISOString()
  const fmt = (v: unknown) => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v))
  return Object.keys(after)
    .filter(k => fmt(before[k]) !== fmt(after[k]))
    .map(k => ({ entity: 'opportunity', entityId, field: k, oldValue: fmt(before[k]), newValue: fmt(after[k]), changedBy: userId, changedAt: now }))
}
