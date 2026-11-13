import type { OppFilter } from '#shared/types'
import { parseFilterQuery, toFilterQuery } from '#shared/filters'

const STORAGE_KEY = 'lcg.filters'
const FILTER_KEYS = ['market', 'partner', 'owner', 'stage', 'dealType', 'health', 'q', 'dateBy', 'dateFrom', 'dateTo', 'closeFrom', 'closeTo']

/**
 * Global filter (SRS 5.10): lives in the URL so links share the same view,
 * and the last choice is remembered per browser user.
 */
export function useOppFilters() {
  const route = useRoute()
  const router = useRouter()
  const filter = computed<OppFilter>(() => parseFilterQuery(route.query))
  const queryForApi = computed(() => toFilterQuery(filter.value))

  function set(patch: Partial<OppFilter>) {
    const next = { ...filter.value, ...patch }
    const keep = Object.fromEntries(Object.entries(route.query).filter(([k]) => !FILTER_KEYS.includes(k)))
    const q = toFilterQuery(next)
    try {
      localStorage.setItem(`${STORAGE_KEY}.${useCurrentUser().value?.id}`, JSON.stringify(q))
    }
    catch { /* storage unavailable */ }
    return router.replace({ query: { ...keep, ...q } })
  }

  function toggleMarket(code: string | 'All') {
    if (code === 'All') return set({ market: [] })
    const cur = filter.value.market ?? []
    return set({ market: cur.includes(code) ? cur.filter(m => m !== code) : [...cur, code] })
  }

  /** On first visit without filters in the URL, restore the user's last selection. */
  function restore() {
    if (FILTER_KEYS.some(k => k in route.query)) return
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}.${useCurrentUser().value?.id}`)
      if (saved) router.replace({ query: { ...route.query, ...JSON.parse(saved) } })
    }
    catch { /* ignore */ }
  }

  return { filter, queryForApi, set, toggleMarket, restore }
}
