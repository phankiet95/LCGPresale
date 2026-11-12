<script setup lang="ts">
/** Δ between two periods. `invert` = a rise is bad (e.g. Lost). */
const props = defineProps<{ current: number | null, previous: number | null, money?: boolean, invert?: boolean }>()
const d = computed(() => (props.current === null || props.previous === null ? null : props.current - props.previous))
const cls = computed(() => {
  if (d.value === null || Math.abs(d.value) < 0.005) return 'flat'
  return (d.value > 0) !== !!props.invert ? 'up' : 'down'
})
const text = computed(() => {
  if (d.value === null) return 'no baseline'
  if (Math.abs(d.value) < 0.005) return '±0'
  const v = props.money ? fmtUsd(Math.abs(d.value)) : Math.abs(Math.round(d.value)).toLocaleString('en-US')
  return `${d.value > 0 ? '▲' : '▼'} ${v}`
})
</script>

<template>
  <span class="delta" :class="cls" :title="d === null ? 'No snapshot for the previous period yet' : undefined">{{ text }}</span>
</template>
