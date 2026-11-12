<script setup lang="ts">
import { LogIn } from 'lucide-vue-next'
definePageMeta({ layout: 'auth' })
useHead({ title: 'Log in · LCG Opportunity' })

const route = useRoute()
const account = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const res = await $fetch<{ mustChangePassword: boolean }>('/api/auth/login', {
      method: 'POST', body: { account: account.value, password: password.value },
    })
    await refreshCurrentUser()
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
    await navigateTo(res.mustChangePassword ? '/change-password' : redirect)
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
    <PageTitle :icon="LogIn" title="Log in" size="md" style="font-size: 20px" />
    <label class="field">Account
      <input v-model="account" class="input" autocomplete="username" required autofocus placeholder="e.g. SonTV16 or sontv16@fpt.com">
    </label>
    <label class="field">Password
      <input v-model="password" class="input" type="password" autocomplete="current-password" required>
    </label>
    <p v-if="error" class="error-text" role="alert" style="margin: 0">{{ error }}</p>
    <button class="btn btn-primary" :disabled="busy" style="height: 44px">{{ busy ? 'Logging in…' : 'Log in' }}</button>
    <p class="muted small" style="margin: 0">No account or forgot your password? Ask your Admin (BD Ops) to generate one.</p>
  </form>
</template>
