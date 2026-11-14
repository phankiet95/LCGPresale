<script setup lang="ts">
import { CalendarRange, ChartBarStacked, ChartColumnBig, Gem, Layers3, Medal, ReceiptText, Rocket, Sprout } from 'lucide-vue-next'
import type { DashboardInsights } from '#shared/types'
import { STAGE_LABEL } from '#shared/constants'
import type { Stage } from '#shared/rules'

/**
 * Sales-team dashboard sections (feedback 2026-11-14), as compact cards; each one expands into a modal.
 * Every number links into Pipeline with the same filters.
 */
const props = defineProps<{ ins: DashboardInsights, link: (extra?: Record<string, string>) => Record<string, unknown>, fy: number }>()
const emit = defineEmits<{ 'update:fy': [number] }>()

const ST_COLORS: Record<string, string> = { O: 'var(--st-O)', D: 'var(--st-D)', C: 'var(--st-C)', B: 'var(--st-B)', A: 'var(--st-A)' }
const ST_LABELS = STAGE_LABEL as Record<string, string>
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const plural = (n: number) => `${n} opp${n === 1 ? '' : 's'}`

// 1. amount by stage (A at the top = closest to won)
const stageMax = computed(() => Math.max(1, ...props.ins.byStage.map(s => s.amountUsd)))
const stageRows = computed(() => [...props.ins.byStage].reverse())
const stageTotal = computed(() => props.ins.byStage.reduce((a, s) => a + s.amountUsd, 0))

// 2. P&L
const pnlRows = computed(() => props.ins.byPnl.map(p => ({
  key: p.code, label: p.code, total: p.amountUsd, sub: plural(p.count),
  segments: (['O', 'D', 'C', 'B', 'A'] as const).map(s => ({ key: s, value: p.stages[s] })),
  to: props.link({ market: p.code }),
})))

// 4 & 5. partner columns
const partnerCols = (xs: { name: string, count: number, amountUsd: number }[], extra: Record<string, string> = {}) =>
  xs.map(p => ({ key: p.name, label: p.name, value: p.amountUsd, sub: plural(p.count), to: props.link({ partner: p.name, ...extra }) }))

// 6. forecast by close month (C, D, O)
const forecastCols = computed(() => props.ins.forecast.months.map(m => ({
  key: m.month, label: MONTHS[Number(m.month.slice(5)) - 1]!,
  segments: (['O', 'D', 'C'] as const).map(s => ({ key: s, value: m.stages[s] })),
  sub: `${plural(m.count)} · weighted ${fmtUsd(m.weightedUsd)}${m.past ? ' · overdue' : ''}`,
  dim: m.past,
  to: props.link({ stage: 'C,D,O', dateFrom: `${m.month}-01`, dateTo: `${m.month}-31` }),
})))
const fcTotal = computed(() => props.ins.forecast.months.reduce((a, m) => a + m.amountUsd, 0))
const fcWeighted = computed(() => props.ins.forecast.months.reduce((a, m) => a + m.weightedUsd, 0))
const CDO: Stage[] = ['O', 'D', 'C']
const tiers = computed(() => [
  { k: 'Mega deal', icon: Rocket, v: props.ins.tiers.mega, rng: `≥ ${fmtUsd(props.ins.tiers.mega.minUsd)}` },
  { k: 'Large deal', icon: Medal, v: props.ins.tiers.large, rng: `${fmtUsd(props.ins.tiers.large.minUsd)} – ${fmtUsd(props.ins.tiers.mega.minUsd)}` },
])
</script>

<template>
  <section class="ins">
    <!-- 1. Amount by stage -->
    <ChartCard title="Open amount by sales stage" :icon="Layers3" :sub="`Total ${fmtUsd(stageTotal)}`">
      <template #default="{ big }">
        <div class="stack" :style="{ gap: big ? '14px' : '7px' }">
          <NuxtLink
            v-for="s in stageRows" :key="s.stage" :to="link({ stage: s.stage })" class="st-row" :class="{ big }"
            v-tip="`${ST_LABELS[s.stage]}: ${fmtFull(s.amountUsd)} · ${plural(s.count)} · weighted ${fmtUsd(s.weightedUsd)}`"
          >
            <span class="st-name"><span class="st-sw" :style="{ background: ST_COLORS[s.stage] }" />{{ big ? ST_LABELS[s.stage] : s.stage }}</span>
            <span class="track"><span class="bar-fill" :style="{ width: `${s.amountUsd / stageMax * 100}%`, background: ST_COLORS[s.stage] }" /></span>
            <span class="st-val"><b>{{ fmtUsd(s.amountUsd) }}</b> <span class="muted">· {{ s.count }}</span></span>
          </NuxtLink>
          <StageLegend v-if="!big" class="mini-legend" />
        </div>
      </template>
    </ChartCard>

    <!-- 2. P&L -->
    <ChartCard title="Total open opps by P&L" :icon="ChartBarStacked" sub="Amount USD, split by stage">
      <template #default="{ big }">
        <StackBars :rows="pnlRows" :colors="ST_COLORS" :seg-labels="ST_LABELS" :compact="!big">
          <template #label="{ row }"><MarketFlag :code="row.key" :size="big ? 18 : 15" />{{ row.label }}</template>
        </StackBars>
        <StageLegend v-if="big" />
      </template>
    </ChartCard>

    <!-- 3. Mega & Large -->
    <ChartCard title="Mega & Large deals" :icon="Gem" sub="Open opps">
      <template #default="{ big }">
        <div class="tiers">
          <div v-for="t in tiers" :key="t.k" class="tier" :class="{ big }">
            <span class="tier-top"><span class="eyebrow">{{ t.k }}</span><span class="ico-tile sm"><component :is="t.icon" class="ico" aria-hidden="true" /></span></span>
            <span class="small muted">{{ t.rng }}</span>
            <span class="tier-v"><AnimatedNumber :value="t.v.amountUsd" :format="fmtUsd" /></span>
            <span class="small muted">{{ t.v.count }} opportunit{{ t.v.count === 1 ? 'y' : 'ies' }}</span>
            <ul class="tier-list">
              <li v-for="o in t.v.opps.slice(0, big ? 8 : 2)" :key="o.id">
                <NuxtLink v-tip :to="`/opportunities/${o.oppCode}`" class="truncate">{{ o.name }}</NuxtLink>
                <span class="small"><MarketFlag :code="o.marketCode" :size="14" /> <b>{{ fmtUsd(o.amountUsd) }}</b></span>
              </li>
              <li v-if="!t.v.count" class="muted small">None</li>
            </ul>
          </div>
        </div>
      </template>
    </ChartCard>

    <!-- 4. Partner resell -->
    <ChartCard title="Partner resell · license deals" :icon="ReceiptText" :sub="`${ins.resell.count} deals · ${fmtUsd(ins.resell.amountUsd)} · License / Project+License, open + won`">
      <template #default="{ big }">
        <ColumnChart v-if="ins.resell.byPartner.length" :items="partnerCols(ins.resell.byPartner, { dealType: 'License,Project+License' })" :height="big ? 380 : 140" :compact="!big" />
        <div v-else class="empty">No deal with type "License" or "Project+License" yet.</div>
      </template>
    </ChartCard>

    <!-- 5. Platforms -->
    <ChartCard class="half" title="Stage A + B by platform" :icon="ChartColumnBig" sub="Verbal award + Negotiation">
      <template #default="{ big }">
        <ColumnChart v-if="ins.platforms.late.length" :items="partnerCols(ins.platforms.late, { stage: 'A,B' })" :height="big ? 380 : 140" color="var(--st-A)" :compact="!big" />
        <div v-else class="empty">No open opp in stage A or B.</div>
      </template>
    </ChartCard>
    <ChartCard class="half" title="Stage C + D + O by platform" :icon="Sprout" sub="Open pipeline">
      <template #default="{ big }">
        <ColumnChart v-if="ins.platforms.early.length" :items="partnerCols(ins.platforms.early, { stage: 'C,D,O' })" :height="big ? 380 : 140" color="var(--st-C)" :compact="!big" />
        <div v-else class="empty">No open opp in stage C, D or O.</div>
      </template>
    </ChartCard>

    <!-- 6. Forecast -->
    <ChartCard class="wide" title="Open amount by close month · forecast" :icon="CalendarRange" :sub="`Stages C, D, O · total ${fmtUsd(fcTotal)} · weighted ${fmtUsd(fcWeighted)}`">
      <template #actions>
        <select class="select yr" aria-label="Close year" :value="fy" @change="emit('update:fy', Number(($event.target as HTMLSelectElement).value))">
          <option v-for="y in ins.forecast.years" :key="y" :value="y">{{ y }}</option>
        </select>
      </template>
      <template #default="{ big }">
        <ColumnChart :items="forecastCols" :colors="ST_COLORS" :seg-labels="ST_LABELS" :height="big ? 400 : 150" :compact="!big" />
        <div class="row" style="justify-content: space-between">
          <StageLegend :stages="CDO" />
          <span v-if="big" class="small muted">Faded months are past (overdue close dates). Click a month to open those opps.</span>
        </div>
      </template>
    </ChartCard>
  </section>
</template>

<style scoped>
/* Always 4 charts per line on desktop (collapsing the menu only widens them); 2 on tablets, 1 on phones */
.ins { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.ins > :deep(.half) { grid-column: span 2; }
@media (max-width: 1180px) { .ins { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ins > :deep(.wide) { grid-column: 1 / -1; }
.ins > * { animation: fade-up 360ms var(--ease-out) backwards; }
.ins > *:nth-child(2) { animation-delay: 40ms; }
.ins > *:nth-child(3) { animation-delay: 80ms; }
.ins > *:nth-child(4) { animation-delay: 120ms; }
.ins > *:nth-child(5) { animation-delay: 160ms; }
.ins > *:nth-child(n+6) { animation-delay: 200ms; }

.st-row { display: grid; grid-template-columns: 28px 1fr minmax(78px, auto); gap: 8px; align-items: center; text-decoration: none; color: inherit; }
.st-row.big { grid-template-columns: minmax(170px, 210px) 1fr minmax(110px, auto); gap: 12px; }
.st-row:hover .bar-fill { filter: brightness(1.08); }
.st-name { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--text-2); white-space: nowrap; }
.st-sw { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.track { height: 14px; background: var(--chip); border-radius: 4px; overflow: hidden; display: flex; }
.big .track { height: 24px; }
.track > span { display: block; height: 100%; border-radius: 0 4px 4px 0; }
.st-val { font-size: 12px; text-align: right; white-space: nowrap; }
.big .st-val { font-size: 14px; }
.mini-legend { font-size: 11px; gap: 2px 10px; margin-top: 2px; }

.tiers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.tier { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--row-border); min-width: 0; }
.tier.big { padding: 18px; gap: 4px; }
.tier-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.ico-tile.sm { width: 28px; height: 28px; border-radius: 8px; }
.ico-tile.sm .ico { width: 16px; height: 16px; }
.tier-v { font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
.tier.big .tier-v { font-size: 30px; }
.tier-list { list-style: none; margin: 6px 0 0; padding: 6px 0 0; border-top: 1px solid var(--row-border); display: flex; flex-direction: column; gap: 4px; }
.tier-list li { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; min-width: 0; }
.tier.big .tier-list li { font-size: 13.5px; }
.tier-list a { min-width: 0; color: var(--text); text-decoration: none; }
.tier-list a:hover { color: var(--primary); }
.tier-list .small { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.yr { height: 30px; width: auto; font-size: 12.5px; padding: 0 8px; }
@media (max-width: 720px) { .ins { grid-template-columns: 1fr; } .ins > :deep(.half) { grid-column: auto; } }
</style>
