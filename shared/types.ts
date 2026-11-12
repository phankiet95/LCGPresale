import type { DealSize, Health, HighlightReason, Role, Stage, Status, WarningCode } from './rules'

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
}

export interface OppFilter {
  market?: string[]
  partner?: string[]
  owner?: string[]
  stage?: Stage[]
  dealType?: string[]
  health?: string[]
  q?: string
  closeFrom?: string
  closeTo?: string
}

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
  highlights: HighlightReason[]
  permissions: { canEdit: boolean, canReopen: boolean, canChangeMarket: boolean, canDelete: boolean }
}

export interface MetaResponse {
  markets: { code: string, name: string }[]
  countries: { id: number, marketCode: string, name: string }[]
  partners: { id: number, name: string }[]
  users: { id: number, account: string, displayName: string, isActive: boolean }[]
  lookups: Record<string, string[]>
  defaultWinRate: Record<Stage, number>
  currencies: string[]
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
  highlights: { opp: OppItem, reasons: HighlightReason[] }[]
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
