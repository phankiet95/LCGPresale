<script setup lang="ts">
import { OPEN_STAGES, STAGE_LABEL } from '#shared/constants'

useHead({ title: 'New opportunity · LCG Opportunity' })
const { $api } = useNuxtApp()
const { data: meta } = await useMeta()
const me = useCurrentUser()
const route = useRoute()

const canCreate = computed(() => ['admin', 'market_lead', 'sales'].includes(me.value?.role ?? ''))
const creatableMarkets = computed(() => (canCreate.value ? meta.value?.markets ?? [] : []))
const form = reactive({
  name: '',
  customerQuery: '',
  customerId: null as number | null,
  industry: '',
  marketCode: (typeof route.query.market === 'string' ? route.query.market.split(',')[0] : '') || '',
  countryId: null as number | null,
  partnerId: null as number | null,
  secondaryPartner: '',
  solution: '',
  isLaida: false,
  dealType: '',
  salesOwnerId: me.value?.id ?? null,
  viOwnerId: null as number | null,
  amount: 0,
  currency: 'USD',
  stage: 'O' as typeof OPEN_STAGES[number],
  winRateOverride: '' as number | '',
  winRateReason: '',
  priority: '',
  expectedCloseDate: '',
  nextAction: '',
  actionOwnerId: me.value?.id ?? null,
  dueDate: '',
  backgroundNote: '',
})
watchEffect(() => {
  if (!form.marketCode && creatableMarkets.value.length === 1) form.marketCode = creatableMarkets.value[0]!.code
})
const countries = computed(() => (meta.value?.countries ?? []).filter(c => c.marketCode === form.marketCode))
watch(() => form.marketCode, () => { form.countryId = countries.value.length === 1 ? countries.value[0]!.id : null })
const people = computed(() => (meta.value?.users ?? []).filter(u => u.isActive))
const stageDefault = computed(() => meta.value?.defaultWinRate[form.stage] ?? 0)

// Customer: search the master; if nothing is picked the typed name is quick-created (matched by normalised name)
const { data: customers } = await useAsyncData('customers-search',
  () => $api<{ id: number, name: string, industry: string | null }[]>('/api/customers', { query: { q: form.customerQuery } }),
  { watch: [() => form.customerQuery] })
watch(() => form.customerQuery, (q) => {
  const hit = customers.value?.find(c => c.name === q)
  form.customerId = hit?.id ?? null
  if (hit?.industry && !form.industry) form.industry = hit.industry
})

// Duplicate warning (SRS 5.11) — checked live, and again by the server on save
type Dup = { id: number, oppCode: string, name: string, stage: string, similarity: number }
const duplicates = ref<Dup[]>([])
let dupTimer: ReturnType<typeof setTimeout> | undefined
async function checkDuplicates() {
  if (!form.name || !form.partnerId || (!form.customerId && !form.customerQuery)) return (duplicates.value = [])
  const r = await $api<{ duplicates: Dup[] }>('/api/opportunities/duplicates', {
    method: 'POST',
    body: { name: form.name, partnerId: form.partnerId, customerId: form.customerId, newCustomerName: form.customerId ? null : form.customerQuery },
  }).catch(() => ({ duplicates: [] }))
  duplicates.value = r.duplicates
}
watch(() => [form.name, form.partnerId, form.customerId, form.customerQuery], () => {
  clearTimeout(dupTimer)
  dupTimer = setTimeout(checkDuplicates, 400)
})

const error = ref('')
const busy = ref(false)
async function save(confirmDuplicate = false) {
  error.value = ''
  busy.value = true
  try {
    const wr = form.winRateOverride === '' ? null : Number(form.winRateOverride)
    const created = await $api<{ oppCode: string }>('/api/opportunities', {
      method: 'POST',
      body: {
        name: form.name,
        customerId: form.customerId,
        newCustomerName: form.customerId ? null : form.customerQuery,
        industry: form.industry || null,
        marketCode: form.marketCode,
        countryId: form.countryId,
        partnerId: form.partnerId,
        secondaryPartner: form.secondaryPartner || null,
        solution: form.solution || null,
        isLaida: form.isLaida,
        dealType: form.dealType,
        salesOwnerId: form.salesOwnerId,
        viOwnerId: form.viOwnerId,
        amount: Number(form.amount) || 0,
        currency: form.currency,
        stage: form.stage,
        winRateOverride: wr === stageDefault.value ? null : wr,
        winRateReason: form.winRateReason || null,
        priority: form.priority || null,
        expectedCloseDate: form.expectedCloseDate,
        nextAction: form.nextAction || null,
        actionOwnerId: form.actionOwnerId,
        dueDate: form.dueDate || null,
        backgroundNote: form.backgroundNote || null,
        confirmDuplicate,
      },
    })
    await navigateTo(`/opportunities/${created.oppCode}`)
  }
  catch (e) {
    const data = (e as { data?: { statusMessage?: string, data?: { duplicates?: Dup[] } } }).data
    if (data?.statusMessage === 'POSSIBLE_DUPLICATE') {
      duplicates.value = data.data?.duplicates ?? []
      error.value = 'This may duplicate an open opportunity. Check below, then save anyway if it is a different deal.'
    }
    else error.value = errMsg(e)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <nav class="small muted"><NuxtLink to="/pipeline" style="text-decoration: none">Pipeline</NuxtLink> / New</nav>
      <h1>New opportunity</h1>
      <div class="sub">The code (OPP-YYYY-NNN) is assigned on save. Yellow fields feed warnings when empty.</div>
    </div>
  </div>

  <div v-if="!creatableMarkets.length" class="alert alert-warn">Your role cannot create opportunities (Management / Viewer are read-only).</div>

  <form v-else class="card stack" style="max-width: 920px" @submit.prevent="save(false)">
    <div class="section-label">Opportunity</div>
    <div class="form-grid">
      <label class="field full">Opportunity name <span class="req">*</span>
        <input v-model="form.name" class="input" required maxlength="200" placeholder="e.g. OutSystems Migration Assessment">
      </label>
      <label class="field">Customer <span class="req">*</span>
        <input v-model="form.customerQuery" class="input" list="customer-list" required placeholder="Search or type a new customer">
        <datalist id="customer-list"><option v-for="c in customers" :key="c.id" :value="c.name" /></datalist>
        <span class="hint">{{ form.customerId ? 'Existing customer' : form.customerQuery ? 'New customer — created on save (matched by normalised name)' : '' }}</span>
      </label>
      <label class="field">Industry<input v-model="form.industry" class="input" placeholder="Defaults from the customer"></label>
      <label class="field">Market <span class="req">*</span>
        <select v-model="form.marketCode" class="select" required>
          <option value="" disabled>Choose market</option>
          <option v-for="m in creatableMarkets" :key="m.code" :value="m.code">{{ m.code }} · {{ m.name }}</option>
        </select>
      </label>
      <label class="field">Country <span class="req">*</span>
        <select v-model="form.countryId" class="select" required :disabled="!form.marketCode">
          <option :value="null" disabled>Choose country</option>
          <option v-for="c in countries" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label class="field">Partner <span class="req">*</span>
        <select v-model="form.partnerId" class="select" required>
          <option :value="null" disabled>Choose partner</option>
          <option v-for="p in meta?.partners" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <label class="field">Secondary partner<input v-model="form.secondaryPartner" class="input" placeholder="e.g. AWS (free text)"></label>
      <label class="field">Deal type <span class="req">*</span>
        <select v-model="form.dealType" class="select" required>
          <option value="" disabled>Choose deal type</option>
          <option v-for="d in meta?.lookups.deal_type" :key="d">{{ d }}</option>
        </select>
      </label>
      <label class="field">Solution<input v-model="form.solution" class="input"></label>
    </div>

    <div v-if="duplicates.length" class="alert alert-warn stack" style="gap: 6px">
      <b>Possible duplicate — same customer + partner and a similar name:</b>
      <span v-for="d in duplicates" :key="d.id">
        <NuxtLink :to="`/opportunities/${d.oppCode}`" target="_blank">{{ d.oppCode }}</NuxtLink> · {{ d.name }} · stage {{ d.stage }} · similarity {{ Math.round(d.similarity * 100) }}%
      </span>
    </div>

    <div class="divider" />
    <div class="section-label">Value &amp; stage</div>
    <div class="form-grid">
      <label class="field">Amount <span class="hint">0 = not estimated yet (W6 from stage C)</span>
        <input v-model="form.amount" type="number" min="0" step="0.01" class="input" :class="{ missing: !Number(form.amount) }">
      </label>
      <label class="field">Currency
        <select v-model="form.currency" class="select"><option v-for="c in meta?.currencies" :key="c">{{ c }}</option></select>
      </label>
      <label class="field">Stage
        <select v-model="form.stage" class="select"><option v-for="s in OPEN_STAGES" :key="s" :value="s">{{ STAGE_LABEL[s] }}</option></select>
      </label>
      <label class="field">Expected close <span class="req">*</span><input v-model="form.expectedCloseDate" type="date" class="input" required></label>
      <label class="field">Win rate override (%) <span class="hint">Default for stage {{ form.stage }}: {{ stageDefault }}%</span>
        <input v-model="form.winRateOverride" type="number" min="0" max="100" class="input" :placeholder="String(stageDefault)">
      </label>
      <label class="field">Win-rate reason<input v-model="form.winRateReason" class="input" placeholder="Required if different from default"></label>
      <label class="field">Priority
        <select v-model="form.priority" class="select"><option value="">—</option><option v-for="p in meta?.lookups.priority" :key="p">{{ p }}</option></select>
      </label>
      <label class="check" style="align-self: end"><input v-model="form.isLaida" type="checkbox"> Uses LAIDA (AI-Powered Solution)</label>
    </div>

    <div class="divider" />
    <div class="section-label">People &amp; next step</div>
    <div class="form-grid">
      <label class="field">Sales owner <span class="req">*</span>
        <select v-model="form.salesOwnerId" class="select" required><option v-for="u in people" :key="u.id" :value="u.id">{{ u.account }}</option></select>
      </label>
      <label class="field">VI owner
        <select v-model="form.viOwnerId" class="select"><option :value="null">—</option><option v-for="u in people" :key="u.id" :value="u.id">{{ u.account }}</option></select>
      </label>
      <label class="field full">Next action<input v-model="form.nextAction" class="input" :class="{ missing: !form.nextAction }"></label>
      <label class="field">Action owner
        <select v-model="form.actionOwnerId" class="select" :class="{ missing: !form.actionOwnerId }"><option :value="null">—</option><option v-for="u in people" :key="u.id" :value="u.id">{{ u.account }}</option></select>
      </label>
      <label class="field">Due date<input v-model="form.dueDate" type="date" class="input" :class="{ missing: !form.dueDate }"></label>
      <label class="field full">Background note<textarea v-model="form.backgroundNote" class="textarea" /></label>
    </div>

    <p v-if="error" class="error-text" role="alert" style="margin: 0">{{ error }}</p>
    <div class="row" style="justify-content: flex-end">
      <NuxtLink to="/pipeline" class="btn">Cancel</NuxtLink>
      <button v-if="duplicates.length" type="button" class="btn" :disabled="busy" @click="save(true)">Save anyway</button>
      <button type="submit" class="btn btn-primary" :disabled="busy">{{ busy ? 'Saving…' : 'Create opportunity' }}</button>
    </div>
  </form>
</template>
