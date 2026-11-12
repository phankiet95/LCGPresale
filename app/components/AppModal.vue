<script setup lang="ts">
const props = withDefaults(defineProps<{ title: string, width?: string, drawer?: boolean }>(), { width: '520px', drawer: false })
const emit = defineEmits<{ close: [] }>()
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" :class="{ drawer: props.drawer }" @mousedown.self="emit('close')">
      <div class="panel" role="dialog" aria-modal="true" :aria-label="title" :style="{ width: props.width }">
        <div class="head">
          <div class="title-slot">
            <slot name="title"><h2>{{ title }}</h2></slot>
          </div>
          <button type="button" class="x" aria-label="Close" @click="emit('close')">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div class="body"><slot /></div>
        <div v-if="$slots.footer" class="foot"><slot name="footer" /></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: var(--backdrop); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; animation: fade-in var(--dur) var(--ease-out); }
.panel { max-width: 100%; max-height: calc(100vh - 32px); background: var(--surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-pop); display: flex; flex-direction: column; animation: pop-in 260ms var(--ease-out); }
.drawer { justify-content: flex-end; padding: 0; }
.drawer .panel { height: 100vh; max-height: 100vh; border-radius: 0; border-left: 1px solid var(--border); animation: slide-in-right 280ms var(--ease-out); }
.head { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.title-slot { min-width: 0; }
.x { display: inline-flex; width: 36px; height: 36px; flex: none; align-items: center; justify-content: center; border-radius: 8px; color: var(--text-2); border: 1px solid var(--border); background: var(--surface); cursor: pointer; }
.body { flex: 1 1 auto; padding: 20px 24px; overflow: auto; display: flex; flex-direction: column; gap: 16px; }
.foot { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
</style>
