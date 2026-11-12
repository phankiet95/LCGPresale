<script setup lang="ts">
import type { DashboardResponse } from '#shared/types'
import { WARNING_META } from '#shared/rules'
import { STAGE_SHORT, WARNING_LABEL } from '#shared/constants'

useHead({ title: 'Dashboard · LCG Opportunity' })
const { $api } = useNuxtApp()
const { queryForApi, filter, set } = useOppFilters()
const { data, error, status } = await useAsyncData('dashboard',
  () => $api<DashboardResponse>('/api/dashboard', { query: queryForApi.value }), { watch: [queryForApi] })

const pipelineLink = (extra: Record<string, string> = {}) => ({ path: '/pipeline', query: { ...queryForApi.value, ...extra } })
const kpis = computed(() => {
  const k = data.value?.kpis
  if (!k) return []
  return [
    { label: 'Total pipeline', value: fmtUsd(k.totalPipelineUsd), sub: `${k.openOpps} open opps`, bad: false, to: pipelineLink() },
    { label: 'Weighted forecast', value: fmtUsd(k.weightedForecastUsd), sub: `${k.totalPipelineUsd ? Math.round(k.weightedForecastUsd / k.totalPipelineUsd * 100) : 0}% of pipeline`, bad: false, to: pipelineLink() },
    { label: 'With warnings', value: String(k.withWarnings), sub: `of ${k.openOpps} open opps`, bad: k.withWarnings > 0, to: pipelineLink({ tab: 'warn' }) },
    { label: 'No update > 14d', value: String(k.noUpdateOver14), sub: 'W1', bad: k.noUpdateOver14 > 0, to: pipelineLink({ warning: 'W1' }) },
    { label: 'On hold > 30d', value: String(k.onHoldOver30), sub: 'W2', bad: k.onHoldOver30 > 0, to: pipelineLink({ warning: 'W2' }) },
    { label: 'Overdue close', value: String(k.overdueClose), sub: 'W3', bad: k.overdueClose > 0, to: pipelineLink({ warning: 'W3' }) },
  ]
})
const marketMax = computed(() => Math.max(1, ...(data.value?.byMarket ?? []).map(m => m.pipelineUsd)))
const partnerMax = computed(() => Math.max(1, ...(data.value?.byPartner ?? []).map(p => p.pipelineUsd)))
const healthTotal = computed(() => Object.values(data.value?.health ?? {}).reduce((a, b) => a + b, 0))
const HEALTH_COLOR = { Green: 'var(--green)', Amber: 'var(--amber)', Red: 'var(--red)' } as const
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Dashboard</h1>
      <div class="sub">
        Calculated on {{ data?.today }} (JST) · USD ·
        {{ filter.market?.length ? `Markets: ${filter.market.join(', ')}` : 'All your markets' }}
      </div>
    </div>
    <NuxtLink to="/opportunities/new" class="btn btn-primary">+ New Opp</NuxtLink>
  </div>

  <FilterBar :market-counts="data?.marketCounts" />

  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>
  <template v-else-if="data">
    <section aria-label="KPI" class="grid-kpi">
      <NuxtLink v-for="k in kpis" :key="k.label" :to="k.to" class="card kpi">
        <span class="eyebrow">{{ k.label }}</span>
        <span class="kpi-value" :class="{ bad: k.bad }">{{ k.value }}</span>
        <span class="small muted">{{ k.sub }}</span>
      </NuxtLink>
    </section>

    <section class="grid-3">
      <div class="card stack" style="gap: 14px">
        <div class="row" style="justify-content: space-between"><h2>Pipeline by market</h2><span class="small muted">click to filter</span></div>
        <button
          v-for="m in data.byMarket" :key="m.code" type="button" class="bar-row"
          :title="`${m.count} open · pipeline ${fmtFull(m.pipelineUsd)} · weighted ${fmtFull(m.weightedUsd)}`"
          @click="set({ market: [m.code] })"
        >
          <span class="bar-label" :class="{ dim: !m.selected }">{{ m.code }}</span>
          <span class="track">
            <span :style="{ width: `${m.weightedUsd / marketMax * 100}%`, background: m.selected ? 'var(--primary)' : '#C5CCD6' }" />
            <span :style="{ width: `${(m.pipelineUsd - m.weightedUsd) / marketMax * 100}%`, background: m.selected ? 'var(--primary-bar-rest)' : '#E1E5EB' }" />
          </span>
          <span class="bar-value">{{ fmtUsd(m.pipelineUsd) }}</span>
        </button>
        <div class="row small muted" style="gap: 16px">
          <span class="row" style="gap: 6px"><span class="sw" style="background: var(--primary)" />Weighted</span>
          <span class="row" style="gap: 6px"><span class="sw" style="background: var(--primary-bar-rest)" />Rest of pipeline</span>
        </div>
      </div>

      <div class="card stack" style="gap: 14px">
        <h2>Pipeline by partner</h2>
        <p v-if="!data.byPartner.length" class="muted">No open opportunities.</p>
        <NuxtLink v-for="p in data.byPartner" :key="p.name" :to="pipelineLink({ partner: p.name })" class="bar-row partner">
          <span class="small" style="color: var(--text-2)">{{ p.name }} <span class="muted">({{ p.count }})</span></span>
          <span class="track"><span :style="{ width: `${p.pipelineUsd / partnerMax * 100}%`, background: 'var(--primary)' }" /></span>
          <span class="bar-value">{{ fmtUsd(p.pipelineUsd) }}</span>
        </NuxtLink>
      </div>

      <div class="card stack" style="gap: 14px">
        <h2>Health &amp; warnings</h2>
        <div v-if="healthTotal" role="img" :aria-label="`Health: Green ${data.health.Green}, Amber ${data.health.Amber}, Red ${data.health.Red}`" class="health-bar">
          <template v-for="(n, h) in data.health" :key="h">
            <NuxtLink v-if="n" :to="pipelineLink({ health: h })" :style="{ flex: `${n} 1 0`, background: HEALTH_COLOR[h] }">{{ n }}</NuxtLink>
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
          <p v-if="!data.warnings.length" class="muted small" style="margin: 0">No warnings 🎉</p>
        </div>
      </div>
    </section>

    <section class="card stack" style="gap: 12px">
      <div class="row" style="justify-content: space-between">
        <h2>Highlight this week &amp; next</h2>
        <NuxtLink :to="pipelineLink({ tab: 'highlight' })" class="small">Open in Pipeline →</NuxtLink>
      </div>
      <p v-if="!data.highlights.length" class="muted small" style="margin: 0">
        Nothing scheduled: no due dates, customer meetings, proposal submissions, demos or seminars in this window, and no pinned opps.
      </p>
      <div v-for="h in data.highlights" :key="h.opp.id" class="hl-row">
        <NuxtLink :to="`/opportunities/${h.opp.oppCode}`" style="font-weight: 600; text-decoration: none; color: var(--text)">{{ h.opp.name }}</NuxtLink>
        <span class="muted small">{{ h.opp.customer }} · {{ h.opp.marketCode }}</span>
        <span class="row" style="gap: 6px">
          <span v-for="(r, i) in h.reasons" :key="i" class="badge">{{ r.date.slice(5) }} · {{ r.reason }}</span>
        </span>
      </div>
    </section>

    <section class="card stack" style="gap: 12px">
      <div class="row" style="justify-content: space-between">
        <h2>Top 10 open opportunities by value</h2>
        <NuxtLink :to="pipelineLink()" class="small">See all in Pipeline →</NuxtLink>
      </div>
      <div style="overflow-x: auto">
        <table class="data" style="min-width: 860px">
          <thead><tr><th>Code</th><th>Customer · Opportunity</th><th>Market</th><th>Partner</th><th>Stage</th><th class="num">Amount</th><th class="num">Win</th><th>Owner</th><th>Health</th></tr></thead>
          <tbody>
            <tr v-for="o in data.top10" :key="o.id">
              <td class="muted" style="white-space: nowrap">{{ o.oppCode }}</td>
              <td><NuxtLink :to="`/opportunities/${o.oppCode}`" class="opp-link"><div style="font-weight: 600">{{ o.customer }}</div><div class="muted">{{ o.name }}</div></NuxtLink></td>
              <td>{{ o.marketCode }}</td>
              <td>{{ o.partner }}</td>
              <td><span class="badge">{{ STAGE_SHORT[o.stage] }}</span></td>
              <td class="num" style="font-weight: 600" :title="amountTitle(o)">{{ fmtUsd(o.amountUsd) }}</td>
              <td class="num">{{ o.winRate }}%</td>
              <td>{{ o.salesOwner }}</td>
              <td><HealthBadge :health="o.health" /></td>
            </tr>
            <tr v-if="!data.top10.length"><td colspan="9" class="muted">No open opportunities match the filter.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
  <p v-else-if="status === 'pending'" class="muted">Loading…</p>
</template>

<style scoped>
.kpi { display: flex; flex-direction: column; gap: 6px; padding: 16px; text-decoration: none; color: var(--text); }
.kpi:hover { border-color: var(--border-strong); }
.kpi-value { font-size: 26px; font-weight: 700; color: var(--text); }
.kpi-value.bad { color: var(--danger); }
.bar-row { display: grid; grid-template-columns: 40px 1fr 72px; align-items: center; gap: 10px; border: 0; background: transparent; padding: 2px 0; cursor: pointer; text-align: left; text-decoration: none; color: inherit; }
.bar-row.partner { grid-template-columns: 150px 1fr 72px; }
.bar-label { font-size: 13px; font-weight: 700; color: var(--text); }
.bar-label.dim { color: var(--faint); }
.track { height: 20px; background: var(--chip); border-radius: 4px; display: flex; overflow: hidden; }
.track > span { display: block; height: 100%; }
.bar-value { font-size: 13px; font-weight: 600; text-align: right; color: var(--text); }
.sw { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.health-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; }
.health-bar a { color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; text-decoration: none; }
.warn-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text); text-decoration: none; }
.warn-row:hover { color: var(--primary); }
.hl-row { display: grid; grid-template-columns: minmax(200px, 2fr) minmax(160px, 1.2fr) 2fr; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--row-border); font-size: 13px; }
.hl-row:last-child { border-bottom: 0; }
.opp-link { text-decoration: none; color: inherit; }
.opp-link:hover div:first-child { color: var(--primary); }
@media (max-width: 720px) { .hl-row { grid-template-columns: 1fr; gap: 4px; } }
</style>
