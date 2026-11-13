import type { OppFilter } from './types'
import type { Stage } from './rules'

const LIST_KEYS = ['market', 'partner', 'owner', 'stage', 'dealType', 'health'] as const

/** URL query (?market=JP,KR&partner=OutSystems) -> filter object (SRS 5.10: filters live in the URL). */
export function parseFilterQuery(query: Record<string, unknown>): OppFilter {
  const f: OppFilter = {}
  for (const k of LIST_KEYS) {
    const raw = query[k]
    const s = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : ''
    const list = s.split(',').map(x => x.trim()).filter(Boolean)
    if (list.length) (f as Record<string, string[]>)[k] = list
  }
  if (typeof query.q === 'string' && query.q.trim()) f.q = query.q.trim()
  const iso = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  // older links used closeFrom / closeTo
  f.dateFrom = iso(query.dateFrom) ?? iso(query.closeFrom)
  f.dateTo = iso(query.dateTo) ?? iso(query.closeTo)
  if (!f.dateFrom) delete f.dateFrom
  if (!f.dateTo) delete f.dateTo
  if (query.dateBy === 'created' || query.dateBy === 'update') f.dateBy = query.dateBy
  if (f.stage) f.stage = f.stage.filter((s): s is Stage => 'ODCBAWL'.includes(s) && s.length === 1)
  return f
}

export function toFilterQuery(f: OppFilter): Record<string, string> {
  const q: Record<string, string> = {}
  for (const k of LIST_KEYS) {
    const v = f[k]
    if (v?.length) q[k] = v.join(',')
  }
  if (f.q) q.q = f.q
  if (f.dateFrom) q.dateFrom = f.dateFrom
  if (f.dateTo) q.dateTo = f.dateTo
  if (f.dateBy && f.dateBy !== 'close') q.dateBy = f.dateBy
  return q
}
