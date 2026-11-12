<script setup lang="ts">
import type { OppItem } from '#shared/types'
import { OPEN_STAGES, STAGE_LABEL } from '#shared/constants'

// S4 Quick Update (SRS 6.2): activity + next step + optional stage / win rate. Goal: ≤ 2 minutes per opp.
const props = defineProps<{ opp: OppItem, today: string }>()
const emit = defineEmits<{ close: [], saved: [] }>()
const { $api } = useNuxtApp()
const { data: meta } = await useMeta()
const me = useCurrentUser()

const form = reactive({
  type: 'Customer Meeting',
  activityDate: props.today,
  content: '',
  isCustomerFacing: true,
  nextAction: props.opp.nextAction ?? '',
  actionOwnerId: props.opp.actionOwnerId ?? props.opp.salesOwnerId ?? me.value?.id ?? null,
  dueDate: props.opp.dueDate ?? '',
  stage: props.opp.stage,
  winRate: props.opp.winRateOverride as number | null,
  winRateReason: props.opp.winRateReason ?? '',
})
watch(() => form.type, (t) => { form.isCustomerFacing = ['Customer Meeting', 'Demo', 'Seminar', 'Proposal Submission'].includes(t) })

const types = computed(() => meta.value?.lookups.activity_type ?? ['Customer Meeting', 'Email', 'Other'])
const people = computed(() => (meta.value?.users ?? []).filter(u => u.isActive || u.id === form.actionOwnerId))
const stageDefault = computed(() => meta.value?.defaultWinRate[form.stage] ?? 0)
const needsReason = computed(() => form.winRate !== null && form.winRate !== undefined && (form.winRate as unknown) !== '' && Number(form.winRate) !== stageDefault.value)
const missingNext = computed(() => !form.nextAction || !form.actionOwnerId || !form.dueDate)
const isClosed = computed(() => props.opp.status === 'Closed')
const error = ref('')
const busy = ref(false)

async function save() {
  error.value = ''
  if (!form.content.trim()) return (error.value = 'Content is required')
  if (needsReason.value && !form.winRateReason.trim()) return (error.value = 'Give a reason when the win rate differs from the stage default')
  busy.value = true
  try {
    const wr = form.winRate === null || (form.winRate as unknown) === '' ? null : Number(form.winRate)
    await $api(`/api/opportunities/${props.opp.oppCode}/activities`, {
      method: 'POST',
      body: {
        type: form.type,
        activityDate: form.activityDate,
        content: form.content,
        isCustomerFacing: form.isCustomerFacing,
        nextAction: form.nextAction || null,
        actionOwnerId: form.actionOwnerId || null,
        dueDate: form.dueDate || null,
        ...(form.stage !== props.opp.stage && !isClosed.value ? { stage: form.stage } : {}),
        ...(wr !== props.opp.winRateOverride ? { winRateOverride: wr, winRateReason: form.winRateReason || null } : {}),
      },
    })
    emit('saved')
  }
  catch (e) {
    error.value = errMsg(e)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <AppModal title="Quick Update" drawer width="520px" @close="emit('close')">
    <template #title>
      <div class="stack" style="gap: 4px">
        <span class="small" style="font-weight: 700; color: var(--muted)">QUICK UPDATE · {{ opp.oppCode }} · {{ opp.marketCode }}</span>
        <span style="font-size: 17px; font-weight: 700">{{ opp.name }}</span>
        <span class="small muted">{{ opp.customer }} · Stage {{ opp.stage }} · {{ opp.status }} · <HealthBadge :health="opp.health" /></span>
      </div>
    </template>

    <form id="qu-form" class="stack" style="gap: 18px" @submit.prevent="save">
      <div class="section-label">1 · New activity</div>
      <div class="form-grid">
        <label class="field">Type <span class="req" aria-hidden="true">*</span>
          <select v-model="form.type" class="select"><option v-for="t in types" :key="t">{{ t }}</option></select>
        </label>
        <label class="field">Date <span class="req" aria-hidden="true">*</span>
          <input v-model="form.activityDate" type="date" class="input" required>
        </label>
      </div>
      <p v-if="form.activityDate > today" class="small muted" style="margin: -8px 0 0">
        Future date = scheduled event: shows in Highlight, does not refresh "latest update".
      </p>
      <label class="field">Content <span class="req" aria-hidden="true">*</span>
        <textarea v-model="form.content" class="textarea" rows="4" required placeholder="e.g. Met the customer; they agreed to reduce the pilot scope to fit the budget" />
      </label>
      <label class="check"><input v-model="form.isCustomerFacing" type="checkbox"> Worked directly with the customer (updates Last Contact Date)</label>

      <div class="divider" />
      <div class="row" style="justify-content: space-between">
        <div class="section-label">2 · Next step</div>
        <span v-if="missingNext" class="small" style="color: var(--red-fg); font-weight: 600">Missing → warning W4</span>
      </div>
      <label class="field">Next action <span class="req" aria-hidden="true">*</span>
        <input v-model="form.nextAction" class="input" :class="{ missing: !form.nextAction }" placeholder="e.g. Resend the quotation for the pilot option">
      </label>
      <div class="form-grid">
        <label class="field">Action owner <span class="req" aria-hidden="true">*</span>
          <select v-model="form.actionOwnerId" class="select" :class="{ missing: !form.actionOwnerId }">
            <option :value="null">Choose a person</option>
            <option v-for="u in people" :key="u.id" :value="u.id">{{ u.account }}</option>
          </select>
        </label>
        <label class="field">Due date <span class="req" aria-hidden="true">*</span>
          <input v-model="form.dueDate" type="date" class="input" :class="{ missing: !form.dueDate }">
        </label>
      </div>

      <div class="divider" />
      <details :open="!isClosed">
        <summary class="section-label" style="cursor: pointer; min-height: 32px">3 · Stage &amp; win rate (optional)</summary>
        <p v-if="isClosed" class="small muted">This opportunity is closed. Reopen it from the detail page first.</p>
        <div v-else class="stack" style="margin-top: 12px; gap: 12px">
          <div class="form-grid">
            <label class="field">Stage
              <select v-model="form.stage" class="select">
                <option v-for="s in OPEN_STAGES" :key="s" :value="s">{{ STAGE_LABEL[s] }}</option>
              </select>
            </label>
            <label class="field">Win rate (%)
              <input v-model="form.winRate" type="number" min="0" max="100" class="input" :placeholder="`${stageDefault} (stage ${form.stage} default)`">
            </label>
          </div>
          <label class="field">Reason for win-rate change <span v-if="needsReason" class="req">*</span>
            <input v-model="form.winRateReason" class="input" :class="{ missing: needsReason && !form.winRateReason }" placeholder="Required when different from the default">
          </label>
        </div>
      </details>

      <div class="alert alert-info">
        On save: Latest Activity and Latest Update Date come from this activity; Next Action, Action Owner and
        Due Date are written to the opportunity; health and warnings are recalculated (SRS 5.9).
      </div>
      <p v-if="error" class="error-text" role="alert" style="margin: 0">{{ error }}</p>
    </form>

    <template #footer>
      <button type="button" class="btn" style="height: 44px" @click="emit('close')">Cancel</button>
      <button type="submit" form="qu-form" class="btn btn-primary" style="height: 44px" :disabled="busy">{{ busy ? 'Saving…' : 'Save update' }}</button>
    </template>
  </AppModal>
</template>
