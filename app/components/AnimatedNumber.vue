<script setup lang="ts">
/** Counts up to `value` (from 0 on first show, from the old value on change). */
const props = withDefaults(defineProps<{ value: number | null | undefined, format?: (n: number) => string, duration?: number }>(), {
  format: (n: number) => Math.round(n).toLocaleString('en-US'),
  duration: 700,
})
const shown = ref(0)
let raf = 0
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function animate(to: number) {
  cancelAnimationFrame(raf)
  const from = shown.value
  if (reduced() || from === to) {
    shown.value = to
    return
  }
  const t0 = performance.now()
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / props.duration)
    shown.value = from + (to - from) * (1 - (1 - k) ** 3)
    if (k < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}
watch(() => props.value, v => animate(v ?? 0))
onMounted(() => animate(props.value ?? 0))
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <span v-if="value === null || value === undefined">—</span>
  <span v-else style="font-variant-numeric: tabular-nums">{{ format(shown) }}</span>
</template>
