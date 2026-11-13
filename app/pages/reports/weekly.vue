<script setup lang="ts">
import type { OppItem, RecommendationItem, WeeklyReportResponse } from '#shared/types'
import { WARNING_META } from '#shared/rules'
import { HEALTH_BUCKET, STAGE_SHORT, WARNING_LABEL } from '#shared/constants'
import { CalendarRange, ChartNoAxesColumn, ChevronLeft, ChevronRight, Earth, Layers, Lightbulb, Plus, Printer, ShieldAlert, Sparkles, TrendingUp, TriangleAlert } from 'lucide-vue-next'

useHead({ title: 'Weekly Report · LCG Opportunity' })
type TopRow = WeeklyReportResponse['topMgmt'][number]
const { $api } = useNuxtApp()
const route = useRoute()
const router = useRouter()
const user = useCurrentUser()
const { queryForApi } = useOppFilters()
const { data: meta } = await useMeta()

const week = computed(() => (typeof route.query.week === 'string' ? route.query.week : ''))
const { data, error, status, refresh } = await useAsyncData('weekly-report',
  () => $api<WeeklyReportResponse>('/api/reports/weekly', { query: { ...queryForApi.value, ...(week.value ? { week: week.value } : {}) } }),
  { watch: [queryForApi, week] })

const setWeek = (w: string) => router.replace({ query: { ...route.query, week: w === data.value?.weeks[0] ? undefined : w } })
const weekIdx = computed(() => data.value?.weeks.indexOf(data.value.week.start) ?? 0)
const step = (n: number) => {
  const w = data.value?.weeks[weekIdx.value - n]
  if (w) setWeek(w)
}
const pipelineLink = (extra: Record<string, string> = {}) => ({ path: '/pipeline', query: { ...queryForApi.value, ...extra } })

const changeChips = computed(() => {
  const c = data.value?.changes
  if (!c) return []
  return [
    { label: 'New', n: c.newOpps, tone: 'up' },
    { label: 'Won', n: c.won, tone: 'up' },
    { label: 'Lost', n: c.lost, tone: 'down' },
    { label: 'Stage up', n: c.stageUp, tone: 'up' },
    { label: 'Stage down', n: c.stageDown, tone: 'down' },
    { label: 'Close date slipped', n: c.slipped, tone: 'down' },
  ]
})
const dtMax = computed(() => Math.max(1, ...(data.value?.projectVsLicense ?? []).map(d => d.pipelineUsd)))
const INVERT = new Set(['lost'])
const WARN_PREVIEW = 15
const showAllWarnings = ref(false)
const HEALTH_RANK = { Red: 0, Amber: 1, Green: 2, Closed: 3 } as const
const mhSort = useTableSort(() => data.value?.marketHealth, { descFirst: ['active', 'onHold', 'won', 'lost', 'pipelineUsd', 'weightedUsd', 'pctGreen', 'pctVerified'] })
const warnSort = useTableSort(() => data.value?.warningList, {
  descFirst: ['amountUsd', 'daysSinceUpdate', 'warnings'],
  get: { warnings: (o: OppItem) => o.warnings.length, daysSinceUpdate: (o: OppItem) => o.daysSinceUpdate ?? 1e9 },
})
const warningRows = computed(() => (showAllWarnings.value ? warnSort.rows.value : warnSort.rows.value.slice(0, WARN_PREVIEW)))
const topSort = useTableSort(() => data.value?.topMgmt, {
  descFirst: ['amount', 'changes'],
  get: {
    name: (t: TopRow) => t.opp.name, market: (t: TopRow) => t.opp.marketCode, stage: (t: TopRow) => 'ODCBAWL'.indexOf(t.opp.stage),
    amount: (t: TopRow) => t.opp.amountUsd, health: (t: TopRow) => HEALTH_RANK[HEALTH_BUCKET(t.opp.health)], changes: (t: TopRow) => t.changes.length,
  },
})
const isRed = (o: OppItem) => HEALTH_BUCKET(o.health) === 'Red' || o.warnings.includes('W3')

// ---- snapshot bootstrap (Admin)
const snapBusy = ref(false)
const snapMsg = ref('')
async function takeSnapshot() {
  snapBusy.value = true
  try {
    const r = await $api<{ weekStart: string, opps: number }>('/api/reports/snapshot', { method: 'POST' })
    snapMsg.value = `Snapshot saved for the week of ${fmtDay(r.weekStart, true)} (${r.opps} opps).`
    await refresh()
  }
  catch (e) { snapMsg.value = errMsg(e) }
  finally { snapBusy.value = false }
}

// ---- recommendations
type Draft = { id?: number, marketCode: string, finding: string, impact: string, recommendation: string, ownerId: number | '', targetDate: string }
const draft = ref<Draft | null>(null)
const saving = ref(false)
const formError = ref('')
function newRec() {
  draft.value = { marketCode: data.value?.recommendationMarkets[0] ?? '', finding: '', impact: '', recommendation: '', ownerId: '', targetDate: '' }
  formError.value = ''
}
function editRec(r: RecommendationItem) {
  draft.value = { id: r.id, marketCode: r.marketCode ?? '', finding: r.finding, impact: r.impact ?? '', recommendation: r.recommendation ?? '', ownerId: r.ownerId ?? '', targetDate: r.targetDate ?? '' }
  formError.value = ''
}
async function saveRec() {
  const d = draft.value
  if (!d || !data.value) return
  saving.value = true
  formError.value = ''
  const body = { marketCode: d.marketCode || null, finding: d.finding, impact: d.impact, recommendation: d.recommendation, ownerId: d.ownerId || null, targetDate: d.targetDate || null }
  try {
    if (d.id) await $api(`/api/reports/recommendations/${d.id}`, { method: 'PATCH', body })
    else await $api('/api/reports/recommendations', { method: 'POST', body: { ...body, weekStart: data.value.week.start } })
    draft.value = null
    await refresh()
  }
  catch (e) { formError.value = errMsg(e) }
  finally { saving.value = false }
}
const confirmDelete = ref<RecommendationItem | null>(null)
async function deleteRec() {
  if (!confirmDelete.value) return
  await $api(`/api/reports/recommendations/${confirmDelete.value.id}`, { method: 'DELETE' })
  confirmDelete.value = null
  await refresh()
}
const printPage = () => window.print()
</script>

<template>
  <div class="page-head">
    <div>
      <PageTitle :icon="CalendarRange" title="Weekly Report" />
      <div v-if="data" class="sub indent">
        Week of {{ fmtWeekRange(data.week.start, data.week.end) }}<template v-if="data.week.isCurrent"> · this week, live</template>
        · USD · {{ queryForApi.market ? `Markets: ${queryForApi.market}` : 'All your markets' }}
      </div>
    </div>
    <div class="row no-print">
      <button type="button" class="btn btn-sm" :disabled="!data || weekIdx >= data.weeks.length - 1" aria-label="Previous week" @click="step(-1)"><ChevronLeft class="ico" aria-hidden="true" /></button>
      <select class="select" style="height: 32px; width: auto; font-size: 13px" aria-label="Week" :value="data?.week.start" @change="setWeek(($event.target as HTMLSelectElement).value)">
        <option v-for="(w, i) in data?.weeks" :key="w" :value="w">{{ i === 0 ? 'This week · ' : i === 1 ? 'Last week · ' : '' }}{{ fmtDay(w, true) }}</option>
      </select>
      <button type="button" class="btn btn-sm" :disabled="!data || weekIdx <= 0" aria-label="Next week" @click="step(1)"><ChevronRight class="ico" aria-hidden="true" /></button>
      <button type="button" class="btn btn-sm" @click="printPage"><Printer class="ico" aria-hidden="true" />Print / PDF</button>
    </div>
  </div>

  <FilterBar :market-counts="data?.marketCounts" class="no-print" />

  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>
  <div v-else-if="data" class="stack" :class="{ refreshing: status === 'pending' }">
    <div v-if="!data.source.start || data.source.end === 'missing'" class="alert alert-info no-print">
      <template v-if="data.source.end === 'missing'">
        No snapshot was taken at the end of this week, so sections 3–5 and 7 show <b>today's</b> state.
      </template>
      <template v-if="!data.source.start">
        Last week's column for open opps, pipeline and weighted needs the Monday snapshot of {{ fmtDay(data.week.start, true) }}, which does not exist yet.
        Snapshots run automatically every Monday 00:05 JST<template v-if="data.source.latestSnapshot"> (latest: {{ fmtDay(data.source.latestSnapshot, true) }})</template>.
      </template>
      <span v-if="user?.role === 'admin' && data.week.isCurrent && !data.source.start" class="row" style="margin-top: 8px">
        <button type="button" class="btn btn-sm btn-outline-primary" :disabled="snapBusy" @click="takeSnapshot">{{ snapBusy ? 'Saving…' : 'Take this week\'s baseline snapshot now' }}</button>
      </span>
      <div v-if="snapMsg" class="small" style="margin-top: 6px">{{ snapMsg }}</div>
    </div>

    <!-- 1. Weekly summary -->
    <section class="grid-2">
      <div class="card stack" style="gap: 12px">
        <div class="row" style="justify-content: space-between"><h2 class="h-ico"><ChartNoAxesColumn class="ico" aria-hidden="true" />1 · Weekly summary</h2><span class="small muted">vs last week</span></div>
        <table class="data">
          <thead><tr><th>Metric</th><th class="num">This week</th><th class="num">Last week</th><th class="num">Δ</th></tr></thead>
          <tbody>
            <tr v-for="r in data.summary" :key="r.key">
              <td>
                <NuxtLink v-if="r.link" :to="pipelineLink(r.link)">{{ r.label }}</NuxtLink>
                <template v-else>{{ r.label }}</template>
              </td>
              <td class="num" style="font-weight: 700"><AnimatedNumber :value="r.current" :format="r.money ? fmtUsd : undefined" /></td>
              <td class="num muted">{{ r.previous === null ? '—' : r.money ? fmtUsd(r.previous) : r.previous }}</td>
              <td class="num"><DeltaChip :current="r.current" :previous="r.previous" :money="r.money" :invert="INVERT.has(r.key)" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card stack" style="gap: 12px">
        <h2 class="h-ico"><TrendingUp class="ico" aria-hidden="true" />What changed this week</h2>
        <div class="change-grid">
          <div v-for="c in changeChips" :key="c.label" class="change" :class="{ zero: !c.n }">
            <span class="change-n"><AnimatedNumber :value="c.n" /></span>
            <span class="small muted">{{ c.label }}</span>
          </div>
        </div>
        <div class="row" style="justify-content: space-between; border-top: 1px solid var(--chip); padding-top: 12px">
          <span class="small muted">Pipeline change (start → end of week)</span>
          <DeltaChip :current="data.changes.pipelineDeltaUsd" :previous="data.changes.pipelineDeltaUsd === null ? null : 0" money />
        </div>
      </div>
    </section>

    <!-- 2. Highlight -->
    <section class="card stack" style="gap: 12px">
      <div class="row" style="justify-content: space-between">
        <h2 class="h-ico"><Sparkles class="ico" aria-hidden="true" />2 · Highlight of the week</h2>
      </div>
      <HighlightList :items="data.highlights" :period="data.highlightPeriod" />
    </section>

    <!-- 3. Market health -->
    <section class="card stack" style="gap: 12px">
      <h2 class="h-ico"><Earth class="ico" aria-hidden="true" />3 · Market health</h2>
      <div style="overflow-x: auto">
        <table class="data" style="min-width: 760px">
          <thead>
            <tr>
              <SortTh :sort="mhSort" k="code">Market</SortTh><SortTh :sort="mhSort" k="active" num>Active</SortTh>
              <SortTh :sort="mhSort" k="onHold" num>On hold</SortTh><SortTh :sort="mhSort" k="won" num>Won</SortTh>
              <SortTh :sort="mhSort" k="lost" num>Lost</SortTh><SortTh :sort="mhSort" k="pipelineUsd" num>Pipeline</SortTh>
              <SortTh :sort="mhSort" k="weightedUsd" num>Weighted</SortTh><SortTh :sort="mhSort" k="pctGreen" style="width: 22%">% Green</SortTh>
              <SortTh :sort="mhSort" k="pctVerified" num>% Verified</SortTh>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in mhSort.rows.value" :key="m.code">
              <td><NuxtLink :to="pipelineLink({ market: m.code })" class="mkt-cell" style="text-decoration: none"><MarketFlag :code="m.code" />{{ m.code }}</NuxtLink></td>
              <td class="num">{{ m.active }}</td>
              <td class="num">{{ m.onHold }}</td>
              <td class="num">{{ m.won }}</td>
              <td class="num">{{ m.lost }}</td>
              <td class="num" style="font-weight: 600" :title="fmtFull(m.pipelineUsd)">{{ fmtUsd(m.pipelineUsd) }}</td>
              <td class="num muted">{{ fmtUsd(m.weightedUsd) }}</td>
              <td>
                <span v-if="m.pctGreen === null" class="muted">—</span>
                <span v-else class="pct"><span class="track sm"><span class="bar-fill" :style="{ width: `${m.pctGreen}%`, background: 'var(--green)' }" /></span><span class="small">{{ m.pctGreen }}%</span></span>
              </td>
              <td class="num">{{ m.pctVerified === null ? '—' : `${m.pctVerified}%` }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 4. Warning list -->
    <section class="card stack" style="gap: 12px">
      <div class="row" style="justify-content: space-between">
        <h2 class="h-ico"><TriangleAlert class="ico" aria-hidden="true" />4 · Warning list <span class="muted small" style="font-weight: 400">({{ data.warningList.length }})</span></h2>
        <NuxtLink :to="pipelineLink({ tab: 'warn' })" class="small no-print">Open in Pipeline →</NuxtLink>
      </div>
      <div style="overflow-x: auto">
        <table class="data" style="min-width: 820px">
          <thead>
            <tr>
              <SortTh :sort="warnSort" k="name">Opportunity</SortTh><SortTh :sort="warnSort" k="marketCode">Market</SortTh>
              <SortTh :sort="warnSort" k="salesOwner">Owner</SortTh><SortTh :sort="warnSort" k="amountUsd" num>Amount</SortTh>
              <SortTh :sort="warnSort" k="warnings">Warnings</SortTh><SortTh :sort="warnSort" k="daysSinceUpdate" num>Days since update</SortTh>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in warningRows" :key="o.id" :class="{ 'row-red': isRed(o) }">
              <td><NuxtLink :to="`/opportunities/${o.oppCode}`" class="strong-link">{{ o.name }}</NuxtLink><div class="muted small">{{ o.oppCode }} · {{ o.customer }}</div></td>
              <td><span class="mkt-cell"><MarketFlag :code="o.marketCode" />{{ o.marketCode }}</span></td>
              <td>{{ o.salesOwner }}</td>
              <td class="num" :title="amountTitle(o)">{{ fmtUsd(o.amountUsd) }}</td>
              <td><span class="row" style="gap: 4px"><span v-for="w in o.warnings" :key="w" class="sev" :class="`sev-${WARNING_META[w].severity}`" :title="WARNING_LABEL[w]">{{ w }}</span></span></td>
              <td class="num">{{ o.daysSinceUpdate ?? 'never' }}</td>
            </tr>
            <tr v-if="!data.warningList.length"><td colspan="6" class="muted">No warnings this week.</td></tr>
          </tbody>
        </table>
      </div>
      <button v-if="data.warningList.length > WARN_PREVIEW" type="button" class="link-btn no-print" style="align-self: flex-start" @click="showAllWarnings = !showAllWarnings">
        {{ showAllWarnings ? 'Show top 15 only' : `Show all ${data.warningList.length}` }}
      </button>
    </section>

    <!-- 5. Top management concerns -->
    <section class="card stack" style="gap: 12px">
      <h2 class="h-ico"><ShieldAlert class="ico" aria-hidden="true" />5 · Top management concerns <span class="muted small" style="font-weight: 400">open opps over {{ fmtUsd(data.topMgmtUsd) }}</span></h2>
      <div style="overflow-x: auto">
        <table class="data" style="min-width: 820px">
          <thead>
            <tr>
              <SortTh :sort="topSort" k="name">Opportunity</SortTh><SortTh :sort="topSort" k="market">Market</SortTh>
              <SortTh :sort="topSort" k="stage">Stage</SortTh><SortTh :sort="topSort" k="amount" num>Amount</SortTh>
              <SortTh :sort="topSort" k="health">Health</SortTh><SortTh :sort="topSort" k="changes" style="width: 34%">Change this week</SortTh>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in topSort.rows.value" :key="t.opp.id" :class="{ 'row-red': isRed(t.opp) }">
              <td><NuxtLink :to="`/opportunities/${t.opp.oppCode}`" class="strong-link">{{ t.opp.name }}</NuxtLink><div class="muted small">{{ t.opp.customer }} · {{ t.opp.salesOwner }}</div></td>
              <td><span class="mkt-cell"><MarketFlag :code="t.opp.marketCode" />{{ t.opp.marketCode }}</span></td>
              <td><span class="badge">{{ STAGE_SHORT[t.opp.stage] }}</span></td>
              <td class="num" style="font-weight: 600" :title="amountTitle(t.opp)">{{ fmtUsd(t.opp.amountUsd) }}</td>
              <td><HealthBadge :health="t.opp.health" /></td>
              <td>
                <ul v-if="t.changes.length" class="changes"><li v-for="(c, i) in t.changes" :key="i">{{ c }}</li></ul>
                <span v-else class="muted small">No change</span>
              </td>
            </tr>
            <tr v-if="!data.topMgmt.length"><td colspan="6" class="muted">No open opportunity above the threshold.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 6. Recommendations -->
    <section class="card stack" style="gap: 12px">
      <div class="row" style="justify-content: space-between">
        <h2 class="h-ico"><Lightbulb class="ico" aria-hidden="true" />6 · Recommendations</h2>
        <button v-if="data.canAddRecommendation" type="button" class="btn btn-sm btn-outline-primary no-print" @click="newRec"><Plus class="ico" aria-hidden="true" />Add recommendation</button>
      </div>
      <div style="overflow-x: auto">
        <table class="data" style="min-width: 820px">
          <thead><tr><th>Market</th><th>Finding</th><th>Impact</th><th>Recommendation</th><th>Owner</th><th>Target</th><th class="no-print" /></tr></thead>
          <TransitionGroup tag="tbody" name="list">
            <tr v-for="r in data.recommendations" :key="r.id">
              <td><span v-if="r.marketCode" class="mkt-cell"><MarketFlag :code="r.marketCode" />{{ r.marketCode }}</span><span v-else style="font-weight: 600">All LCG</span></td>
              <td class="pre">{{ r.finding }}</td>
              <td class="pre">{{ r.impact ?? '—' }}</td>
              <td class="pre">{{ r.recommendation ?? '—' }}</td>
              <td>{{ r.owner ?? '—' }}</td>
              <td style="white-space: nowrap">{{ r.targetDate ? fmtDay(r.targetDate, true) : '—' }}</td>
              <td class="no-print" style="white-space: nowrap">
                <template v-if="r.canEdit">
                  <button type="button" class="link-btn" @click="editRec(r)">Edit</button>
                  <button type="button" class="link-btn" style="color: var(--danger); margin-left: 10px" @click="confirmDelete = r">Delete</button>
                </template>
              </td>
            </tr>
            <tr v-if="!data.recommendations.length" key="empty"><td colspan="7" class="muted">No recommendations recorded for this week.</td></tr>
          </TransitionGroup>
        </table>
      </div>
    </section>

    <!-- 7. Project vs License -->
    <section class="card stack" style="gap: 14px">
      <h2 class="h-ico"><Layers class="ico" aria-hidden="true" />7 · Project vs License <span class="muted small" style="font-weight: 400">open pipeline by deal type</span></h2>
      <div v-for="d in data.projectVsLicense" :key="d.dealType" class="dt-row">
        <NuxtLink :to="d.dealType === '(not set)' ? pipelineLink() : pipelineLink({ dealType: d.dealType })" class="small" style="color: var(--text-2); text-decoration: none">{{ d.dealType }}</NuxtLink>
        <span class="track"><span class="bar-fill" :style="{ width: `${d.pipelineUsd / dtMax * 100}%`, background: 'var(--primary)' }" :title="`${d.open} open · pipeline ${fmtFull(d.pipelineUsd)} · weighted ${fmtFull(d.weightedUsd)}`" /></span>
        <span class="small" style="text-align: right"><b>{{ fmtUsd(d.pipelineUsd) }}</b> <span class="muted">· {{ d.open }} open · {{ d.wonInWeek }} won this week</span></span>
      </div>
      <p v-if="!data.projectVsLicense.length" class="muted small" style="margin: 0">No opportunities.</p>
    </section>
  </div>
  <template v-else-if="status === 'pending'"><SkeletonBlock :rows="6" /><SkeletonBlock :rows="4" /></template>

  <AppModal v-if="draft" :title="draft.id ? 'Edit recommendation' : `New recommendation · week of ${fmtDay(data!.week.start, true)}`" width="640px" @close="draft = null">
    <form id="rec-form" class="stack" @submit.prevent="saveRec">
      <div class="form-grid">
        <label class="field">Market <span class="req">*</span>
          <select v-model="draft.marketCode" class="select">
            <option v-for="m in data?.recommendationMarkets" :key="m" :value="m">{{ m || 'All LCG' }}</option>
          </select>
        </label>
        <label class="field">Owner
          <select v-model="draft.ownerId" class="select">
            <option value="">—</option>
            <option v-for="u in meta?.users.filter(x => x.isActive)" :key="u.id" :value="u.id">{{ u.displayName }} ({{ u.account }})</option>
          </select>
        </label>
        <label class="field full">Finding <span class="req">*</span><textarea v-model="draft.finding" class="textarea" required maxlength="1000" style="min-height: 72px" /></label>
        <label class="field full">Impact<textarea v-model="draft.impact" class="textarea" maxlength="1000" style="min-height: 60px" /></label>
        <label class="field full">Recommendation<textarea v-model="draft.recommendation" class="textarea" maxlength="1000" style="min-height: 72px" /></label>
        <label class="field">Target date<input v-model="draft.targetDate" type="date" class="input"></label>
      </div>
      <p v-if="formError" class="error-text" style="margin: 0">{{ formError }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn" @click="draft = null">Cancel</button>
      <button type="submit" form="rec-form" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
    </template>
  </AppModal>

  <AppModal v-if="confirmDelete" title="Delete recommendation?" width="440px" @close="confirmDelete = null">
    <p style="margin: 0">“{{ confirmDelete.finding }}” will be removed from this week's report.</p>
    <template #footer>
      <button type="button" class="btn" @click="confirmDelete = null">Cancel</button>
      <button type="button" class="btn btn-danger" @click="deleteRec">Delete</button>
    </template>
  </AppModal>
</template>

<style scoped>
.change-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.change { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--row-border); }
.change-n { font-size: 22px; font-weight: 700; }
.change.zero .change-n { color: var(--faint); }
.hl-row { display: grid; grid-template-columns: minmax(200px, 2fr) minmax(160px, 1.4fr) 2fr; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--row-border); font-size: 13px; }
.hl-row:last-child { border-bottom: 0; }
.strong-link { font-weight: 600; color: var(--text); text-decoration: none; }
.strong-link:hover { color: var(--primary); }
.track { height: 20px; background: var(--chip); border-radius: 4px; display: flex; overflow: hidden; }
.track.sm { height: 8px; flex: 1 1 auto; }
.track > span { display: block; height: 100%; border-radius: 0 4px 4px 0; }
.pct { display: flex; align-items: center; gap: 8px; }
.dt-row { display: grid; grid-template-columns: 150px 1fr minmax(220px, auto); gap: 12px; align-items: center; }
.changes { margin: 0; padding-left: 16px; font-size: 12px; color: var(--text-2); }
.pre { white-space: pre-line; }
.list-enter-active, .list-leave-active { transition: opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(-8px); }
@media (max-width: 720px) {
  .hl-row, .dt-row { grid-template-columns: 1fr; gap: 4px; }
  .change-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
