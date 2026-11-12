import { asc, desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import * as R from '#shared/rules'
import type { HistoryItem, OppDetailResponse } from '#shared/types'

export default defineEventHandler(async (event): Promise<OppDetailResponse> => {
  const user = await requireUser(event)
  const { db, today, settings, item } = await loadOppByCode(event, user, getRouterParam(event, 'code')!)
  const a = tables.activities
  const owner = alias(tables.users, 'owner')
  const creator = alias(tables.users, 'creator')
  const [acts, stages, audits] = await Promise.all([
    db.select({
      id: a.id, activityDate: a.activityDate, type: a.type, isCustomerFacing: a.isCustomerFacing, content: a.content,
      nextAction: a.nextAction, actionOwner: owner.account, dueDate: a.dueDate, source: a.source,
      createdBy: creator.account, createdAt: a.createdAt,
    }).from(a)
      .leftJoin(owner, eq(owner.id, a.actionOwnerId))
      .leftJoin(creator, eq(creator.id, a.createdBy))
      .where(eq(a.oppId, item.id))
      .orderBy(desc(a.activityDate), desc(a.createdAt)),
    db.select({ h: tables.stageHistory, by: tables.users.account }).from(tables.stageHistory)
      .leftJoin(tables.users, eq(tables.users.id, tables.stageHistory.changedBy))
      .where(eq(tables.stageHistory.oppId, item.id)).orderBy(asc(tables.stageHistory.changedAt)),
    db.select({ l: tables.auditLog, by: tables.users.account }).from(tables.auditLog)
      .leftJoin(tables.users, eq(tables.users.id, tables.auditLog.changedBy))
      .where(eq(tables.auditLog.entityId, item.id)).orderBy(asc(tables.auditLog.changedAt)),
  ])

  const history: HistoryItem[] = [
    ...stages.map(({ h, by }) => ({
      id: h.id, kind: 'stage' as const, field: 'stage/status',
      from: `${h.fromStage} · ${h.fromStatus}`, to: `${h.toStage} · ${h.toStatus}`,
      reason: h.reason, changedBy: by, changedAt: h.changedAt,
    })),
    ...audits.filter(x => x.l.entity === 'opportunity').map(({ l, by }) => ({
      id: l.id, kind: 'field' as const, field: l.field, from: l.oldValue, to: l.newValue,
      reason: null, changedBy: by, changedAt: l.changedAt,
    })),
  ].sort((x, y) => y.changedAt.localeCompare(x.changedAt))

  const ruleActs: R.Activity[] = acts.map(x => ({ opp_code: item.oppCode, activity_date: x.activityDate, type: x.type, content: x.content }))
  const highlights = R.highlightReasons({
    opp_code: item.oppCode, name: item.name, customer: item.customer, market_code: item.marketCode, partner: item.partner,
    sales_owner: item.salesOwner, amount: item.amount, currency: item.currency, status: item.status, stage: item.stage,
    due_date: item.dueDate, next_action: item.nextAction, is_focus_pinned: item.isFocusPinned,
  }, ruleActs, today, settings)

  return {
    today,
    opp: item,
    activities: acts,
    history,
    highlights,
    permissions: {
      canEdit: item.canEdit,
      canReopen: canReopen(user) && canSeeMarket(user, item.marketCode),
      canChangeMarket: user.role === 'admin',
      canDelete: user.role === 'admin',
    },
  }
})
