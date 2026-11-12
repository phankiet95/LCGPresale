<script setup lang="ts">
import { WARNING_META, type WarningCode } from '#shared/rules'
import { WARNING_LABEL } from '#shared/constants'

defineProps<{ codes: WarningCode[] }>()
</script>

<template>
  <div class="row" style="gap: 4px">
    <span
      v-for="c in codes" :key="c" class="sev" :class="`sev-${WARNING_META[c].severity}`"
      :title="`${WARNING_LABEL[c]} · ${WARNING_META[c].severity}`"
    >{{ c }}</span>
  </div>
</template>
