<script setup lang="ts">
import type { DashboardResponse } from '#shared/types'
import { WARNING_META } from '#shared/rules'
import { HEALTH_BUCKET, STAGE_SHORT, WARNING_LABEL } from '#shared/constants'
import type { OppItem } from '#shared/types'
import { ArrowRight, CalendarX2, LayoutDashboard, PartyPopper, SearchX, CircleDollarSign, CirclePause, Earth, Handshake, HeartPulse, Hourglass, Plus, Sparkles, Target, TriangleAlert, Trophy } from 'lucide-vue-next'

useHead({ title: 'Dashboard · LCG Opportunity' })
const { $api } = useNuxtApp()
const { queryForApi, filter, set } = useOppFilters()
const fy = ref<number | null>(null) // forecast year (close month chart); null = current year
const { data, error, status } = await useAsyncData('dashboard',
  () => $api<DashboardResponse>('/api/dashboard', { query: { ...queryForApi.value, ...(fy.value ? { fy: fy.value } : {}) } }), { watch: [queryForApi, fy] })

const pipelineLink = (extra: Record<string, string> = {}) => ({ path: '/pipeline', query: { ...queryForApi.value, ...extra } })
const kpis = computed(() => {
  const k = data.value?.kpis
  if (!k) return []
  return [
    { label: 'Total pipeline', icon: CircleDollarSign, value: k.totalPipelineUsd, fmt: fmtUsd, sub: `${k.openOpps} open opps`, bad: false, to: pipelineLink() },
    { label: 'Weighted forecast', icon: Target, value: k.weightedForecastUsd, fmt: fmtUsd, sub: `${k.totalPipelineUsd ? Math.round(k.weightedForecastUsd / k.totalPipelineUsd * 100) : 0}% of pipeline`, bad: false, to: pipelineLink() },
    { label: 'With warnings', icon: TriangleAlert, value: k.withWarnings, fmt: undefined, sub: `of ${k.openOpps} open opps`, bad: k.withWarnings > 0, to: pipelineLink({ tab: 'warn' }) },
    { label: 'No update > 14d', icon: Hourglass, value: k.noUpdateOver14, fmt: undefined, sub: 'W1', bad: k.noUpdateOver14 > 0, to: pipelineLink({ warning: 'W1' }) },
    { label: 'On hold > 30d', icon: CirclePause, value: k.onHoldOver30, fmt: undefined, sub: 'W2', bad: k.onHoldOver30 > 0, to: pipelineLink({ warning: 'W2' }) },
    { label: 'Overdue close', icon: CalendarX2, value: k.overdueClose, fmt: undefined, sub: 'W3', bad: k.overdueClose > 0, to: pipelineLink({ warning: 'W3' }) },
  ]
})
const marketMax = computed(() => Math.max(1, ...(data.value?.byMarket ?? []).map(m => m.pipelineUsd)))
const partnerMax = computed(() => Math.max(1, ...(data.value?.byPartner ?? []).map(p => p.pipelineUsd)))
const healthTotal = computed(() => Object.values(data.value?.health ?? {}).reduce((a, b) => a + b, 0))
const HEALTH_COLOR = { Green: 'var(--green)', Amber: 'var(--amber)', Red: 'var(--red)' } as const
const STAGE_RANK = { O: 0, D: 1, C: 2, B: 3, A: 4, W: 5, L: 6 } as const
const HEALTH_RANK = { Red: 0, Amber: 1, Green: 2, Closed: 3 } as const
const topSort = useTableSort(() => data.value?.top10, {
  descFirst: ['amountUsd', 'winRate'],
  get: { stage: (o: OppItem) => STAGE_RANK[o.stage], health: (o: OppItem) => HEALTH_RANK[HEALTH_BUCKET(o.health)] },
})
const isRed = (o: OppItem) => HEALTH_BUCKET(o.health) === 'Red' || o.warnings.includes('W3')
</script>

<template>
  <div class="page-head">
    <div>
      <PageTitle :icon="LayoutDashboard" title="Dashboard" />
      <div class="sub indent">
        Calculated on {{ data?.today }} (JST) · USD ·
        {{ filter.market?.length ? `Markets: ${filter.market.join(', ')}` : 'All your markets' }}
      </div>
    </div>
    <NuxtLink to="/opportunities/new" class="btn btn-primary"><Plus class="ico" aria-hidden="true" />New Opp</NuxtLink>
  </div>

  <FilterBar :market-counts="data?.marketCounts" />

  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>
  <div v-else-if="data" class="stack" :class="{ refreshing: status === 'pending' }">
    <section aria-label="KPI" class="grid-kpi">
      <NuxtLink v-for="k in kpis" :key="k.label" :to="k.to" class="card kpi">
        <span class="kpi-top"><span class="eyebrow">{{ k.label }}</span><span class="ico-tile" :class="{ danger: k.bad }"><component :is="k.icon" class="ico" aria-hidden="true" /></span></span>
        <span class="kpi-value" :class="{ bad: k.bad }"><AnimatedNumber :value="k.value" :format="k.fmt" /></span>
        <span class="small muted">{{ k.sub }}</span>
      </NuxtLink>
    </section>

    <SalesInsights :ins="data.insights" :link="pipelineLink" :fy="data.insights.forecast.year" @update:fy="v => (fy = v)" />

    <section class="grid-3">
      <div class="card stack" style="gap: 14px">
        <div class="row" style="justify-content: space-between"><h2 class="h-ico"><Earth class="ico" aria-hidden="true" />Pipeline by market</h2><span class="small muted">click to filter</span></div>
        <button
          v-for="m in data.byMarket" :key="m.code" type="button" class="bar-row"
          :title="`${m.count} open · pipeline ${fmtFull(m.pipelineUsd)} · weighted ${fmtFull(m.weightedUsd)}`"
          @click="set({ market: [m.code] })"
        >
          <span class="bar-label" :class="{ dim: !m.selected }"><MarketFlag :code="m.code" :size="18" />{{ m.code }}</span>
          <span class="track">
            <span class="bar-fill" :style="{ width: `${m.weightedUsd / marketMax * 100}%`, background: m.selected ? 'var(--primary)' : 'var(--bar-dim)' }" />
            <span class="bar-fill" :style="{ width: `${(m.pipelineUsd - m.weightedUsd) / marketMax * 100}%`, background: m.selected ? 'var(--primary-bar-rest)' : 'var(--bar-dim-rest)' }" />
          </span>
          <span class="bar-value">{{ fmtUsd(m.pipelineUsd) }}</span>
        </button>
        <div class="row small muted" style="gap: 16px">
          <span class="row" style="gap: 6px"><span class="sw" style="background: var(--primary)" />Weighted</span>
          <span class="row" style="gap: 6px"><span class="sw" style="background: var(--primary-bar-rest)" />Rest of pipeline</span>
        </div>
      </div>

      <div class="card stack" style="gap: 14px">
        <h2 class="h-ico"><Handshake class="ico" aria-hidden="true" />Pipeline by partner</h2>
        <p v-if="!data.byPartner.length" class="muted">No open opportunities.</p>
        <NuxtLink v-for="p in data.byPartner" :key="p.name" :to="pipelineLink({ partner: p.name })" class="bar-row partner">
          <span class="small" style="color: var(--text-2)">{{ p.name }} <span class="muted">({{ p.count }})</span></span>
          <span class="track"><span class="bar-fill" :style="{ width: `${p.pipelineUsd / partnerMax * 100}%`, background: 'var(--primary)' }" /></span>
          <span class="bar-value">{{ fmtUsd(p.pipelineUsd) }}</span>
        </NuxtLink>
      </div>

      <div class="card stack" style="gap: 14px">
        <h2 class="h-ico"><HeartPulse class="ico" aria-hidden="true" />Health &amp; warnings</h2>
        <div v-if="healthTotal" role="img" :aria-label="`Health: Green ${data.health.Green}, Amber ${data.health.Amber}, Red ${data.health.Red}`" class="health-bar">
          <template v-for="(n, h) in data.health" :key="h">
            <NuxtLink v-if="n" class="bar-fill" :to="pipelineLink({ health: h })" :style="{ flex: `${n} 1 0`, background: HEALTH_COLOR[h] }">{{ n }}</NuxtLink>
          </template>
        </div>
        <div class="row small" style="gap: 16px">
          <span v-for="(n, h) in data.health" :key="h" class="row" style="gap: 6px"><span class="dot" :style="{ background: HEALTH_COLOR[h] }" />{{ h }} · {{ n }}</span>
        </div>
        <div class="stack" style="gap: 8px; border-top: 1px solid var(--chip); padding-top: 12px">
          <NuxtLink v-for="w in data.warnings" :key="w.code" :to="pipelineLink({ warning: w.code })" class="warn-row">
            <span class="row" style="gap: 8px"><span class="sev" :class="`sev-${WARNING_META[w.code].severity}`">{{ w.code }}</span>{{ WARNING_LABEL[w.code] }}</span>
            <b>{{ w.count }}</b>
          </NuxtLink>
          <div v-if="!data.warnings.length" class="empty"><PartyPopper class="ico" aria-hidden="true" />No warnings</div>
        </div>
      </div>
    </section>

    <section class="card stack" style="gap: 12px">
      <div class="row" style="justify-content: space-between">
        <h2 class="h-ico"><Sparkles class="ico" aria-hidden="true" />Highlight of the week</h2>
        <NuxtLink :to="pipelineLink({ tab: 'highlight' })" class="small more">Open in Pipeline<ArrowRight class="ico" aria-hidden="true" /></NuxtLink>
      </div>
      <HighlightList :items="data.highlights" :period="data.highlightPeriod" />
    </section>

    <section class="card stack" style="gap: 12px">
      <div class="row" style="justify-content: space-between">
        <h2 class="h-ico"><Trophy class="ico" aria-hidden="true" />Top 10 open opportunities by value</h2>
        <NuxtLink :to="pipelineLink()" class="small more">See all in Pipeline<ArrowRight class="ico" aria-hidden="true" /></NuxtLink>
      </div>
      <div style="overflow-x: auto">
        <table class="data" style="min-width: 980px">
          <thead>
            <tr>
              <SortTh :sort="topSort" k="customer">Customer · Opportunity</SortTh>
              <SortTh :sort="topSort" k="marketCode">Market</SortTh><SortTh :sort="topSort" k="partner">Partner</SortTh>
              <SortTh :sort="topSort" k="stage">Stage</SortTh><SortTh :sort="topSort" k="amountUsd" num>Amount</SortTh>
              <SortTh :sort="topSort" k="winRate" num>Win</SortTh><SortTh :sort="topSort" k="biddingLead">Bidding lead</SortTh>
              <SortTh :sort="topSort" k="salesOwner">Sales</SortTh><SortTh :sort="topSort" k="viOwner">VI</SortTh>
              <SortTh :sort="topSort" k="health">Health</SortTh>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in topSort.rows.value" :key="o.id" :class="{ 'row-red': isRed(o) }">
              <td><NuxtLink :to="`/opportunities/${o.oppCode}`" class="opp-link"><div style="font-weight: 600">{{ o.customer }}</div><div class="muted">{{ o.name }}</div></NuxtLink></td>
              <td><span class="mkt-cell"><MarketFlag :code="o.marketCode" />{{ o.marketCode }}</span></td>
              <td>{{ o.partner }}</td>
              <td><span class="badge">{{ STAGE_SHORT[o.stage] }}</span></td>
              <td class="num" style="font-weight: 600" :title="amountTitle(o)">{{ fmtUsd(o.amountUsd) }}</td>
              <td class="num">{{ o.winRate }}%</td>
              <td><span v-tip class="ppl">{{ o.biddingLead ?? '—' }}</span></td>
              <td><span v-tip class="ppl">{{ o.salesOwner }}</span></td>
              <td><span v-tip class="ppl">{{ o.viOwner ?? '—' }}</span></td>
              <td><HealthBadge :health="o.health" /></td>
            </tr>
            <tr v-if="!data.top10.length"><td colspan="10"><div class="empty"><SearchX class="ico" aria-hidden="true" />No open opportunities match the filter.</div></td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
  <template v-else-if="status === 'pending'"><SkeletonBlock :rows="2" /><SkeletonBlock :rows="5" /></template>
</template>

<style scoped>
.ppl { display: block; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi { display: flex; flex-direction: column; gap: 6px; padding: 16px; text-decoration: none; color: var(--text); }
.kpi:hover { border-color: var(--border-strong); }
.kpi-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.kpi-value { font-size: 26px; font-weight: 700; color: var(--text); }
.kpi-value.bad { color: var(--danger); }
.bar-row { display: grid; grid-template-columns: 64px 1fr 72px; align-items: center; gap: 10px; border: 0; background: transparent; padding: 2px 0; cursor: pointer; text-align: left; text-decoration: none; color: inherit; }
.bar-row.partner { grid-template-columns: 150px 1fr 72px; }
.bar-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text); }
.bar-label.dim :deep(.flag) { opacity: .45; }
.bar-label.dim { color: var(--faint); }
.track { height: 20px; background: var(--chip); border-radius: 4px; display: flex; overflow: hidden; }
.track > span { display: block; height: 100%; }
.bar-value { font-size: 13px; font-weight: 600; text-align: right; color: var(--text); }
.sw { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.health-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; }
.health-bar a { color: var(--surface); font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; text-decoration: none; }
.warn-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text); text-decoration: none; }
.warn-row:hover { color: var(--primary); }
.hl-row { display: grid; grid-template-columns: minmax(200px, 2fr) minmax(160px, 1.2fr) 2fr; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--row-border); font-size: 13px; }
.hl-row:last-child { border-bottom: 0; }
.opp-link { text-decoration: none; color: inherit; }
.more { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; text-decoration: none; }
.more .ico { width: 15px; height: 15px; transition: transform var(--dur) var(--ease-out); }
.more:hover .ico { transform: translateX(3px); }
.opp-link:hover div:first-child { color: var(--primary); }
@media (max-width: 720px) { .hl-row { grid-template-columns: 1fr; gap: 4px; } }
</style>
