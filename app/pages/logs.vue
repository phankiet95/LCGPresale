<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowRight, CalendarRange, FilePlus2, History, MessageSquareText, PencilLine, Search, Trash2, TrendingUp, UserCog, X } from 'lucide-vue-next'
import type { LogItem, LogKind, LogResponse } from '#shared/types'

useHead({ title: 'Change log · LCG Opportunity' })
const { $api } = useNuxtApp()
const route = useRoute()
const router = useRouter()
const me = useCurrentUser()

// filters live in the URL (shareable)
const qv = (k: string) => (typeof route.query[k] === 'string' ? route.query[k] as string : '')
const params = computed(() => Object.fromEntries(Object.entries({
  q: qv('q'), kind: qv('kind'), who: qv('who'), market: qv('market'), from: qv('from'), to: qv('to'),
}).filter(([, v]) => v)))
const setQ = (patch: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...patch } })

const { data, error, status } = await useAsyncData('logs', () => $api<LogResponse>('/api/logs', { query: params.value }), { watch: [params] })

const search = ref(qv('q'))
let t: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(t)
  t = setTimeout(() => setQ({ q: v || undefined }), 300)
})

const KINDS: { k: LogKind, label: string, icon: Component, tone: string }[] = [
  { k: 'field', label: 'Field change', icon: PencilLine, tone: '' },
  { k: 'stage', label: 'Stage / status', icon: TrendingUp, tone: 'amber' },
  { k: 'activity', label: 'Activity', icon: MessageSquareText, tone: 'green' },
  { k: 'created', label: 'Created', icon: FilePlus2, tone: 'green' },
  { k: 'deleted', label: 'Deleted', icon: Trash2, tone: 'danger' },
  ...(me.value?.role === 'admin' ? [{ k: 'user' as LogKind, label: 'User admin', icon: UserCog, tone: '' }] : []),
]
const KIND = Object.fromEntries(KINDS.map(x => [x.k, x])) as Record<LogKind, (typeof KINDS)[number]>
const kindSel = computed(() => qv('kind').split(',').filter(Boolean))
function toggleKind(k: LogKind) {
  const s = new Set(kindSel.value)
  if (s.has(k)) s.delete(k)
  else s.add(k)
  setQ({ kind: [...s].join(',') || undefined })
}
const { data: meta } = await useMeta()
const marketOpts = computed(() => (meta.value?.markets ?? []).map(m => ({ value: m.code, label: `${m.code} · ${m.name}` })))
const peopleOpts = computed(() => (data.value?.people ?? []).map(p => ({ value: p })))

const SCOPE_TEXT = {
  all: 'You see every change in the app.',
  markets: 'You see every change in your markets.',
  mine: 'You see the changes on the opportunities you are involved in, and everything you changed.',
}

// group by JST day, show in pages of 150
const LIMIT = 150
const shown = ref(LIMIT)
watch(params, () => { shown.value = LIMIT })
const jst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString()
const groups = computed(() => {
  const g = new Map<string, LogItem[]>()
  for (const i of (data.value?.items ?? []).slice(0, shown.value)) {
    const day = jst(i.at).slice(0, 10)
    g.set(day, [...(g.get(day) ?? []), i])
  }
  return [...g.entries()]
})
const dayLabel = (d: string) => {
  const today = data.value?.to
  if (d === today) return 'Today'
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${d}T00:00:00Z`).getUTCDay()]} ${fmtDay(d, true)}`
}
const hasFilter = computed(() => Object.keys(params.value).length > 0)
const clearAll = () => {
  search.value = ''
  router.replace({ query: {} })
}
</script>

<template>
  <div class="page-head">
    <div>
      <PageTitle :icon="History" title="Change log" />
      <div class="sub indent">{{ data ? SCOPE_TEXT[data.scope] : '' }} Times are Japan time.</div>
    </div>
  </div>

  <section class="card filters">
    <label class="search">
      <Search class="ico" aria-hidden="true" />
      <input v-model="search" type="search" placeholder="Opp code, name, field, text, person" aria-label="Search the log">
    </label>
    <span class="kinds">
      <button v-for="k in KINDS" :key="k.k" type="button" class="kchip" :class="k.tone" :aria-pressed="kindSel.includes(k.k)" @click="toggleKind(k.k)">
        <component :is="k.icon" class="ico" aria-hidden="true" />{{ k.label }}
      </button>
    </span>
    <MultiSelect label="Who" :options="peopleOpts" :model-value="qv('who') ? [qv('who')] : []" @update:model-value="v => setQ({ who: v[v.length - 1] || undefined })" />
    <MultiSelect label="Market" :options="marketOpts" :model-value="qv('market').split(',').filter(Boolean)" @update:model-value="v => setQ({ market: v.join(',') || undefined })" />
    <span class="daterange">
      <CalendarRange class="ico" aria-hidden="true" />
      <input type="date" aria-label="From" :value="data?.from" :max="data?.to" @change="setQ({ from: ($event.target as HTMLInputElement).value || undefined })">
      <span class="muted">~</span>
      <input type="date" aria-label="To" :value="data?.to" :min="data?.from" @change="setQ({ to: ($event.target as HTMLInputElement).value || undefined })">
    </span>
    <button v-if="hasFilter" type="button" class="link-btn clear" @click="clearAll"><X class="ico" aria-hidden="true" />Clear</button>
  </section>

  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>
  <div v-else-if="data" class="stack" :class="{ refreshing: status === 'pending' }" style="gap: 12px">
    <div class="small muted">{{ data.total }} change{{ data.total === 1 ? '' : 's' }} from {{ fmtDay(data.from, true) }} to {{ fmtDay(data.to, true) }}<template v-if="data.total > 1000"> · showing the latest 1000, narrow the filters to see older ones</template></div>

    <div v-if="!data.items.length" class="card empty"><History class="ico" aria-hidden="true" />No changes in this period.</div>

    <section v-for="[day, list] in groups" :key="day" class="card day">
      <h2 class="day-head">{{ dayLabel(day) }} <span class="count-pill">{{ list.length }}</span></h2>
      <ol class="log">
        <li v-for="i in list" :key="i.key" class="entry">
          <span class="ico-tile sm" :class="KIND[i.kind]?.tone" :title="KIND[i.kind]?.label"><component :is="KIND[i.kind]?.icon ?? PencilLine" class="ico" aria-hidden="true" /></span>
          <div class="body">
            <div class="line1">
              <span class="time">{{ jst(i.at).slice(11, 16) }}</span>
              <b class="who">{{ i.by ?? 'System' }}</b>
              <template v-if="i.oppCode">
                <span class="muted">on</span>
                <NuxtLink v-if="!i.deleted" :to="`/opportunities/${i.oppCode}`" class="opp">
                  <MarketFlag v-if="i.market" :code="i.market" :size="16" /><span class="code">{{ i.oppCode }}</span>
                  <span v-tip class="truncate oname">{{ i.oppName }}</span>
                </NuxtLink>
                <span v-else class="opp deleted" title="This opportunity was deleted">
                  <MarketFlag v-if="i.market" :code="i.market" :size="16" /><span class="code">{{ i.oppCode }}</span>
                  <span v-tip class="truncate oname">{{ i.oppName }}</span>
                </span>
              </template>
              <template v-else-if="i.kind === 'user'"><span class="muted">on user</span> <b>{{ i.text }}</b></template>
            </div>

            <div class="line2">
              <template v-if="i.kind === 'field' || i.kind === 'stage' || i.kind === 'user'">
                <span class="fname">{{ i.field }}</span>
                <span v-if="i.from !== null" v-tip class="val old">{{ i.from }}</span>
                <ArrowRight v-if="i.from !== null" class="ico arrow" aria-hidden="true" />
                <span v-tip class="val new">{{ i.to ?? '—' }}</span>
                <span v-if="i.kind === 'stage' && i.text" v-tip class="muted reason">· {{ i.text }}</span>
              </template>
              <template v-else-if="i.kind === 'activity'">
                <span class="fname">{{ i.field }}</span><span class="muted small">dated {{ i.to ? fmtDay(i.to, true) : '' }}</span>
                <span v-tip class="act-text clamp-2">{{ i.text }}</span>
              </template>
              <template v-else-if="i.kind === 'created'"><span class="fname">Created</span><span class="muted">{{ i.text }}</span></template>
              <template v-else-if="i.kind === 'deleted'"><span class="fname" style="color: var(--danger)">Deleted</span><span v-tip class="muted">reason: {{ i.text }}</span></template>
            </div>
          </div>
        </li>
      </ol>
    </section>
    <button v-if="(data.items.length) > shown" type="button" class="btn" style="align-self: center" @click="shown += LIMIT">Show more ({{ data.items.length - shown }} left)</button>
  </div>
  <template v-else-if="status === 'pending'"><SkeletonBlock :rows="6" /></template>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px; }
.search { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border-strong); background: var(--surface); border-radius: 8px; padding: 0 10px; height: 36px; color: var(--muted); }
.search input { border: 0; outline: none; width: 230px; background: transparent; font-size: 13px; color: var(--text); }
.search .ico { width: 16px; height: 16px; }
.kinds { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.kchip { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border-radius: 17px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.kchip .ico { width: 15px; height: 15px; }
.kchip[aria-pressed="true"] { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.daterange { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 8px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--muted); }
.daterange .ico { width: 16px; height: 16px; }
.daterange input { border: 0; background: transparent; font-size: 13px; color: var(--text); width: 128px; outline: none; }
.clear { display: inline-flex; align-items: center; gap: 4px; }
.clear .ico { width: 15px; height: 15px; }

.day { padding: 14px 18px; }
.day-head { font-size: 14px; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.count-pill { font-size: 12px; font-weight: 600; color: var(--muted); background: var(--chip); border-radius: 10px; padding: 1px 8px; }
.log { list-style: none; margin: 0; padding: 0; }
.entry { display: grid; grid-template-columns: 34px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--row-border); }
.entry:last-child { border-bottom: 0; }
.ico-tile.sm { width: 32px; height: 32px; border-radius: 9px; }
.ico-tile.sm .ico { width: 17px; height: 17px; }
.body { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.line1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; min-width: 0; }
.time { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 12px; min-width: 38px; }
.opp { display: inline-flex; align-items: center; gap: 6px; min-width: 0; max-width: 520px; text-decoration: none; color: var(--text); }
.opp:hover .oname { color: var(--primary); }
.opp.deleted { color: var(--faint); text-decoration: line-through; }
.code { font-weight: 600; color: var(--muted); white-space: nowrap; }
.oname { min-width: 0; }
.line2 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; min-width: 0; }
.fname { font-weight: 600; color: var(--text-2); }
.val { padding: 1px 8px; border-radius: 6px; max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.val.old { background: var(--red-bg); color: var(--red-fg); text-decoration: line-through; text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); }
.val.new { background: var(--green-bg); color: var(--green-fg); }
.arrow { width: 15px; height: 15px; color: var(--faint); }
.reason { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.act-text { flex-basis: 100%; color: var(--text); white-space: pre-line; }
@media (max-width: 720px) { .search input { width: 150px; } .opp { max-width: 100%; } }
</style>
