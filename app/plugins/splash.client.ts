/** Tells the splash when the page behind it is ready, and drives the small loader for slow navigations. */
export default defineNuxtPlugin((nuxtApp) => {
  const { state } = useSplash()
  const ready = () => { state.value.ready = true }
  nuxtApp.hook('app:suspense:resolve', ready)
  nuxtApp.hook('page:finish', ready)

  let t: ReturnType<typeof setTimeout> | undefined
  nuxtApp.hook('page:loading:start', () => {
    clearTimeout(t)
    t = setTimeout(() => { if (!state.value.open) state.value.mini = true }, 450)
  })
  nuxtApp.hook('page:loading:end', () => {
    clearTimeout(t)
    state.value.mini = false
  })
})
