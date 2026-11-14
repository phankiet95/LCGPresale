<script setup lang="ts">
import {
  CalendarRange, ChartColumn, KeyRound, LayoutDashboard, ListTodo, LogOut, Moon,
  ShieldCheck, Sun, BriefcaseBusiness, History,
} from 'lucide-vue-next'
import { ROLE_LABEL } from '#shared/constants'

const user = useCurrentUser()
const route = useRoute()
const theme = useTheme()
const nav = computed(() => [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/pipeline', label: 'Pipeline', icon: BriefcaseBusiness },
  { to: '/my-actions', label: 'My Actions', icon: ListTodo },
  { to: '/reports/weekly', label: 'Weekly Report', icon: CalendarRange },
  { to: '/reports/monthly', label: 'Monthly Report', icon: ChartColumn },
  { to: '/logs', label: 'Change log', icon: History },
  ...(user.value?.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
])
const isActive = (item: { to: string, exact?: boolean }) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to)
    || (item.to === '/pipeline' && route.path.startsWith('/opportunities'))
const isDark = computed(() => theme.theme.value === 'dark')
</script>

<template>
  <div class="shell">
    <nav aria-label="Main" class="side">
      <NuxtLink to="/" class="brand">
        <div class="logo"><AppLogo :size="28" /></div>
        <div class="brand-text"><span class="b1">Opportunity</span><span class="b2">Management</span></div>
      </NuxtLink>
      <NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="nav-link" :class="{ active: isActive(item) }">
        <component :is="item.icon" class="ico nav-ico" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </NuxtLink>
      <div class="spacer" />

      <button type="button" role="switch" class="theme" :aria-checked="isDark" aria-label="Dark mode" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="theme.toggle()">
        <span class="theme-label">
          <component :is="isDark ? Moon : Sun" class="ico" aria-hidden="true" />
          <span>{{ isDark ? 'Dark mode' : 'Light mode' }}</span>
        </span>
        <span class="switch" :class="{ on: isDark }" aria-hidden="true">
          <span class="knob"><component :is="isDark ? Moon : Sun" class="knob-ico" /></span>
        </span>
      </button>

      <div v-if="user" class="me">
        <div class="me-head">
          <span class="avatar" aria-hidden="true">{{ user.displayName.slice(0, 1).toUpperCase() }}</span>
          <div style="min-width: 0">
            <div class="me-name">{{ user.displayName }}</div>
            <div class="me-role">{{ user.account }} · {{ ROLE_LABEL[user.role] }}</div>
          </div>
        </div>
        <div class="me-role" style="margin-top: 6px">{{ user.markets === null ? 'All markets' : user.markets.join(', ') || 'No market assigned' }}</div>
        <div class="row" style="margin-top: 8px">
          <NuxtLink to="/change-password" class="btn btn-sm"><KeyRound class="ico" aria-hidden="true" />Password</NuxtLink>
          <button type="button" class="btn btn-sm" @click="logout()"><LogOut class="ico" aria-hidden="true" />Log out</button>
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
.side { flex: 1 1 220px; max-width: 240px; background: var(--surface); border-right: 1px solid var(--border); padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; height: 100vh; transition: background-color 220ms, border-color 220ms; }
.brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 20px; text-decoration: none; color: var(--text); }
.logo { width: 38px; height: 38px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; transition: transform var(--dur) var(--ease-out); }
.brand:hover .logo { transform: rotate(-6deg) scale(1.06); }
.brand-text { display: flex; flex-direction: column; }
.b1 { font-weight: 700; font-size: 14px; }
.b2 { font-size: 12px; color: var(--muted); }
.nav-link { display: flex; align-items: center; gap: 10px; text-decoration: none; padding: 9px 12px; border-radius: 8px; color: var(--text-2); font-size: 14px; position: relative; }
.nav-ico { width: 20px; height: 20px; color: var(--muted); transition: color var(--dur), transform var(--dur) var(--ease-out); }
.nav-link:hover { background: var(--surface-2); color: var(--text); }
.nav-link:hover .nav-ico { color: var(--text-2); transform: scale(1.08); }
.nav-link.active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.nav-link.active .nav-ico { color: var(--primary); }
.nav-link.active::before { content: ''; position: absolute; left: -14px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--primary); }
.theme { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; padding: 8px 12px; border: 0; border-radius: 8px; background: transparent; color: var(--text-2); font-size: 13px; cursor: pointer; }
.theme:hover { background: var(--surface-2); color: var(--text); }
.theme-label { display: inline-flex; align-items: center; gap: 10px; }
.switch { position: relative; width: 40px; height: 22px; border-radius: 11px; background: var(--border-strong); transition: background-color var(--dur) var(--ease-out); flex: none; }
.switch.on { background: var(--primary); }
.knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform 260ms var(--ease-out); }
.switch.on .knob { transform: translateX(18px); }
.knob-ico { width: 11px; height: 11px; color: var(--muted); }
.switch.on .knob-ico { color: var(--primary); }
.me { border-top: 1px solid var(--border); padding: 12px 8px 0; }
.me-head { display: flex; gap: 10px; align-items: center; }
.avatar { width: 32px; height: 32px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; background: var(--icon-tile); color: var(--icon-tile-fg); }
.me-name { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.me-role { font-size: 12px; color: var(--muted); }
.main { flex: 999 1 560px; min-width: 0; padding: 24px 32px 48px; display: flex; flex-direction: column; gap: 16px; }
@media (max-width: 720px) {
  .side { max-width: none; height: auto; position: static; flex-direction: row; flex-wrap: wrap; align-items: center; padding: 10px; }
  .brand { padding: 4px 8px; }
  .nav-link.active::before { display: none; }
  .spacer, .me { display: none; }
  .theme { margin: 0 0 0 auto; padding: 6px; }
  .theme-label span { display: none; }
  .main { padding: 16px; }
}
</style>
