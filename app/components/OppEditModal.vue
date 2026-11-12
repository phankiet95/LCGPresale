<script setup lang="ts">
import type { OppItem } from '#shared/types'

// Field edits (not an "update" for health — SRS 5.9). Market change is Admin-only (5.8).
const props = defineProps<{ opp: OppItem, canChangeMarket: boolean }>()
const emit = defineEmits<{ close: [], saved: [] }>()
const { $api } = useNuxtApp()
const { data: meta } = await useMeta()
const me = useCurrentUser()
const canChangeOwner = computed(() => ['admin', 'market_lead'].includes(me.value?.role ?? ''))
const canVerify = canChangeOwner

const o = props.opp
const form = reactive({
  name: o.name, industry: o.industry ?? '', marketCode: o.marketCode, countryId: o.countryId,
  partnerId: o.partnerId, secondaryPartner: o.secondaryPartner ?? '', solution: o.solution ?? '', isLaida: o.isLaida,
  dealType: o.dealType ?? '', salesOwnerId: o.salesOwnerId, viOwnerId: o.viOwnerId, coordinatorId: o.coordinatorId,
  amount: o.amount, currency: o.currency, winRateOverride: o.winRateOverride as number | null | '',
  winRateReason: o.winRateReason ?? '', priority: o.priority ?? '', expectedCloseDate: o.expectedCloseDate,
  blockingIssue: o.blockingIssue ?? '', supportNeeded: o.supportNeeded ?? '', backgroundNote: o.backgroundNote ?? '',
  isFocusPinned: o.isFocusPinned, verified: !!o.verifiedAt,
})
const countries = computed(() => (meta.value?.countries ?? []).filter(c => c.marketCode === form.marketCode))
watch(() => form.marketCode, () => { if (!countries.value.some(c => c.id === form.countryId)) form.countryId = countries.value[0]?.id ?? null })
const people = computed(() => meta.value?.users ?? [])
const stageDefault = computed(() => meta.value?.defaultWinRate[o.stage] ?? 0)
const error = ref('')
const busy = ref(false)

async function save() {
  error.value = ''
  busy.value = true
  try {
    const wr = form.winRateOverride === '' || form.winRateOverride === null ? null : Number(form.winRateOverride)
    const body: Record<string, unknown> = {
      name: form.name, industry: form.industry || null, countryId: form.countryId, partnerId: form.partnerId,
      secondaryPartner: form.secondaryPartner || null, solution: form.solution || null, isLaida: form.isLaida,
      dealType: form.dealType || null, viOwnerId: form.viOwnerId || null, coordinatorId: form.coordinatorId || null,
      amount: Number(form.amount), currency: form.currency,
      winRateOverride: wr === stageDefault.value ? null : wr, winRateReason: form.winRateReason || null,
      priority: form.priority || null, expectedCloseDate: form.expectedCloseDate,
      blockingIssue: form.blockingIssue || null, supportNeeded: form.supportNeeded || null,
      backgroundNote: form.backgroundNote || null, isFocusPinned: form.isFocusPinned,
    }
    if (props.canChangeMarket) body.marketCode = form.marketCode
    if (canChangeOwner.value) body.salesOwnerId = form.salesOwnerId
    if (canVerify.value && form.verified !== !!o.verifiedAt) body.verified = form.verified
    await $api(`/api/opportunities/${o.oppCode}`, { method: 'PATCH', body })
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
  <AppModal :title="`Edit ${o.oppCode}`" width="720px" @close="emit('close')">
    <form id="edit-form" class="form-grid" @submit.prevent="save">
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
      <label class="field">Amount<input v-model="form.amount" type="number" min="0" step="0.01" class="input"></label>
      <label class="field">Currency
        <select v-model="form.currency" class="select"><option v-for="c in meta?.currencies" :key="c">{{ c }}</option></select>
      </label>
      <label class="field">Win rate override (%) <span class="hint">Stage {{ o.stage }} default: {{ stageDefault }}%</span>
        <input v-model="form.winRateOverride" type="number" min="0" max="100" class="input" :placeholder="String(stageDefault)">
      </label>
      <label class="field">Win-rate reason<input v-model="form.winRateReason" class="input"></label>
      <label class="field">Expected close <span class="req">*</span><input v-model="form.expectedCloseDate" type="date" class="input" required></label>
      <label class="field">Industry<input v-model="form.industry" class="input"></label>
      <label class="field">Sales owner
        <select v-model="form.salesOwnerId" class="select" :disabled="!canChangeOwner" :title="canChangeOwner ? '' : 'Only Market Lead / Admin can change the owner'">
          <option v-for="u in people" :key="u.id" :value="u.id">{{ u.account }}</option>
        </select>
      </label>
      <label class="field">VI owner
        <select v-model="form.viOwnerId" class="select"><option :value="null">—</option><option v-for="u in people" :key="u.id" :value="u.id">{{ u.account }}</option></select>
      </label>
      <label class="field">Coordinator
        <select v-model="form.coordinatorId" class="select"><option :value="null">—</option><option v-for="u in people" :key="u.id" :value="u.id">{{ u.account }}</option></select>
      </label>
      <label class="field">Solution<input v-model="form.solution" class="input"></label>
      <label class="field full">Blocking issue<textarea v-model="form.blockingIssue" class="textarea" style="min-height: 60px" /></label>
      <label class="field full">Support needed<textarea v-model="form.supportNeeded" class="textarea" style="min-height: 60px" /></label>
      <label class="field full">Background note<textarea v-model="form.backgroundNote" class="textarea" style="min-height: 60px" /></label>
      <label class="check"><input v-model="form.isLaida" type="checkbox"> Uses LAIDA (AI-Powered Solution)</label>
      <label class="check"><input v-model="form.isFocusPinned" type="checkbox"> Pin to this week's Highlight</label>
      <label v-if="canVerify" class="check"><input v-model="form.verified" type="checkbox"> Data verified this week</label>
    </form>
    <p v-if="error" class="error-text" role="alert" style="margin: 0">{{ error }}</p>
    <template #footer>
      <button type="button" class="btn" @click="emit('close')">Cancel</button>
      <button type="submit" form="edit-form" class="btn btn-primary" :disabled="busy">{{ busy ? 'Saving…' : 'Save changes' }}</button>
    </template>
  </AppModal>
</template>
