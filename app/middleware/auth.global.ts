const PUBLIC = new Set(['/login'])

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useCurrentUser()
  if (user.value === undefined) await refreshCurrentUser().catch(() => (user.value = null))

  if (!user.value) {
    return PUBLIC.has(to.path) ? undefined : navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} })
  }
  if (user.value.mustChangePassword) {
    return to.path === '/change-password' ? undefined : navigateTo('/change-password')
  }
  if (PUBLIC.has(to.path)) return navigateTo('/')
  if (to.path.startsWith('/admin') && user.value.role !== 'admin') return navigateTo('/')
})
