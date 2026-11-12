<script setup lang="ts">
import { ROLE_LABEL } from '#shared/constants'

const user = useCurrentUser()
const route = useRoute()
const nav = computed(() => [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/my-actions', label: 'My Actions' },
  { to: '/reports/weekly', label: 'Weekly Report' },
  { to: '/reports/monthly', label: 'Monthly Report' },
  ...(user.value?.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
])
const isActive = (item: { to: string, exact?: boolean }) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to)
    || (item.to === '/pipeline' && route.path.startsWith('/opportunities'))
</script>

<template>
  <div class="shell">
    <nav aria-label="Main" class="side">
      <NuxtLink to="/" class="brand">
        <div class="logo">LCG</div>
        <div class="brand-text"><span class="b1">Opportunity</span><span class="b2">Management</span></div>
      </NuxtLink>
      <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="nav-link" :class="{ active: isActive(item) }">
        {{ item.label }}
      </NuxtLink>
      <div class="spacer" />
      <div v-if="user" class="me">
        <div class="me-name">{{ user.displayName }}</div>
        <div class="me-role">{{ user.account }} · {{ ROLE_LABEL[user.role] }}</div>
        <div class="me-role">{{ user.markets === null ? 'All markets' : user.markets.join(', ') || 'No market assigned' }}</div>
        <div class="row" style="margin-top: 8px">
          <NuxtLink to="/change-password" class="btn btn-sm">Password</NuxtLink>
          <button type="button" class="btn btn-sm" @click="logout()">Log out</button>
        </div>
      </div>
    </nav>
    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; display: flex; flex-wrap: wrap; }
.side { flex: 1 1 220px; max-width: 240px; background: var(--surface); border-right: 1px solid var(--border); padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; height: 100vh; }
.brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 20px; text-decoration: none; color: var(--text); }
.logo { width: 32px; height: 32px; border-radius: 8px; background: var(--primary); color: #fff; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; }
.brand-text { display: flex; flex-direction: column; }
.b1 { font-weight: 700; font-size: 14px; }
.b2 { font-size: 12px; color: var(--muted); }
.nav-link { text-decoration: none; padding: 10px 12px; border-radius: 8px; color: var(--text-2); font-size: 14px; }
.nav-link:hover { background: var(--surface-2); color: var(--text); }
.nav-link.active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.me { border-top: 1px solid var(--border); padding: 12px 8px 0; }
.me-name { font-weight: 600; font-size: 13px; }
.me-role { font-size: 12px; color: var(--muted); }
.main { flex: 999 1 560px; min-width: 0; padding: 24px 32px 48px; display: flex; flex-direction: column; gap: 16px; }
@media (max-width: 720px) {
  .side { max-width: none; height: auto; position: static; flex-direction: row; flex-wrap: wrap; padding: 10px; }
  .brand { padding: 4px 8px; }
  .spacer, .me { display: none; }
  .main { padding: 16px; }
}
</style>
