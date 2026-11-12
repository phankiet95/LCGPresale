<script setup lang="ts">
import type { Health } from '#shared/rules'
import { HEALTH_BUCKET } from '#shared/constants'

const props = defineProps<{ health: Health }>()
const bucket = computed(() => HEALTH_BUCKET(props.health))
</script>

<template>
  <span class="pill" :class="`h-${bucket}`" :title="health">{{ health === 'Red (No update)' ? 'Red · no update' : health }}</span>
</template>
