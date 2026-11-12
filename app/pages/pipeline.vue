<script setup lang="ts">
import type { OppItem, OppListResponse } from '#shared/types'
import { WARNING_META, type WarningCode } from '#shared/rules'
import { STAGE_SHORT, WARNING_LABEL } from '#shared/constants'

useHead({ title: 'Pipeline · LCG Opportunity' })
const { $api } = useNuxtApp()
const route = useRoute()
const router = useRouter()
const me = useCurrentUser()
const { queryForApi, filter } = useOppFilters()
const { data, error, refresh } = await useAsyncData('pipeline',
  () => $api<OppListResponse>('/api/opportunities', { query: queryForApi.value }), { watch: [queryForApi] })

// Quick tabs (SRS S2): All / My opps / Highlight / Warnings / Key deals (+ On hold)
type TabId = 'all' | 'mine' | 'warn' | 'key' | 'hold' | 'highlight' | 'closed'
const isMine = (o: OppItem) => [o.salesOwnerId, o.viOwnerId, o.actionOwnerId].includes(me.value?.id ?? -1)
const hasHigh = (o: OppItem) => o.warnings.some(c => WARNING_META[c].severity === 'High')
const tabs: { id: TabId, label: string, f: (o: OppItem) => boolean }[] = [
  { id: 'all', label: 'Open', f: o => o.status !== 'Closed' },
  { id: 'mine', label: 'My opps', f: o => isMine(o) && o.status !== 'Closed' },
  { id: 'highlight', label: 'Highlight', f: o => o.status !== 'Closed' && (o.isFocusPinned || dueInWindow(o)) },
  { id: 'warn', label: 'High warnings', f: hasHigh },
  { id: 'key', label: 'Key deals', f: o => o.isKeyDeal },
  { id: 'hold', label: 'On hold', f: o => o.status === 'On Hold' },
  { id: 'closed', label: 'Won / Lost', f: o => o.status === 'Closed' },
]
function dueInWindow(o: OppItem) {
  if (!o.dueDate || !data.value) return false
  const t = new Date(`${data.value.today}T00:00:00Z`)
  const dow = t.getUTCDay() || 7
  const mon = new Date(t.getTime() - (dow - 1) * 864e5).toISOString().slice(0, 10)
  const sun2 = new Date(t.getTime() + (14 - dow) * 864e5).toISOString().slice(0, 10)
  return o.dueDate >= mon && o.dueDate <= sun2
}
const tab = computed<TabId>(() => (tabs.some(t => t.id === route.query.tab) ? route.query.tab as TabId : 'all'))
const warning = computed(() => (typeof route.query.warning === 'string' ? route.query.warning as WarningCode : null))
const setTab = (id: TabId) => router.replace({ query: { ...route.query, tab: id === 'all' ? undefined : id, warning: undefined } })

type SortKey = 'amountUsd' | 'expectedCloseDate' | 'daysSinceUpdate' | 'oppCode' | 'winRate'
const sortKey = ref<SortKey>('amountUsd')
const sortDir = ref<1 | -1>(-1)
function sortBy(k: SortKey) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 1 ? -1 : 1
  else { sortKey.value = k; sortDir.value = k === 'expectedCloseDate' || k === 'oppCode' ? 1 : -1 }
}
const arrow = (k: SortKey) => (sortKey.value === k ? (sortDir.value === 1 ? ' ▴' : ' ▾') : '')

const base = computed(() => data.value?.items ?? [])
const counts = computed(() => Object.fromEntries(tabs.map(t => [t.id, base.value.filter(t.f).length])))
const rows = computed(() => {
  const f = tabs.find(t => t.id === tab.value)!.f
  let list = base.value.filter(f)
  if (warning.value) list = base.value.filter(o => o.warnings.includes(warning.value!))
  const k = sortKey.value
  return [...list].sort((a, b) => {
    const av = a[k] ?? (k === 'daysSinceUpdate' ? 1e9 : ''), bv = b[k] ?? (k === 'daysSinceUpdate' ? 1e9 : '')
    return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir.value
  })
})
const pipelineUsd = computed(() => rows.value.filter(o => o.status !== 'Closed').reduce((s, o) => s + o.amountUsd, 0))

// Quick Update: button per row, or select a row and press "U" (SRS S4)
const selected = ref<number | null>(null)
const updating = ref<OppItem | null>(null)
function onKey(e: KeyboardEvent) {
  if (updating.value || (e.target as HTMLElement)?.closest('input, textarea, select')) return
  if (e.key.toLowerCase() === 'u' && selected.value) {
    const o = rows.value.find(r => r.id === selected.value)
    if (o?.canEdit) updating.value = o
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const i = rows.value.findIndex(r => r.id === selected.value)
    const next = rows.value[Math.min(rows.value.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]
    if (next) { selected.value = next.id; e.preventDefault() }
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
async function onSaved() {
  updating.value = null
  await refresh()
}

function exportCsv() {
  const cols: [string, (o: OppItem) => unknown][] = [
    ['Code', o => o.oppCode], ['Opportunity', o => o.name], ['Customer', o => o.customer], ['Industry', o => o.industry],
    ['Market', o => o.marketCode], ['Country', o => o.country], ['Partner', o => o.partner], ['Solution', o => o.solution],
    ['Deal type', o => o.dealType], ['Sales owner', o => o.salesOwner], ['VI owner', o => o.viOwner], ['Amount', o => o.amount],
    ['Currency', o => o.currency], ['Amount USD', o => o.amountUsd], ['Win %', o => o.winRate], ['Weighted USD', o => o.weightedUsd],
    ['Priority', o => o.priority], ['Deal size', o => o.dealSize], ['Status', o => o.status], ['Stage', o => o.stage],
    ['Latest activity', o => o.latestActivity], ['Latest update', o => o.latestUpdateDate], ['Next action', o => o.nextAction],
    ['Action owner', o => o.actionOwner], ['Due date', o => o.dueDate], ['Last contact', o => o.lastContactDate],
    ['Expected close', o => o.expectedCloseDate], ['Days since update', o => o.daysSinceUpdate], ['Health', o => o.health],
    ['Pending reason', o => o.pendingReason], ['Lost reason', o => o.lostReason], ['Warnings', o => o.warnings.join(' ')],
  ]
  const esc = (v: unknown) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const csv = [cols.map(c => c[0]).join(','), ...rows.value.map(o => cols.map(c => esc(c[1](o))).join(','))].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `pipeline-${data.value?.today ?? 'export'}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Pipeline</h1>
      <div class="sub">
        {{ rows.length }} opps · pipeline {{ fmtUsd(pipelineUsd) }} ·
        {{ filter.market?.length ? `Markets: ${filter.market.join(', ')}` : 'All your markets' }}
      </div>
    </div>
    <div class="row">
      <button type="button" class="btn" title="CSV opens in Excel; the Excel template export comes later" @click="exportCsv">Export CSV</button>
      <NuxtLink to="/opportunities/new" class="btn btn-primary">+ New Opp</NuxtLink>
    </div>
  </div>

  <FilterBar :market-counts="data?.marketCounts" />

  <div role="tablist" aria-label="Quick lists" class="tabs">
    <button v-for="t in tabs" :key="t.id" type="button" role="tab" class="tab" :aria-selected="!warning && tab === t.id" @click="setTab(t.id)">
      {{ t.label }}<span class="count">{{ counts[t.id] }}</span>
    </button>
    <span v-if="warning" class="tab" aria-selected="true" style="cursor: default">
      {{ warning }} · {{ WARNING_LABEL[warning] }}<span class="count">{{ rows.length }}</span>
    </span>
  </div>

  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>
  <div class="table-wrap">
    <table class="data" style="min-width: 1180px">
      <thead>
        <tr>
          <th class="sortable" @click="sortBy('oppCode')">Code{{ arrow('oppCode') }}</th>
          <th>Opportunity · Customer</th>
          <th>Mkt</th>
          <th>Partner</th>
          <th>Stage</th>
          <th class="num sortable" @click="sortBy('amountUsd')">Amount{{ arrow('amountUsd') }}</th>
          <th class="num sortable" @click="sortBy('winRate')">Win{{ arrow('winRate') }}</th>
          <th>Owner</th>
          <th class="sortable" @click="sortBy('daysSinceUpdate')">Latest activity{{ arrow('daysSinceUpdate') }}</th>
          <th class="sortable" @click="sortBy('expectedCloseDate')">Close{{ arrow('expectedCloseDate') }}</th>
          <th>Health</th>
          <th>Warnings</th>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="o in rows" :key="o.id"
          :class="{ overdue: o.warnings.includes('W3'), selected: selected === o.id }"
          @click="selected = o.id"
        >
          <td class="muted" style="white-space: nowrap">{{ o.oppCode }}</td>
          <td style="max-width: 300px">
            <NuxtLink :to="`/opportunities/${o.oppCode}`" style="font-weight: 600; text-decoration: none; color: var(--text)">{{ o.name }}</NuxtLink>
            <div class="muted">{{ o.customer }}</div>
          </td>
          <td style="font-weight: 600">{{ o.marketCode }}</td>
          <td>{{ o.partner }}</td>
          <td style="white-space: nowrap">
            <span class="badge">{{ STAGE_SHORT[o.stage] }}</span>
            <div v-if="o.status === 'On Hold'" class="small" style="color: var(--amber-fg); margin-top: 4px">On hold</div>
          </td>
          <td class="num" style="font-weight: 600" :title="amountTitle(o)">{{ o.amount ? fmtUsd(o.amountUsd) : '—' }}</td>
          <td class="num" :title="o.winRateOverride !== null ? `Override: ${o.winRateReason ?? 'no reason'}` : 'Stage default'">{{ o.winRate }}%</td>
          <td>{{ o.salesOwner }}</td>
          <td style="max-width: 260px; color: var(--text-2)">
            <div class="clamp">{{ o.latestActivity ?? '—' }}</div>
            <div class="small muted">{{ daysAgo(o.daysSinceUpdate) }}</div>
          </td>
          <td :style="{ whiteSpace: 'nowrap', color: o.warnings.includes('W3') ? 'var(--danger)' : 'var(--text-2)', fontWeight: o.warnings.includes('W3') ? 600 : 400 }">{{ o.expectedCloseDate }}</td>
          <td><HealthBadge :health="o.health" /></td>
          <td><WarningBadges :codes="o.warnings" /></td>
          <td>
            <button v-if="o.canEdit" type="button" class="btn btn-outline-primary" @click.stop="updating = o">Update</button>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="13" class="muted">No opportunities match.</td></tr>
      </tbody>
    </table>
  </div>
  <p class="small muted" style="margin: 0">
    Light-red rows = past Expected Close (W3). Hover a warning code for its name. Select a row and press <kbd>U</kbd> for Quick Update.
    Calculated on {{ data?.today }} (JST).
  </p>

  <QuickUpdateDrawer v-if="updating && data" :opp="updating" :today="data.today" @close="updating = null" @saved="onSaved" />
</template>

<style scoped>
.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sr-only { position: absolute; left: -9999px; }
tbody tr { cursor: default; }
kbd { border: 1px solid var(--border-strong); border-radius: 4px; padding: 0 4px; font-size: 11px; background: var(--surface); }
</style>
