import type { DealSize, Health, Role, Stage, Status, WarningCode } from './rules'
import type { HighlightTag, ReportPeriod } from './highlight'

export interface SessionUserInfo {
  id: number
  account: string
  displayName: string
  role: Role
  /** null = all markets (admin / management) */
  markets: string[] | null
  mustChangePassword: boolean
}

/** Opportunity as returned to the UI: stored fields + computed fields (SRS §5). */
export interface OppItem {
  id: number
  oppCode: string
  name: string
  customerId: number
  customer: string
  industry: string | null
  marketCode: string
  countryId: number | null
  country: string | null
  partnerId: number
  partner: string
  secondaryPartner: string | null
  solution: string | null
  isLaida: boolean
  dealType: string | null
  salesOwnerId: number
  salesOwner: string
  viOwnerId: number | null
  viOwner: string | null
  biddingLead: string | null
  coordinatorId: number | null
  coordinator: string | null
  amount: number
  currency: string
  winRateOverride: number | null
  winRateReason: string | null
  priority: string | null
  status: Status
  stage: Stage
  stageChangedAt: string
  statusChangedAt: string
  latestActivity: string | null
  latestUpdateDate: string | null
  lastContactDate: string | null
  nextAction: string | null
  actionOwnerId: number | null
  actionOwner: string | null
  dueDate: string | null
  expectedCloseDate: string
  closedAt: string | null
  pendingReason: string | null
  lostReason: string | null
  blockingIssue: string | null
  supportNeeded: string | null
  backgroundNote: string | null
  isFocusPinned: boolean
  verifiedAt: string | null
  importNeedsConfirm: string[]
  createdAt: string
  createdBy: string | null
  // computed
  amountUsd: number
  winRate: number
  weightedUsd: number
  dealSize: DealSize
  health: Health
  daysSinceUpdate: number | null
  daysSinceContact: number | null
  warnings: WarningCode[]
  isKeyDeal: boolean
  isTopMgmt: boolean
  canEdit: boolean
  canDelete: boolean
}

export interface OppFilter {
  market?: string[]
  partner?: string[]
  owner?: string[]
  stage?: Stage[]
  dealType?: string[]
  health?: string[]
  q?: string
  /** which date the from/to range applies to (default: expected close) */
  dateBy?: DateField
  dateFrom?: string
  dateTo?: string
}
export type DateField = 'close' | 'created' | 'update'

export interface OppListResponse {
  today: string
  items: OppItem[]
  /** open-opp count per market within the user's scope (for the market chips) */
  marketCounts: Record<string, number>
}

export interface ActivityItem {
  id: number
  activityDate: string
  type: string
  isCustomerFacing: boolean
  content: string
  nextAction: string | null
  actionOwner: string | null
  dueDate: string | null
  source: string
  createdBy: string | null
  createdAt: string
}

export interface HistoryItem {
  id: number
  kind: 'stage' | 'field'
  field: string | null
  from: string | null
  to: string | null
  reason: string | null
  changedBy: string | null
  changedAt: string
}

export interface OppDetailResponse {
  today: string
  opp: OppItem
  activities: ActivityItem[]
  history: HistoryItem[]
  highlights: HighlightTag[]
  permissions: { canEdit: boolean, canReopen: boolean, canChangeMarket: boolean, canDelete: boolean }
}

export interface MetaResponse {
  markets: { code: string, name: string }[]
  /** every active market; inScope = the user may see it (filter bar shows the others greyed out) */
  allMarkets: { code: string, name: string, inScope: boolean }[]
  countries: { id: number, marketCode: string, name: string }[]
  partners: { id: number, name: string }[]
  users: { id: number, account: string, displayName: string, isActive: boolean }[]
  lookups: Record<string, string[]>
  defaultWinRate: Record<Stage, number>
  currencies: string[]
  /** distinct VI names already used on opportunities (suggestions for the VI owner field) */
  viOwners: string[]
  /** distinct Bidding lead names already used */
  biddingLeads: string[]
}

export interface DashboardResponse {
  today: string
  marketCounts: Record<string, number>
  kpis: {
    totalOpps: number
    openOpps: number
    totalPipelineUsd: number
    weightedForecastUsd: number
    withWarnings: number
    onHoldOver30: number
    noUpdateOver14: number
    overdueClose: number
  }
  byMarket: { code: string, pipelineUsd: number, weightedUsd: number, count: number, selected: boolean }[]
  byPartner: { name: string, pipelineUsd: number, weightedUsd: number, count: number }[]
  health: Record<'Green' | 'Amber' | 'Red', number>
  warnings: { code: WarningCode, count: number }[]
  top10: OppItem[]
  highlights: { opp: OppItem, tags: HighlightTag[] }[]
  highlightPeriod: ReportPeriod
  insights: DashboardInsights
}

export interface AdminUser {
  id: number
  account: string
  email: string | null
  displayName: string
  role: Role
  isActive: boolean
  hasPassword: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  markets: string[]
  ownedOpps: number
}

// ---------------------------------------------------------------- Reports (SRS §7)
export type StateSource = 'live' | 'snapshot' | 'missing'

export interface SummaryRow {
  key: string
  label: string
  money: boolean
  current: number | null
  previous: number | null
  /** extra pipeline query for the drill-down link */
  link?: Record<string, string>
}

export interface MarketHealthRow {
  code: string
  active: number
  onHold: number
  won: number
  lost: number
  pipelineUsd: number
  weightedUsd: number
  pctGreen: number | null
  pctVerified: number | null
}

export interface RecommendationItem {
  id: number
  weekStart: string
  marketCode: string | null
  finding: string
  impact: string | null
  recommendation: string | null
  ownerId: number | null
  owner: string | null
  targetDate: string | null
  createdBy: string | null
  canEdit: boolean
}

export interface WeeklyReportResponse {
  today: string
  week: { start: string, end: string, isCurrent: boolean }
  weeks: string[]
  marketCounts: Record<string, number>
  /** where the end-of-week state comes from, and whether the start-of-week snapshot exists */
  source: { end: StateSource, start: boolean, latestSnapshot: string | null }
  summary: SummaryRow[]
  changes: { newOpps: number, won: number, lost: number, stageUp: number, stageDown: number, slipped: number, pipelineDeltaUsd: number | null }
  highlights: { opp: OppItem, tags: HighlightTag[] }[]
  highlightPeriod: ReportPeriod
  marketHealth: MarketHealthRow[]
  warningList: OppItem[]
  topMgmt: { opp: OppItem, changes: string[] }[]
  topMgmtUsd: number
  projectVsLicense: { dealType: string, open: number, pipelineUsd: number, weightedUsd: number, wonInWeek: number }[]
  recommendations: RecommendationItem[]
  canAddRecommendation: boolean
  recommendationMarkets: string[]
}

export interface MonthlyReportResponse {
  today: string
  month: { key: string, start: string, end: string, isCurrent: boolean }
  months: string[]
  marketCounts: Record<string, number>
  source: StateSource
  byMarket: { code: string, created: number, won: number, lost: number, wonUsd: number, open: number | null, pipelineUsd: number | null }[]
  byPartner: { name: string, count: number, pipelineUsd: number, avgWinRate: number }[]
  trend: SummaryRow[]
  series: { key: string, created: number, won: number, lost: number, wonUsd: number }[]
  pipelineWeeks: { weekStart: string, pipelineUsd: number, weightedUsd: number }[]
  funnel: { stage: Stage, reached: number, conversion: number | null }[]
  risk: { key: string, label: string, opps: OppItem[] }[]
  winLoss: {
    month: { won: number, lost: number, wonUsd: number, lostUsd: number, winRate: number | null }
    ytd: { won: number, lost: number, wonUsd: number, lostUsd: number, winRate: number | null }
    reasons: { reason: string, count: number, usd: number }[]
  }
}

// ---------------------------------------------------------------- Dashboard insights (sales feedback 2026-11-14)
type OpenStage = 'O' | 'D' | 'C' | 'B' | 'A'
export interface PartnerSum { name: string, count: number, amountUsd: number }
export interface DealTier { minUsd: number, count: number, amountUsd: number, opps: OppItem[] }
export interface DashboardInsights {
  byStage: { stage: OpenStage, count: number, amountUsd: number, weightedUsd: number }[]
  byPnl: { code: string, count: number, amountUsd: number, stages: Record<OpenStage, number> }[]
  tiers: { mega: DealTier, large: DealTier }
  resell: { byPartner: PartnerSum[], count: number, amountUsd: number }
  /** late = stages A + B, early = stages C + D + O (open opps) */
  platforms: { late: PartnerSum[], early: PartnerSum[] }
  forecast: {
    year: number
    years: number[]
    months: { month: string, count: number, amountUsd: number, weightedUsd: number, stages: Record<'O' | 'D' | 'C', number>, past: boolean }[]
  }
}

// ---------------------------------------------------------------- Change log (all changes, scoped by role)
export type LogKind = 'field' | 'stage' | 'activity' | 'created' | 'deleted' | 'user'
export interface LogItem {
  key: string
  kind: LogKind
  at: string
  by: string | null
  oppCode: string | null
  oppName: string | null
  market: string | null
  deleted: boolean
  /** field changes: readable field name */
  field: string | null
  from: string | null
  to: string | null
  /** activity content / reason / user account */
  text: string | null
}
export interface LogResponse {
  items: LogItem[]
  total: number
  scope: 'all' | 'markets' | 'mine'
  from: string
  to: string
  people: string[]
}
