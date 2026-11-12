<script setup lang="ts">
import type { OppItem } from '#shared/types'

useHead({ title: 'My Actions · LCG Opportunity' })
const { $api } = useNuxtApp()
type Resp = { today: string, overdue: OppItem[], thisWeek: OppItem[], later: OppItem[], missingNextStep: OppItem[] }
const { data, error, refresh } = await useAsyncData('my-actions', () => $api<Resp>('/api/my-actions'))
const updating = ref<OppItem | null>(null)
const groups = computed(() => data.value
  ? [
      { key: 'overdue', title: 'Overdue', items: data.value.overdue, tone: 'var(--danger)' },
      { key: 'week', title: 'This week', items: data.value.thisWeek, tone: 'var(--text)' },
      { key: 'later', title: 'Later / no due date', items: data.value.later, tone: 'var(--muted)' },
      { key: 'missing', title: 'My opps missing a next step (W4)', items: data.value.missingNextStep, tone: 'var(--amber-fg)' },
    ]
  : [])
async function onSaved() {
  updating.value = null
  await refresh()
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1>My Actions</h1>
      <div class="sub">Next actions where you are the action owner. Completing one = log what happened with Quick Update.</div>
    </div>
  </div>
  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>
  <section v-for="g in groups" :key="g.key" class="card stack" style="gap: 10px">
    <h2 :style="{ color: g.tone }">{{ g.title }} <span class="muted small">{{ g.items.length }}</span></h2>
    <p v-if="!g.items.length" class="muted small" style="margin: 0">Nothing here.</p>
    <div v-for="o in g.items" :key="o.id" class="act-row">
      <div class="stack" style="gap: 2px; min-width: 0">
        <NuxtLink :to="`/opportunities/${o.oppCode}`" style="font-weight: 600; text-decoration: none; color: var(--text)">{{ o.nextAction ?? '(no next action)' }}</NuxtLink>
        <span class="small muted">{{ o.oppCode }} · {{ o.name }} · {{ o.customer }} · {{ o.marketCode }}</span>
      </div>
      <span class="small" :style="{ color: o.dueDate && data && o.dueDate < data.today ? 'var(--danger)' : 'var(--text-2)', fontWeight: 600 }">{{ o.dueDate ?? 'no due date' }}</span>
      <HealthBadge :health="o.health" />
      <button v-if="o.canEdit" type="button" class="btn btn-outline-primary" @click="updating = o">Done → Update</button>
    </div>
  </section>
  <QuickUpdateDrawer v-if="updating && data" :opp="updating" :today="data.today" @close="updating = null" @saved="onSaved" />
</template>

<style scoped>
.act-row { display: grid; grid-template-columns: 1fr 110px 120px 130px; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--row-border); }
.act-row:last-child { border-bottom: 0; }
@media (max-width: 720px) { .act-row { grid-template-columns: 1fr auto; } }
</style>
