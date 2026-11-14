/**
 * Splash / loading screen state.
 *  - open:   the full-screen LCG splash (first load, and after logging in)
 *  - ready:  the page behind it has finished loading
 *  - mini:   a small floating loader for slow page changes
 *  - since:  performance.now() when the splash opened (so the intro animation can finish)
 */
export interface SplashState { open: boolean, ready: boolean, mini: boolean, since: number, mode: 'intro' | 'idle', label: string }

export function useSplash() {
  const state = useState<SplashState>('splash', () => ({ open: true, ready: false, mini: false, since: 0, mode: 'idle', label: '' }))
  /** Show the splash with the intro animation (e.g. right after a successful login). */
  function show(label = '') {
    state.value = { ...state.value, open: true, ready: false, since: performance.now(), mode: 'intro', label }
  }
  return { state, show }
}
