<script setup lang="ts">
import { CalendarRange, Globe, Search, SlidersHorizontal, X } from 'lucide-vue-next'
import type { DateField } from '#shared/types'
import { ALL_STAGES, STAGE_SHORT } from '#shared/constants'

const props = defineProps<{ marketCounts?: Record<string, number> }>()
const { filter, set, toggleMarket, restore } = useOppFilters()
const { data: meta } = await useMeta()
onMounted(restore)

const markets = computed(() => meta.value?.allMarkets ?? (meta.value?.markets ?? []).map(m => ({ ...m, inScope: true })))
const totalOpen = computed(() => Object.values(props.marketCounts ?? {}).reduce((a, b) => a + b, 0))
const owners = computed(() => meta.value?.users ?? [])
const dealTypes = computed(() => meta.value?.lookups.deal_type ?? [])

const partnerOpts = computed(() => (meta.value?.partners ?? []).map(p => ({ value: p.name })))
const ownerOpts = computed(() => owners.value.map(u => ({ value: u.account, label: u.displayName && u.displayName !== u.account ? `${u.account} · ${u.displayName}` : u.account })))
const stageOpts = ALL_STAGES.map(s => ({ value: s, label: STAGE_SHORT[s] }))
const dealOpts = computed(() => dealTypes.value.map(d => ({ value: d })))
const healthOpts = ['Green', 'Amber', 'Red', 'Closed'].map(h => ({ value: h }))
const search = ref(filter.value.q ?? '')
let t: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(t)
  t = setTimeout(() => set({ q: v || undefined }), 300)
})
const hasExtra = computed(() => !!(filter.value.partner?.length || filter.value.owner?.length || filter.value.dealType?.length
  || filter.value.stage?.length || filter.value.health?.length || filter.value.q || filter.value.market?.length
  || filter.value.dateFrom || filter.value.dateTo))
function clearAll() {
  search.value = ''
  set({ market: [], partner: [], owner: [], dealType: [], stage: [], health: [], q: undefined, dateBy: undefined, dateFrom: undefined, dateTo: undefined })
}
</script>

<template>
  <section aria-label="Filters" class="bar">
    <div class="line">
    <span class="eyebrow lbl"><Globe class="ico" aria-hidden="true" />Market</span>
    <button type="button" class="chip" :aria-pressed="!filter.market?.length" @click="toggleMarket('All')">
      All <span class="cnt">{{ totalOpen }}</span>
    </button>
    <button
      v-for="m in markets" :key="m.code" type="button" class="chip"
      :class="{ inactive: !(marketCounts?.[m.code]) }"
      :disabled="!m.inScope"
      :title="m.inScope ? `${m.name} · ${marketCounts?.[m.code] ?? 0} open` : `${m.name} · outside your market scope`"
      :aria-pressed="!!filter.market?.includes(m.code)" @click="toggleMarket(m.code)"
    >
      <MarketFlag :code="m.code" :size="18" />{{ m.code }} <span class="cnt">{{ marketCounts?.[m.code] ?? 0 }}</span>
    </button>
    </div>
    <div class="line">
    <span class="eyebrow lbl"><SlidersHorizontal class="ico" aria-hidden="true" />Filter</span>
    <label class="search">
      <Search class="ico" aria-hidden="true" />
      <input v-model="search" type="search" placeholder="Code, opp, customer" aria-label="Search">
    </label>
    <MultiSelect label="Partner" :options="partnerOpts" :model-value="filter.partner" @update:model-value="v => set({ partner: v })" />
    <MultiSelect label="Owner" :options="ownerOpts" :model-value="filter.owner" @update:model-value="v => set({ owner: v })" />
    <MultiSelect label="Stage" :options="stageOpts" :model-value="filter.stage" @update:model-value="v => set({ stage: v as typeof filter.stage })" />
    <MultiSelect label="Deal type" :options="dealOpts" :model-value="filter.dealType" @update:model-value="v => set({ dealType: v })" />
    <MultiSelect label="Health" :options="healthOpts" :model-value="filter.health" @update:model-value="v => set({ health: v })" />
    <span class="daterange" :class="{ on: filter.dateFrom || filter.dateTo }">
      <CalendarRange class="ico" aria-hidden="true" />
      <select class="dr-by" aria-label="Date field" :value="filter.dateBy ?? 'close'" @change="set({ dateBy: ($event.target as HTMLSelectElement).value as DateField })">
        <option value="close">Expected close</option>
        <option value="created">Created</option>
        <option value="update">Last update</option>
      </select>
      <input type="date" class="dr-in" aria-label="From date" :value="filter.dateFrom ?? ''" :max="filter.dateTo" @change="set({ dateFrom: ($event.target as HTMLInputElement).value || undefined })">
      <span class="muted">~</span>
      <input type="date" class="dr-in" aria-label="To date" :value="filter.dateTo ?? ''" :min="filter.dateFrom" @change="set({ dateTo: ($event.target as HTMLInputElement).value || undefined })">
    </span>
    <button v-if="hasExtra" type="button" class="link-btn clear" @click="clearAll"><X class="ico" aria-hidden="true" />Clear</button>
    </div>
  </section>
</template>

<style scoped>
.bar { display: flex; flex-direction: column; gap: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 16px; }
.chip { height: 36px; padding: 0 12px; border-radius: 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: var(--surface); color: var(--text-2); border: 1px solid var(--border-strong); }
.chip .cnt { font-size: 11px; font-weight: 600; border-radius: 9px; padding: 1px 6px; background: var(--chip); color: var(--muted); }
.chip[aria-pressed="true"] { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
.chip[aria-pressed="true"] .cnt { background: var(--on-primary); color: var(--primary); }
.search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 8px; padding: 0 10px; height: 36px; color: var(--muted); }
.search input { border: 0; outline: none; width: 170px; background: transparent; font-size: 13px; color: var(--text); }
.lbl { display: inline-flex; align-items: center; gap: 6px; min-width: 78px; }
.lbl .ico { width: 16px; height: 16px; }
.clear { display: inline-flex; align-items: center; gap: 4px; }
.clear .ico { width: 15px; height: 15px; }
.chip.inactive { background: var(--chip); color: var(--faint); border-color: var(--border); }
.chip.inactive :deep(.flag) { filter: grayscale(1); opacity: .55; }
.chip.inactive .cnt { background: transparent; color: var(--faint); }
.chip.inactive[aria-pressed="true"] { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
.chip:disabled { cursor: not-allowed; opacity: .7; }
.daterange { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 8px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--muted); }
.daterange.on { border-color: var(--primary); color: var(--primary); }
.daterange .ico { width: 16px; height: 16px; }
.dr-by { border: 0; background: transparent; font-size: 13px; color: var(--text-2); padding: 0 2px; cursor: pointer; }
.dr-in { border: 0; background: transparent; font-size: 13px; color: var(--text); width: 128px; }
.dr-by:focus, .dr-in:focus { outline: none; }
.line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.line + .line { border-top: 1px solid var(--row-border); padding-top: 10px; }
</style>
