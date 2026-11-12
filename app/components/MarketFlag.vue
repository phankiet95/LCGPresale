<script setup lang="ts">
/**
 * Market marker. Country markets get their flag (inline SVG: Windows has no flag emoji);
 * regional markets (Americas, Asia Pacific, Middle East) get a globe turned to that region.
 */
const props = withDefaults(defineProps<{ code: string, label?: boolean, size?: number }>(), { label: false, size: 20 })
const NAMES: Record<string, string> = {
  JP: 'Japan', KR: 'Korea', EU: 'Europe', AM: 'Americas', VN: 'Vietnam', AP: 'Asia Pacific', ME: 'Middle East',
}
const h = computed(() => Math.round(props.size * 0.7))
// 12 stars of the EU flag
const euStars = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2
  return { x: 15 + Math.sin(a) * 6, y: 10.5 - Math.cos(a) * 6 }
})
</script>

<template>
  <span class="mkt" :title="NAMES[code] ?? code">
    <svg class="flag" :width="size" :height="h" viewBox="0 0 30 21" aria-hidden="true">
      <template v-if="code === 'JP'">
        <rect width="30" height="21" fill="#fff" />
        <circle cx="15" cy="10.5" r="6.3" fill="#BC002D" />
      </template>
      <template v-else-if="code === 'KR'">
        <rect width="30" height="21" fill="#fff" />
        <path d="M9.5 10.5a5.5 5.5 0 0 1 11 0a2.75 2.75 0 0 1-5.5 0a2.75 2.75 0 0 0-5.5 0z" fill="#CD2E3A" />
        <path d="M9.5 10.5a5.5 5.5 0 0 0 11 0a2.75 2.75 0 0 1-5.5 0a2.75 2.75 0 0 0-5.5 0z" fill="#0047A0" />
        <g stroke="#000" stroke-width="1.1">
          <path d="M3.6 6.2l2.6-3.4M4.6 7l2.6-3.4M5.6 7.8l2.6-3.4" />
          <path d="M21.8 13.2l2.6 3.4M22.8 12.4l2.6 3.4M23.8 11.6l2.6 3.4" />
          <path d="M21.8 7.8l2.6-3.4M22.8 8.6l2.6-3.4M23.8 9.4l2.6-3.4" />
          <path d="M3.6 14.8l2.6 3.4M4.6 14l2.6 3.4M5.6 13.2l2.6 3.4" />
        </g>
      </template>
      <template v-else-if="code === 'EU'">
        <rect width="30" height="21" fill="#003399" />
        <circle v-for="(s, i) in euStars" :key="i" :cx="s.x" :cy="s.y" r="0.95" fill="#FFCC00" />
      </template>
      <template v-else-if="code === 'VN'">
        <rect width="30" height="21" fill="#DA251D" />
        <path d="M15 4.2l1.55 4.75h5l-4.05 2.95 1.55 4.75L15 13.7l-4.05 2.95 1.55-4.75-4.05-2.95h5z" fill="#FFFF00" />
      </template>
      <template v-else>
        <!-- regional market: globe on a soft tile, continent hint by colour -->
        <rect width="30" height="21" :fill="code === 'AM' ? '#E6F0FF' : code === 'AP' ? '#E7F7EF' : code === 'ME' ? '#FFF3E0' : '#EEF1F5'" />
        <circle cx="15" cy="10.5" r="7" fill="none" :stroke="code === 'AM' ? '#1E4FC2' : code === 'AP' ? '#14663A' : code === 'ME' ? '#B45309' : '#5B6472'" stroke-width="1.4" />
        <path d="M8 10.5h14M15 3.5c-2.4 2-2.4 12 0 14M15 3.5c2.4 2 2.4 12 0 14" fill="none" :stroke="code === 'AM' ? '#1E4FC2' : code === 'AP' ? '#14663A' : code === 'ME' ? '#B45309' : '#5B6472'" stroke-width="1.1" />
      </template>
    </svg>
    <span v-if="label" class="mkt-code">{{ code }}</span>
  </span>
</template>

<style scoped>
.mkt { display: inline-flex; align-items: center; gap: 6px; vertical-align: middle; }
.flag { border-radius: 3px; flex: none; box-shadow: 0 0 0 1px rgba(17, 24, 39, .14); display: block; }
.mkt-code { font-weight: 700; }
</style>
