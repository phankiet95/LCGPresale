<script setup lang="ts">
import type { OppItem } from '#shared/types'
import { OPEN_STAGES, STAGE_LABEL } from '#shared/constants'

export type TransitionAction = 'won' | 'lost' | 'hold' | 'resume' | 'reopen'
// SRS 5.8: every closing / holding action asks for its mandatory reason before saving.
const props = defineProps<{ opp: OppItem, action: TransitionAction, today: string }>()
const emit = defineEmits<{ close: [], saved: [] }>()
const { $api } = useNuxtApp()

const TITLES: Record<TransitionAction, string> = {
  won: 'Mark as Won', lost: 'Mark as Lost', hold: 'Put on hold', resume: 'Resume', reopen: 'Reopen opportunity',
}
const form = reactive({
  closedAt: props.today,
  amount: props.opp.amount || null as number | null,
  lostReason: '',
  pendingReason: '',
  stage: 'O' as typeof OPEN_STAGES[number],
  reason: '',
})
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  const body
    = props.action === 'won' ? { action: 'won', closedAt: form.closedAt, amount: Number(form.amount) }
      : props.action === 'lost' ? { action: 'lost', closedAt: form.closedAt, lostReason: form.lostReason }
        : props.action === 'hold' ? { action: 'hold', pendingReason: form.pendingReason }
          : props.action === 'resume' ? { action: 'resume' }
            : { action: 'reopen', stage: form.stage, reason: form.reason }
  busy.value = true
  try {
    await $api(`/api/opportunities/${props.opp.oppCode}/transition`, { method: 'POST', body })
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
  <AppModal :title="`${TITLES[action]} · ${opp.oppCode}`" width="480px" @close="emit('close')">
    <form id="tr-form" class="stack" @submit.prevent="submit">
      <p class="muted" style="margin: 0">{{ opp.name }} — {{ opp.customer }}</p>

      <template v-if="action === 'won'">
        <label class="field">Close date <span class="req">*</span><input v-model="form.closedAt" type="date" class="input" required></label>
        <label class="field">Final contract value ({{ opp.currency }}) <span class="req">*</span>
          <input v-model="form.amount" type="number" min="0.01" step="0.01" class="input" required>
        </label>
      </template>

      <template v-else-if="action === 'lost'">
        <label class="field">Close date <span class="req">*</span><input v-model="form.closedAt" type="date" class="input" required></label>
        <label class="field">Lost / dropped reason <span class="req">*</span>
          <textarea v-model="form.lostReason" class="textarea" required placeholder="e.g. Customer chose a competitor on price" />
        </label>
      </template>

      <template v-else-if="action === 'hold'">
        <label class="field">On hold reason <span class="req">*</span>
          <textarea v-model="form.pendingReason" class="textarea" required placeholder="e.g. Over the customer's budget, decision moved to next FY" />
        </label>
        <p class="small muted" style="margin: 0">Stage stays {{ opp.stage }}. Warning W2 appears after 30 days on hold.</p>
      </template>

      <template v-else-if="action === 'resume'">
        <p style="margin: 0">Set the status back to <b>Active</b>? Stage stays {{ opp.stage }}.</p>
      </template>

      <template v-else>
        <label class="field">Reopen at stage <span class="req">*</span>
          <select v-model="form.stage" class="select"><option v-for="s in OPEN_STAGES" :key="s" :value="s">{{ STAGE_LABEL[s] }}</option></select>
        </label>
        <label class="field">Reason <span class="req">*</span><textarea v-model="form.reason" class="textarea" required /></label>
      </template>

      <p v-if="error" class="error-text" role="alert" style="margin: 0">{{ error }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn" @click="emit('close')">Cancel</button>
      <button
        type="submit" form="tr-form" class="btn"
        :class="action === 'won' ? 'btn-success' : action === 'lost' ? 'btn-danger' : 'btn-primary'"
        :disabled="busy"
      >{{ busy ? 'Saving…' : TITLES[action] }}</button>
    </template>
  </AppModal>
</template>
