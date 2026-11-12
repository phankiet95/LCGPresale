/** $2.82M / $348K / $950 (SRS 6.1: short amounts, full value on hover) */
export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`
  return `$${Math.round(n)}`
}

export function fmtFull(n: number, currency = 'USD') {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)} ${currency}`
}

export function amountTitle(o: { amount: number, currency: string, amountUsd: number }) {
  return o.currency === 'USD' ? fmtFull(o.amountUsd) : `${fmtFull(o.amountUsd)} (${fmtFull(o.amount, o.currency)})`
}

export function daysAgo(d: number | null | undefined) {
  if (d === null || d === undefined) return 'no update yet'
  if (d === 0) return 'today'
  if (d < 0) return `in ${-d} days`
  return `${d} day${d === 1 ? '' : 's'} ago`
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 16)
}

/** Message from a $fetch / createError failure */
export function errMsg(e: unknown): string {
  const err = e as { data?: { statusMessage?: string, message?: string, data?: { issues?: { message: string }[] } }, statusMessage?: string, message?: string }
  // zod validation failure (readValidatedBody): show the field messages, e.g. "Lost reason is required"
  const issues = err?.data?.data?.issues
  if (issues?.length) return issues.map(i => i.message).join('; ')
  const raw = err?.data?.statusMessage ?? err?.data?.message ?? err?.statusMessage ?? err?.message ?? 'Something went wrong'
  // zod errors arrive as a JSON array of issues
  if (raw.startsWith('[')) {
    try {
      return (JSON.parse(raw) as { path: string[], message: string }[]).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    }
    catch { /* keep raw */ }
  }
  return raw
}
