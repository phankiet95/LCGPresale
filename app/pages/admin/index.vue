<script setup lang="ts">
import type { AdminUser } from '#shared/types'
import type { Role } from '#shared/rules'
import { ALL_MARKET_ROLES, MARKET_CODES, ROLE_HELP, ROLE_LABEL } from '#shared/constants'
import { KeyRound, ShieldCheck, UserPen, UserPlus, UserSearch } from 'lucide-vue-next'

useHead({ title: 'Admin · Users & roles' })
const { $api } = useNuxtApp()
const me = useCurrentUser()
const { data: users, error, refresh } = await useAsyncData('admin-users', () => $api<AdminUser[]>('/api/admin/users'))
const ROLES = Object.keys(ROLE_LABEL) as Role[]

// ---------- list filters
const q = ref('')
const roleFilter = ref<'' | Role>('')
const statusFilter = ref<'' | 'active' | 'inactive' | 'pending'>('')
const rows = computed(() => (users.value ?? []).filter((u) => {
  const s = q.value.toLowerCase()
  if (s && !`${u.account} ${u.displayName} ${u.email ?? ''}`.toLowerCase().includes(s)) return false
  if (roleFilter.value && u.role !== roleFilter.value) return false
  if (statusFilter.value === 'active' && !u.isActive) return false
  if (statusFilter.value === 'inactive' && u.isActive) return false
  if (statusFilter.value === 'pending' && !(u.isActive && u.mustChangePassword)) return false
  return true
}))
const ROLE_RANK: Record<Role, number> = { admin: 0, management: 1, market_lead: 2, sales: 3, viewer: 4 }
const userSort = useTableSort(rows, {
  key: 'account',
  descFirst: ['ownedOpps', 'lastLoginAt'],
  get: {
    role: (u: AdminUser) => ROLE_RANK[u.role],
    markets: (u: AdminUser) => (ALL_MARKET_ROLES.includes(u.role) ? 'All' : u.markets.join(',')),
    status: (u: AdminUser) => status(u),
  },
})
const counts = computed(() => ({
  total: users.value?.length ?? 0,
  active: users.value?.filter(u => u.isActive).length ?? 0,
  inactive: users.value?.filter(u => !u.isActive).length ?? 0,
}))

// ---------- create / edit
type Draft = { id?: number, account: string, displayName: string, email: string, role: Role, markets: string[], isActive: boolean }
const draft = ref<Draft | null>(null)
const formError = ref('')
const busy = ref(false)
const scoped = computed(() => draft.value && !ALL_MARKET_ROLES.includes(draft.value.role))
function openNew() {
  formError.value = ''
  draft.value = { account: '', displayName: '', email: '', role: 'sales', markets: [], isActive: true }
}
function openEdit(u: AdminUser) {
  formError.value = ''
  draft.value = { id: u.id, account: u.account, displayName: u.displayName, email: u.email ?? '', role: u.role, markets: [...u.markets], isActive: u.isActive }
}
function toggleMarket(m: string) {
  if (!draft.value) return
  const i = draft.value.markets.indexOf(m)
  if (i >= 0) draft.value.markets.splice(i, 1)
  else draft.value.markets.push(m)
}
async function saveDraft() {
  const d = draft.value!
  formError.value = ''
  if (scoped.value && !d.markets.length) return (formError.value = 'Pick at least one market for this role (otherwise the user sees nothing)')
  busy.value = true
  try {
    const body = { account: d.account, displayName: d.displayName, email: d.email || null, role: d.role, markets: d.markets }
    if (d.id) {
      await $api(`/api/admin/users/${d.id}`, { method: 'PATCH', body: { ...body, isActive: d.isActive } })
    }
    else {
      const r = await $api<{ account: string, password: string }>('/api/admin/users', { method: 'POST', body })
      issued.value = { ...r, isNew: true }
    }
    draft.value = null
    await refresh()
  }
  catch (e) {
    formError.value = errMsg(e)
  }
  finally {
    busy.value = false
  }
}

// ---------- passwords (generated server-side, shown once)
const issued = ref<{ account: string, password: string, isNew?: boolean } | null>(null)
const confirmReset = ref<AdminUser | null>(null)
const copied = ref(false)
async function resetPassword(u: AdminUser) {
  busy.value = true
  try {
    issued.value = await $api<{ account: string, password: string }>(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' })
    confirmReset.value = null
    await refresh()
  }
  catch (e) {
    alert(errMsg(e))
  }
  finally {
    busy.value = false
  }
}
async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
const loginUrl = computed(() => (import.meta.client ? `${location.origin}/login` : '/login'))
const status = (u: AdminUser) => !u.isActive ? 'Inactive' : !u.hasPassword ? 'No password' : u.mustChangePassword ? 'Temp password' : 'Active'
</script>

<template>
  <div class="page-head">
    <div>
      <PageTitle :icon="ShieldCheck" title="Admin · Users & roles" />
      <div class="sub indent">{{ counts.total }} users · {{ counts.active }} active · {{ counts.inactive }} inactive (imported Excel owners start inactive)</div>
    </div>
    <button type="button" class="btn btn-primary" @click="openNew"><UserPlus class="ico" aria-hidden="true" />New user</button>
  </div>

  <div class="tabs" role="tablist">
    <span class="tab" aria-selected="true">Users</span>
    <span class="tab" style="cursor: default" title="Next iteration">Master data · FX · Thresholds · Import <span class="count">soon</span></span>
  </div>

  <div class="card row" style="padding: 12px 16px">
    <input v-model="q" class="input" style="max-width: 260px; height: 36px" placeholder="Search account, name, email" type="search">
    <select v-model="roleFilter" class="select" style="max-width: 200px; height: 36px">
      <option value="">All roles</option><option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
    </select>
    <select v-model="statusFilter" class="select" style="max-width: 200px; height: 36px">
      <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="pending">Temp password pending</option>
    </select>
  </div>

  <p v-if="error" class="error-text">{{ errMsg(error) }}</p>
  <div class="table-wrap">
    <table class="data" style="min-width: 980px">
      <thead>
        <tr>
          <SortTh :sort="userSort" k="account">Account</SortTh><SortTh :sort="userSort" k="displayName">Name · Email</SortTh>
          <SortTh :sort="userSort" k="role">Role</SortTh><SortTh :sort="userSort" k="markets">Markets</SortTh>
          <SortTh :sort="userSort" k="ownedOpps" num>Owns</SortTh><SortTh :sort="userSort" k="status">Status</SortTh>
          <SortTh :sort="userSort" k="lastLoginAt">Last login</SortTh><th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in userSort.rows.value" :key="u.id" :style="{ opacity: u.isActive ? 1 : 0.7 }">
          <td style="font-weight: 600">{{ u.account }}<span v-if="u.id === me?.id" class="badge" style="margin-left: 6px">you</span></td>
          <td><div>{{ u.displayName }}</div><div class="small muted">{{ u.email ?? '—' }}</div></td>
          <td>{{ ROLE_LABEL[u.role] }}</td>
          <td>
            <span v-if="ALL_MARKET_ROLES.includes(u.role)" class="muted">All</span>
            <span v-else-if="!u.markets.length" class="muted">—</span>
            <span v-else class="row" style="gap: 4px"><MarketFlag v-for="m in u.markets" :key="m" :code="m" :size="18" /></span>
          </td>
          <td class="num">{{ u.ownedOpps }}</td>
          <td>
            <span class="pill" :class="u.isActive ? (u.mustChangePassword || !u.hasPassword ? 'h-Amber' : 'h-Green') : 'h-Closed'">{{ status(u) }}</span>
          </td>
          <td class="small muted" style="white-space: nowrap">{{ fmtDateTime(u.lastLoginAt) }}</td>
          <td style="white-space: nowrap; text-align: right">
            <button type="button" class="btn btn-sm" @click="openEdit(u)"><UserPen class="ico" aria-hidden="true" />Edit</button>
            <button type="button" class="btn btn-sm" style="margin-left: 6px" @click="confirmReset = u"><KeyRound class="ico" aria-hidden="true" />
              {{ u.isActive && u.hasPassword ? 'Reset password' : 'Activate + password' }}
            </button>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="8"><div class="empty"><UserSearch class="ico" aria-hidden="true" />No users match.</div></td></tr>
      </tbody>
    </table>
  </div>

  <!-- create / edit -->
  <AppModal v-if="draft" :title="draft.id ? `Edit ${draft.account}` : 'New user'" width="600px" @close="draft = null">
    <form id="user-form" class="stack" @submit.prevent="saveDraft">
      <div class="form-grid">
        <label class="field">Account (login) <span class="req">*</span>
          <span class="hint">User name or email address</span>
          <input v-model="draft.account" class="input" required maxlength="120" placeholder="e.g. SonTV16 or sontv16@fpt.com"
            pattern="[A-Za-z0-9._\-]+|[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"
            title="A user name (letters, digits, . _ -) or an email address">
        </label>
        <label class="field">Display name <span class="req">*</span><input v-model="draft.displayName" class="input" required></label>
        <label class="field full">Email<input v-model="draft.email" class="input" type="email" placeholder="name@fpt.com"></label>
      </div>
      <fieldset class="stack" style="gap: 8px; border: 0; padding: 0; margin: 0">
        <legend class="field" style="margin-bottom: 8px">Role <span class="req">*</span></legend>
        <label v-for="r in ROLES" :key="r" class="role-opt" :class="{ on: draft.role === r }">
          <input v-model="draft.role" type="radio" name="role" :value="r" :disabled="draft.id === me?.id && r !== 'admin'">
          <span><b>{{ ROLE_LABEL[r] }}</b><br><span class="small muted">{{ ROLE_HELP[r] }}</span></span>
        </label>
      </fieldset>
      <div class="stack" style="gap: 8px">
        <span class="field">Market scope <span v-if="scoped" class="req">*</span></span>
        <p v-if="!scoped" class="small muted" style="margin: 0">{{ ROLE_LABEL[draft.role] }} sees all markets; scope is ignored.</p>
        <div class="row">
          <button
            v-for="m in MARKET_CODES" :key="m" type="button" class="chip-btn" :aria-pressed="draft.markets.includes(m)"
            :disabled="!scoped" @click="toggleMarket(m)"
          >{{ m }}</button>
        </div>
      </div>
      <label v-if="draft.id" class="check">
        <input v-model="draft.isActive" type="checkbox" :disabled="draft.id === me?.id"> Active (can log in)
      </label>
      <p v-if="!draft.id" class="alert alert-info" style="margin: 0">A temporary password is generated on save and shown once. The user must change it at first login.</p>
      <p v-if="formError" class="error-text" role="alert" style="margin: 0">{{ formError }}</p>
    </form>
    <template #footer>
      <button type="button" class="btn" @click="draft = null">Cancel</button>
      <button type="submit" form="user-form" class="btn btn-primary" :disabled="busy">{{ busy ? 'Saving…' : draft.id ? 'Save' : 'Create user' }}</button>
    </template>
  </AppModal>

  <!-- confirm reset -->
  <AppModal v-if="confirmReset" :title="`New password for ${confirmReset.account}`" width="440px" @close="confirmReset = null">
    <p style="margin: 0">
      Generate a new temporary password for <b>{{ confirmReset.account }}</b>?
      <span v-if="confirmReset.hasPassword"> Their current password stops working immediately.</span>
      <span v-if="!confirmReset.isActive"> The account will also be <b>activated</b>.</span>
    </p>
    <template #footer>
      <button type="button" class="btn" @click="confirmReset = null">Cancel</button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="resetPassword(confirmReset)">Generate password</button>
    </template>
  </AppModal>

  <!-- show generated password once -->
  <AppModal v-if="issued" :title="issued.isNew ? 'User created' : 'Password generated'" width="460px" @close="issued = null">
    <p style="margin: 0">Send these to <b>{{ issued.account }}</b> through a private channel (Teams chat). This password is shown <b>only once</b>.</p>
    <div class="secret">
      <div><span class="small muted">Login page</span><div>{{ loginUrl }}</div></div>
      <div><span class="small muted">Account</span><div>{{ issued.account }}</div></div>
      <div><span class="small muted">Temporary password</span><div class="pw">{{ issued.password }}</div></div>
    </div>
    <template #footer>
      <button type="button" class="btn" @click="copy(`Login: ${loginUrl}\nAccount: ${issued.account}\nTemporary password: ${issued.password}\n(You will be asked to set your own password.)`)">
        {{ copied ? 'Copied ✓' : 'Copy all' }}
      </button>
      <button type="button" class="btn btn-primary" @click="issued = null">Done</button>
    </template>
  </AppModal>
</template>

<style scoped>
.role-opt { display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; cursor: pointer; font-size: 13px; }
.role-opt.on { border-color: var(--primary); background: var(--primary-soft); }
.role-opt input { margin-top: 3px; }
.chip-btn { height: 34px; min-width: 48px; padding: 0 12px; border-radius: 17px; border: 1px solid var(--border-strong); background: var(--surface); font-weight: 600; font-size: 13px; cursor: pointer; }
.chip-btn[aria-pressed="true"] { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.chip-btn:disabled { opacity: .45; cursor: not-allowed; }
.secret { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px; display: grid; gap: 10px; font-size: 14px; }
.pw { font-family: ui-monospace, Consolas, monospace; font-size: 18px; font-weight: 700; letter-spacing: .05em; }
</style>
