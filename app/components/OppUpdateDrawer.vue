<script setup lang="ts">
import { ClipboardList, MessageSquarePlus, Save } from 'lucide-vue-next'
import type { OppItem } from '#shared/types'
import { OPEN_STAGES, STAGE_LABEL } from '#shared/constants'

/**
 * The one "Update" editor (Sales feedback: Quick Update and Edit were two confusing features).
 * Tab 1 logs an activity + next step + stage / win rate (SRS 5.9); tab 2 edits every other field.
 * One Save: changed fields go to PATCH, the activity (if written) to /activities.
 */
const props = withDefaults(defineProps<{ opp: OppItem, today: string, tab?: 'activity' | 'details' }>(), { tab: 'activity' })
const emit = defineEmits<{ close: [], saved: [] }>()
const { $api } = useNuxtApp()
const { data: meta } = await useMeta()
const me = useCurrentUser()
const o = props.opp
const tab = ref(props.tab)
const isClosed = o.status === 'Closed'
const canChangeOwner = computed(() => ['admin', 'market_lead'].includes(me.value?.role ?? ''))
const canChangeMarket = computed(() => me.value?.role === 'admin')
const canVerify = canChangeOwner

const act = reactive({ type: 'Customer Meeting', activityDate: props.today, content: '', isCustomerFacing: true })
watch(() => act.type, (t) => { act.isCustomerFacing = ['Customer Meeting', 'Demo', 'Seminar', 'Proposal Submission'].includes(t) })

const initial = {
  name: o.name, industry: o.industry ?? '', marketCode: o.marketCode, countryId: o.countryId,
  partnerId: o.partnerId, secondaryPartner: o.secondaryPartner ?? '', solution: o.solution ?? '', isLaida: o.isLaida,
  dealType: o.dealType ?? '', salesOwnerAccount: o.salesOwner ?? '', viOwner: o.viOwner ?? '', biddingLead: o.biddingLead ?? '', coordinatorId: o.coordinatorId,
  amount: o.amount, currency: o.currency, stage: o.stage, winRateOverride: o.winRateOverride as number | null | '',
  winRateReason: o.winRateReason ?? '', priority: o.priority ?? '', expectedCloseDate: o.expectedCloseDate,
  nextAction: o.nextAction ?? '', actionOwnerId: o.actionOwnerId, dueDate: o.dueDate ?? '',
  blockingIssue: o.blockingIssue ?? '', supportNeeded: o.supportNeeded ?? '', backgroundNote: o.backgroundNote ?? '',
  isFocusPinned: o.isFocusPinned, verified: !!o.verifiedAt,
}
const form = reactive({ ...initial })

const types = computed(() => meta.value?.lookups.activity_type ?? ['Customer Meeting', 'Email', 'Other'])
const people = computed(() => meta.value?.users ?? [])
const activePeople = computed(() => people.value.filter(u => u.isActive || u.id === form.actionOwnerId))
const accounts = computed(() => people.value.map(u => u.account))
const countries = computed(() => (meta.value?.countries ?? []).filter(c => c.marketCode === form.marketCode))
watch(() => form.marketCode, () => { if (!countries.value.some(c => c.id === form.countryId)) form.countryId = countries.value[0]?.id ?? null })
const stageDefault = computed(() => meta.value?.defaultWinRate[form.stage as keyof NonNullable<typeof meta.value>['defaultWinRate']] ?? 0)
const wrValue = computed(() => (form.winRateOverride === '' || form.winRateOverride === null ? null : Number(form.winRateOverride)))
const needsReason = computed(() => wrValue.value !== null && wrValue.value !== stageDefault.value)
const missingNext = computed(() => !form.nextAction || !form.actionOwnerId || !form.dueDate)

const error = ref('')
const busy = ref(false)

/** Only the fields that changed (so nothing is audited for untouched values). */
function changedFields(includeNextStep: boolean) {
  const out: Record<string, unknown> = {}
  const clean = (v: unknown) => (v === '' ? null : v)
  const keys = Object.keys(initial) as (keyof typeof initial)[]
  for (const k of keys) {
    if (!includeNextStep && ['nextAction', 'actionOwnerId', 'dueDate'].includes(k)) continue
    const a = clean(initial[k])
    const b = clean(form[k])
    if (k === 'salesOwnerAccount' ? String(a ?? '').toLowerCase() !== String(b ?? '').trim().toLowerCase() : a !== b) out[k] = b
  }
  if ('amount' in out) out.amount = Number(form.amount)
  if ('winRateOverride' in out || 'stage' in out) {
    out.winRateOverride = wrValue.value === stageDefault.value ? null : wrValue.value
    out.winRateReason = form.winRateReason || null
  }
  if ('salesOwnerAccount' in out) out.salesOwnerAccount = String(form.salesOwnerAccount).trim()
  if ('viOwner' in out) out.viOwner = String(form.viOwner ?? '').trim() || null
  if ('biddingLead' in out) out.biddingLead = String(form.biddingLead ?? '').trim() || null
  if (!canChangeMarket.value) delete out.marketCode
  if (!canChangeOwner.value) delete out.salesOwnerAccount
  if (!canVerify.value) delete out.verified
  if (isClosed) delete out.stage
  return out
}

async function save() {
  error.value = ''
  const hasActivity = !!act.content.trim()
  if (needsReason.value && !form.winRateReason.trim()) {
    tab.value = 'activity'
    return (error.value = 'Give a reason when the win rate differs from the stage default')
  }
  if (!form.name.trim() || !form.expectedCloseDate) {
    tab.value = 'details'
    return (error.value = 'Opportunity name and Expected close are required')
  }
  const patch = changedFields(!hasActivity)
  if (!hasActivity && !Object.keys(patch).length) return (error.value = 'Nothing changed. Write an activity or change a field.')
  busy.value = true
  try {
    if (Object.keys(patch).length) await $api(`/api/opportunities/${o.oppCode}`, { method: 'PATCH', body: patch })
    if ('viOwner' in patch || 'biddingLead' in patch) refreshNuxtData('meta') // new VI name -> suggestions
    if (hasActivity) {
      await $api(`/api/opportunities/${o.oppCode}/activities`, {
        method: 'POST',
        body: {
          ...act, content: act.content.trim(),
          nextAction: form.nextAction || null, actionOwnerId: form.actionOwnerId || null, dueDate: form.dueDate || null,
        },
      })
    }
    emit('saved')
  }
  catch (e) { error.value = errMsg(e) }
  finally { busy.value = false }
}
</script>

<template>
  <AppModal title="Update" drawer width="640px" @close="emit('close')">
    <template #title>
      <div class="stack" style="gap: 4px">
        <span class="small" style="font-weight: 700; color: var(--muted)">UPDATE · {{ o.oppCode }} · {{ o.marketCode }}</span>
        <span style="font-size: 17px; font-weight: 700">{{ o.name }}</span>
        <span class="small muted row" style="gap: 6px">{{ o.customer }} · Stage {{ o.stage }} · {{ o.status }} <HealthBadge :health="o.health" /></span>
      </div>
    </template>

    <div role="tablist" class="tabs">
      <button type="button" role="tab" class="tab" :aria-selected="tab === 'activity'" @click="tab = 'activity'">
        <MessageSquarePlus class="ico" aria-hidden="true" />Activity &amp; next step
      </button>
      <button type="button" role="tab" class="tab" :aria-selected="tab === 'details'" @click="tab = 'details'">
        <ClipboardList class="ico" aria-hidden="true" />All details
      </button>
    </div>

    <form id="upd-form" class="stack" style="gap: 16px" @submit.prevent="save">
      <!-- ============ Activity & next step -->
      <template v-if="tab === 'activity'">
        <div class="section-label">1 · New activity <span class="muted" style="text-transform: none; font-weight: 400">(optional: leave empty to only change fields)</span></div>
        <div class="form-grid">
          <label class="field">Type<select v-model="act.type" class="select"><option v-for="t in types" :key="t">{{ t }}</option></select></label>
          <label class="field">Date<input v-model="act.activityDate" type="date" class="input"></label>
          <label class="field full">Content
            <textarea v-model="act.content" class="textarea" rows="4" placeholder="e.g. Met the customer; they agreed to reduce the pilot scope to fit the budget" />
          </label>
        </div>
        <p v-if="act.activityDate > today" class="small muted" style="margin: -6px 0 0">Future date = scheduled event: does not refresh "latest update".</p>
        <label class="check"><input v-model="act.isCustomerFacing" type="checkbox"> Worked directly with the customer (updates Last Contact Date)</label>

        <div class="divider" />
        <div class="row" style="justify-content: space-between">
          <div class="section-label">2 · Next step</div>
          <span v-if="missingNext" class="small" style="color: var(--red-fg); font-weight: 600">Missing → warning W4</span>
        </div>
        <label class="field">Next action<input v-model="form.nextAction" class="input" :class="{ missing: !form.nextAction }" placeholder="e.g. Resend the quotation for the pilot option"></label>
        <div class="form-grid">
          <label class="field">Action owner
            <select v-model="form.actionOwnerId" class="select" :class="{ missing: !form.actionOwnerId }">
              <option :value="null">Choose a person</option>
              <option v-for="u in activePeople" :key="u.id" :value="u.id">{{ u.account }}</option>
            </select>
          </label>
          <label class="field">Due date<input v-model="form.dueDate" type="date" class="input" :class="{ missing: !form.dueDate }"></label>
        </div>

        <div class="divider" />
        <div class="section-label">3 · Stage &amp; win rate</div>
        <p v-if="isClosed" class="small muted" style="margin: 0">This opportunity is closed. Reopen it from the detail page first.</p>
        <div v-else class="form-grid">
          <label class="field">Stage
            <select v-model="form.stage" class="select"><option v-for="s in OPEN_STAGES" :key="s" :value="s">{{ STAGE_LABEL[s] }}</option></select>
          </label>
          <label class="field">Win rate (%) <span class="hint">Stage {{ form.stage }} default: {{ stageDefault }}%</span>
            <input v-model="form.winRateOverride" type="number" min="0" max="100" class="input" :placeholder="String(stageDefault)">
          </label>
          <label class="field full">Reason for the win rate <span v-if="needsReason" class="req">*</span>
            <input v-model="form.winRateReason" class="input" :class="{ missing: needsReason && !form.winRateReason }" placeholder="Required when different from the default">
          </label>
        </div>
      </template>

      <!-- ============ All details -->
      <template v-else>
        <div class="form-grid">
          <label class="field full">Opportunity name <span class="req">*</span><input v-model="form.name" class="input" required></label>
          <label class="field">Market
            <select v-model="form.marketCode" class="select" :disabled="!canChangeMarket" :title="canChangeMarket ? '' : 'Only Admin can change the market'">
              <option v-for="m in meta?.markets" :key="m.code" :value="m.code">{{ m.code }} · {{ m.name }}</option>
              <option v-if="!meta?.markets.some(m => m.code === form.marketCode)" :value="form.marketCode">{{ form.marketCode }}</option>
            </select>
          </label>
          <label class="field">Country
            <select v-model="form.countryId" class="select"><option v-for="c in countries" :key="c.id" :value="c.id">{{ c.name }}</option></select>
          </label>
          <label class="field">Partner
            <select v-model="form.partnerId" class="select"><option v-for="p in meta?.partners" :key="p.id" :value="p.id">{{ p.name }}</option></select>
          </label>
          <label class="field">Secondary partner<input v-model="form.secondaryPartner" class="input" placeholder="e.g. AWS"></label>
          <label class="field">Deal type
            <select v-model="form.dealType" class="select" :class="{ missing: !form.dealType }">
              <option value="">—</option><option v-for="d in meta?.lookups.deal_type" :key="d">{{ d }}</option>
            </select>
          </label>
          <label class="field">Priority
            <select v-model="form.priority" class="select"><option value="">—</option><option v-for="p in meta?.lookups.priority" :key="p">{{ p }}</option></select>
          </label>
          <label class="field">Amount <span class="hint">0 = not estimated yet</span><input v-model="form.amount" type="number" min="0" step="0.01" class="input" :class="{ missing: !Number(form.amount) }"></label>
          <label class="field">Currency
            <select v-model="form.currency" class="select"><option v-for="c in meta?.currencies" :key="c">{{ c }}</option></select>
          </label>
          <label class="field">Expected close <span class="req">*</span><input v-model="form.expectedCloseDate" type="date" class="input" required></label>
          <label class="field">Industry<input v-model="form.industry" class="input"></label>
          <label class="field">Sales owner (FPT account)
            <input
              v-model="form.salesOwnerAccount" class="input" list="acc-list" autocomplete="off" placeholder="e.g. SonTV16"
              :disabled="!canChangeOwner" :title="canChangeOwner ? 'Type the account of the sales person' : 'Only Market Lead / Admin can change the owner'"
            >
          </label>
          <label class="field">Solution<input v-model="form.solution" class="input"></label>
          <label class="field">VI owner
            <input v-model="form.viOwner" class="input" list="vi-list" autocomplete="off" maxlength="100" placeholder="Type a VI name or pick one" title="Type a new VI name, or pick one already used">
          </label>
          <label class="field">Bidding lead
            <input v-model="form.biddingLead" class="input" list="bl-list" autocomplete="off" maxlength="100" placeholder="Type a name or pick one" title="Type a new name, or pick one already used">
          </label>
          <label class="field">Coordinator
            <select v-model="form.coordinatorId" class="select"><option :value="null">—</option><option v-for="u in people" :key="u.id" :value="u.id">{{ u.account }}</option></select>
          </label>
          <label class="field full">Blocking issue<textarea v-model="form.blockingIssue" class="textarea" style="min-height: 60px" /></label>
          <label class="field full">Support needed<textarea v-model="form.supportNeeded" class="textarea" style="min-height: 60px" /></label>
          <label class="field full">Background note<textarea v-model="form.backgroundNote" class="textarea" style="min-height: 60px" /></label>
          <label class="check"><input v-model="form.isLaida" type="checkbox"> Uses LAIDA (AI-Powered Solution)</label>
          <label v-if="canVerify" class="check"><input v-model="form.verified" type="checkbox"> Data verified this week</label>
        </div>
        <datalist id="acc-list"><option v-for="a in accounts" :key="a" :value="a" /></datalist>
        <datalist id="vi-list"><option v-for="v in meta?.viOwners ?? []" :key="v" :value="v" /></datalist>
        <datalist id="bl-list"><option v-for="v in meta?.biddingLeads ?? []" :key="v" :value="v" /></datalist>
      </template>

      <div class="alert alert-info small">
        Saving an activity refreshes Latest Activity / Latest Update and the health. Editing fields only (no activity) does not count as an update (SRS 5.9).
      </div>
      <p v-if="error" class="error-text" role="alert" style="margin: 0">{{ error }}</p>
    </form>

    <template #footer>
      <button type="button" class="btn" style="height: 44px" @click="emit('close')">Cancel</button>
      <button type="submit" form="upd-form" class="btn btn-primary" style="height: 44px" :disabled="busy"><Save class="ico" aria-hidden="true" />{{ busy ? 'Saving…' : 'Save' }}</button>
    </template>
  </AppModal>
</template>
