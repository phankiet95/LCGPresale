<script setup lang="ts">
import type { Health } from '#shared/rules'
import { HEALTH_BUCKET } from '#shared/constants'

const props = defineProps<{ health: Health }>()
const bucket = computed(() => HEALTH_BUCKET(props.health))
</script>

<template>
  <span class="pill hb" :class="`h-${bucket}`" :title="health">
    <span class="hb-dot" aria-hidden="true" />{{ health === 'Red (No update)' ? 'Red · no update' : health }}
  </span>
</template>

<style scoped>
.hb { display: inline-flex; align-items: center; gap: 6px; }
.hb-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex: none; }
.h-Red .hb-dot { box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent); }
</style>
