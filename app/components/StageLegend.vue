<script setup lang="ts">
import { STAGE_LABEL } from '#shared/constants'
import type { Stage } from '#shared/rules'

withDefaults(defineProps<{ stages?: Stage[] }>(), { stages: () => ['O', 'D', 'C', 'B', 'A'] })
</script>

<template>
  <span class="lg">
    <span v-for="s in stages" :key="s" class="lg-i"><span class="sw" :style="{ background: `var(--st-${s})` }" />{{ STAGE_LABEL[s] }}</span>
  </span>
</template>

<style scoped>
.lg { display: inline-flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--text-2); }
.lg-i { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
</style>
