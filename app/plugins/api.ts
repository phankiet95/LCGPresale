/**
 * $api: $fetch that sends the user to /login on 401 and to /change-password
 * when the server says the temporary password must be changed first.
 */
export default defineNuxtPlugin(() => {
  const api = $fetch.create({
    async onResponseError({ response }) {
      if (response.status === 401) {
        useCurrentUser().value = null
        await navigateTo({ path: '/login', query: { redirect: useRoute().fullPath } })
      }
      else if (response.status === 403 && response._data?.statusMessage === 'PASSWORD_CHANGE_REQUIRED') {
        await navigateTo('/change-password')
      }
    },
  })
  return { provide: { api } }
})
