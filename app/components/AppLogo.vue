<script setup lang="ts">
/**
 * The LCG mark (vector redraw of the red logo): L bracket, C bracket and the "G" pixel blocks,
 * drawn on a square grid and slanted. Each piece is its own shape so it can be animated.
 *   mode: 'static' | 'intro' (pieces fly in, light sweep) | 'idle' (pixels breathe — while loading)
 * Same geometry as public/favicon.svg and app/spa-loading-template.html.
 */
withDefaults(defineProps<{ size?: number, mode?: 'static' | 'intro' | 'idle', color?: string }>(), { size: 32, mode: 'static', color: '#E8202A' })
const uid = useId()
</script>

<template>
  <svg class="lcg" :class="mode" :width="size" :height="size" viewBox="0 0 100 100" role="img" aria-label="LCG">
    <defs>
      <linearGradient :id="`sw-${uid}`" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0" />
        <stop offset=".5" stop-color="#fff" stop-opacity=".85" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <mask :id="`mk-${uid}`" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <g fill="#fff" transform="translate(24 38) rotate(-4) skewY(-36) scale(.64)">
          <path d="M6 16 H18 V82 H82 V94 H6 Z" /><path d="M26 30 H58 V41 H37 V63 H58 V74 H26 Z" />
          <rect x="44" y="48" width="9" height="9" /><rect x="62" y="30" width="11" height="11" /><rect x="62" y="52" width="11" height="22" />
          <rect x="66" y="10" width="11" height="11" /><rect x="82" y="22" width="11" height="11" />
        </g>
      </mask>
    </defs>
    <g :fill="color" transform="translate(24 38) rotate(-4) skewY(-36) scale(.64)">
      <path class="p p1" d="M6 16 H18 V82 H82 V94 H6 Z" />
      <path class="p p2" d="M26 30 H58 V41 H37 V63 H58 V74 H26 Z" />
      <rect class="p p3 px" x="44" y="48" width="9" height="9" />
      <rect class="p p4 px" x="62" y="30" width="11" height="11" />
      <rect class="p p5 px" x="62" y="52" width="11" height="22" />
      <rect class="p p6 px" x="66" y="10" width="11" height="11" />
      <rect class="p p7 px" x="82" y="22" width="11" height="11" />
    </g>
    <g v-if="mode !== 'static'" :mask="`url(#mk-${uid})`">
      <rect class="sweep" x="-60" y="0" width="40" height="100" :fill="`url(#sw-${uid})`" />
    </g>
  </svg>
</template>

<style scoped>
.lcg { display: block; overflow: visible; }
.p { transform-box: fill-box; transform-origin: center; }

/* intro: every piece flies in from its own direction with a little overshoot, then a light sweep */
.intro .p { animation: lcg-in 820ms cubic-bezier(.34, 1.5, .64, 1) backwards; }
.intro .p1 { --dx: -46px; --dy: 30px; --r: -14deg; animation-delay: 0ms; }
.intro .p2 { --dx: -30px; --dy: -34px; --r: 12deg; animation-delay: 110ms; }
.intro .p3 { --dx: 0px; --dy: 0px; --r: 90deg; animation-delay: 260ms; }
.intro .p4 { --dx: 40px; --dy: -10px; --r: -90deg; animation-delay: 330ms; }
.intro .p5 { --dx: 46px; --dy: 30px; --r: 45deg; animation-delay: 390ms; }
.intro .p6 { --dx: 10px; --dy: -50px; --r: 180deg; animation-delay: 450ms; }
.intro .p7 { --dx: 50px; --dy: -40px; --r: -180deg; animation-delay: 510ms; }
@keyframes lcg-in {
  from { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--r)) scale(.2); }
  60% { opacity: 1; }
  to { opacity: 1; transform: none; }
}
.intro .sweep { animation: lcg-sweep 900ms cubic-bezier(.4, 0, .2, 1) 1050ms both; }
@keyframes lcg-sweep { from { transform: translateX(0); } to { transform: translateX(200px); } }

/* idle: the G pixels light up one after another, like data loading; the sweep keeps passing */
.idle .px { animation: lcg-blink 1.6s ease-in-out infinite; }
.idle .p4 { animation-delay: .15s; }
.idle .p5 { animation-delay: .3s; }
.idle .p6 { animation-delay: .45s; }
.idle .p7 { animation-delay: .6s; }
@keyframes lcg-blink { 0%, 100% { opacity: 1; transform: none; } 40% { opacity: .35; transform: scale(.82); } }
.idle .sweep { animation: lcg-sweep 1.8s cubic-bezier(.4, 0, .2, 1) infinite; }

@media (prefers-reduced-motion: reduce) { .p, .sweep { animation: none !important; } }
</style>
