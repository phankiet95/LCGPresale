<script setup lang="ts">
import { Trash2, TriangleAlert } from 'lucide-vue-next'
import type { OppItem } from '#shared/types'

const props = defineProps<{ opp: OppItem }>()
const emit = defineEmits<{ close: [], deleted: [code: string] }>()
const { $api } = useNuxtApp()
const reason = ref('')
const busy = ref(false)
const error = ref('')

async function confirmDelete() {
  busy.value = true
  error.value = ''
  try {
    await $api(`/api/opportunities/${props.opp.oppCode}`, { method: 'DELETE', body: { reason: reason.value } })
    emit('deleted', props.opp.oppCode)
  }
  catch (e) { error.value = errMsg(e) }
  finally { busy.value = false }
}
</script>

<template>
  <AppModal :title="`Delete ${opp.oppCode}?`" width="480px" @close="emit('close')">
    <div class="warn">
      <TriangleAlert class="ico" aria-hidden="true" />
      <div>
        <b>{{ opp.name }}</b> · {{ opp.customer }}<br>
        <span class="small">It will be removed from Pipeline, Dashboard and reports. Its history is kept for audit and the code is not reused.</span>
      </div>
    </div>
    <form id="del-form" @submit.prevent="confirmDelete">
      <label class="field">Reason <span class="req">*</span>
        <textarea v-model="reason" class="textarea" required maxlength="300" style="min-height: 72px" placeholder="e.g. Duplicate of OPP-2026-012, created by mistake" />
      </label>
    </form>
    <p v-if="error" class="error-text" style="margin: 0">{{ error }}</p>
    <template #footer>
      <button type="button" class="btn" @click="emit('close')">Cancel</button>
      <button type="submit" form="del-form" class="btn btn-danger" :disabled="busy || !reason.trim()">
        <Trash2 class="ico" aria-hidden="true" />{{ busy ? 'Deleting…' : 'Delete opportunity' }}
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.warn { display: flex; gap: 10px; padding: 12px; border-radius: 10px; background: var(--danger-soft); border: 1px solid var(--danger-border); color: var(--alert-danger-fg); font-size: 13px; }
.warn .ico { color: var(--danger); margin-top: 2px; }
</style>
