<script setup lang="ts">
import type { OppDetailResponse } from '#shared/types'
import { WARNING_META } from '#shared/rules'
import { OPEN_STAGES, STAGE_SHORT, WARNING_LABEL } from '#shared/constants'
import { BriefcaseBusiness } from 'lucide-vue-next'
import type { TransitionAction } from '~/components/TransitionDialog.vue'

const route = useRoute()
const code = computed(() => String(route.params.code))
const { $api } = useNuxtApp()
const { data, error, refresh } = await useAsyncData(() => `opp-${code.value}`,
  () => $api<OppDetailResponse>(`/api/opportunities/${code.value}`))
useHead({ title: () => `${code.value} · LCG Opportunity` })

const opp = computed(() => data.value?.opp)
const perms = computed(() => data.value?.permissions)
const tab = ref<'overview' | 'activity' | 'history'>('overview')
const dialog = ref<null | 'update' | 'edit' | TransitionAction>(null)
async function done() {
  dialog.value = null
  await refresh()
}

const stepper = computed(() => {
  const o = opp.value
  if (!o) return []
  const order = [...OPEN_STAGES, o.stage === 'L' ? 'L' : 'W'] as const
  const cur = order.indexOf(o.stage as never)
  return order.map((s, i) => ({ s, label: STAGE_SHORT[s], state: i < cur ? 'past' : i === cur ? 'current' : 'future' }))
})
const daysToClose = computed(() => {
  if (!opp.value || !data.value) return null
  return Math.round((Date.parse(opp.value.expectedCloseDate) - Date.parse(data.value.today)) / 864e5)
})
const warningText: Record<string, (o: NonNullable<typeof opp.value>) => string> = {
  W1: o => (o.daysSinceUpdate === null ? 'no activity yet' : `${o.daysSinceUpdate} days without a new activity`),
  W2: () => 'on hold for more than 30 days',
  W3: o => `expected close ${o.expectedCloseDate} has passed`,
  W4: o => `missing ${[!o.latestActivity && 'Latest Activity', !o.nextAction && 'Next Action', !o.actionOwner && 'Action Owner', !o.dueDate && 'Due Date'].filter(Boolean).join(', ')}`,
  W5: o => `next action was due ${o.dueDate}`,
  W6: () => 'amount is 0 at stage C/B/A',
  W7: o => `in stage ${o.stage} since ${o.stageChangedAt}`,
}
const sourceLabel = (s: string) => (s === 'import' ? 'imported from Excel' : s === 'system' ? 'system' : '')
</script>

<template>
  <p v-if="error" class="error-text">{{ errMsg(error) }} · <NuxtLink to="/pipeline">Back to Pipeline</NuxtLink></p>
  <template v-else-if="opp && data && perms">
    <nav aria-label="Breadcrumb" class="small muted"><NuxtLink to="/pipeline" style="text-decoration: none">Pipeline</NuxtLink> / {{ opp.marketCode }} / {{ opp.oppCode }}</nav>

    <header class="page-head" style="align-items: flex-start">
      <div class="stack" style="gap: 8px; min-width: 0">
        <div class="row small">
          <span style="font-weight: 700; color: var(--muted)">{{ opp.oppCode }}</span>
          <span class="badge mkt-cell" style="display: inline-flex"><MarketFlag :code="opp.marketCode" :size="16" />{{ opp.marketCode }}</span>
          <span class="badge">{{ opp.partner }}</span>
          <span v-if="opp.status === 'On Hold'" class="badge" style="background: var(--amber-bg); color: var(--amber-fg)">On Hold · {{ opp.pendingReason }}</span>
          <span v-if="opp.stage === 'W'" class="badge h-Green">Won {{ opp.closedAt }}</span>
          <span v-if="opp.stage === 'L'" class="badge h-Red">Lost {{ opp.closedAt }} · {{ opp.lostReason }}</span>
          <span v-if="opp.isKeyDeal" class="badge" style="background: var(--primary-soft); color: var(--primary)">Key deal</span>
        </div>
        <PageTitle :icon="BriefcaseBusiness" :title="opp.name" />
        <span style="font-size: 15px; color: var(--text-2)">{{ opp.customer }} · Sales owner {{ opp.salesOwner }}</span>
      </div>
      <div class="row">
        <template v-if="opp.status !== 'Closed' && perms.canEdit">
          <button v-if="opp.status === 'On Hold'" type="button" class="btn" @click="dialog = 'resume'">Resume</button>
          <button v-else type="button" class="btn" @click="dialog = 'hold'">On hold</button>
          <button type="button" class="btn btn-danger" @click="dialog = 'lost'">Mark Lost</button>
          <button type="button" class="btn btn-success" @click="dialog = 'won'">Mark Won</button>
        </template>
        <button v-if="opp.status === 'Closed' && perms.canReopen" type="button" class="btn" @click="dialog = 'reopen'">Reopen</button>
        <button v-if="perms.canEdit" type="button" class="btn" @click="dialog = 'edit'">Edit</button>
        <button v-if="perms.canEdit" type="button" class="btn btn-primary" @click="dialog = 'update'">Quick Update</button>
      </div>
    </header>

    <div aria-label="Stage" class="stepper">
      <div v-for="st in stepper" :key="st.s" class="step" :class="[st.state, st.s === 'L' ? 'lost' : '']">{{ st.label }}</div>
    </div>

    <div v-if="opp.warnings.length" role="alert" class="alert alert-danger row" style="justify-content: space-between; gap: 12px">
      <div class="stack" style="gap: 4px">
        <b>{{ opp.warnings.length }} warning{{ opp.warnings.length > 1 ? 's' : '' }} to resolve</b>
        <span>
          <template v-for="(w, i) in opp.warnings" :key="w">
            <span v-if="i"> &nbsp;·&nbsp; </span><b>{{ w }} · {{ WARNING_META[w].severity }}</b> — {{ WARNING_LABEL[w] }}: {{ warningText[w]?.(opp) }}
          </template>
        </span>
      </div>
      <button v-if="perms.canEdit" type="button" class="link-btn" @click="dialog = 'update'">Update now →</button>
    </div>

    <section class="grid-kpi" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr))">
      <div class="card kpi"><span class="eyebrow">Amount</span><span class="kv" :title="amountTitle(opp)">{{ opp.amount ? fmtUsd(opp.amountUsd) : '—' }}</span><span class="small muted">USD · deal size {{ opp.dealSize }}</span></div>
      <div class="card kpi"><span class="eyebrow">Win rate</span><span class="kv">{{ opp.winRate }}%</span><span class="small muted">{{ opp.winRateOverride !== null ? `Override · ${opp.winRateReason ?? 'no reason given'}` : `Stage ${opp.stage} default` }}{{ opp.importNeedsConfirm.includes('win_rate') ? ' · PIC to confirm' : '' }}</span></div>
      <div class="card kpi"><span class="eyebrow">Weighted</span><span class="kv">{{ fmtUsd(opp.weightedUsd) }}</span><span class="small muted">Amount × win rate</span></div>
      <div class="card kpi"><span class="eyebrow">Expected close</span><span class="kv" :style="{ color: opp.warnings.includes('W3') ? 'var(--danger)' : undefined }">{{ opp.expectedCloseDate }}</span><span class="small muted">{{ daysToClose === null ? '' : daysToClose >= 0 ? `in ${daysToClose} days` : `${-daysToClose} days overdue` }}</span></div>
      <div class="card kpi"><span class="eyebrow">Health</span><span><HealthBadge :health="opp.health" /></span><span class="small muted">{{ opp.latestUpdateDate ? `last update ${opp.latestUpdateDate} · ${daysAgo(opp.daysSinceUpdate)}` : 'no activity yet' }}</span></div>
    </section>

    <div role="tablist" class="tabs">
      <button type="button" role="tab" class="tab" :aria-selected="tab === 'overview'" @click="tab = 'overview'">Overview</button>
      <button type="button" role="tab" class="tab" :aria-selected="tab === 'activity'" @click="tab = 'activity'">Activity<span class="count">{{ data.activities.length }}</span></button>
      <button type="button" role="tab" class="tab" :aria-selected="tab === 'history'" @click="tab = 'history'">History<span class="count">{{ data.history.length }}</span></button>
    </div>

    <section v-if="tab !== 'history'" class="row" style="align-items: flex-start; gap: 16px">
      <div class="card stack" style="flex: 3 1 480px; min-width: 0">
        <div class="row" style="justify-content: space-between">
          <h2>Activity timeline</h2>
          <button v-if="perms.canEdit" type="button" class="link-btn" @click="dialog = 'update'">+ Log activity</button>
        </div>
        <div class="next-box">
          <div class="stack" style="gap: 4px"><span class="small muted">Next action</span><span v-if="opp.nextAction">{{ opp.nextAction }}</span><span v-else class="missing-chip">Not filled</span></div>
          <div class="stack" style="gap: 4px"><span class="small muted">Action owner · Due date</span>
            <span v-if="opp.actionOwner || opp.dueDate" :style="{ color: opp.warnings.includes('W5') ? 'var(--danger)' : undefined }">{{ opp.actionOwner ?? '—' }} · {{ opp.dueDate ?? '—' }}</span>
            <span v-else class="missing-chip">Not filled</span>
          </div>
        </div>
        <div v-if="data.highlights.length" class="row small">
          <span class="muted">Highlight:</span><span v-for="(h, i) in data.highlights" :key="i" class="badge">{{ h.date.slice(5) }} · {{ h.reason }}</span>
        </div>
        <ol class="timeline">
          <li v-for="a in (tab === 'overview' ? data.activities.slice(0, 8) : data.activities)" :key="a.id">
            <span class="t-date" :class="{ future: a.activityDate > data.today }">{{ a.activityDate }}</span>
            <span class="t-line"><span class="t-dot" :class="{ sys: a.source === 'system', future: a.activityDate > data.today }" /><span class="t-bar" /></span>
            <div class="stack" style="gap: 4px">
              <span class="small" style="font-weight: 600; color: var(--muted)">
                {{ a.type }}{{ a.isCustomerFacing ? ' · with customer' : '' }}{{ sourceLabel(a.source) ? ` · ${sourceLabel(a.source)}` : '' }}{{ a.createdBy ? ` · ${a.createdBy}` : '' }}{{ a.activityDate > data.today ? ' · scheduled' : '' }}
              </span>
              <span style="white-space: pre-wrap">{{ a.content }}</span>
              <span v-if="a.nextAction" class="small muted">→ {{ a.nextAction }}{{ a.actionOwner ? ` · ${a.actionOwner}` : '' }}{{ a.dueDate ? ` · due ${a.dueDate}` : '' }}</span>
            </div>
          </li>
          <li>
            <span class="t-date">{{ opp.createdAt.slice(0, 10) }}</span>
            <span class="t-line"><span class="t-dot sys" /></span>
            <div class="stack" style="gap: 4px"><span class="small" style="font-weight: 600; color: var(--muted)">System</span><span>Opportunity created{{ opp.createdBy ? ` by ${opp.createdBy}` : '' }}</span></div>
          </li>
        </ol>
        <button v-if="tab === 'overview' && data.activities.length > 8" type="button" class="link-btn" @click="tab = 'activity'">Show all {{ data.activities.length }} activities</button>
      </div>

      <div class="card" style="flex: 2 1 340px; min-width: 0; display: flex; flex-direction: column">
        <h2 style="margin-bottom: 8px">Details</h2>
        <div class="kv-row"><span>Customer</span><span>{{ opp.customer }}</span></div>
        <div class="kv-row"><span>Industry</span><span>{{ opp.industry ?? '—' }}</span></div>
        <div class="kv-row"><span>Market · Country</span><span>{{ opp.marketCode }} · {{ opp.country ?? '—' }}</span></div>
        <div class="kv-row"><span>Partner · Solution</span><span>{{ opp.partner }}{{ opp.secondaryPartner ? ` + ${opp.secondaryPartner}` : '' }} · {{ opp.solution ?? '—' }}</span></div>
        <div class="kv-row"><span>Deal type</span><span><span v-if="opp.dealType">{{ opp.dealType }}</span><span v-else class="missing-chip">Not filled</span></span></div>
        <div class="kv-row"><span>Priority</span><span><span v-if="opp.priority">{{ opp.priority }}</span><span v-else class="missing-chip">Not filled</span></span></div>
        <div class="kv-row"><span>Amount (original)</span><span>{{ fmtFull(opp.amount, opp.currency) }}</span></div>
        <div class="kv-row"><span>VI owner</span><span>{{ opp.viOwner ?? '—' }}</span></div>
        <div class="kv-row"><span>Coordinator</span><span>{{ opp.coordinator ?? '—' }}</span></div>
        <div class="kv-row"><span>LAIDA</span><span>{{ opp.isLaida ? 'Yes' : 'No' }}</span></div>
        <div v-if="opp.pendingReason" class="kv-row"><span>Pending reason</span><span>{{ opp.pendingReason }}</span></div>
        <div v-if="opp.blockingIssue" class="kv-row"><span>Blocking issue</span><span>{{ opp.blockingIssue }}</span></div>
        <div v-if="opp.supportNeeded" class="kv-row"><span>Support needed</span><span>{{ opp.supportNeeded }}</span></div>
        <div class="kv-row"><span>Background note</span><span style="white-space: pre-wrap">{{ opp.backgroundNote ?? '—' }}</span></div>
        <div class="kv-row"><span>Last customer contact</span><span>{{ opp.lastContactDate ?? '—' }}</span></div>
        <div class="kv-row"><span>Created</span><span>{{ opp.createdAt.slice(0, 10) }}{{ opp.createdBy ? ` · ${opp.createdBy}` : '' }}</span></div>
        <div class="kv-row"><span>Verified</span><span>{{ opp.verifiedAt ? fmtDateTime(opp.verifiedAt) : 'Not yet · Market Lead' }}</span></div>
        <div v-if="opp.importNeedsConfirm.length" class="kv-row"><span>Import: PIC to confirm</span><span>{{ opp.importNeedsConfirm.join(', ') }}</span></div>
      </div>
    </section>

    <section v-else class="table-wrap">
      <table class="data">
        <thead><tr><th>When</th><th>Who</th><th>Field</th><th>From</th><th>To</th><th>Reason</th></tr></thead>
        <tbody>
          <tr v-for="h in data.history" :key="`${h.kind}-${h.id}`">
            <td style="white-space: nowrap">{{ fmtDateTime(h.changedAt) }}</td>
            <td>{{ h.changedBy ?? '—' }}</td>
            <td>{{ h.field }}</td>
            <td class="muted" style="max-width: 260px">{{ h.from ?? '—' }}</td>
            <td style="max-width: 260px">{{ h.to ?? '—' }}</td>
            <td>{{ h.reason ?? '' }}</td>
          </tr>
          <tr v-if="!data.history.length"><td colspan="6" class="muted">No changes recorded yet. Every change made in the app is logged here.</td></tr>
        </tbody>
      </table>
    </section>

    <QuickUpdateDrawer v-if="dialog === 'update'" :opp="opp" :today="data.today" @close="dialog = null" @saved="done" />
    <OppEditModal v-else-if="dialog === 'edit'" :opp="opp" :can-change-market="perms.canChangeMarket" @close="dialog = null" @saved="done" />
    <TransitionDialog v-else-if="dialog" :opp="opp" :action="dialog" :today="data.today" @close="dialog = null" @saved="done" />
  </template>
</template>

<style scoped>
.stepper { display: flex; gap: 2px; flex-wrap: wrap; }
.step { flex: 1 1 0; min-width: 90px; padding: 8px 10px; font-size: 12px; font-weight: 600; text-align: center; clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%); background: var(--chip); color: var(--muted); }
.step.past { background: var(--primary-tint); color: var(--primary-hover); }
.step.current { background: var(--primary); color: var(--on-primary); }
.step.current.lost { background: var(--danger); }
.kpi { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; }
.kv { font-size: 22px; font-weight: 700; }
.next-box { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; background: var(--surface-2); border-radius: 10px; padding: 14px; font-size: 14px; }
.timeline { list-style: none; margin: 0; padding: 0; }
.timeline li { display: grid; grid-template-columns: 96px 16px 1fr; gap: 12px; padding-bottom: 18px; font-size: 14px; }
.t-date { font-size: 12px; color: var(--muted); text-align: right; padding-top: 2px; }
.t-date.future { color: var(--primary); font-weight: 600; }
.t-line { display: flex; flex-direction: column; align-items: center; }
.t-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--primary); margin-top: 4px; flex: none; }
.t-dot.sys { background: var(--faint); }
.t-dot.future { background: var(--surface); border: 2px solid var(--primary); }
.t-bar { flex: 1; width: 2px; background: var(--border); }
.kv-row { display: grid; grid-template-columns: 150px 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--row-border); font-size: 13px; }
.kv-row > span:first-child { color: var(--muted); }
.kv-row:last-child { border-bottom: 0; }
</style>
