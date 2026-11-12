export type Theme = 'light' | 'dark'
const KEY = 'lcg.theme'

/**
 * Light / Dark toggle, remembered per browser. With nothing saved yet, the first value follows the OS.
 * The same logic runs inline in <head> (nuxt.config) so the page never flashes the wrong theme.
 */
export function useTheme() {
  const theme = useState<Theme>('theme', () => {
    if (import.meta.server) return 'light'
    const t = document.documentElement.dataset.theme
    return t === 'dark' ? 'dark' : 'light'
  })

  function set(t: Theme) {
    theme.value = t
    document.documentElement.dataset.theme = t
    try {
      localStorage.setItem(KEY, t)
    }
    catch { /* storage unavailable: still applies for this visit */ }
  }

  const toggle = () => set(theme.value === 'dark' ? 'light' : 'dark')

  return { theme, set, toggle }
}
