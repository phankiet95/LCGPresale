import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import * as R from '#shared/rules'
import type { OppItem, SessionUserInfo } from '#shared/types'

/** Used by the Monday job: sees every market. */
export const SYSTEM_USER: SessionUserInfo = {
  id: 0, account: 'system', displayName: 'System', role: 'admin', markets: null, mustChangePassword: false,
}

/** JST calendar date of an ISO timestamp (created_at etc. are stored in UTC). */
export const jstDate = (iso: string) => R.todayJst(new Date(iso))

export const inRange = (d: string | null | undefined, from: string, to: string) => !!d && d >= from && d <= to

// ---------------------------------------------------------------- SRS 5.12 snapshot

/**
 * Copy the state of every live opp into weekly_snapshots for the week that starts on `weekStart`
 * (default: the Monday of today, JST). Idempotent: an existing (week, opp) row is kept.
 */
export async function takeSnapshot(db: Db, weekStart?: string) {
  const { items, today } = await loadOpps(db, SYSTEM_USER, {})
  const week = weekStart ?? R.weekStart(today)
  const rows = items.map(i => ({
    weekStart: week, oppId: i.id, marketCode: i.marketCode, partnerId: i.partnerId, stage: i.stage, status: i.status,
    amountUsd: i.amountUsd, winRate: i.winRate, weightedUsd: i.weightedUsd, health: i.health,
    expectedCloseDate: i.expectedCloseDate, warningCodes: JSON.stringify(i.warnings),
  }))
  // D1 allows 100 bound parameters per statement: 12 columns -> 8 rows per INSERT.
  const stmts = []
  for (let k = 0; k < rows.length; k += 8) {
    stmts.push(db.insert(tables.weeklySnapshots).values(rows.slice(k, k + 8)).onConflictDoNothing())
  }
  for (let k = 0; k < stmts.length; k += 50) {
    const chunk = stmts.slice(k, k + 50)
    if (chunk.length) await db.batch(chunk as [typeof chunk[number], ...typeof chunk])
  }
  return { weekStart: week, opps: rows.length }
}

export type SnapshotRow = typeof tables.weeklySnapshots.$inferSelect

export async function loadSnapshot(db: Db, weekStart: string) {
  const rows = await db.select().from(tables.weeklySnapshots).where(eq(tables.weeklySnapshots.weekStart, weekStart))
  return rows.length ? new Map(rows.map(r => [r.oppId, r])) : null
}

/** Items as they were in a snapshot (descriptive fields stay current). Opps not in the snapshot are dropped. */
export function itemsAtSnapshot(items: OppItem[], snap: Map<number, SnapshotRow>): OppItem[] {
  return items.flatMap((i) => {
    const s = snap.get(i.id)
    if (!s) return []
    return [{
      ...i, stage: s.stage as R.Stage, status: s.status as R.Status, amountUsd: s.amountUsd, winRate: s.winRate,
      weightedUsd: s.weightedUsd, health: s.health as R.Health, expectedCloseDate: s.expectedCloseDate ?? i.expectedCloseDate,
      warnings: JSON.parse(s.warningCodes) as R.WarningCode[],
    }]
  })
}

/**
 * The state of the portfolio at the END of the period that finishes on `endDate`:
 * live data when the period is still running, otherwise the snapshot taken the Monday after.
 */
export async function stateAt(db: Db, items: OppItem[], endDate: string, today: string) {
  if (endDate >= today) return { source: 'live' as const, items }
  const next = R.addDays(R.weekStart(endDate), 7)
  const snap = await loadSnapshot(db, next)
  return snap ? { source: 'snapshot' as const, items: itemsAtSnapshot(items, snap), weekStart: next } : { source: 'missing' as const, items: null }
}

// ---------------------------------------------------------------- aggregates

export const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100
export const isWon = (i: Pick<OppItem, 'stage'>) => i.stage === 'W'
export const isLost = (i: Pick<OppItem, 'stage'>) => i.stage === 'L'
export const openOf = (xs: OppItem[]) => xs.filter(i => i.status !== 'Closed')

/** Event-based counts for [from, to] — need no snapshot. */
export function periodEvents(items: OppItem[], from: string, to: string) {
  const created = items.filter(i => inRange(jstDate(i.createdAt), from, to))
  const won = items.filter(i => isWon(i) && inRange(i.closedAt, from, to))
  const lost = items.filter(i => isLost(i) && inRange(i.closedAt, from, to))
  return {
    totalAtEnd: items.filter(i => jstDate(i.createdAt) <= to).length,
    created, won, lost,
    wonUsd: sum(won.map(i => i.amountUsd)),
  }
}

/** Highlight (SRS 5.7) for the window around `ref` (this week + next). */
export async function computeHighlights(db: Db, open: OppItem[], ref: string, settings: R.Settings) {
  const [from, to] = R.highlightWindow(ref)
  // Filter opps in JS: D1 allows only 100 bound parameters, so no `IN (…ids)`.
  const ids = new Set(open.map(i => i.id))
  const acts = ids.size
    ? (await db.select({ oppId: tables.activities.oppId, date: tables.activities.activityDate, type: tables.activities.type })
        .from(tables.activities)
        .where(and(gte(tables.activities.activityDate, from), lte(tables.activities.activityDate, to))))
        .filter(a => ids.has(a.oppId))
    : []
  const codeById = new Map(open.map(i => [i.id, i.oppCode]))
  const ruleActs: R.Activity[] = acts.map(a => ({ opp_code: codeById.get(a.oppId)!, activity_date: a.date, type: a.type, content: '' }))
  return open
    .map(i => ({
      opp: i,
      reasons: R.highlightReasons({
        opp_code: i.oppCode, name: i.name, customer: i.customer, market_code: i.marketCode, partner: i.partner,
        sales_owner: i.salesOwner, amount: i.amount, currency: i.currency, status: i.status, stage: i.stage,
        due_date: i.dueDate, next_action: i.nextAction, is_focus_pinned: i.isFocusPinned,
      }, ruleActs, ref, settings),
    }))
    .filter(h => h.reasons.length)
    .sort((a, b) => a.reasons[0]!.date.localeCompare(b.reasons[0]!.date))
}

/** Warning List order (SRS 7.1 §4): High-severity count ↓, amount ↓, days without update ↓. */
export function warningList(open: OppItem[]) {
  const high = (i: OppItem) => i.warnings.filter(c => R.WARNING_META[c].severity === 'High').length
  return open.filter(i => i.warnings.length)
    .sort((a, b) => high(b) - high(a) || b.amountUsd - a.amountUsd
      || (b.daysSinceUpdate ?? Infinity) - (a.daysSinceUpdate ?? Infinity))
}

/** Stage changes, status changes, amount and close-date edits per opp inside [from, to] (JST dates). */
export async function changesInPeriod(db: Db, oppIds: number[], from: string, to: string) {
  const ids = new Set(oppIds)
  const out = new Map<number, string[]>()
  const stageMoves = new Map<number, { first: string | null, last: string | null }>()
  const slipped = new Set<number>()
  if (!ids.size) return { out, stageMoves, slipped }
  // Timestamps are UTC; widen by a day and filter on the JST date.
  const lo = `${R.addDays(from, -1)}T00:00:00`
  const hi = `${R.addDays(to, 1)}T23:59:59`
  const [hist, audits] = await Promise.all([
    db.select().from(tables.stageHistory)
      .where(and(gte(tables.stageHistory.changedAt, lo), lte(tables.stageHistory.changedAt, hi))),
    db.select().from(tables.auditLog)
      .where(and(eq(tables.auditLog.entity, 'opportunity'),
        inArray(tables.auditLog.field, ['amount', 'currency', 'expectedCloseDate']),
        gte(tables.auditLog.changedAt, lo), lte(tables.auditLog.changedAt, hi))),
  ])
  const push = (id: number, s: string) => out.set(id, [...(out.get(id) ?? []), s])
  for (const h of hist.filter(h => ids.has(h.oppId) && inRange(jstDate(h.changedAt), from, to)).sort((a, b) => a.changedAt.localeCompare(b.changedAt))) {
    if (h.fromStage !== h.toStage && h.toStage) {
      push(h.oppId, `Stage ${h.fromStage ?? '—'} → ${h.toStage}`)
      const m = stageMoves.get(h.oppId) ?? { first: h.fromStage, last: null }
      m.last = h.toStage
      stageMoves.set(h.oppId, m)
    }
    if (h.fromStatus !== h.toStatus && h.toStatus) push(h.oppId, `${h.fromStatus ?? '—'} → ${h.toStatus}`)
  }
  for (const a of audits.filter(a => ids.has(a.entityId) && inRange(jstDate(a.changedAt), from, to)).sort((x, y) => x.changedAt.localeCompare(y.changedAt))) {
    if (a.field === 'amount') push(a.entityId, `Amount ${fmtNum(a.oldValue)} → ${fmtNum(a.newValue)}`)
    if (a.field === 'currency') push(a.entityId, `Currency ${a.oldValue ?? '—'} → ${a.newValue}`)
    if (a.field === 'expectedCloseDate') {
      push(a.entityId, `Close ${a.oldValue ?? '—'} → ${a.newValue ?? '—'}`)
      if (a.oldValue && a.newValue && a.newValue > a.oldValue) slipped.add(a.entityId)
    }
  }
  return { out, stageMoves, slipped }
}

const fmtNum = (v: string | null) => (v === null || v === '' ? '—' : Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US') : v)

const RANK: Record<string, number> = { O: 0, D: 1, C: 2, B: 3, A: 4, W: 5 }
export const stageRank = (s: string | null | undefined) => (s && s in RANK ? RANK[s]! : -1)
