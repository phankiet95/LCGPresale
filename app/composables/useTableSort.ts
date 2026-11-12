import type { MaybeRefOrGetter } from 'vue'

export type SortDir = 1 | -1
export interface TableSort<T> {
  key: Ref<string | null>
  dir: Ref<SortDir>
  rows: ComputedRef<T[]>
  by: (key: string) => void
}

/**
 * Click-to-sort for any table. Values come from `get[key]` or the row property of that name.
 * Empty values (null / undefined / '') always go last. Keys in `descFirst` start descending (amounts, counts).
 */
export function useTableSort<T>(
  source: MaybeRefOrGetter<T[] | null | undefined>,
  opts: { key?: string, dir?: SortDir, get?: Record<string, (row: T) => unknown>, descFirst?: string[] } = {},
): TableSort<T> {
  const key = ref<string | null>(opts.key ?? null)
  const dir = ref<SortDir>(opts.dir ?? 1)
  const value = (row: T, k: string) => (opts.get?.[k] ? opts.get[k]!(row) : (row as Record<string, unknown>)[k])

  const rows = computed(() => {
    const list = [...(toValue(source) ?? [])]
    const k = key.value
    if (!k) return list
    return list.sort((a, b) => {
      const av = value(a, k)
      const bv = value(b, k)
      const ae = av === null || av === undefined || av === ''
      const be = bv === null || bv === undefined || bv === ''
      if (ae || be) return ae === be ? 0 : ae ? 1 : -1
      const c = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
      return c * dir.value
    })
  })

  function by(k: string) {
    if (key.value === k) dir.value = dir.value === 1 ? -1 : 1
    else {
      key.value = k
      dir.value = opts.descFirst?.includes(k) ? -1 : 1
    }
  }

  return { key, dir, rows, by }
}
