<script setup lang="ts">
import type { Component } from 'vue'

/** Screen title with its icon tile (same icon as the sidebar entry). */
defineProps<{ icon: Component, title: string, size?: 'md' | 'lg' }>()
</script>

<template>
  <h1 class="page-title" :class="size">
    <span class="title-ico" aria-hidden="true"><component :is="icon" /></span>
    <span class="title-text">{{ title }}</span>
  </h1>
</template>

<style scoped>
.page-title { display: flex; align-items: center; gap: 12px; }
.title-ico {
  width: 40px; height: 40px; border-radius: 11px; flex: none; display: inline-flex; align-items: center; justify-content: center;
  background: var(--icon-tile); color: var(--icon-tile-fg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--icon-tile-fg) 14%, transparent);
}
.title-ico :deep(svg) { width: 22px; height: 22px; stroke-width: 2; }
.title-text { min-width: 0; }
.md .title-ico { width: 34px; height: 34px; border-radius: 9px; }
.md .title-ico :deep(svg) { width: 19px; height: 19px; }
</style>
