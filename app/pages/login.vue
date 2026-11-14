<script setup lang="ts">
import { ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-vue-next'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Log in · LCG Opportunity' })

const route = useRoute()
const account = ref('')
const password = ref('')
const showPw = ref(false)
const error = ref('')
const busy = ref(false)
const shake = ref(0) // bump to replay the shake animation on each failed attempt

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const res = await $fetch<{ mustChangePassword: boolean }>('/api/auth/login', {
      method: 'POST', body: { account: account.value, password: password.value },
    })
    await refreshCurrentUser()
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
    // play the LCG splash while the next page loads, then reveal it
    if (!res.mustChangePassword) useSplash().show('Loading your pipeline…')
    await navigateTo(res.mustChangePassword ? '/change-password' : redirect)
  }
  catch (e) {
    error.value = errMsg(e)
    shake.value++
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <form :key="shake" class="login" :class="{ shake: shake > 0 }" novalidate @submit.prevent="submit">
    <div class="head">
      <h1>Welcome back</h1>
      <p class="muted">Sign in to your LCG pipeline.</p>
    </div>

    <label class="fld">
      <span class="lbl">Account</span>
      <span class="ctl">
        <UserRound class="ico lead" aria-hidden="true" />
        <input v-model="account" class="input" autocomplete="username" required autofocus :aria-invalid="!!error">
      </span>
    </label>

    <label class="fld">
      <span class="lbl">Password</span>
      <span class="ctl">
        <LockKeyhole class="ico lead" aria-hidden="true" />
        <input v-model="password" class="input" :type="showPw ? 'text' : 'password'" autocomplete="current-password" required :aria-invalid="!!error">
        <button type="button" class="eye" :aria-label="showPw ? 'Hide password' : 'Show password'" :aria-pressed="showPw" @click="showPw = !showPw">
          <component :is="showPw ? EyeOff : Eye" class="ico" aria-hidden="true" />
        </button>
      </span>
    </label>

    <Transition name="err">
      <p v-if="error" class="err" role="alert"><CircleAlert class="ico" aria-hidden="true" />{{ error }}</p>
    </Transition>

    <button class="btn btn-primary submit" :disabled="busy || !account || !password">
      <LoaderCircle v-if="busy" class="ico spinner" aria-hidden="true" />
      <span>{{ busy ? 'Signing in…' : 'Sign in' }}</span>
      <ArrowRight v-if="!busy" class="ico arrow" aria-hidden="true" />
    </button>

    <p class="muted small help">No account or forgot your password? Ask your Admin (BD Ops) to generate one.</p>
  </form>
</template>

<style scoped>
.login { display: flex; flex-direction: column; gap: 18px; }
.login > * { animation: fade-up 520ms var(--ease-out) backwards; }
.login > *:nth-child(2) { animation-delay: 80ms; }
.login > *:nth-child(3) { animation-delay: 140ms; }
.login > *:nth-child(4) { animation-delay: 200ms; }
.login > *:nth-child(5) { animation-delay: 260ms; }
.login > *:nth-child(6) { animation-delay: 320ms; }
.login.shake { animation: shake 420ms cubic-bezier(.36, .07, .19, .97); }
.login.shake > * { animation: none; }
@keyframes shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(3px); }
  30%, 50%, 70% { transform: translateX(-6px); }
  40%, 60% { transform: translateX(6px); }
}

.head h1 { font-size: 24px; }
.head p { margin: 6px 0 0; font-size: 14px; }

.fld { display: flex; flex-direction: column; gap: 6px; }
.lbl { font-size: 13px; font-weight: 600; color: var(--text-2); }
.ctl { position: relative; display: block; }
.ctl .input { height: 46px; padding-left: 42px; border-radius: 10px; background: var(--surface-2); }
.ctl .input:focus { background: var(--surface); outline: 3px solid var(--primary-tint); border-color: var(--primary); }
.ctl .input[aria-invalid="true"] { border-color: var(--danger); }
.lead { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--faint); pointer-events: none; transition: color var(--dur); }
.ctl:focus-within .lead { color: var(--primary); }
.ctl input[type="password"], .ctl input[type="text"]:has(+ .eye) { padding-right: 44px; }
.eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.eye:hover { background: var(--chip); color: var(--text); }

.err { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 13px; background: var(--danger-soft); border: 1px solid var(--danger-border); color: var(--alert-danger-fg); }
.err .ico { width: 17px; height: 17px; margin-top: 1px; color: var(--danger); }
.err-enter-active { transition: opacity 220ms, transform 220ms var(--ease-out); }
.err-enter-from { opacity: 0; transform: translateY(-4px); }

.submit { height: 48px; border-radius: 10px; font-size: 15px; gap: 8px; position: relative; overflow: hidden; box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--primary) 70%, transparent); }
.submit::after { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.28) 50%, transparent 70%); transform: translateX(-100%); }
.submit:hover:not(:disabled)::after { transform: translateX(100%); transition: transform 700ms var(--ease-out); }
.submit .arrow { transition: transform var(--dur) var(--ease-out); }
.submit:hover:not(:disabled) .arrow { transform: translateX(3px); }
.spinner { animation: spin 800ms linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.help { margin: 0; text-align: center; line-height: 1.5; }
</style>
