<script setup lang="ts">
import { ALL_STAGES, STAGE_SHORT } from '#shared/constants'

const props = defineProps<{ marketCounts?: Record<string, number> }>()
const { filter, set, toggleMarket, restore } = useOppFilters()
const { data: meta } = await useMeta()
onMounted(restore)

const markets = computed(() => meta.value?.markets ?? [])
const totalOpen = computed(() => Object.values(props.marketCounts ?? {}).reduce((a, b) => a + b, 0))
const owners = computed(() => meta.value?.users ?? [])
const dealTypes = computed(() => meta.value?.lookups.deal_type ?? [])

const single = (v: string[] | undefined) => v?.[0] ?? ''
const onSelect = (key: 'partner' | 'owner' | 'dealType' | 'stage' | 'health', e: Event) => {
  const v = (e.target as HTMLSelectElement).value
  set({ [key]: v ? [v] : [] })
}
const search = ref(filter.value.q ?? '')
let t: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(t)
  t = setTimeout(() => set({ q: v || undefined }), 300)
})
const hasExtra = computed(() => !!(filter.value.partner?.length || filter.value.owner?.length || filter.value.dealType?.length
  || filter.value.stage?.length || filter.value.health?.length || filter.value.q || filter.value.market?.length))
function clearAll() {
  search.value = ''
  set({ market: [], partner: [], owner: [], dealType: [], stage: [], health: [], q: undefined })
}
</script>

<template>
  <section aria-label="Filters" class="bar">
    <span class="eyebrow" style="margin-right: 4px">Market</span>
    <button type="button" class="chip" :aria-pressed="!filter.market?.length" @click="toggleMarket('All')">
      All <span class="cnt">{{ totalOpen }}</span>
    </button>
    <button
      v-for="m in markets" :key="m.code" type="button" class="chip" :title="m.name"
      :aria-pressed="!!filter.market?.includes(m.code)" @click="toggleMarket(m.code)"
    >
      {{ m.code }} <span class="cnt">{{ marketCounts?.[m.code] ?? 0 }}</span>
    </button>
    <span class="spacer" />
    <label class="search">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input v-model="search" type="search" placeholder="Code, opp, customer" aria-label="Search">
    </label>
    <select class="sel" aria-label="Partner" :value="single(filter.partner)" @change="onSelect('partner', $event)">
      <option value="">Partner: All</option>
      <option v-for="p in meta?.partners" :key="p.id" :value="p.name">{{ p.name }}</option>
    </select>
    <select class="sel" aria-label="Owner" :value="single(filter.owner)" @change="onSelect('owner', $event)">
      <option value="">Owner: All</option>
      <option v-for="u in owners" :key="u.id" :value="u.account">{{ u.account }}</option>
    </select>
    <select class="sel" aria-label="Stage" :value="single(filter.stage)" @change="onSelect('stage', $event)">
      <option value="">Stage: All</option>
      <option v-for="s in ALL_STAGES" :key="s" :value="s">{{ STAGE_SHORT[s] }}</option>
    </select>
    <select class="sel" aria-label="Deal type" :value="single(filter.dealType)" @change="onSelect('dealType', $event)">
      <option value="">Deal type: All</option>
      <option v-for="d in dealTypes" :key="d" :value="d">{{ d }}</option>
    </select>
    <select class="sel" aria-label="Health" :value="single(filter.health)" @change="onSelect('health', $event)">
      <option value="">Health: All</option>
      <option v-for="h in ['Green', 'Amber', 'Red', 'Closed']" :key="h" :value="h">{{ h }}</option>
    </select>
    <button v-if="hasExtra" type="button" class="link-btn" @click="clearAll">Clear</button>
  </section>
</template>

<style scoped>
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 16px; }
.chip { height: 36px; padding: 0 12px; border-radius: 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: var(--surface); color: var(--text-2); border: 1px solid var(--border-strong); }
.chip .cnt { font-size: 11px; font-weight: 600; border-radius: 9px; padding: 1px 6px; background: var(--chip); color: var(--muted); }
.chip[aria-pressed="true"] { background: var(--primary); color: #fff; border-color: var(--primary); }
.chip[aria-pressed="true"] .cnt { background: #fff; color: var(--primary); }
.sel { height: 36px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface); font-size: 13px; color: var(--text-2); max-width: 170px; }
.search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 8px; padding: 0 10px; height: 36px; color: var(--muted); }
.search input { border: 0; outline: none; width: 170px; background: transparent; font-size: 13px; color: var(--text); }
</style>
