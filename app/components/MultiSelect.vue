<script setup lang="ts">
import { Check, ChevronDown, Search, X } from 'lucide-vue-next'

/** Dropdown with checkboxes (multi-select filter). v-model = selected values; empty = All. */
const props = withDefaults(defineProps<{
  label: string
  options: { value: string, label?: string }[]
  modelValue: string[] | undefined
  searchable?: boolean
}>(), { searchable: undefined })
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const open = ref(false)
const q = ref('')
const root = ref<HTMLElement | null>(null)
const selected = computed(() => props.modelValue ?? [])
const canSearch = computed(() => props.searchable ?? props.options.length > 8)
const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  return s ? props.options.filter(o => (o.label ?? o.value).toLowerCase().includes(s)) : props.options
})
const summary = computed(() => {
  const n = selected.value.length
  if (!n) return 'All'
  if (n === 1) return props.options.find(o => o.value === selected.value[0])?.label ?? selected.value[0]
  return `${n} selected`
})

function toggle(v: string) {
  const s = new Set(selected.value)
  if (s.has(v)) s.delete(v)
  else s.add(v)
  emit('update:modelValue', props.options.map(o => o.value).filter(x => s.has(x)))
}
const clear = () => emit('update:modelValue', [])
function onDoc(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') open.value = false }
onMounted(() => { document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) })
watch(open, (v) => { if (!v) q.value = '' })
</script>

<template>
  <div ref="root" class="ms" :class="{ active: selected.length }">
    <button type="button" class="ms-btn" :aria-expanded="open" aria-haspopup="listbox" @click="open = !open">
      <span class="ms-label">{{ label }}:</span>
      <span class="ms-value">{{ summary }}</span>
      <span v-if="selected.length > 1" class="ms-count">{{ selected.length }}</span>
      <ChevronDown class="ico ms-chev" :class="{ up: open }" aria-hidden="true" />
    </button>
    <Transition name="pop">
      <div v-if="open" class="ms-pop" role="listbox" aria-multiselectable="true" :aria-label="label">
        <label v-if="canSearch" class="ms-search">
          <Search class="ico" aria-hidden="true" />
          <input v-model="q" type="search" :placeholder="`Search ${label.toLowerCase()}`" autofocus>
        </label>
        <div class="ms-list">
          <button
            v-for="o in shown" :key="o.value" type="button" role="option" class="ms-opt"
            :aria-selected="selected.includes(o.value)" @click="toggle(o.value)"
          >
            <span class="box"><Check v-if="selected.includes(o.value)" class="ico" aria-hidden="true" /></span>
            <span class="txt">{{ o.label ?? o.value }}</span>
          </button>
          <p v-if="!shown.length" class="muted small" style="margin: 6px 10px">No match</p>
        </div>
        <div class="ms-foot">
          <button type="button" class="link-btn" :disabled="!selected.length" @click="clear"><X class="ico" aria-hidden="true" />Clear</button>
          <button type="button" class="btn btn-sm" @click="open = false">Done</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ms { position: relative; }
.ms-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface); font-size: 13px; color: var(--text-2); cursor: pointer; max-width: 230px; }
.ms-btn:hover { border-color: var(--faint); }
.ms.active .ms-btn { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
.ms-label { color: var(--muted); }
.ms.active .ms-label { color: var(--primary); }
.ms-value { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ms-count { font-size: 11px; font-weight: 700; background: var(--primary); color: var(--on-primary); border-radius: 9px; padding: 0 6px; }
.ms-chev { width: 15px; height: 15px; transition: transform var(--dur) var(--ease-out); }
.ms-chev.up { transform: rotate(180deg); }
.ms-pop { position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; min-width: 240px; max-width: 320px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-pop); padding: 6px; }
.ms-search { display: flex; align-items: center; gap: 6px; border: 1px solid var(--border-strong); border-radius: 8px; padding: 0 8px; height: 34px; margin-bottom: 6px; color: var(--muted); }
.ms-search .ico { width: 15px; height: 15px; }
.ms-search input { border: 0; outline: none; background: transparent; width: 100%; font-size: 13px; color: var(--text); }
.ms-list { max-height: 260px; overflow: auto; display: flex; flex-direction: column; }
.ms-opt { display: flex; align-items: center; gap: 10px; padding: 7px 8px; border: 0; background: transparent; border-radius: 8px; text-align: left; font-size: 13px; color: var(--text); cursor: pointer; }
.ms-opt:hover { background: var(--surface-2); }
.box { width: 18px; height: 18px; flex: none; border-radius: 5px; border: 1.5px solid var(--border-strong); display: inline-flex; align-items: center; justify-content: center; transition: background-color var(--dur), border-color var(--dur); }
.box .ico { width: 13px; height: 13px; stroke-width: 3; }
.ms-opt[aria-selected="true"] .box { background: var(--primary); border-color: var(--primary); color: var(--on-primary); }
.txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ms-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--row-border); margin-top: 6px; padding: 6px 4px 2px; }
.ms-foot .link-btn { display: inline-flex; align-items: center; gap: 4px; }
.ms-foot .link-btn:disabled { color: var(--faint); cursor: default; }
.ms-foot .ico { width: 14px; height: 14px; }
.pop-enter-active, .pop-leave-active { transition: opacity 160ms, transform 160ms var(--ease-out); }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }
</style>
