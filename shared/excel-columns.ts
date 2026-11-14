/**
 * Excel round-trip (export -> edit in Excel -> import). One definition used by both the export
 * (app) and the import (server), so headers, order and read-only columns always match.
 *  - `ro`: read-only (computed or managed elsewhere) — exported for reference, ignored on import.
 *  - `kind`: how the cell is written / parsed.
 */
export type ExcelKind = 'text' | 'longtext' | 'number' | 'date' | 'percent'
export interface ExcelColumn { key: string, header: string, width: number, kind: ExcelKind, ro?: boolean, required?: boolean, note?: string }

export const EXCEL_SHEET = 'Opportunities'
export const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'oppCode', header: 'OPP code', width: 15, kind: 'text', ro: true, note: 'Leave empty to create a new opportunity. Do not change existing codes.' },
  { key: 'name', header: 'Opportunity name', width: 42, kind: 'text', required: true },
  { key: 'customer', header: 'Customer', width: 30, kind: 'text', required: true, note: 'Used when creating. Changing it on an existing opp is ignored.' },
  { key: 'market', header: 'Market', width: 9, kind: 'text', required: true, note: 'JP, KR, EU, AM, VN, AP, ME' },
  { key: 'country', header: 'Country', width: 16, kind: 'text' },
  { key: 'partner', header: 'Partner', width: 18, kind: 'text', required: true },
  { key: 'secondaryPartner', header: 'Secondary partner', width: 16, kind: 'text' },
  { key: 'solution', header: 'Solution', width: 22, kind: 'text' },
  { key: 'dealType', header: 'Deal type', width: 16, kind: 'text', required: true },
  { key: 'industry', header: 'Industry', width: 16, kind: 'text' },
  { key: 'salesOwner', header: 'Sales owner (account)', width: 16, kind: 'text', required: true, note: 'FPT account, e.g. SonTV16' },
  { key: 'viOwner', header: 'VI owner', width: 16, kind: 'text' },
  { key: 'biddingLead', header: 'Bidding lead', width: 16, kind: 'text' },
  { key: 'coordinator', header: 'Coordinator (account)', width: 16, kind: 'text' },
  { key: 'amount', header: 'Amount', width: 14, kind: 'number' },
  { key: 'currency', header: 'Currency', width: 9, kind: 'text' },
  { key: 'amountUsd', header: 'Amount USD', width: 14, kind: 'number', ro: true },
  { key: 'stage', header: 'Stage', width: 8, kind: 'text', note: 'O, D, C, B, A. Won / Lost / On hold: use the buttons in the app.' },
  { key: 'status', header: 'Status', width: 10, kind: 'text', ro: true },
  { key: 'winRateOverride', header: 'Win rate override (%)', width: 12, kind: 'number', note: 'Empty = stage default' },
  { key: 'winRateReason', header: 'Win-rate reason', width: 24, kind: 'text' },
  { key: 'winRate', header: 'Win rate (%)', width: 10, kind: 'number', ro: true },
  { key: 'priority', header: 'Priority', width: 9, kind: 'text' },
  { key: 'expectedCloseDate', header: 'Expected close', width: 14, kind: 'date', required: true },
  { key: 'nextAction', header: 'Next action', width: 36, kind: 'longtext' },
  { key: 'actionOwner', header: 'Action owner (account)', width: 16, kind: 'text' },
  { key: 'dueDate', header: 'Due date', width: 13, kind: 'date' },
  { key: 'latestActivity', header: 'Latest activity', width: 40, kind: 'longtext', ro: true },
  { key: 'latestUpdateDate', header: 'Latest update', width: 13, kind: 'date', ro: true },
  { key: 'health', header: 'Health', width: 14, kind: 'text', ro: true },
  { key: 'blockingIssue', header: 'Blocking issue', width: 30, kind: 'longtext' },
  { key: 'supportNeeded', header: 'Support needed', width: 30, kind: 'longtext' },
  { key: 'backgroundNote', header: 'Background note', width: 36, kind: 'longtext' },
  { key: 'activityType', header: 'New activity type', width: 18, kind: 'text', note: 'Optional, with "New activity". Default: Other' },
  { key: 'activityContent', header: 'New activity (logged on import)', width: 40, kind: 'longtext', note: 'Fill to log an activity dated today' },
]

/** Values sent by the app to the import API (cells already parsed: dates as YYYY-MM-DD, numbers as numbers). */
export type ImportRow = { row: number } & Partial<Record<string, string | number | null>>

export interface ImportResultRow {
  row: number
  oppCode: string | null
  action: 'update' | 'create' | 'skip' | 'error'
  changes: string[]
  warnings: string[]
  errors: string[]
  /** after apply */
  done?: boolean
}
export interface ImportResponse {
  applied: boolean
  rows: ImportResultRow[]
  summary: { update: number, create: number, skip: number, error: number }
}
