<script setup lang="ts">
/** Horizontal stacked bars (one row per category, segments in a fixed key order), value at the end. */
export interface StackRow { key: string, label: string, total: number, segments: { key: string, value: number }[], sub?: string, to?: string | Record<string, unknown> }
const Link = resolveComponent('NuxtLink')
const props = withDefaults(defineProps<{
  rows: StackRow[]
  colors: Record<string, string>
  segLabels?: Record<string, string>
  format?: (n: number) => string
  compact?: boolean
}>(), { segLabels: () => ({}), format: (n: number) => fmtUsd(n) })
const max = computed(() => Math.max(1, ...props.rows.map(r => r.total)))
const tip = (r: StackRow) => [`${r.label}: ${props.format(r.total)}${r.sub ? ` · ${r.sub}` : ''}`,
  ...r.segments.filter(s => s.value).map(s => `${props.segLabels[s.key] ?? s.key}: ${props.format(s.value)}`)].join('\n')
</script>

<template>
  <div class="sb" :class="{ compact }">
    <component :is="r.to ? Link : 'div'" v-for="r in rows" :key="r.key" :to="r.to" v-tip="tip(r)" class="sb-row">
      <span class="sb-label"><slot name="label" :row="r">{{ r.label }}</slot></span>
      <span class="sb-track">
        <span class="bar-fill sb-fill" :style="{ width: `${r.total / max * 100}%` }">
          <span v-for="s in r.segments" v-show="s.value" :key="s.key" class="sb-seg" :style="{ flex: `${s.value} 1 0`, background: colors[s.key] }" />
        </span>
      </span>
      <span class="sb-val"><b>{{ format(r.total) }}</b><span v-if="r.sub" class="muted"> · {{ r.sub }}</span></span>
    </component>
  </div>
</template>

<style scoped>
.sb { display: flex; flex-direction: column; gap: 10px; }
.sb-row { display: grid; grid-template-columns: 74px 1fr minmax(96px, auto); gap: 10px; align-items: center; text-decoration: none; color: inherit; }
.sb-row:hover .sb-fill { filter: brightness(1.08); }
.sb-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }
.sb-track { height: 22px; background: var(--chip); border-radius: 5px; overflow: hidden; display: flex; }
.sb-fill { display: flex; gap: 2px; height: 100%; }
.sb-seg { display: block; height: 100%; min-width: 0; }
.sb-val { font-size: 12.5px; text-align: right; white-space: nowrap; }
.compact { gap: 6px; }
.compact .sb-row { grid-template-columns: 52px 1fr minmax(64px, auto); gap: 8px; }
.compact .sb-track { height: 14px; border-radius: 4px; }
.compact .sb-label { font-size: 12px; gap: 4px; }
.compact .sb-val { font-size: 11.5px; }
.compact .sb-val .muted { display: none; }
</style>
