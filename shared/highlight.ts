import { addDays, todayJst } from './rules'

/**
 * Highlight of the week — rule agreed with the Sales team (2026-11-13), replaces SRS 5.7:
 *   an OPEN opp is highlighted when
 *     (a) it was created in the report period: Previous Report Date < Created ≤ Report Date, or
 *     (b) its revenue is above HIGHLIGHT_USD (amount in USD).
 *   The report date is the Thursday of each week.
 */
export const REPORT_WEEKDAY = 4 // Thursday (0 = Sunday)
export const HIGHLIGHT_USD = 200_000

export interface ReportPeriod { previous: string, report: string }
export interface HighlightTag { kind: 'new' | 'revenue', label: string, date?: string }

const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()

/** The report (Thursday) on or after `ref`, and the one before it. */
export function reportPeriod(ref: string): ReportPeriod {
  const report = addDays(ref, (REPORT_WEEKDAY - dow(ref) + 7) % 7)
  return { previous: addDays(report, -7), report }
}

/** JST calendar date of a stored UTC timestamp. */
export const createdJst = (createdAt: string) => todayJst(new Date(createdAt))

export function highlightTags(
  o: { status: string, createdAt: string, amountUsd: number },
  period: ReportPeriod,
  thresholdUsd = HIGHLIGHT_USD,
): HighlightTag[] {
  if (o.status === 'Closed') return []
  const tags: HighlightTag[] = []
  const created = createdJst(o.createdAt)
  if (created > period.previous && created <= period.report) tags.push({ kind: 'new', label: 'New this period', date: created })
  if (o.amountUsd > thresholdUsd) tags.push({ kind: 'revenue', label: `Revenue > $${thresholdUsd / 1000}K` })
  return tags
}
