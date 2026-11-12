<script setup lang="ts">
import type { MonthlyReportResponse } from '#shared/types'
import { STAGE_LABEL } from '#shared/constants'
import { ChartColumn, ChartNoAxesColumn, ChevronLeft, ChevronRight, Earth, Funnel, Handshake, Printer, Scale, ShieldAlert, TrendingUp } from 'lucide-vue-next'

useHead({ title: 'Monthly Report · LCG Opportunity' })
const { $api } = useNuxtApp()
const route = useRoute()
const router = useRouter()
const { queryForApi } = useOppFilters()

const month = computed(() => (typeof route.query.month === 'string' ? route.query.month : ''))
const { data, error, status } = await useAsyncData('monthly-report',
  () => $api<MonthlyReportResponse>('/api/reports/monthly', { query: { ...queryForApi.value, ...(month.value ? { month: month.value } : {}) } }),
  { watch: [queryForApi, month] })

const setMonth = (m: string) => router.replace({ query: { ...route.query, month: m === data.value?.months[0] ? undefined : m } })
const monthIdx = computed(() => data.value?.months.indexOf(data.value.month.key) ?? 0)
const step = (n: number) => {
  const m = data.value?.months[monthIdx.value - n]
  if (m) setMonth(m)
}
const pipelineLink = (extra: Record<string, string> = {}) => ({ path: '/pipeline', query: { ...queryForApi.value, ...extra } })
const trendRow = (k: string) => data.value?.trend.find(t => t.key === k)

const tiles = computed(() => {
  const d = data.value
  if (!d) return []
  const t = (k: string) => trendRow(k)!
  return [
    { label: 'New opps', row: t('new'), sub: 'created this month' },
    { label: 'Won', row: t('won'), sub: `${fmtUsd(t('wonUsd').current)} contract value` },
    { label: 'Lost', row: t('lost'), sub: 'closed lost this month', invert: true },
    { label: 'Pipeline', row: t('pipeline'), sub: d.month.isCurrent ? 'open, as of today' : 'open, at month end' },
    { label: 'Weighted forecast', row: t('weighted'), sub: 'pipeline × win rate' },
  ]
})

// Small multiples: one column chart per measure, single hue, the selected month emphasised
const multiples = computed(() => {
  const s = data.value?.series ?? []
  return ([['created', 'New'], ['won', 'Won'], ['lost', 'Lost']] as const).map(([k, label]) => ({
    key: k, label, max: Math.max(1, ...s.map(x => x[k])),
    points: s.map(x => ({ month: x.key, v: x[k] })),
  }))
})

// Weekly pipeline line from snapshots
const line = computed(() => {
  const pts = data.value?.pipelineWeeks ?? []
  if (pts.length < 2) return null
  const W = 640
  const H = 160
  const pad = { l: 8, r: 8, t: 12, b: 22 }
  const max = Math.max(...pts.map(p => p.pipelineUsd)) * 1.1 || 1
  const x = (i: number) => pad.l + i * (W - pad.l - pad.r) / (pts.length - 1)
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  return {
    W, H,
    pipe: pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.pipelineUsd).toFixed(1)}`).join(' '),
    weighted: pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.weightedUsd).toFixed(1)}`).join(' '),
    dots: pts.map((p, i) => ({ ...p, cx: x(i), cy: y(p.pipelineUsd), cyw: y(p.weightedUsd) })),
    base: H - pad.b,
  }
})
const hover = ref<number | null>(null)

const funnelMax = computed(() => Math.max(1, data.value?.funnel[0]?.reached ?? 1))
const partnerMax = computed(() => Math.max(1, ...(data.value?.byPartner ?? []).map(p => p.pipelineUsd)))
const reasonMax = computed(() => Math.max(1, ...(data.value?.winLoss.reasons ?? []).map(r => r.count)))
const openRisk = ref<string | null>(null)
const mkSort = useTableSort(() => data.value?.byMarket, { descFirst: ['created', 'won', 'wonUsd', 'lost', 'open', 'pipelineUsd'] })
const printPage = () => window.print()
</script>

<template>
  <div class="page-head">
    <div>
      <PageTitle :icon="ChartColumn" title="Monthly Report" />
      <div v-if="data" class="sub indent">
        {{ fmtMonth(data.month.key) }}<template v-if="data.month.isCurrent"> · month to date</template>
        · USD · {{ queryForApi.market ? `Markets: ${queryForApi.market}` : 'All your markets' }}
      </div>
    </div>
    <div class="row no-print">
      <button type="button" class="btn btn-sm" :disabled="!data || monthIdx >= data.months.length - 1" aria-label="Previous month" @click="step(-1)"><ChevronLeft class="ico" aria-hidden="true" /></button>
      <select class="select" style="height: 32px; width: auto; font-size: 13px" aria-label="Month" :value="data?.month.key" @change="setMonth(($event.target as HTMLSelectElement).value)">
        <option v-for="m in data?.months" :key="m" :value="m">{{ fmtMonth(m) }}</option>
      </select>
      <button type="button" class="btn btn-sm" :disabled="!data || monthIdx <= 0" aria-label="Next month" @click="step(1)"><ChevronRight class="ico" aria-hidden="true" /></button>
      <button type="button" class="btn btn-sm" @click="printPage"><Printer class="ico" aria-hidden="true" />Print / PDF</button>
    </div>
  </div>

  <FilterBar :market-counts="data?.marketCounts" class="no-print" />

  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>
  <div v-else-if="data" class="stack" :class="{ refreshing: status === 'pending' }">
    <div v-if="data.source === 'missing'" class="alert alert-info no-print">
      No snapshot exists for the end of {{ fmtMonth(data.month.key) }}, so pipeline figures for that month are not available.
      New / Won / Lost come from the opportunity records and are always shown.
    </div>

    <!-- Trend: this month vs last month -->
    <section aria-label="Month KPIs" class="grid-kpi">
      <div v-for="t in tiles" :key="t.label" class="card kpi">
        <span class="eyebrow">{{ t.label }}</span>
        <span class="kpi-value"><AnimatedNumber :value="t.row.current" :format="t.row.money ? fmtUsd : undefined" /></span>
        <span class="row" style="gap: 6px"><DeltaChip :current="t.row.current" :previous="t.row.previous" :money="t.row.money" :invert="t.invert" /><span class="small muted">vs {{ fmtMonth(data.months[monthIdx + 1] ?? data.month.key) }}</span></span>
        <span class="small muted">{{ t.sub }}</span>
      </div>
    </section>

    <section class="grid-2">
      <div class="card stack" style="gap: 12px">
        <div class="row" style="justify-content: space-between"><h2 class="h-ico"><ChartNoAxesColumn class="ico" aria-hidden="true" />Last 6 months</h2><span class="small muted">opps per month</span></div>
        <div class="multiples">
          <div v-for="m in multiples" :key="m.key" class="multiple">
            <div class="small" style="font-weight: 600; color: var(--text-2)">{{ m.label }}</div>
            <div class="cols" role="img" :aria-label="`${m.label} per month: ${m.points.map(p => `${fmtMonth(p.month)} ${p.v}`).join(', ')}`">
              <div v-for="p in m.points" :key="p.month" class="col" :title="`${fmtMonth(p.month)}: ${p.v}`">
                <span class="col-v">{{ p.v || '' }}</span>
                <span class="col-fill" :style="{ height: `${Math.max(p.v ? 4 : 0, p.v / m.max * 100)}%`, background: p.month === data.month.key ? 'var(--primary)' : 'var(--primary-bar-rest)' }" />
              </div>
            </div>
            <div class="col-axis"><span v-for="p in m.points" :key="p.month">{{ fmtMonth(p.month).slice(0, 3) }}</span></div>
          </div>
        </div>
      </div>

      <div class="card stack" style="gap: 12px">
        <div class="row" style="justify-content: space-between">
          <h2 class="h-ico"><TrendingUp class="ico" aria-hidden="true" />Pipeline by week</h2>
          <span class="row small muted" style="gap: 12px">
            <span class="row" style="gap: 6px"><span class="sw" style="background: var(--primary)" />Pipeline</span>
            <span class="row" style="gap: 6px"><span class="sw dashed" />Weighted</span>
          </span>
        </div>
        <div v-if="line" class="line-wrap" @mouseleave="hover = null">
          <svg :viewBox="`0 0 ${line.W} ${line.H}`" preserveAspectRatio="none" class="line-svg" role="img" aria-label="Weekly pipeline from snapshots">
            <line :x1="0" :x2="line.W" :y1="line.base" :y2="line.base" stroke="var(--border)" />
            <path :d="line.weighted" fill="none" stroke="var(--primary-bar-rest)" stroke-width="2" stroke-dasharray="5 4" class="draw" vector-effect="non-scaling-stroke" />
            <path :d="line.pipe" fill="none" stroke="var(--primary)" stroke-width="2" class="draw" vector-effect="non-scaling-stroke" />
            <line v-if="hover !== null" :x1="line.dots[hover]!.cx" :x2="line.dots[hover]!.cx" :y1="0" :y2="line.base" stroke="var(--border-strong)" vector-effect="non-scaling-stroke" />
            <rect v-for="(d, i) in line.dots" :key="d.weekStart" :x="d.cx - line.W / line.dots.length / 2" y="0" :width="line.W / line.dots.length" :height="line.H" fill="transparent" @mouseenter="hover = i" />
          </svg>
          <div v-if="hover !== null" class="tip" :style="{ left: `${line.dots[hover]!.cx / line.W * 100}%` }">
            <b>Week of {{ fmtDay(line.dots[hover]!.weekStart, true) }}</b><br>
            Pipeline {{ fmtUsd(line.dots[hover]!.pipelineUsd) }} · Weighted {{ fmtUsd(line.dots[hover]!.weightedUsd) }}
          </div>
          <div class="col-axis"><span>{{ fmtDay(line.dots[0]!.weekStart) }}</span><span>{{ fmtDay(line.dots[line.dots.length - 1]!.weekStart) }}</span></div>
        </div>
        <p v-else class="muted small" style="margin: 0">
          This chart fills in from the Monday snapshots (one point per week).
          <template v-if="data.pipelineWeeks.length === 1">One snapshot so far: {{ fmtUsd(data.pipelineWeeks[0]!.pipelineUsd) }} on {{ fmtDay(data.pipelineWeeks[0]!.weekStart, true) }}.</template>
        </p>
      </div>
    </section>

    <!-- KPI by market / by partner -->
    <section class="grid-2">
      <div class="card stack" style="gap: 12px">
        <h2 class="h-ico"><Earth class="ico" aria-hidden="true" />KPI by market</h2>
        <table class="data">
          <thead>
            <tr>
              <SortTh :sort="mkSort" k="code">Market</SortTh><SortTh :sort="mkSort" k="created" num>New</SortTh>
              <SortTh :sort="mkSort" k="won" num>Won</SortTh><SortTh :sort="mkSort" k="wonUsd" num>Won value</SortTh>
              <SortTh :sort="mkSort" k="lost" num>Lost</SortTh><SortTh :sort="mkSort" k="open" num>Open</SortTh>
              <SortTh :sort="mkSort" k="pipelineUsd" num>Pipeline</SortTh>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in mkSort.rows.value" :key="m.code">
              <td><NuxtLink :to="pipelineLink({ market: m.code })" class="mkt-cell" style="text-decoration: none"><MarketFlag :code="m.code" />{{ m.code }}</NuxtLink></td>
              <td class="num">{{ m.created }}</td>
              <td class="num">{{ m.won }}</td>
              <td class="num">{{ m.wonUsd ? fmtUsd(m.wonUsd) : '—' }}</td>
              <td class="num">{{ m.lost }}</td>
              <td class="num">{{ m.open ?? '—' }}</td>
              <td class="num" style="font-weight: 600">{{ m.pipelineUsd === null ? '—' : fmtUsd(m.pipelineUsd) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card stack" style="gap: 12px">
        <h2 class="h-ico"><Handshake class="ico" aria-hidden="true" />KPI by partner <span class="muted small" style="font-weight: 400">open pipeline</span></h2>
        <p v-if="!data.byPartner.length" class="muted small" style="margin: 0">No open opportunities.</p>
        <NuxtLink v-for="p in data.byPartner" :key="p.name" :to="pipelineLink({ partner: p.name })" class="bar-row">
          <span class="small" style="color: var(--text-2)">{{ p.name }}</span>
          <span class="track"><span class="bar-fill" :style="{ width: `${p.pipelineUsd / partnerMax * 100}%`, background: 'var(--primary)' }" /></span>
          <span class="small" style="text-align: right"><b>{{ fmtUsd(p.pipelineUsd) }}</b> <span class="muted">· {{ p.count }} · avg {{ p.avgWinRate }}%</span></span>
        </NuxtLink>
      </div>
    </section>

    <!-- Funnel -->
    <section class="card stack" style="gap: 10px">
      <div class="row" style="justify-content: space-between">
        <h2 class="h-ico"><Funnel class="ico" aria-hidden="true" />Funnel O → W</h2>
        <span class="small muted">opps that reached each stage (stage history) · created up to {{ fmtDay(data.month.end, true) }}</span>
      </div>
      <template v-for="(f, i) in data.funnel" :key="f.stage">
        <div class="funnel-row">
          <span class="small" style="font-weight: 600">{{ STAGE_LABEL[f.stage] }}</span>
          <span class="funnel-track"><span class="bar-fill funnel-fill" :style="{ width: `${f.reached / funnelMax * 100}%`, animationDelay: `${i * 70}ms` }" /></span>
          <span class="small" style="text-align: right"><b>{{ f.reached }}</b></span>
        </div>
        <div v-if="f.conversion !== null" class="funnel-conv small muted">↓ {{ f.conversion }}% move on</div>
      </template>
    </section>

    <!-- Risk + Win/Loss -->
    <section class="grid-2">
      <div class="card stack" style="gap: 10px">
        <h2 class="h-ico"><ShieldAlert class="ico" aria-hidden="true" />Risk <span class="muted small" style="font-weight: 400">as of {{ fmtDay(data.today, true) }}</span></h2>
        <div v-for="r in data.risk" :key="r.key" class="risk">
          <button type="button" class="risk-head" :aria-expanded="openRisk === r.key" @click="openRisk = openRisk === r.key ? null : r.key">
            <span>{{ r.label }}</span>
            <span class="row" style="gap: 8px"><b :class="{ bad: r.opps.length }">{{ r.opps.length }}</b><span class="chev" :class="{ open: openRisk === r.key }">›</span></span>
          </button>
          <div class="risk-body" :class="{ open: openRisk === r.key }">
            <div>
              <div v-for="o in r.opps" :key="o.id" class="risk-item">
                <NuxtLink :to="`/opportunities/${o.oppCode}`">{{ o.name }}</NuxtLink>
                <span class="muted small">{{ o.marketCode }} · {{ o.salesOwner }} · {{ fmtUsd(o.amountUsd) }}</span>
              </div>
              <p v-if="!r.opps.length" class="muted small" style="margin: 4px 0">None.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card stack" style="gap: 12px">
        <h2 class="h-ico"><Scale class="ico" aria-hidden="true" />Win / loss</h2>
        <div class="wl">
          <div v-for="p in [{ k: 'This month', v: data.winLoss.month }, { k: `${data.month.key.slice(0, 4)} to date`, v: data.winLoss.ytd }]" :key="p.k" class="wl-box">
            <span class="eyebrow">{{ p.k }}</span>
            <span class="kpi-value"><AnimatedNumber :value="p.v.winRate" :format="(n: number) => `${Math.round(n)}%`" /></span>
            <span class="small muted">win rate · {{ p.v.won }} won ({{ fmtUsd(p.v.wonUsd) }}) · {{ p.v.lost }} lost ({{ fmtUsd(p.v.lostUsd) }})</span>
          </div>
        </div>
        <div class="stack" style="gap: 8px; border-top: 1px solid var(--chip); padding-top: 12px">
          <span class="small" style="font-weight: 600; color: var(--text-2)">Why we lost ({{ data.month.key.slice(0, 4) }} to date)</span>
          <div v-for="r in data.winLoss.reasons" :key="r.reason" class="bar-row" :title="`${r.count} lost · ${fmtFull(r.usd)}`">
            <span class="small" style="color: var(--text-2)">{{ r.reason }}</span>
            <span class="track"><span class="bar-fill" :style="{ width: `${r.count / reasonMax * 100}%`, background: 'var(--primary)' }" /></span>
            <span class="small" style="text-align: right"><b>{{ r.count }}</b> <span class="muted">· {{ fmtUsd(r.usd) }}</span></span>
          </div>
          <p v-if="!data.winLoss.reasons.length" class="muted small" style="margin: 0">No lost opportunities this year.</p>
        </div>
      </div>
    </section>
  </div>
  <template v-else-if="status === 'pending'"><SkeletonBlock :rows="2" /><SkeletonBlock :rows="6" /></template>
</template>

<style scoped>
.kpi { display: flex; flex-direction: column; gap: 6px; padding: 16px; }
.kpi-value { font-size: 26px; font-weight: 700; }
.bad { color: var(--danger); }
.multiples { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.cols { height: 120px; display: flex; align-items: flex-end; gap: 4px; border-bottom: 1px solid var(--border); }
.col { flex: 1 1 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; }
.col-v { font-size: 11px; color: var(--text-2); text-align: center; margin-bottom: 2px; }
.col-fill { display: block; border-radius: 4px 4px 0 0; min-height: 0; }
.col-axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 4px; gap: 4px; }
.col-axis span { flex: 1 1 0; text-align: center; }
.line-wrap { position: relative; }
.line-svg { width: 100%; height: 160px; display: block; }
.draw { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: draw 1.1s var(--ease-out) forwards; }
path.draw[stroke-dasharray="5 4"] { stroke-dasharray: 5 4; stroke-dashoffset: 0; animation: fade-in .9s var(--ease-out) backwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
.tip { position: absolute; top: 4px; transform: translateX(-50%); background: var(--tip-bg); color: var(--tip-fg); font-size: 12px; padding: 6px 8px; border-radius: 6px; pointer-events: none; white-space: nowrap; box-shadow: var(--shadow-pop); }
.sw { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.sw.dashed { background: repeating-linear-gradient(90deg, var(--primary-bar-rest) 0 4px, transparent 4px 6px); }
.bar-row { display: grid; grid-template-columns: minmax(110px, 160px) 1fr minmax(120px, auto); align-items: center; gap: 10px; text-decoration: none; color: inherit; }
.track { height: 18px; background: var(--chip); border-radius: 4px; display: flex; overflow: hidden; }
.track > span { display: block; height: 100%; border-radius: 0 4px 4px 0; }
.funnel-row { display: grid; grid-template-columns: 170px 1fr 48px; gap: 12px; align-items: center; }
.funnel-track { height: 26px; display: flex; justify-content: center; }
.funnel-fill { display: block; height: 100%; background: var(--primary); border-radius: 4px; transform-origin: center; }
.funnel-conv { padding-left: 182px; margin: -2px 0; font-size: 11px; }
.risk { border: 1px solid var(--row-border); border-radius: 10px; overflow: hidden; }
.risk-head { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border: 0; background: var(--surface-2); cursor: pointer; font-size: 13px; color: var(--text); }
.risk-head:hover { background: var(--primary-soft); }
.chev { display: inline-block; transition: transform var(--dur) var(--ease-out); color: var(--muted); }
.chev.open { transform: rotate(90deg); }
.risk-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--dur) var(--ease-out); }
.risk-body.open { grid-template-rows: 1fr; }
.risk-body > div { overflow: hidden; padding: 0 12px; }
.risk-body.open > div { padding: 6px 12px 10px; }
.risk-item { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 13px; border-bottom: 1px solid var(--row-border); }
.risk-item:last-child { border-bottom: 0; }
.wl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.wl-box { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: 10px; background: var(--surface-2); }
@media (max-width: 720px) {
  .multiples, .wl { grid-template-columns: 1fr; }
  .funnel-row { grid-template-columns: 90px 1fr 36px; }
  .funnel-conv { padding-left: 102px; }
  .bar-row { grid-template-columns: 1fr; gap: 4px; }
}
@media print { .risk-body { grid-template-rows: 1fr; } }
</style>
