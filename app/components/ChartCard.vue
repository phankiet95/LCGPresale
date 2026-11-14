<script setup lang="ts">
import type { Component } from 'vue'
import { Maximize2 } from 'lucide-vue-next'

/**
 * Compact chart card with an Expand button: the same content re-renders large in a modal.
 * The default slot receives `big` so a chart can switch to its large size / longer lists.
 */
defineProps<{ title: string, icon: Component, sub?: string }>()
const open = ref(false)
</script>

<template>
  <div class="card cc-card">
    <div class="cc-head">
      <h2 class="h-ico cc-title"><component :is="icon" class="ico" aria-hidden="true" /><span v-tip class="truncate">{{ title }}</span></h2>
      <span class="cc-actions">
        <slot name="actions" :big="false" />
        <button type="button" class="cc-exp" :title="`Expand · ${title}`" :aria-label="`Expand ${title}`" @click="open = true">
          <Maximize2 class="ico" aria-hidden="true" />
        </button>
      </span>
    </div>
    <div v-if="sub" class="cc-sub small muted">{{ sub }}</div>
    <div class="cc-body"><slot :big="false" /></div>

    <AppModal v-if="open" :title="title" width="1100px" @close="open = false">
      <template #title>
        <div class="stack" style="gap: 2px">
          <h2 class="h-ico"><component :is="icon" class="ico" aria-hidden="true" />{{ title }}</h2>
          <span v-if="sub" class="small muted">{{ sub }}</span>
        </div>
      </template>
      <div class="row" style="justify-content: flex-end"><slot name="actions" :big="true" /></div>
      <slot :big="true" />
    </AppModal>
  </div>
</template>

<style scoped>
.cc-card { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; min-width: 0; }
.cc-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-width: 0; }
.cc-title { font-size: 14px; min-width: 0; }
.cc-title .ico { width: 18px; height: 18px; }
.cc-actions { display: inline-flex; align-items: center; gap: 6px; flex: none; }
.cc-exp { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--muted); cursor: pointer; transition: background-color var(--dur), color var(--dur), border-color var(--dur), transform var(--dur-fast); }
.cc-exp .ico { width: 16px; height: 16px; }
.cc-exp:hover { background: var(--surface-2); border-color: var(--border); color: var(--primary); }
.cc-exp:active { transform: scale(.94); }
.cc-sub { margin-top: -4px; }
.cc-body { flex: 1 1 auto; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
</style>
