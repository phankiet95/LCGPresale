import type { Health, Role, Stage, Status, WarningCode } from './rules'

export const MARKET_CODES = ['JP', 'KR', 'EU', 'AM', 'VN', 'AP', 'ME'] as const
export const OPEN_STAGES: Stage[] = ['O', 'D', 'C', 'B', 'A']
export const ALL_STAGES: Stage[] = ['O', 'D', 'C', 'B', 'A', 'W', 'L']

export const STAGE_LABEL: Record<Stage, string> = {
  O: 'O · Open New',
  D: 'D · Proposal Preparation',
  C: 'C · Proposal Submitted',
  B: 'B · Negotiation',
  A: 'A · Verbal Award',
  W: 'W · Won',
  L: 'L · Lost / Dropped',
}
export const STAGE_SHORT: Record<Stage, string> = {
  O: 'O · Open', D: 'D · Prep', C: 'C · Submitted', B: 'B · Negotiation', A: 'A · Verbal', W: 'Won', L: 'Lost',
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin (BD Ops)',
  management: 'Management',
  market_lead: 'Market Lead',
  sales: 'Sales / Presales',
  viewer: 'Viewer',
}
export const ROLE_HELP: Record<Role, string> = {
  admin: 'All markets. Master data, users, import, FX, soft delete, reopen closed opps.',
  management: 'All markets, read-only. Dashboard, reports, export.',
  market_lead: 'Assigned markets. Edit any opp there, verify weekly, reopen closed, change owner.',
  sales: 'Assigned markets. Edit opps where Sales/VI/Action owner; create opps.',
  viewer: 'Assigned markets, read-only.',
}

/** Roles that see every market regardless of user_markets (SRS §2). */
export const ALL_MARKET_ROLES: Role[] = ['admin', 'management']

export const WARNING_LABEL: Record<WarningCode, string> = {
  W1: 'No update > 14d',
  W2: 'On hold > 30d',
  W3: 'Overdue close',
  W4: 'Missing key fields',
  W5: 'Action overdue',
  W6: 'No estimate',
  W7: 'Stuck in stage',
}

export const HEALTH_BUCKET = (h: Health): 'Green' | 'Amber' | 'Red' | 'Closed' =>
  h.startsWith('Red') ? 'Red' : (h as 'Green' | 'Amber' | 'Closed')

export const STATUSES: Status[] = ['Active', 'On Hold', 'Closed']
export const CURRENCIES = ['USD', 'JPY', 'VND', 'KRW', 'SGD', 'AED', 'EUR'] as const
