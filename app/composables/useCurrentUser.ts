import type { SessionUserInfo } from '#shared/types'

/** undefined = not loaded yet, null = logged out */
export const useCurrentUser = () => useState<SessionUserInfo | null | undefined>('current-user', () => undefined)

export async function refreshCurrentUser() {
  const user = useCurrentUser()
  user.value = await $fetch<SessionUserInfo | null>('/api/auth/me')
  return user.value
}

export async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  useCurrentUser().value = null
  clearNuxtData()
  await navigateTo('/login')
}
