<script setup lang="ts">
withDefaults(defineProps<{ rows?: number, height?: number }>(), { rows: 3, height: 16 })
</script>

<template>
  <div class="card stack" style="gap: 10px" aria-busy="true" aria-label="Loading">
    <div class="skeleton" style="width: 30%; height: 18px" />
    <div v-for="i in rows" :key="i" class="skeleton" :style="{ height: `${height}px`, width: `${100 - (i % 3) * 12}%` }" />
  </div>
</template>
