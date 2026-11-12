<script setup lang="ts">
import type { Component } from 'vue'
import { AlarmClock, CalendarClock, CalendarDays, CircleCheckBig, CircleDashed, Inbox, ListTodo } from 'lucide-vue-next'
import type { OppItem } from '#shared/types'

useHead({ title: 'My Actions · LCG Opportunity' })
const { $api } = useNuxtApp()
type Resp = { today: string, overdue: OppItem[], thisWeek: OppItem[], later: OppItem[], missingNextStep: OppItem[] }
const { data, error, refresh } = await useAsyncData('my-actions', () => $api<Resp>('/api/my-actions'))
const updating = ref<OppItem | null>(null)
type Group = { key: string, title: string, hint: string, items: OppItem[], icon: Component, tone: '' | 'danger' | 'amber' | 'green' }
const groups = computed<Group[]>(() => data.value
  ? [
      { key: 'overdue', title: 'Overdue', hint: 'due date has passed', items: data.value.overdue, icon: AlarmClock, tone: 'danger' },
      { key: 'week', title: 'This week', hint: 'due by Sunday', items: data.value.thisWeek, icon: CalendarDays, tone: '' },
      { key: 'later', title: 'Later / no due date', hint: 'nothing urgent', items: data.value.later, icon: CalendarClock, tone: 'green' },
      { key: 'missing', title: 'Missing a next step (W4)', hint: 'my opps without a next action', items: data.value.missingNextStep, icon: CircleDashed, tone: 'amber' },
    ]
  : [])
const total = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))
async function onSaved() {
  updating.value = null
  await refresh()
}
</script>

<template>
  <div class="page-head">
    <div>
      <PageTitle :icon="ListTodo" title="My Actions" />
      <div class="sub indent">Next actions where you are the action owner · {{ total }} in total. Completing one = log what happened with Quick Update.</div>
    </div>
  </div>
  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>

  <section v-if="data" aria-label="Summary" class="grid-kpi">
    <a v-for="g in groups" :key="g.key" :href="`#grp-${g.key}`" class="card kpi">
      <span class="kpi-top"><span class="eyebrow">{{ g.title }}</span><span class="ico-tile" :class="g.tone"><component :is="g.icon" class="ico" aria-hidden="true" /></span></span>
      <span class="kpi-value" :class="{ bad: g.tone === 'danger' && g.items.length }"><AnimatedNumber :value="g.items.length" /></span>
      <span class="small muted">{{ g.hint }}</span>
    </a>
  </section>

  <section v-for="g in groups" :id="`grp-${g.key}`" :key="g.key" class="card stack" style="gap: 6px">
    <h2 class="h-ico grp-title">
      <span class="ico-tile sm" :class="g.tone"><component :is="g.icon" class="ico" aria-hidden="true" /></span>
      {{ g.title }} <span class="count-pill">{{ g.items.length }}</span>
    </h2>
    <div v-if="!g.items.length" class="empty"><Inbox class="ico" aria-hidden="true" />Nothing here.</div>
    <div v-for="o in g.items" :key="o.id" class="act-row" :class="{ late: g.key === 'overdue' }">
      <div class="stack" style="gap: 3px; min-width: 0">
        <NuxtLink :to="`/opportunities/${o.oppCode}`" class="act-title">{{ o.nextAction ?? '(no next action)' }}</NuxtLink>
        <span class="small muted act-meta">
          <MarketFlag :code="o.marketCode" :size="16" />
          {{ o.oppCode }} · {{ o.name }} · {{ o.customer }}
        </span>
      </div>
      <span class="due" :class="{ late: o.dueDate && data && o.dueDate < data.today }">
        <CalendarClock class="ico" aria-hidden="true" />{{ o.dueDate ? fmtDay(o.dueDate, true) : 'no due date' }}
      </span>
      <HealthBadge :health="o.health" />
      <button v-if="o.canEdit" type="button" class="btn btn-outline-primary" @click="updating = o">
        <CircleCheckBig class="ico" aria-hidden="true" />Done · Update
      </button>
    </div>
  </section>
  <QuickUpdateDrawer v-if="updating && data" :opp="updating" :today="data.today" @close="updating = null" @saved="onSaved" />
</template>

<style scoped>
.kpi { display: flex; flex-direction: column; gap: 6px; padding: 16px; text-decoration: none; color: var(--text); }
.kpi-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.kpi-value { font-size: 26px; font-weight: 700; }
.kpi-value.bad { color: var(--danger); }
.grp-title { margin-bottom: 4px; }
.ico-tile.sm { width: 30px; height: 30px; border-radius: 8px; }
.ico-tile.sm .ico { width: 17px; height: 17px; color: inherit; }
.count-pill { font-size: 12px; font-weight: 600; color: var(--muted); background: var(--chip); border-radius: 10px; padding: 1px 8px; }
.act-row { display: grid; grid-template-columns: 1fr 140px 120px 150px; gap: 12px; align-items: center; padding: 10px 10px; margin: 0 -10px; border-radius: 10px; border-bottom: 1px solid var(--row-border); transition: background-color var(--dur); }
.act-row:last-child { border-bottom: 0; }
.act-row:hover { background: var(--surface-2); }
.act-row.late { background: var(--row-red); }
.act-row.late:hover { background: var(--row-red-hover); }
.act-title { font-weight: 600; text-decoration: none; color: var(--text); }
.act-title:hover { color: var(--primary); }
.act-meta { display: inline-flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.due { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-2); }
.due .ico { width: 16px; height: 16px; color: var(--muted); }
.due.late, .due.late .ico { color: var(--danger); }
@media (max-width: 720px) { .act-row { grid-template-columns: 1fr auto; } }
</style>
