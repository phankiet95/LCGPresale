<script setup lang="ts">
import { CalendarCheck, CircleDollarSign, Sparkles } from 'lucide-vue-next'
import type { OppItem } from '#shared/types'
import type { HighlightTag, ReportPeriod } from '#shared/highlight'
import { createdJst, HIGHLIGHT_USD } from '#shared/highlight'

/** Highlight of the week: new in the report period, or revenue > $200K (open opps). */
const props = defineProps<{ items: { opp: OppItem, tags: HighlightTag[] }[], period: ReportPeriod }>()
const sort = useTableSort(() => props.items, {
  key: 'amount', dir: -1, descFirst: ['amount', 'created'],
  get: {
    name: x => (x as { opp: OppItem }).opp.name,
    market: x => (x as { opp: OppItem }).opp.marketCode,
    owner: x => (x as { opp: OppItem }).opp.salesOwner,
    amount: x => (x as { opp: OppItem }).opp.amountUsd,
    created: x => (x as { opp: OppItem }).opp.createdAt,
  },
})
const newCount = computed(() => props.items.filter(i => i.tags.some(t => t.kind === 'new')).length)
</script>

<template>
  <div class="stack" style="gap: 10px">
    <div class="row small muted period">
      <span class="pchip"><CalendarCheck class="ico" aria-hidden="true" />Report date <b>Thu {{ fmtDay(period.report, true) }}</b></span>
      <span>New = created after Thu {{ fmtDay(period.previous) }} up to the report date ({{ newCount }})</span>
      <span>·</span>
      <span>or revenue &gt; {{ fmtUsd(HIGHLIGHT_USD) }}</span>
    </div>
    <div v-if="!items.length" class="empty">
      <CalendarCheck class="ico" aria-hidden="true" />No new opportunity in this period and none above {{ fmtUsd(HIGHLIGHT_USD) }}.
    </div>
    <div v-else style="overflow-x: auto">
      <table class="data" style="min-width: 760px">
        <thead>
          <tr>
            <SortTh :sort="sort" k="name">Opportunity</SortTh><SortTh :sort="sort" k="market">Market</SortTh>
            <SortTh :sort="sort" k="owner">Owner</SortTh><SortTh :sort="sort" k="amount" num>Amount</SortTh>
            <SortTh :sort="sort" k="created">Created</SortTh><th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in sort.rows.value" :key="h.opp.id">
            <td>
              <NuxtLink :to="`/opportunities/${h.opp.oppCode}`" class="hl-name">{{ h.opp.name }}</NuxtLink>
              <div class="muted small">{{ h.opp.oppCode }} · {{ h.opp.customer }}</div>
            </td>
            <td><span class="mkt-cell"><MarketFlag :code="h.opp.marketCode" />{{ h.opp.marketCode }}</span></td>
            <td>{{ h.opp.salesOwner }}</td>
            <td class="num" style="font-weight: 600" :title="amountTitle(h.opp)">{{ fmtUsd(h.opp.amountUsd) }}</td>
            <td class="small" style="white-space: nowrap">{{ fmtDay(createdJst(h.opp.createdAt), true) }}</td>
            <td>
              <span class="row" style="gap: 6px">
                <span v-for="t in h.tags" :key="t.kind" class="tag" :class="t.kind">
                  <component :is="t.kind === 'new' ? Sparkles : CircleDollarSign" class="ico" aria-hidden="true" />{{ t.label }}
                </span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.period { gap: 8px; }
.pchip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 12px; background: var(--primary-soft); color: var(--primary); }
.pchip .ico { width: 15px; height: 15px; }
.hl-name { font-weight: 600; color: var(--text); text-decoration: none; }
.hl-name:hover { color: var(--primary); }
.tag { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; border-radius: 10px; padding: 2px 8px; white-space: nowrap; }
.tag .ico { width: 14px; height: 14px; }
.tag.new { background: var(--primary-soft); color: var(--primary); }
.tag.revenue { background: var(--green-bg); color: var(--green-fg); }
</style>
