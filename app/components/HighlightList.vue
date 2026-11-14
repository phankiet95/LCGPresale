<script setup lang="ts">
import { CalendarCheck, CircleDollarSign, Sparkles } from 'lucide-vue-next'
import type { OppItem } from '#shared/types'
import { HEALTH_BUCKET, STAGE_SHORT } from '#shared/constants'
import type { HighlightTag, ReportPeriod } from '#shared/highlight'
import { createdJst, HIGHLIGHT_USD } from '#shared/highlight'

/** Highlight of the week: new in the report period, or revenue > $200K (open opps). */
const props = defineProps<{ items: { opp: OppItem, tags: HighlightTag[] }[], period: ReportPeriod }>()
const STAGE_RANK = { O: 0, D: 1, C: 2, B: 3, A: 4, W: 5, L: 6 } as const
const HEALTH_RANK = { Red: 0, Amber: 1, Green: 2, Closed: 3 } as const
type H = { opp: OppItem }
const sort = useTableSort(() => props.items, {
  key: 'amount', dir: -1, descFirst: ['amount', 'win', 'created'],
  get: {
    customer: x => (x as H).opp.customer,
    market: x => (x as H).opp.marketCode,
    partner: x => (x as H).opp.partner,
    stage: x => STAGE_RANK[(x as H).opp.stage],
    amount: x => (x as H).opp.amountUsd,
    win: x => (x as H).opp.winRate,
    bidding: x => (x as H).opp.biddingLead ?? '',
    sales: x => (x as H).opp.salesOwner,
    vi: x => (x as H).opp.viOwner ?? '',
    health: x => HEALTH_RANK[HEALTH_BUCKET((x as H).opp.health)],
    created: x => (x as H).opp.createdAt,
  },
})
const isRed = (o: OppItem) => HEALTH_BUCKET(o.health) === 'Red' || o.warnings.includes('W3')
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
      <table class="data" style="min-width: 1180px">
        <thead>
          <tr>
            <SortTh :sort="sort" k="customer">Customer · Opportunity</SortTh>
            <SortTh :sort="sort" k="market">Market</SortTh><SortTh :sort="sort" k="partner">Partner</SortTh>
            <SortTh :sort="sort" k="stage">Stage</SortTh><SortTh :sort="sort" k="amount" num>Amount</SortTh>
            <SortTh :sort="sort" k="win" num>Win</SortTh><SortTh :sort="sort" k="bidding">Bidding lead</SortTh>
            <SortTh :sort="sort" k="sales">Sales</SortTh><SortTh :sort="sort" k="vi">VI</SortTh>
            <SortTh :sort="sort" k="health">Health</SortTh>
            <SortTh :sort="sort" k="created">Created</SortTh><th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in sort.rows.value" :key="h.opp.id" :class="{ 'row-red': isRed(h.opp) }">
            <td><NuxtLink :to="`/opportunities/${h.opp.oppCode}`" class="hl-name"><div style="font-weight: 600">{{ h.opp.customer }}</div><div class="muted">{{ h.opp.name }}</div></NuxtLink></td>
            <td><span class="mkt-cell"><MarketFlag :code="h.opp.marketCode" />{{ h.opp.marketCode }}</span></td>
            <td>{{ h.opp.partner }}</td>
            <td><span class="badge">{{ STAGE_SHORT[h.opp.stage] }}</span></td>
            <td class="num" style="font-weight: 600" :title="amountTitle(h.opp)">{{ fmtUsd(h.opp.amountUsd) }}</td>
            <td class="num">{{ h.opp.winRate }}%</td>
            <td><span v-tip class="ppl">{{ h.opp.biddingLead ?? '—' }}</span></td>
            <td><span v-tip class="ppl">{{ h.opp.salesOwner }}</span></td>
            <td><span v-tip class="ppl">{{ h.opp.viOwner ?? '—' }}</span></td>
            <td><HealthBadge :health="h.opp.health" /></td>
            <td class="small" style="white-space: nowrap">{{ fmtDay(createdJst(h.opp.createdAt), true) }}</td>
            <td>
              <span class="row" style="gap: 6px; flex-wrap: nowrap">
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
.hl-name { color: var(--text); text-decoration: none; }
.hl-name:hover > div:first-child { color: var(--primary); }
.ppl { display: block; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; border-radius: 10px; padding: 2px 8px; white-space: nowrap; }
.tag .ico { width: 14px; height: 14px; }
.tag.new { background: var(--primary-soft); color: var(--primary); }
.tag.revenue { background: var(--green-bg); color: var(--green-fg); }
</style>
