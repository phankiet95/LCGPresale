<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Change password · LCG Opportunity' })

const MIN = 10
const user = useCurrentUser()
const current = ref('')
const next = ref('')
const confirm = ref('')
const error = ref('')
const busy = ref(false)
const forced = computed(() => user.value?.mustChangePassword)

async function submit() {
  error.value = ''
  if (next.value.length < MIN) return (error.value = `New password must be at least ${MIN} characters`)
  if (next.value !== confirm.value) return (error.value = 'The two new passwords do not match')
  busy.value = true
  try {
    await $fetch('/api/auth/change-password', { method: 'POST', body: { currentPassword: current.value, newPassword: next.value } })
    await refreshCurrentUser()
    await navigateTo('/')
  }
  catch (e) {
    error.value = errMsg(e)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="stack" @submit.prevent="submit">
    <div>
      <h1 style="font-size: 20px">{{ forced ? 'Set your password' : 'Change password' }}</h1>
      <p v-if="forced" class="muted" style="margin: 6px 0 0; font-size: 13px">
        You are using a temporary password from your Admin. Choose your own to continue.
      </p>
    </div>
    <label class="field">{{ forced ? 'Temporary password' : 'Current password' }}
      <input v-model="current" class="input" type="password" autocomplete="current-password" required>
    </label>
    <label class="field">New password <span class="hint">At least {{ MIN }} characters</span>
      <input v-model="next" class="input" type="password" autocomplete="new-password" required :minlength="MIN">
    </label>
    <label class="field">Repeat new password
      <input v-model="confirm" class="input" type="password" autocomplete="new-password" required>
    </label>
    <p v-if="error" class="error-text" role="alert" style="margin: 0">{{ error }}</p>
    <div class="row">
      <NuxtLink v-if="!forced" to="/" class="btn">Cancel</NuxtLink>
      <button type="button" class="btn btn-ghost" @click="logout()">Log out</button>
      <span class="spacer" />
      <button class="btn btn-primary" :disabled="busy">{{ busy ? 'Saving…' : 'Save password' }}</button>
    </div>
  </form>
</template>
