import { z } from 'zod'
import type { ImportResponse, ImportResultRow } from '#shared/excel-columns'
import type { OppItem } from '#shared/types'
import { normalizeCustomerName } from '#shared/normalize'
import { eq } from 'drizzle-orm'

/**
 * Excel import (round-trip of the Pipeline export). `apply: false` = preview only (nothing is written).
 *  - row with an OPP code  -> update that opp (only the cells that differ) + optional new activity
 *  - row without a code    -> create a new opp
 *  - nothing is ever deleted; read-only columns are ignored.
 * Every write goes through server/utils/opp-ops.ts, i.e. the same rules and permissions as the screens.
 */
const Body = z.object({
  apply: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(2000),
})

const OPEN = ['O', 'D', 'C', 'B', 'A']
const errText = (e: unknown) => {
  const x = e as { statusMessage?: string, message?: string, issues?: { message: string, path: (string | number)[] }[], data?: { duplicates?: { oppCode: string }[] } }
  if (x?.issues) return x.issues.map(i => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ')
  if (x?.statusMessage === 'POSSIBLE_DUPLICATE') return `Possible duplicate of ${x.data?.duplicates?.map(d => d.oppCode).join(', ')}`
  return x?.statusMessage ?? x?.message ?? 'Error'
}

export default defineEventHandler(async (event): Promise<ImportResponse> => {
  const user = await requireUser(event)
  if (!['admin', 'market_lead', 'sales'].includes(user.role)) throw createError({ statusCode: 403, statusMessage: 'Not allowed for your role' })
  const { apply, rows } = await readValidatedBody(event, Body.parse)
  const db = useDb(event)

  const [{ items, today, settings }, partners, countries, users] = await Promise.all([
    loadOpps(db, user, {}),
    db.select({ id: tables.partners.id, name: tables.partners.name }).from(tables.partners),
    db.select({ id: tables.countries.id, name: tables.countries.name, marketCode: tables.countries.marketCode }).from(tables.countries),
    db.select({ id: tables.users.id, account: tables.users.account }).from(tables.users),
  ])
  const byCode = new Map(items.map(i => [i.oppCode.toUpperCase(), i]))
  const partnerId = new Map(partners.map(p => [p.name.toLowerCase(), p.id]))
  const userId = new Map(users.map(u => [u.account.toLowerCase(), u.id]))
  const countryOf = (market: string, name: string | null) => {
    const inMarket = countries.filter(c => c.marketCode === market)
    return name ? inMarket.find(c => c.name.toLowerCase() === name.toLowerCase()) : inMarket[0]
  }

  const out: ImportResultRow[] = []
  for (const raw of rows) {
    const s = (k: string) => {
      const v = raw[k]
      if (v === null || v === undefined) return null
      const t = String(v).trim()
      return t ? t : null
    }
    const n = (k: string) => {
      const v = raw[k]
      if (v === null || v === undefined || v === '') return null
      const x = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, ''))
      return Number.isFinite(x) ? x : Number.NaN
    }
    const r: ImportResultRow = { row: Number(raw.row) || 0, oppCode: s('oppCode')?.toUpperCase() ?? null, action: 'skip', changes: [], warnings: [], errors: [] }
    out.push(r)
    // Accounts typed in the sheet; unknown ones become inactive users when applied
    const person = (k: string, label: string) => {
      const acc = s(k)
      if (!acc) return { acc: null, known: true }
      if (!ACCOUNT_RE.test(acc)) {
        r.errors.push(`${label}: "${acc}" is not a valid account`)
        return { acc: null, known: true }
      }
      const known = userId.has(acc.toLowerCase())
      if (!known) r.warnings.push(`${label} "${acc}" is not a user yet: an inactive user will be created`)
      return { acc, known }
    }
    const resolve = async (acc: string | null) => (acc ? (await resolveAccount(db, acc)).id : null)

    try {
      const activity = s('activityContent')
      if (r.oppCode) {
        // ------------------------------------------------ update
        const item = byCode.get(r.oppCode)
        if (!item) {
          r.errors.push('OPP code not found (or outside your markets)')
          r.action = 'error'
          continue
        }
        if (!item.canEdit) {
          r.errors.push('You cannot edit this opportunity')
          r.action = 'error'
          continue
        }
        const edit: Record<string, unknown> = {}
        const norm = (v: unknown) => (v === null || v === undefined || v === '' ? null : typeof v === 'string' ? v.trim() : v)
        const diff = (label: string, before: unknown, after: unknown, set: () => void) => {
          const a = norm(before)
          const b = norm(after)
          const same = typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() && a === b : a === b
          if (!same) {
            r.changes.push(`${label}: ${a ?? '—'} → ${b ?? '—'}`)
            set()
          }
        }
        const req = (k: string, label: string) => {
          const v = s(k)
          if (!v) r.errors.push(`${label} is required`)
          return v
        }

        const name = req('name', 'Opportunity name')
        if (name) diff('Name', item.name, name, () => (edit.name = name))
        const market = s('market')?.toUpperCase() ?? item.marketCode
        diff('Market', item.marketCode, market, () => (edit.marketCode = market))
        const countryName = s('country')
        if (countryName || market !== item.marketCode) {
          const c = countryOf(market, countryName)
          if (!c) r.errors.push(`Country "${countryName}" is not in market ${market}`)
          else diff('Country', item.country, c.name, () => (edit.countryId = c.id))
        }
        const partner = req('partner', 'Partner')
        if (partner) {
          const pid = partnerId.get(partner.toLowerCase())
          if (!pid) r.errors.push(`Unknown partner "${partner}"`)
          else diff('Partner', item.partner.toLowerCase(), partner.toLowerCase(), () => (edit.partnerId = pid))
        }
        const texts: [string, string, keyof OppItem][] = [
          ['secondaryPartner', 'Secondary partner', 'secondaryPartner'], ['solution', 'Solution', 'solution'],
          ['dealType', 'Deal type', 'dealType'], ['industry', 'Industry', 'industry'], ['priority', 'Priority', 'priority'],
          ['winRateReason', 'Win-rate reason', 'winRateReason'], ['nextAction', 'Next action', 'nextAction'],
          ['blockingIssue', 'Blocking issue', 'blockingIssue'], ['supportNeeded', 'Support needed', 'supportNeeded'],
          ['backgroundNote', 'Background note', 'backgroundNote'], ['viOwner', 'VI owner', 'viOwner'], ['biddingLead', 'Bidding lead', 'biddingLead'],
        ]
        for (const [k, label, f] of texts) {
          const v = s(k)
          diff(label, item[f], v, () => (edit[k] = v))
        }
        const so = person('salesOwner', 'Sales owner')
        if (!so.acc) r.errors.push('Sales owner is required')
        else diff('Sales owner', item.salesOwner?.toLowerCase(), so.acc.toLowerCase(), () => (edit.salesOwnerAccount = so.acc))
        const co = person('coordinator', 'Coordinator')
        const ao = person('actionOwner', 'Action owner')
        let coChanged = false
        let aoChanged = false
        diff('Coordinator', item.coordinator?.toLowerCase(), co.acc?.toLowerCase(), () => (coChanged = true))
        diff('Action owner', item.actionOwner?.toLowerCase(), ao.acc?.toLowerCase(), () => (aoChanged = true))

        const amount = n('amount')
        if (amount === null || Number.isNaN(amount) || amount < 0) r.errors.push('Amount must be a number ≥ 0 (0 = not estimated)')
        else diff('Amount', item.amount, amount, () => (edit.amount = amount))
        const currency = s('currency')?.toUpperCase() ?? item.currency
        diff('Currency', item.currency, currency, () => (edit.currency = currency))
        const stage = s('stage')?.toUpperCase()
        if (stage && stage !== item.stage) {
          if (!OPEN.includes(stage) || item.status === 'Closed') r.errors.push(`Stage ${item.stage} → ${stage}: use Mark Won / Lost / Reopen in the app`)
          else diff('Stage', item.stage, stage, () => (edit.stage = stage))
        }
        const wr = n('winRateOverride')
        if (Number.isNaN(wr)) r.errors.push('Win rate override must be a number 0–100')
        else diff('Win rate override', item.winRateOverride, wr, () => (edit.winRateOverride = wr))
        const close = req('expectedCloseDate', 'Expected close')
        if (close) diff('Expected close', item.expectedCloseDate, close, () => (edit.expectedCloseDate = close))
        diff('Due date', item.dueDate, s('dueDate'), () => (edit.dueDate = s('dueDate')))
        if (activity) r.changes.push(`New activity (${s('activityType') ?? 'Other'}): ${activity.length > 80 ? `${activity.slice(0, 80)}…` : activity}`)

        // shape check without the people ids (resolved on apply)
        const check = EditFields.safeParse(edit)
        if (!check.success) r.errors.push(errText(check.error))
        if (activity) {
          const a = ActivityFields.safeParse({ type: s('activityType') ?? 'Other', activityDate: today, content: activity })
          if (!a.success) r.errors.push(errText(a.error))
        }
        r.action = r.errors.length ? 'error' : r.changes.length ? 'update' : 'skip'
        if (!apply || r.action !== 'update') continue

        if (coChanged) edit.coordinatorId = await resolve(co.acc)
        if (aoChanged) edit.actionOwnerId = await resolve(ao.acc)
        const loaded = await loadOppByCode(event, user, item.oppCode)
        if (Object.keys(edit).length) await editOpp(db, user, settings, today, loaded.row, EditFields.parse(edit))
        if (activity) {
          const fresh = await loadOppByCode(event, user, item.oppCode)
          await logActivity(db, user, settings, today, fresh.row, ActivityFields.parse({ type: s('activityType') ?? 'Other', activityDate: today, content: activity }))
        }
        r.done = true
      }
      else {
        // ------------------------------------------------ create
        const name = s('name')
        if (!name) {
          // a completely empty line is not an error
          if (Object.entries(raw).every(([k, v]) => k === 'row' || v === null || v === '')) continue
          r.errors.push('Opportunity name is required')
        }
        const customer = s('customer')
        if (!customer) r.errors.push('Customer is required for a new opportunity')
        const market = s('market')?.toUpperCase() ?? ''
        if (!market) r.errors.push('Market is required')
        else if (!canCreateIn(user, market)) r.errors.push(`You cannot create opportunities in market ${market}`)
        const country = market ? countryOf(market, s('country')) : undefined
        if (market && !country) r.errors.push(`Country "${s('country')}" is not in market ${market}`)
        const partner = s('partner')
        const pid = partner ? partnerId.get(partner.toLowerCase()) : undefined
        if (!pid) r.errors.push(partner ? `Unknown partner "${partner}"` : 'Partner is required')
        const so = person('salesOwner', 'Sales owner')
        const co = person('coordinator', 'Coordinator')
        const ao = person('actionOwner', 'Action owner')
        const stage = (s('stage')?.toUpperCase() ?? 'O')
        if (!OPEN.includes(stage)) r.errors.push('A new opportunity starts in stage O, D, C, B or A')
        const amount = n('amount') ?? 0
        const wr = n('winRateOverride')
        const input = {
          name, newCustomerName: customer, industry: s('industry'), marketCode: market, countryId: country?.id,
          partnerId: pid, secondaryPartner: s('secondaryPartner'), solution: s('solution'), dealType: s('dealType') ?? '',
          salesOwnerAccount: so.acc ?? user.account, amount, currency: s('currency')?.toUpperCase() ?? 'USD', stage,
          winRateOverride: wr, winRateReason: s('winRateReason'), priority: s('priority'),
          expectedCloseDate: s('expectedCloseDate') ?? '', nextAction: s('nextAction'), dueDate: s('dueDate'),
          blockingIssue: s('blockingIssue'), supportNeeded: s('supportNeeded'), backgroundNote: s('backgroundNote'), viOwner: s('viOwner'), biddingLead: s('biddingLead'),
          confirmDuplicate: true,
        }
        const check = CreateFields.safeParse(input)
        if (!check.success) r.errors.push(errText(check.error))
        // duplicate check (SRS 5.11) against an existing customer with the same normalised name
        if (customer && pid && name) {
          const c = await db.query.customers.findFirst({ where: eq(tables.customers.normalizedName, normalizeCustomerName(customer)) })
          if (c) {
            const dups = await findDuplicates(db, { customerId: c.id, partnerId: pid, name })
            if (dups.length) r.errors.push(`Possible duplicate of ${dups.map(d => d.oppCode).join(', ')} — put that code in "OPP code" to update it instead`)
          }
          else r.warnings.push(`New customer "${customer}" will be created`)
        }
        r.changes.push(`New opportunity in ${market || '?'} · ${partner ?? '?'} · stage ${stage}`)
        if (activity) r.changes.push(`New activity: ${activity.length > 80 ? `${activity.slice(0, 80)}…` : activity}`)
        r.action = r.errors.length ? 'error' : 'create'
        if (!apply || r.action !== 'create' || !check.success) continue

        const created = await createOpp(db, user, settings, today, {
          ...check.data,
          coordinatorId: await resolve(co.acc), actionOwnerId: await resolve(ao.acc),
        })
        r.oppCode = created.oppCode
        if (activity) {
          const fresh = await loadOppByCode(event, user, created.oppCode)
          await logActivity(db, user, settings, today, fresh.row, ActivityFields.parse({ type: s('activityType') ?? 'Other', activityDate: today, content: activity }))
        }
        r.done = true
      }
    }
    catch (e) {
      r.errors.push(errText(e))
      r.action = 'error'
    }
  }

  const visible = out.filter(r => r.action !== 'skip' || r.oppCode)
  const count = (a: ImportResultRow['action']) => visible.filter(r => r.action === a).length
  return { applied: apply, rows: visible, summary: { update: count('update'), create: count('create'), skip: count('skip'), error: count('error') } }
})
