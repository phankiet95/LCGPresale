<script setup lang="ts">
/**
 * Vertical column chart (single series or stacked). Plain HTML: thin recessive grid, value label on top,
 * one hue for a single series, the stage ramp for stacks, hover tooltip with the breakdown.
 */
export interface Col { key: string, label: string, value?: number, segments?: { key: string, value: number }[], dim?: boolean, to?: string | Record<string, unknown>, sub?: string }
const Link = resolveComponent('NuxtLink')
const props = withDefaults(defineProps<{
  items: Col[]
  colors?: Record<string, string>
  segLabels?: Record<string, string>
  format?: (n: number) => string
  height?: number
  color?: string
  /** small card: fewer grid lines, smaller labels, short x labels */
  compact?: boolean
}>(), { colors: () => ({}), segLabels: () => ({}), format: (n: number) => fmtUsd(n), height: 220, color: 'var(--primary)' })

const totals = computed(() => props.items.map(i => i.value ?? (i.segments ?? []).reduce((a, s) => a + s.value, 0)))
/** "nice" axis: 4 steps */
const axis = computed(() => {
  const max = Math.max(0, ...totals.value)
  if (!max) return { top: 1, ticks: [0] }
  const raw = max / (props.compact ? 2 : 4)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)!
  const top = step * Math.ceil(max / step)
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step) }
})
const tilt = computed(() => !props.compact && (props.items.length > 7 || props.items.some(i => i.label.length > 10)))
/** compact: keep x labels short (full name in the tooltip) */
const xlabel = (s: string) => (props.compact && s.length > 9 ? `${s.slice(0, 8)}…` : s)
const tip = (i: Col, t: number) => {
  const lines = [`${i.label}: ${props.format(t)}${i.sub ? ` · ${i.sub}` : ''}`]
  for (const s of [...(i.segments ?? [])].reverse()) if (s.value) lines.push(`${props.segLabels[s.key] ?? s.key}: ${props.format(s.value)}`)
  return lines.join('\n')
}
</script>

<template>
  <div class="cc" :class="{ compact }" :style="{ '--h': `${height}px` }">
    <div class="plot">
      <div class="grid" aria-hidden="true">
        <div v-for="t in [...axis.ticks].reverse()" :key="t" class="gl"><span class="gv">{{ format(t) }}</span></div>
      </div>
      <div class="cols">
        <component
          :is="i.to ? Link : 'div'" v-for="(i, k) in items" :key="i.key" :to="i.to" class="col" :class="{ dim: i.dim }"
          v-tip="tip(i, totals[k]!)"
        >
          <span class="cv">{{ totals[k] ? format(totals[k]!) : '0' }}</span>
          <span class="stack" :style="{ height: `${totals[k]! / axis.top * 100}%` }">
            <template v-if="i.segments">
              <span v-for="s in i.segments" :key="s.key" class="seg" :style="{ flex: `${s.value} 1 0`, background: colors[s.key] ?? color }" />
            </template>
            <span v-else class="seg" :style="{ flex: '1 1 0', background: color }" />
          </span>
        </component>
      </div>
    </div>
    <div class="xl" :class="{ tilt }">
      <span v-for="i in items" :key="i.key" class="xlab" :class="{ dim: i.dim }"><slot name="label" :item="i">{{ xlabel(i.label) }}</slot></span>
    </div>
  </div>
</template>

<style scoped>
.cc { display: flex; flex-direction: column; gap: 6px; padding-left: 44px; }
.plot { position: relative; height: var(--h); }
.grid { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; }
.gl { position: relative; border-top: 1px solid var(--row-border); height: 0; }
.gl:last-child { border-top-color: var(--border-strong); }
.gv { position: absolute; right: calc(100% + 8px); top: -8px; font-size: 11px; color: var(--muted); white-space: nowrap; }
.cols { position: absolute; inset: 0; display: flex; align-items: flex-end; gap: 10px; padding: 0 6px; }
.col { flex: 1 1 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-width: 0; text-decoration: none; color: inherit; }
.cv { font-size: 11.5px; font-weight: 600; color: var(--text-2); margin-bottom: 4px; white-space: nowrap; }
.stack { width: min(100%, 56px); display: flex; flex-direction: column-reverse; gap: 2px; border-radius: 4px 4px 0 0; overflow: hidden; transform-origin: bottom; animation: grow-y var(--dur-slow) var(--ease-out) backwards; transition: height var(--dur-slow) var(--ease-out); min-height: 0; }
.seg { display: block; min-height: 0; }
.col:hover .stack { filter: brightness(1.08); }
.col.dim .stack { opacity: .45; }
.xl { display: flex; gap: 10px; padding: 0 6px; }
.xlab { flex: 1 1 0; min-width: 0; text-align: center; font-size: 12px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xlab.dim { color: var(--faint); }
.xl.tilt { height: 64px; }
.compact { padding-left: 38px; gap: 4px; }
.compact .cols, .compact .xl { gap: 6px; padding: 0 2px; }
.compact .cv { font-size: 10.5px; margin-bottom: 2px; }
.compact .gv { font-size: 10px; }
.compact .xlab { font-size: 11px; }
.compact .stack { width: min(100%, 40px); }
.xl.tilt .xlab { transform: rotate(-35deg); transform-origin: top right; text-align: right; white-space: nowrap; overflow: visible; translate: -40% 4px; }
</style>
