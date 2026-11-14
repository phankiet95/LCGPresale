<script setup lang="ts">
import { BellRing, ChartNoAxesCombined, Moon, ShieldCheck, Sun } from 'lucide-vue-next'

const theme = useTheme()
const isDark = computed(() => theme.theme.value === 'dark')
const year = new Date().getFullYear()
// Mini pipeline chart in the brand panel (decorative)
const bars = [38, 56, 44, 70, 62, 84, 76]
const features = [
  { icon: ChartNoAxesCombined, title: 'One live pipeline', text: 'Every market, partner and stage in one place, in USD.' },
  { icon: BellRing, title: 'Never miss a follow-up', text: 'Health, warnings and next actions surface automatically.' },
  { icon: ShieldCheck, title: 'Weekly & monthly reports', text: 'Snapshots every Monday, ready for the meeting.' },
]
</script>

<template>
  <div class="auth">
    <!-- Brand panel (hidden on small screens) -->
    <aside class="brand-panel" aria-hidden="true">
      <div class="blob b-1" />
      <div class="blob b-2" />
      <div class="blob b-3" />
      <div class="grid-bg" />

      <div class="bp-inner">
        <div class="bp-brand">
          <div class="bp-logo"><AppLogo :size="30" color="#fff" /></div>
          <div><div class="bp-b1">Opportunity Management</div><div class="bp-b2">LCG pre-sale pipeline</div></div>
        </div>

        <div class="bp-hero">
          <h2 class="bp-title">Close more deals,<br><span>with less spreadsheet.</span></h2>

          <div class="chart-card">
            <div class="cc-head">
              <span class="cc-label">Weighted forecast</span>
              <span class="cc-chip">▲ 12%</span>
            </div>
            <div class="cc-value">$5.74M</div>
            <div class="cc-bars">
              <span v-for="(h, i) in bars" :key="i" class="cc-bar" :style="{ height: `${h}%`, animationDelay: `${300 + i * 90}ms` }" />
            </div>
            <svg class="cc-line" viewBox="0 0 300 60" preserveAspectRatio="none">
              <path d="M0,48 C40,44 60,30 100,32 C140,34 160,18 200,20 C240,22 260,8 300,6" />
            </svg>
          </div>

          <ul class="bp-features">
            <li v-for="(f, i) in features" :key="f.title" :style="{ animationDelay: `${500 + i * 120}ms` }">
              <span class="f-ico"><component :is="f.icon" /></span>
              <span><b>{{ f.title }}</b><br><span class="f-text">{{ f.text }}</span></span>
            </li>
          </ul>
        </div>

        <div class="bp-foot">© {{ year }} LCG · Opportunity Management</div>
      </div>
    </aside>

    <!-- Form side -->
    <main class="form-side">
      <button type="button" class="theme-btn" :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" :title="isDark ? 'Light mode' : 'Dark mode'" @click="theme.toggle()">
        <Transition name="spin" mode="out-in">
          <component :is="isDark ? Sun : Moon" :key="String(isDark)" class="ico" />
        </Transition>
      </button>

      <div class="auth-card">
        <div class="brand-sm">
          <div class="logo"><AppLogo :size="34" /></div>
          <div><div class="b1">Opportunity Management</div><div class="b2">LCG pre-sale pipeline</div></div>
        </div>
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); background: var(--bg); }

/* ---------------- brand panel */
.brand-panel {
  position: relative; overflow: hidden; color: #fff;
  background: linear-gradient(145deg, #0A1A40 0%, #12307A 48%, #1E4FC2 100%);
}
.blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .55; will-change: transform; }
.b-1 { width: 420px; height: 420px; background: #3B82F6; top: -120px; left: -80px; animation: float1 18s ease-in-out infinite alternate; }
.b-2 { width: 360px; height: 360px; background: #22D3EE; bottom: -140px; right: -60px; opacity: .35; animation: float2 22s ease-in-out infinite alternate; }
.b-3 { width: 260px; height: 260px; background: #818CF8; top: 40%; left: 55%; opacity: .35; animation: float3 16s ease-in-out infinite alternate; }
@keyframes float1 { to { transform: translate(120px, 90px) scale(1.15); } }
@keyframes float2 { to { transform: translate(-110px, -70px) scale(1.1); } }
@keyframes float3 { to { transform: translate(-80px, 60px) scale(.9); } }
.grid-bg {
  position: absolute; inset: 0; opacity: .12;
  background-image: linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%);
}
.bp-inner { position: relative; z-index: 1; height: 100%; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: 40px 56px; gap: 32px; }
.bp-brand { display: flex; align-items: center; gap: 12px; animation: fade-up 600ms var(--ease-out) both; }
.bp-logo { width: 42px; height: 42px; border-radius: 11px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.25); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
.bp-b1 { font-weight: 700; font-size: 16px; }
.bp-b2 { font-size: 13px; opacity: .7; }
.bp-hero { display: flex; flex-direction: column; gap: 28px; max-width: 480px; }
.bp-title { font-size: 34px; line-height: 1.2; font-weight: 700; letter-spacing: -.02em; margin: 0; animation: fade-up 700ms var(--ease-out) 100ms both; }
.bp-title span { background: linear-gradient(90deg, #93C5FD, #67E8F9); -webkit-background-clip: text; background-clip: text; color: transparent; }

.chart-card {
  position: relative; padding: 18px 20px 14px; border-radius: 16px;
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); backdrop-filter: blur(10px);
  box-shadow: 0 20px 50px rgba(3, 10, 30, .35);
  animation: fade-up 700ms var(--ease-out) 200ms both, bob 6s ease-in-out 1s infinite;
}
@keyframes bob { 50% { transform: translateY(-6px); } }
.cc-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.cc-label { opacity: .75; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
.cc-chip { background: rgba(74, 222, 128, .18); color: #86EFAC; border-radius: 10px; padding: 2px 8px; font-weight: 700; }
.cc-value { font-size: 28px; font-weight: 700; margin: 4px 0 10px; letter-spacing: -.01em; }
.cc-bars { display: flex; align-items: flex-end; gap: 8px; height: 84px; }
.cc-bar {
  flex: 1; border-radius: 6px 6px 2px 2px; transform-origin: bottom;
  background: linear-gradient(180deg, rgba(147,197,253,.95), rgba(96,165,250,.35));
  animation: grow-y 900ms var(--ease-out) both;
}
.cc-line { position: absolute; left: 20px; right: 20px; bottom: 14px; width: calc(100% - 40px); height: 84px; overflow: visible; }
.cc-line path { fill: none; stroke: #67E8F9; stroke-width: 2.5; stroke-linecap: round; vector-effect: non-scaling-stroke; stroke-dasharray: 600; stroke-dashoffset: 600; animation: draw-line 1.6s var(--ease-out) 900ms forwards; filter: drop-shadow(0 0 6px rgba(103,232,249,.6)); }
@keyframes draw-line { to { stroke-dashoffset: 0; } }

.bp-features { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.bp-features li { display: flex; gap: 12px; align-items: flex-start; font-size: 14px; animation: fade-up 600ms var(--ease-out) both; }
.f-ico { width: 34px; height: 34px; flex: none; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); }
.f-ico :deep(svg) { width: 18px; height: 18px; }
.f-text { opacity: .72; font-size: 13px; }
.bp-foot { font-size: 12px; opacity: .55; animation: fade-in 1s ease 600ms both; }

/* ---------------- form side */
.form-side { position: relative; display: flex; align-items: center; justify-content: center; padding: 32px 20px; }
.form-side::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(600px 300px at 80% 0%, var(--primary-soft), transparent 70%);
}
.theme-btn {
  position: absolute; top: 20px; right: 20px; width: 40px; height: 40px; border-radius: 10px; cursor: pointer;
  border: 1px solid var(--border); background: var(--surface); color: var(--text-2); display: inline-flex; align-items: center; justify-content: center;
  transition: background-color var(--dur), color var(--dur), border-color var(--dur), transform var(--dur-fast);
}
.theme-btn:hover { color: var(--text); border-color: var(--border-strong); }
.theme-btn:active { transform: scale(.94); }
.spin-enter-active, .spin-leave-active { transition: transform 250ms var(--ease-out), opacity 250ms; }
.spin-enter-from { transform: rotate(-90deg) scale(.6); opacity: 0; }
.spin-leave-to { transform: rotate(90deg) scale(.6); opacity: 0; }

.auth-card {
  position: relative; width: 100%; max-width: 420px; padding: 36px 34px; display: flex; flex-direction: column; gap: 22px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 18px;
  box-shadow: 0 1px 2px rgba(17,24,39,.04), 0 24px 60px -20px rgba(17,24,39,.18);
  animation: card-in 650ms var(--ease-out) both;
}
@keyframes card-in { from { opacity: 0; transform: translateY(18px) scale(.985); } to { opacity: 1; transform: none; } }
.brand-sm { display: none; gap: 12px; align-items: center; }
.logo { width: 44px; height: 44px; border-radius: 11px; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; }
.b1 { font-weight: 700; font-size: 16px; }
.b2 { font-size: 13px; color: var(--muted); }

@media (max-width: 960px) {
  .auth { grid-template-columns: 1fr; }
  .brand-panel { display: none; }
  .brand-sm { display: flex; }
  .auth-card { padding: 28px 24px; }
}
</style>
