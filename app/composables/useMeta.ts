import type { MetaResponse } from '#shared/types'

/** Master data (markets in scope, partners, users, lookups), loaded once per session. */
export function useMeta() {
  const { $api } = useNuxtApp()
  return useAsyncData('meta', () => $api<MetaResponse>('/api/meta'), {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
}
