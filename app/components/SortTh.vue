<script setup lang="ts">
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-vue-next'

/** Sortable column header: <SortTh :sort="s" k="amountUsd" num>Amount</SortTh> */
const props = defineProps<{ sort: { key: Ref<string | null>, dir: Ref<1 | -1>, by: (k: string) => void }, k: string, num?: boolean }>()
const active = computed(() => props.sort.key.value === props.k)
const ariaSort = computed(() => (active.value ? (props.sort.dir.value === 1 ? 'ascending' : 'descending') : 'none'))
</script>

<template>
  <th :class="{ num }" :aria-sort="ariaSort">
    <button type="button" class="sort-btn" :class="{ active, num }" @click="sort.by(k)">
      <span><slot /></span>
      <component :is="!active ? ArrowUpDown : sort.dir.value === 1 ? ArrowUp : ArrowDown" class="sort-ico" aria-hidden="true" />
    </button>
  </th>
</template>

<style scoped>
.sort-btn {
  display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; padding: 0; margin: 0; cursor: pointer;
  font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit;
}
.sort-btn.num { flex-direction: row-reverse; }
.sort-btn:hover, .sort-btn.active { color: var(--text); }
.sort-ico { width: 13px; height: 13px; opacity: .35; transition: opacity var(--dur), transform var(--dur) var(--ease-out); }
.sort-btn:hover .sort-ico { opacity: .7; }
.sort-btn.active .sort-ico { opacity: 1; color: var(--primary); }
</style>
