<script setup lang="ts">
import { CircleAlert, CircleCheck, FilePlus2, FileSpreadsheet, MinusCircle, PencilLine, TriangleAlert, Upload } from 'lucide-vue-next'
import type { ImportResponse, ImportRow } from '#shared/excel-columns'

const emit = defineEmits<{ close: [], done: [] }>()
const { $api } = useNuxtApp()
const fileName = ref('')
const rows = ref<ImportRow[] | null>(null)
const preview = ref<ImportResponse | null>(null)
const result = ref<ImportResponse | null>(null)
const busy = ref(false)
const error = ref('')
const showSkipped = ref(false)

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = f.name
  error.value = ''
  preview.value = null
  result.value = null
  busy.value = true
  try {
    rows.value = await readOppsExcel(f)
    preview.value = await $api<ImportResponse>('/api/opportunities/import', { method: 'POST', body: { apply: false, rows: rows.value } })
  }
  catch (err) { error.value = err instanceof Error && !('data' in err) ? err.message : errMsg(err) }
  finally { busy.value = false }
}

async function applyImport() {
  if (!rows.value) return
  busy.value = true
  error.value = ''
  try {
    result.value = await $api<ImportResponse>('/api/opportunities/import', { method: 'POST', body: { apply: true, rows: rows.value } })
    emit('done')
  }
  catch (err) { error.value = errMsg(err) }
  finally { busy.value = false }
}

const shown = computed(() => {
  const r = (result.value ?? preview.value)?.rows ?? []
  return showSkipped.value ? r : r.filter(x => x.action !== 'skip')
})
const ICON = { update: PencilLine, create: FilePlus2, skip: MinusCircle, error: CircleAlert }
const toApply = computed(() => (preview.value ? preview.value.summary.update + preview.value.summary.create : 0))
</script>

<template>
  <AppModal title="Import from Excel" width="960px" @close="emit('close')">
    <div class="stack" style="gap: 14px">
      <p class="muted small" style="margin: 0">
        Use a file exported with <b>Export Excel</b>. Rows with an OPP code update that opportunity; rows without one create a new opportunity.
        You see every change first. Nothing is saved until you click <b>Apply</b>, and nothing is ever deleted.
      </p>
      <label class="drop" :class="{ busy }">
        <input type="file" accept=".xlsx" class="sr-only" :disabled="busy" @change="onFile">
        <FileSpreadsheet class="ico big" aria-hidden="true" />
        <span v-if="!fileName"><b>Choose an .xlsx file</b> exported from the Pipeline</span>
        <span v-else><b>{{ fileName }}</b> · click to choose another file</span>
      </label>
      <p v-if="error" class="error-text" style="margin: 0">{{ error }}</p>
      <div v-if="busy" class="row muted small"><span class="spinner" />{{ result ? 'Applying…' : preview ? 'Applying…' : 'Reading the file…' }}</div>

      <template v-if="preview">
        <div v-if="result" class="alert" :class="result.summary.error ? 'alert-warn' : 'alert-info'">
          <CircleCheck class="ico" aria-hidden="true" />
          Done: {{ result.rows.filter(r => r.done && r.action === 'update').length }} updated ·
          {{ result.rows.filter(r => r.done && r.action === 'create').length }} created ·
          {{ result.summary.error }} with errors (not saved).
        </div>
        <div class="row" style="gap: 8px">
          <span class="sum update"><PencilLine class="ico" aria-hidden="true" />{{ (result ?? preview).summary.update }} to update</span>
          <span class="sum create"><FilePlus2 class="ico" aria-hidden="true" />{{ (result ?? preview).summary.create }} new</span>
          <span class="sum skip"><MinusCircle class="ico" aria-hidden="true" />{{ (result ?? preview).summary.skip }} unchanged</span>
          <span class="sum error"><CircleAlert class="ico" aria-hidden="true" />{{ (result ?? preview).summary.error }} with errors</span>
          <span class="spacer" />
          <label class="check" style="min-height: 0"><input v-model="showSkipped" type="checkbox"> Show unchanged</label>
        </div>
        <div class="table-wrap" style="max-height: 46vh; overflow: auto">
          <table class="data">
            <thead><tr><th>Row</th><th>OPP code</th><th>Action</th><th>Changes</th><th>Notes</th></tr></thead>
            <tbody>
              <tr v-for="r in shown" :key="r.row" :class="{ 'row-red': r.action === 'error' }">
                <td class="muted">{{ r.row }}</td>
                <td style="white-space: nowrap; font-weight: 600">{{ r.oppCode ?? '(new)' }}</td>
                <td><span class="act" :class="r.action"><component :is="ICON[r.action]" class="ico" aria-hidden="true" />{{ r.action }}<template v-if="r.done"> ✓</template></span></td>
                <td><ul class="list"><li v-for="(c, i) in r.changes" :key="i">{{ c }}</li></ul></td>
                <td>
                  <ul class="list">
                    <li v-for="(e, i) in r.errors" :key="`e${i}`" class="e"><CircleAlert class="ico" aria-hidden="true" />{{ e }}</li>
                    <li v-for="(w, i) in r.warnings" :key="`w${i}`" class="w"><TriangleAlert class="ico" aria-hidden="true" />{{ w }}</li>
                  </ul>
                </td>
              </tr>
              <tr v-if="!shown.length"><td colspan="5"><div class="empty">No changes found in this file.</div></td></tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
    <template #footer>
      <button type="button" class="btn" @click="emit('close')">{{ result ? 'Close' : 'Cancel' }}</button>
      <button v-if="preview && !result" type="button" class="btn btn-primary" :disabled="busy || !toApply" @click="applyImport">
        <Upload class="ico" aria-hidden="true" />Apply {{ toApply }} change{{ toApply === 1 ? '' : 's' }}
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
.drop { display: flex; align-items: center; gap: 12px; padding: 18px; border: 2px dashed var(--border-strong); border-radius: 12px; cursor: pointer; background: var(--surface-2); color: var(--text-2); transition: border-color var(--dur), background-color var(--dur); }
.drop:hover { border-color: var(--primary); background: var(--primary-soft); }
.drop.busy { opacity: .6; cursor: progress; }
.big { width: 28px; height: 28px; color: var(--primary); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border-strong); border-top-color: var(--primary); animation: spin 800ms linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.sum { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 12px; background: var(--chip); }
.sum .ico, .act .ico, .list .ico { width: 15px; height: 15px; }
.sum.update, .act.update { background: var(--primary-soft); color: var(--primary); }
.sum.create, .act.create { background: var(--green-bg); color: var(--green-fg); }
.sum.error, .act.error { background: var(--red-bg); color: var(--red-fg); }
.act { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; border-radius: 10px; padding: 2px 8px; text-transform: capitalize; background: var(--chip); }
.list { margin: 0; padding: 0; list-style: none; font-size: 12px; display: flex; flex-direction: column; gap: 2px; }
.list .e { color: var(--danger); display: flex; gap: 4px; }
.list .w { color: var(--amber-fg); display: flex; gap: 4px; }
.alert { display: flex; align-items: center; gap: 8px; }
</style>
