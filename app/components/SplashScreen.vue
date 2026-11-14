<script setup lang="ts">
/**
 * Full-screen LCG splash. On first load it continues the animation started by spa-loading-template.html
 * (pieces already assembled -> pixels breathe), then exits with a zoom + circular reveal of the app.
 * After login it plays the full intro (pieces fly in) before revealing the dashboard.
 */
const { state } = useSplash()
const leaving = ref(false)
const MIN_FIRST = 1700 // ms since navigation start: lets the intro of the pre-load template finish
const MIN_SHOW = 1500 // ms after show(): lets the intro play
let timer: ReturnType<typeof setTimeout> | undefined

function close() {
  const min = state.value.mode === 'intro' ? MIN_SHOW : MIN_FIRST
  const wait = Math.max(0, min - (performance.now() - state.value.since))
  clearTimeout(timer)
  timer = setTimeout(() => {
    leaving.value = true
    timer = setTimeout(() => {
      state.value.open = false
      leaving.value = false
    }, 700)
  }, wait)
}
watch(() => [state.value.open, state.value.ready] as const, ([open, ready]) => { if (open && ready) close() }, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Teleport to="body">
    <div v-if="state.open" class="splash" :class="{ leaving }" role="status" aria-live="polite" :aria-label="state.label || 'Loading'">
      <div class="glow" aria-hidden="true" />
      <div class="center">
        <div class="mark">
          <AppLogo :key="state.since" :size="132" :mode="state.mode" />
        </div>
        <div class="word">
          <span class="w1">LCG</span>
          <span class="w2">Opportunity Management</span>
        </div>
        <div class="bar" aria-hidden="true"><span /></div>
        <div v-if="state.label" class="lbl">{{ state.label }}</div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <Transition name="mini">
      <div v-if="state.mini && !state.open" class="mini" role="status" aria-label="Loading">
        <AppLogo :size="22" mode="idle" /><span>Loading…</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.splash {
  position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center;
  background: var(--bg); clip-path: circle(150% at 50% 46%);
}
.splash.leaving { animation: reveal 700ms cubic-bezier(.7, 0, .2, 1) forwards; }
@keyframes reveal { to { clip-path: circle(0% at 50% 46%); } }
.glow {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(420px 320px at 50% 44%, color-mix(in srgb, #E8202A 14%, transparent), transparent 70%),
    radial-gradient(900px 600px at 50% 120%, var(--primary-soft), transparent 70%);
  animation: glow 3s ease-in-out infinite alternate;
}
@keyframes glow { to { opacity: .6; transform: scale(1.06); } }
.center { position: relative; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.mark { filter: drop-shadow(0 12px 28px rgba(232, 32, 42, .28)); }
.leaving .mark { animation: zoom-out 650ms cubic-bezier(.7, 0, .2, 1) forwards; }
@keyframes zoom-out { to { transform: scale(1.35) rotate(-4deg); opacity: 0; filter: blur(4px); } }
.word { display: flex; flex-direction: column; align-items: center; gap: 2px; animation: fade-up 700ms var(--ease-out) 350ms both; }
.w1 { font-size: 22px; font-weight: 700; letter-spacing: .32em; padding-left: .32em; color: var(--text); }
.w2 { font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.bar { width: 180px; height: 3px; border-radius: 3px; background: var(--chip); overflow: hidden; animation: fade-in 500ms ease 600ms both; }
.bar span { display: block; width: 40%; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #E8202A, var(--primary)); animation: slide 1.1s cubic-bezier(.4, 0, .2, 1) infinite; }
@keyframes slide { from { transform: translateX(-110%); } to { transform: translateX(260%); } }
.leaving .word, .leaving .bar, .leaving .lbl { transition: opacity 250ms; opacity: 0; }
.lbl { font-size: 13px; color: var(--text-2); animation: fade-in 400ms ease both; }

.mini {
  position: fixed; z-index: 150; top: 14px; left: 50%; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 10px; border-radius: 999px;
  background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-pop); font-size: 13px; color: var(--text-2);
}
.mini-enter-active, .mini-leave-active { transition: opacity 200ms, transform 250ms var(--ease-out); }
.mini-enter-from, .mini-leave-to { opacity: 0; transform: translate(-50%, -10px); }
@media (prefers-reduced-motion: reduce) { .splash.leaving { animation-duration: 1ms; } }
</style>
