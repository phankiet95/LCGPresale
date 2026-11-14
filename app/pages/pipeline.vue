<script setup lang="ts">
import { highlightTags, reportPeriod } from '#shared/highlight'
import type { OppItem, OppListResponse } from '#shared/types'
import { WARNING_META, type WarningCode } from '#shared/rules'
import { HEALTH_BUCKET, STAGE_SHORT, WARNING_LABEL } from '#shared/constants'
import { BriefcaseBusiness, Download, Info, Plus, SearchX, SquarePen, Trash2, Upload } from 'lucide-vue-next'

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
  { id: 'highlight', label: 'Highlight', f: o => !!data.value && highlightTags(o, reportPeriod(data.value.today)).length > 0 },
  { id: 'warn', label: 'High warnings', f: hasHigh },
  { id: 'key', label: 'Key deals', f: o => o.isKeyDeal },
  { id: 'hold', label: 'On hold', f: o => o.status === 'On Hold' },
  { id: 'closed', label: 'Won / Lost', f: o => o.status === 'Closed' },
]
const tab = computed<TabId>(() => (tabs.some(t => t.id === route.query.tab) ? route.query.tab as TabId : 'all'))
const warning = computed(() => (typeof route.query.warning === 'string' ? route.query.warning as WarningCode : null))
const setTab = (id: TabId) => router.replace({ query: { ...route.query, tab: id === 'all' ? undefined : id, warning: undefined } })


const base = computed(() => data.value?.items ?? [])
const counts = computed(() => Object.fromEntries(tabs.map(t => [t.id, base.value.filter(t.f).length])))
const filtered = computed(() => {
  if (warning.value) return base.value.filter(o => o.warnings.includes(warning.value!))
  return base.value.filter(tabs.find(t => t.id === tab.value)!.f)
})
const STAGE_RANK = { O: 0, D: 1, C: 2, B: 3, A: 4, W: 5, L: 6 } as const
const HEALTH_RANK = { Red: 0, Amber: 1, Green: 2, Closed: 3 } as const
const sort = useTableSort(filtered, {
  key: 'amountUsd', dir: -1,
  descFirst: ['amountUsd', 'winRate', 'daysSinceUpdate', 'warnings'],
  get: {
    stage: o => STAGE_RANK[o.stage],
    health: o => HEALTH_RANK[HEALTH_BUCKET(o.health)],
    daysSinceUpdate: o => o.daysSinceUpdate ?? 1e9,
    warnings: o => o.warnings.length,
  },
})
const rows = sort.rows
const isRed = (o: OppItem) => HEALTH_BUCKET(o.health) === 'Red' || o.warnings.includes('W3')
const pipelineUsd = computed(() => rows.value.filter(o => o.status !== 'Closed').reduce((s, o) => s + o.amountUsd, 0))

// Update (activity + all fields): button per row, or select a row and press "U" (SRS S4)
const selected = ref<number | null>(null)
const updating = ref<OppItem | null>(null)
const deleting = ref<OppItem | null>(null)
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

const { data: meta } = await useMeta()
const exporting = ref(false)
const importing = ref(false)
async function exportExcel() {
  exporting.value = true
  try { await exportOppsToExcel(rows.value, meta.value, `pipeline-${data.value?.today ?? 'export'}.xlsx`) }
  finally { exporting.value = false }
}

// Overview of the opps currently listed (follows tabs + filters)
const overview = computed(() => {
  const list = rows.value
  const open = list.filter(o => o.status !== 'Closed')
  const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0)
  const pipeline = sum(open.map(o => o.amountUsd))
  const health = { Green: 0, Amber: 0, Red: 0 }
  for (const o of open) {
    const h = HEALTH_BUCKET(o.health)
    if (h !== 'Closed') health[h]++
  }
  const today = data.value?.today ?? ''
  const in30 = today ? new Date(Date.parse(`${today}T00:00:00Z`) + 30 * 864e5).toISOString().slice(0, 10) : ''
  return {
    total: list.length,
    open: open.length,
    pipeline,
    weighted: sum(open.map(o => o.weightedUsd)),
    avgWin: open.length ? Math.round(sum(open.map(o => o.winRate)) / open.length) : 0,
    health,
    warnings: open.filter(o => o.warnings.length).length,
    overdue: open.filter(o => o.warnings.includes('W3')).length,
    closing30: open.filter(o => o.expectedCloseDate >= today && o.expectedCloseDate <= in30).length,
    won: list.filter(o => o.stage === 'W').length,
  }
})
const HEALTH_COLOR = { Green: 'var(--green)', Amber: 'var(--amber)', Red: 'var(--red)' } as const
</script>

<template>
  <div class="page-head">
    <div>
      <PageTitle :icon="BriefcaseBusiness" title="Pipeline" />
      <div class="sub indent">
        {{ rows.length }} opps · pipeline {{ fmtUsd(pipelineUsd) }} ·
        {{ filter.market?.length ? `Markets: ${filter.market.join(', ')}` : 'All your markets' }}
      </div>
    </div>
    <div class="row">
      <button type="button" class="btn" title="Download the listed opps as Excel; edit and import it back" :disabled="exporting || !rows.length" @click="exportExcel"><Download class="ico" aria-hidden="true" />{{ exporting ? 'Preparing…' : 'Export Excel' }}</button>
      <button v-if="me && ['admin', 'market_lead', 'sales'].includes(me.role)" type="button" class="btn" title="Update or add opps from an exported Excel file" @click="importing = true"><Upload class="ico" aria-hidden="true" />Import Excel</button>
      <NuxtLink to="/opportunities/new" class="btn btn-primary"><Plus class="ico" aria-hidden="true" />New Opp</NuxtLink>
    </div>
  </div>

  <FilterBar :market-counts="data?.marketCounts" />

  <section v-if="data" class="ov card" aria-label="Overview">
    <div class="ov-cell"><span class="ov-k">Opportunities</span><span class="ov-v"><AnimatedNumber :value="overview.total" /></span><span class="ov-s">{{ overview.open }} open · {{ overview.won }} won</span></div>
    <div class="ov-cell"><span class="ov-k">Pipeline</span><span class="ov-v"><AnimatedNumber :value="overview.pipeline" :format="fmtUsd" /></span><span class="ov-s">open opps, USD</span></div>
    <div class="ov-cell"><span class="ov-k">Weighted</span><span class="ov-v"><AnimatedNumber :value="overview.weighted" :format="fmtUsd" /></span><span class="ov-s">avg win rate {{ overview.avgWin }}%</span></div>
    <div class="ov-cell wide">
      <span class="ov-k">Health of open opps</span>
      <div v-if="overview.open" class="ov-bar" role="img" :aria-label="`Green ${overview.health.Green}, Amber ${overview.health.Amber}, Red ${overview.health.Red}`">
        <template v-for="(n, h) in overview.health" :key="h">
          <span v-if="n" v-tip="`${h}: ${n}`" class="bar-fill" :style="{ flex: `${n} 1 0`, background: HEALTH_COLOR[h] }">{{ n }}</span>
        </template>
      </div>
      <span v-else class="ov-s">—</span>
      <span class="ov-s"><span class="dot" style="background: var(--green)" />{{ overview.health.Green }} · <span class="dot" style="background: var(--amber)" />{{ overview.health.Amber }} · <span class="dot" style="background: var(--red)" />{{ overview.health.Red }}</span>
    </div>
    <div class="ov-cell"><span class="ov-k">With warnings</span><span class="ov-v" :class="{ bad: overview.warnings }"><AnimatedNumber :value="overview.warnings" /></span><span class="ov-s">{{ overview.overdue }} past close date</span></div>
    <div class="ov-cell"><span class="ov-k">Closing ≤ 30 days</span><span class="ov-v"><AnimatedNumber :value="overview.closing30" /></span><span class="ov-s">expected close</span></div>
  </section>

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
          <SortTh :sort="sort" k="oppCode">Code</SortTh>
          <SortTh :sort="sort" k="name">Opportunity · Customer</SortTh>
          <SortTh :sort="sort" k="marketCode">Mkt</SortTh>
          <SortTh :sort="sort" k="partner">Partner</SortTh>
          <SortTh :sort="sort" k="stage">Stage</SortTh>
          <SortTh :sort="sort" k="amountUsd" num>Amount</SortTh>
          <SortTh :sort="sort" k="winRate" num>Win</SortTh>
          <SortTh :sort="sort" k="salesOwner">Owner</SortTh>
          <SortTh :sort="sort" k="daysSinceUpdate">Latest activity</SortTh>
          <SortTh :sort="sort" k="expectedCloseDate">Close</SortTh>
          <SortTh :sort="sort" k="health">Health</SortTh>
          <SortTh :sort="sort" k="warnings">Warnings</SortTh>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="o in rows" :key="o.id"
          :class="{ 'row-red': isRed(o), selected: selected === o.id }"
          @click="selected = o.id"
        >
          <td class="muted" style="white-space: nowrap">{{ o.oppCode }}</td>
          <td style="max-width: 300px">
            <NuxtLink v-tip :to="`/opportunities/${o.oppCode}`" class="clamp-2" style="font-weight: 600; text-decoration: none; color: var(--text)">{{ o.name }}</NuxtLink>
            <div v-tip class="muted truncate">{{ o.customer }}</div>
          </td>
          <td><span class="mkt-cell"><MarketFlag :code="o.marketCode" />{{ o.marketCode }}</span></td>
          <td><div v-tip class="truncate" style="max-width: 130px">{{ o.partner }}</div></td>
          <td style="white-space: nowrap">
            <span class="badge">{{ STAGE_SHORT[o.stage] }}</span>
            <div v-if="o.status === 'On Hold'" class="small" style="color: var(--amber-fg); margin-top: 4px">On hold</div>
          </td>
          <td class="num" style="font-weight: 600" :title="amountTitle(o)">{{ o.amount ? fmtUsd(o.amountUsd) : '—' }}</td>
          <td class="num" :title="o.winRateOverride !== null ? `Override: ${o.winRateReason ?? 'no reason'}` : 'Stage default'">{{ o.winRate }}%</td>
          <td>{{ o.salesOwner }}</td>
          <td style="max-width: 260px; color: var(--text-2)">
            <div v-tip class="clamp">{{ o.latestActivity ?? '—' }}</div>
            <div class="small muted">{{ daysAgo(o.daysSinceUpdate) }}</div>
          </td>
          <td :style="{ whiteSpace: 'nowrap', color: o.warnings.includes('W3') ? 'var(--danger)' : 'var(--text-2)', fontWeight: o.warnings.includes('W3') ? 600 : 400 }">{{ o.expectedCloseDate }}</td>
          <td><HealthBadge :health="o.health" /></td>
          <td><WarningBadges :codes="o.warnings" /></td>
          <td>
            <span class="row-actions">
              <button v-if="o.canEdit" type="button" class="btn btn-outline-primary" @click.stop="updating = o"><SquarePen class="ico" aria-hidden="true" />Update</button>
              <button v-if="o.canDelete" type="button" class="icon-btn danger" title="Delete" aria-label="Delete" @click.stop="deleting = o"><Trash2 class="ico" aria-hidden="true" /></button>
            </span>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="13"><div class="empty"><SearchX class="ico" aria-hidden="true" />No opportunities match these filters.</div></td></tr>
      </tbody>
    </table>
  </div>
  <p class="small muted row" style="margin: 0; gap: 6px">
    <Info class="ico" aria-hidden="true" />Light-red rows = Red health or past Expected Close (W3). Hover a warning code for its name. Select a row and press <kbd>U</kbd> to update it.
    Calculated on {{ data?.today }} (JST).
  </p>

  <DeleteOppDialog v-if="deleting" :opp="deleting" @close="deleting = null" @deleted="deleting = null; refresh()" />
  <ImportExcelDialog v-if="importing" @close="importing = false" @done="refresh()" />
  <OppUpdateDrawer v-if="updating && data" :opp="updating" :today="data.today" @close="updating = null" @saved="onSaved" />
</template>

<style scoped>
.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sr-only { position: absolute; left: -9999px; }
tbody tr { cursor: default; }
.row-actions { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.icon-btn { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--muted); cursor: pointer; transition: background-color var(--dur), color var(--dur), border-color var(--dur); }
.icon-btn .ico { width: 17px; height: 17px; }
.icon-btn:hover { background: var(--surface-2); border-color: var(--border); color: var(--text); }
.icon-btn.danger:hover { background: var(--danger-soft); border-color: var(--danger-border); color: var(--danger); }
.ov { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0; padding: 0; overflow: hidden; }
.ov-cell { display: flex; flex-direction: column; gap: 3px; padding: 14px 16px; border-right: 1px solid var(--row-border); min-width: 0; }
.ov-cell:last-child { border-right: 0; }
.ov-cell.wide { grid-column: span 2; }
.ov-k { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.ov-v { font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
.ov-v.bad { color: var(--danger); }
.ov-s { font-size: 12px; color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
.ov-bar { display: flex; height: 22px; border-radius: 6px; overflow: hidden; margin: 4px 0 2px; gap: 2px; }
.ov-bar span { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--surface); min-width: 18px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
@media (max-width: 720px) { .ov-cell.wide { grid-column: auto; } .ov-cell { border-right: 0; border-bottom: 1px solid var(--row-border); } }
kbd { border: 1px solid var(--border-strong); border-radius: 4px; padding: 0 4px; font-size: 11px; background: var(--surface); }
</style>
