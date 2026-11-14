<script setup lang="ts">
import {
  CalendarRange, ChartColumn, KeyRound, LayoutDashboard, ListTodo, LogOut, Moon,
  ShieldCheck, Sun, BriefcaseBusiness, History, PanelLeftClose, PanelLeftOpen,
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

// Collapsible side menu (icons only) for more room. Remembered per browser; Ctrl+B toggles.
const KEY = 'lcg.nav.collapsed'
const collapsed = useState('nav-collapsed', () => {
  try { return localStorage.getItem(KEY) === '1' }
  catch { return false }
})
function toggleNav() {
  collapsed.value = !collapsed.value
  try { localStorage.setItem(KEY, collapsed.value ? '1' : '0') }
  catch { /* storage blocked: still toggles for this visit */ }
}
function onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    toggleNav()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
/** tooltip text only while collapsed (labels are hidden then) */
const tipIf = (text: string) => (collapsed.value ? text : '')
</script>

<template>
  <div class="shell" :class="{ collapsed }">
    <nav aria-label="Main" class="side">
      <div class="brand-row">
        <NuxtLink to="/" class="brand">
          <div class="logo"><AppLogo :size="28" /></div>
          <div class="brand-text"><span class="b1">Opportunity</span><span class="b2">Management</span></div>
        </NuxtLink>
        <button
          v-tip="collapsed ? 'Expand menu (Ctrl+B)' : 'Collapse menu (Ctrl+B)'" type="button" class="collapse-btn"
          :aria-label="collapsed ? 'Expand menu' : 'Collapse menu'" :aria-expanded="!collapsed" @click="toggleNav"
        >
          <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" class="ico" aria-hidden="true" />
        </button>
      </div>
      <NuxtLink
        v-for="item in nav" :key="item.to" v-tip="tipIf(item.label)" :to="item.to" class="nav-link"
        :class="{ active: isActive(item) }" :aria-label="collapsed ? item.label : undefined"
      >
        <component :is="item.icon" class="ico nav-ico" aria-hidden="true" />
        <span class="lbl">{{ item.label }}</span>
      </NuxtLink>
      <div class="spacer" />

      <button v-tip="tipIf(isDark ? 'Dark mode' : 'Light mode')" type="button" role="switch" class="theme" :aria-checked="isDark" aria-label="Dark mode" @click="theme.toggle()">
        <span class="theme-label">
          <component :is="isDark ? Moon : Sun" class="ico" aria-hidden="true" />
          <span class="lbl">{{ isDark ? 'Dark mode' : 'Light mode' }}</span>
        </span>
        <span class="switch" :class="{ on: isDark }" aria-hidden="true">
          <span class="knob"><component :is="isDark ? Moon : Sun" class="knob-ico" /></span>
        </span>
      </button>

      <div v-if="user" class="me">
        <div class="me-head">
          <span v-tip="tipIf(`${user.displayName} · ${ROLE_LABEL[user.role]}`)" class="avatar" aria-hidden="true">{{ user.displayName.slice(0, 1).toUpperCase() }}</span>
          <div class="me-text">
            <div class="me-name">{{ user.displayName }}</div>
            <div class="me-role">{{ user.account }} · {{ ROLE_LABEL[user.role] }}</div>
          </div>
        </div>
        <div class="me-role me-text" style="margin-top: 6px">{{ user.markets === null ? 'All markets' : user.markets.join(', ') || 'No market assigned' }}</div>
        <div class="me-actions">
          <NuxtLink v-tip="tipIf('Change password')" to="/change-password" class="btn btn-sm" aria-label="Change password"><KeyRound class="ico" aria-hidden="true" /><span class="lbl">Password</span></NuxtLink>
          <button v-tip="tipIf('Log out')" type="button" class="btn btn-sm" aria-label="Log out" @click="logout()"><LogOut class="ico" aria-hidden="true" /><span class="lbl">Log out</span></button>
        </div>
      </div>
    </nav>
    <main class="main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell { --side-w: 236px; min-height: 100vh; display: flex; }
.shell.collapsed { --side-w: 68px; }
.side {
  flex: none; width: var(--side-w); background: var(--surface); border-right: 1px solid var(--border);
  padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; height: 100vh;
  overflow: hidden auto; overflow-x: hidden;
  transition: width 240ms var(--ease-out), padding 240ms var(--ease-out), background-color 220ms, border-color 220ms;
}
.collapsed .side { padding: 20px 10px; }

/* labels fade out while the menu narrows */
.lbl, .brand-text, .me-text { white-space: nowrap; transition: opacity 160ms; }
.collapsed .lbl, .collapsed .brand-text, .collapsed .me-text { opacity: 0; width: 0; overflow: hidden; pointer-events: none; }
.collapsed .me-text { display: none; }

.brand-row { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 0 0 16px; }
.collapsed .brand-row { flex-direction: column; gap: 10px; }
.brand { display: flex; align-items: center; gap: 10px; padding: 4px 4px 4px 8px; text-decoration: none; color: var(--text); min-width: 0; }
.collapsed .brand { padding: 4px 0; }
.logo { width: 38px; height: 38px; flex: none; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; transition: transform var(--dur) var(--ease-out); }
.brand:hover .logo { transform: rotate(-6deg) scale(1.06); }
.brand-text { display: flex; flex-direction: column; }
.b1 { font-weight: 700; font-size: 14px; }
.b2 { font-size: 12px; color: var(--muted); }
.collapse-btn { flex: none; width: 30px; height: 30px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background-color var(--dur), color var(--dur), border-color var(--dur); }
.collapse-btn:hover { background: var(--surface-2); border-color: var(--border); color: var(--text); }
.collapse-btn .ico { width: 18px; height: 18px; }

.nav-link { display: flex; align-items: center; gap: 10px; text-decoration: none; padding: 9px 12px; border-radius: 8px; color: var(--text-2); font-size: 14px; position: relative; }
.collapsed .nav-link { justify-content: center; padding: 10px 0; gap: 0; }
.nav-ico { width: 20px; height: 20px; flex: none; color: var(--muted); transition: color var(--dur), transform var(--dur) var(--ease-out); }
.nav-link:hover { background: var(--surface-2); color: var(--text); }
.nav-link:hover .nav-ico { color: var(--text-2); transform: scale(1.08); }
.nav-link.active { background: var(--primary-soft); color: var(--primary); font-weight: 600; }
.nav-link.active .nav-ico { color: var(--primary); }
.nav-link.active::before { content: ''; position: absolute; left: -14px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--primary); }
.collapsed .nav-link.active::before { left: -10px; }

.theme { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; padding: 8px 12px; border: 0; border-radius: 8px; background: transparent; color: var(--text-2); font-size: 13px; cursor: pointer; }
.collapsed .theme { flex-direction: column; justify-content: center; padding: 8px 0; gap: 6px; }
.collapsed .theme-label { display: none; }
.theme:hover { background: var(--surface-2); color: var(--text); }
.theme-label { display: inline-flex; align-items: center; gap: 10px; }
.switch { position: relative; width: 40px; height: 22px; border-radius: 11px; background: var(--border-strong); transition: background-color var(--dur) var(--ease-out); flex: none; }
.switch.on { background: var(--primary); }
.knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform 260ms var(--ease-out); }
.switch.on .knob { transform: translateX(18px); }
.knob-ico { width: 11px; height: 11px; color: var(--muted); }
.switch.on .knob-ico { color: var(--primary); }

.me { border-top: 1px solid var(--border); padding: 12px 8px 0; }
.collapsed .me { padding: 12px 0 0; }
.me-head { display: flex; gap: 10px; align-items: center; }
.collapsed .me-head { justify-content: center; }
.me-text { min-width: 0; }
.avatar { width: 32px; height: 32px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; background: var(--icon-tile); color: var(--icon-tile-fg); }
.me-name { font-weight: 600; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.me-role { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.me-actions { display: flex; gap: 8px; margin-top: 8px; }
.collapsed .me-actions { flex-direction: column; align-items: center; gap: 6px; }
.collapsed .me-actions .btn { width: 36px; padding: 0; justify-content: center; gap: 0; }

.main { flex: 1 1 auto; min-width: 0; padding: 24px 32px 48px; display: flex; flex-direction: column; gap: 16px; transition: padding 240ms var(--ease-out); }

@media (max-width: 720px) {
  .shell { flex-direction: column; }
  .side, .collapsed .side { width: auto; height: auto; position: static; flex-direction: row; flex-wrap: wrap; align-items: center; padding: 10px; }
  .brand-row { padding: 0; }
  .collapse-btn { display: none; }
  .nav-link.active::before { display: none; }
  .spacer, .me { display: none; }
  .theme { margin: 0 0 0 auto; padding: 6px; }
  .theme-label .lbl { display: none; }
  .main { padding: 16px; }
}
</style>
