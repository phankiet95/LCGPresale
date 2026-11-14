import { and, desc, gte, lte } from 'drizzle-orm'
import * as R from '#shared/rules'
import type { LogItem, LogKind, LogResponse } from '#shared/types'

/**
 * Change log: field edits (audit_log), stage / status moves (stage_history) and logged activities, merged.
 * Who sees what:
 *   - Admin, Management: everything (Admin also sees user-account changes)
 *   - Market Lead: everything in their markets
 *   - Sales / Viewer: the opportunities they are involved in (sales owner, VI owner, coordinator, action owner,
 *     creator) and every change they made themselves.
 * D1 allows only 100 bound parameters, so opp scoping is done in JS (no IN (...ids)).
 */
const FIELD_LABEL: Record<string, string> = {
  name: 'Name', industry: 'Industry', marketCode: 'Market', countryId: 'Country', partnerId: 'Partner',
  secondaryPartner: 'Secondary partner', solution: 'Solution', isLaida: 'LAIDA', dealType: 'Deal type',
  salesOwnerId: 'Sales owner', viOwnerId: 'VI owner', viOwner: 'VI owner', biddingLead: 'Bidding lead', coordinatorId: 'Coordinator', amount: 'Amount', currency: 'Currency',
  winRateOverride: 'Win rate override', winRateReason: 'Win-rate reason', priority: 'Priority',
  expectedCloseDate: 'Expected close', nextAction: 'Next action', actionOwnerId: 'Action owner', dueDate: 'Due date',
  blockingIssue: 'Blocking issue', supportNeeded: 'Support needed', backgroundNote: 'Background note',
  isFocusPinned: 'Pinned', verifiedAt: 'Verified', verifiedBy: 'Verified by', latestActivity: 'Latest activity',
  latestUpdateDate: 'Latest update', lastContactDate: 'Last contact', stage: 'Stage', stageChangedAt: 'Stage changed',
  winRate: 'Win rate', lostReason: 'Lost reason', pendingReason: 'On-hold reason', closedAt: 'Closed on', status: 'Status',
  // user records
  role: 'Role', isActive: 'Active', markets: 'Markets', displayName: 'Display name', email: 'Email', account: 'Account', password: 'Password',
}
const HIDDEN = new Set(['verifiedBy', 'stageChangedAt', 'statusChangedAt', 'updatedAt', 'latestActivity', 'latestUpdateDate', 'lastContactDate'])

export default defineEventHandler(async (event): Promise<LogResponse> => {
  const user = await requireUser(event)
  const q = getQuery(event)
  const db = useDb(event)
  const today = R.todayJst()
  const iso = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const to = iso(q.to) ?? today
  const from = iso(q.from) ?? R.addDays(to, -30)
  const kinds = new Set(String(q.kind ?? '').split(',').filter(Boolean) as LogKind[])
  const who = typeof q.who === 'string' && q.who ? q.who.toLowerCase() : null
  const search = typeof q.q === 'string' ? q.q.trim().toLowerCase() : ''
  const marketF = new Set(String(q.market ?? '').split(',').filter(Boolean))
  const lo = `${R.addDays(from, -1)}T15:00:00` // JST day starts at 15:00 UTC the day before
  const hi = `${to}T15:00:00`

  const scope: LogResponse['scope'] = user.role === 'admin' || user.role === 'management' ? 'all' : user.role === 'market_lead' ? 'markets' : 'mine'

  // ---- lookups (small tables)
  const o = tables.opportunities
  const [opps, users, partners, countries] = await Promise.all([
    db.select({
      id: o.id, oppCode: o.oppCode, name: o.name, marketCode: o.marketCode, deletedAt: o.deletedAt,
      salesOwnerId: o.salesOwnerId, viOwnerId: o.viOwnerId, coordinatorId: o.coordinatorId, actionOwnerId: o.actionOwnerId, createdBy: o.createdBy,
    }).from(o),
    db.select({ id: tables.users.id, account: tables.users.account }).from(tables.users),
    db.select({ id: tables.partners.id, name: tables.partners.name }).from(tables.partners),
    db.select({ id: tables.countries.id, name: tables.countries.name }).from(tables.countries),
  ])
  const acc = new Map(users.map(u => [u.id, u.account]))
  const oppById = new Map(opps.map(x => [x.id, x]))
  const visibleOpp = (id: number) => {
    const x = oppById.get(id)
    if (!x) return false
    if (scope === 'all') return true
    if (!canSeeMarket(user, x.marketCode)) return false
    if (scope === 'markets') return true
    return [x.salesOwnerId, x.viOwnerId, x.coordinatorId, x.actionOwnerId, x.createdBy].includes(user.id)
  }
  const mine = (by: number | null) => by === user.id

  // ---- read the period
  const [audits, stages, acts] = await Promise.all([
    db.select().from(tables.auditLog).where(and(gte(tables.auditLog.changedAt, lo), lte(tables.auditLog.changedAt, hi))).orderBy(desc(tables.auditLog.changedAt)),
    db.select().from(tables.stageHistory).where(and(gte(tables.stageHistory.changedAt, lo), lte(tables.stageHistory.changedAt, hi))),
    db.select().from(tables.activities).where(and(gte(tables.activities.createdAt, lo), lte(tables.activities.createdAt, hi))),
  ])

  const name = (field: string, v: string | null) => {
    if (v === null || v === '') return null
    if (/OwnerId$|^coordinatorId$|^verifiedBy$/.test(field)) return acc.get(Number(v)) ?? v
    if (field === 'partnerId') return partners.find(p => p.id === Number(v))?.name ?? v
    if (field === 'countryId') return countries.find(c => c.id === Number(v))?.name ?? v
    if (field === 'verifiedAt') return v.slice(0, 10)
    if (v === 'true') return 'Yes'
    if (v === 'false') return 'No'
    return v
  }
  const oppInfo = (id: number) => {
    const x = oppById.get(id)
    return { oppCode: x?.oppCode ?? null, oppName: x?.name ?? null, market: x?.marketCode ?? null, deleted: !!x?.deletedAt }
  }

  const out: LogItem[] = []
  for (const l of audits) {
    if (l.entity === 'user') {
      if (user.role !== 'admin') continue
      out.push({
        key: `a${l.id}`, kind: 'user', at: l.changedAt, by: acc.get(l.changedBy ?? 0) ?? null,
        oppCode: null, oppName: null, market: null, deleted: false,
        field: FIELD_LABEL[l.field ?? ''] ?? l.field, from: l.oldValue, to: l.newValue, text: acc.get(l.entityId) ?? `user #${l.entityId}`,
      })
      continue
    }
    if (l.entity !== 'opportunity' || !(visibleOpp(l.entityId) || (canSeeMarket(user, oppById.get(l.entityId)?.marketCode ?? '') && mine(l.changedBy)))) continue
    if (l.field && HIDDEN.has(l.field)) continue
    const kind: LogKind = l.field === 'created' ? 'created' : l.field === 'deleted' ? 'deleted' : 'field'
    out.push({
      key: `a${l.id}`, kind, at: l.changedAt, by: acc.get(l.changedBy ?? 0) ?? null, ...oppInfo(l.entityId),
      field: kind === 'field' ? (FIELD_LABEL[l.field ?? ''] ?? l.field) : null,
      from: kind === 'field' ? name(l.field ?? '', l.oldValue) : null,
      to: kind === 'field' ? name(l.field ?? '', l.newValue) : null,
      text: kind === 'field' ? null : l.newValue,
    })
  }
  for (const h of stages) {
    if (!(visibleOpp(h.oppId) || (canSeeMarket(user, oppById.get(h.oppId)?.marketCode ?? '') && mine(h.changedBy)))) continue
    out.push({
      key: `s${h.id}`, kind: 'stage', at: h.changedAt, by: acc.get(h.changedBy ?? 0) ?? null, ...oppInfo(h.oppId),
      field: h.fromStatus !== h.toStatus && h.fromStage === h.toStage ? 'Status' : 'Stage',
      from: h.fromStatus !== h.toStatus && h.fromStage === h.toStage ? h.fromStatus : `${h.fromStage ?? '—'}${h.fromStatus && h.fromStatus !== 'Active' ? ` · ${h.fromStatus}` : ''}`,
      to: h.fromStatus !== h.toStatus && h.fromStage === h.toStage ? h.toStatus : `${h.toStage ?? '—'}${h.toStatus && h.toStatus !== 'Active' ? ` · ${h.toStatus}` : ''}`,
      text: h.reason,
    })
  }
  for (const a of acts) {
    if (a.source === 'system') continue // the matching stage move is already listed
    if (!(visibleOpp(a.oppId) || (canSeeMarket(user, oppById.get(a.oppId)?.marketCode ?? '') && mine(a.createdBy)))) continue
    out.push({
      key: `v${a.id}`, kind: 'activity', at: a.createdAt, by: acc.get(a.createdBy ?? 0) ?? (a.source === 'import' ? 'Excel import' : null), ...oppInfo(a.oppId),
      field: a.type, from: null, to: a.activityDate, text: a.content,
    })
  }

  let items = out
  if (kinds.size) items = items.filter(i => kinds.has(i.kind))
  if (who) items = items.filter(i => (i.by ?? '').toLowerCase() === who)
  if (marketF.size) items = items.filter(i => i.market && marketF.has(i.market))
  if (search) {
    items = items.filter(i => [i.oppCode, i.oppName, i.field, i.from, i.to, i.text, i.by].some(v => (v ?? '').toLowerCase().includes(search)))
  }
  items.sort((x, y) => y.at.localeCompare(x.at))
  const people = [...new Set(out.map(i => i.by).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b))
  return { items: items.slice(0, 1000), total: items.length, scope, from, to, people }
})
