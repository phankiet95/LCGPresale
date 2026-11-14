import type { Directive } from 'vue'

/**
 * v-tip: hover tooltip with the full content.
 *   <div v-tip class="clamp">{{ long text }}</div>    -> shown only when the text is cut off (ellipsis / line clamp)
 *   <span v-tip="'Explain this'">…</span>               -> always shown, with that text
 */
let box: HTMLDivElement | null = null
let timer: ReturnType<typeof setTimeout> | undefined

function ensureBox() {
  if (box) return box
  box = document.createElement('div')
  box.className = 'app-tip'
  box.setAttribute('role', 'tooltip')
  document.body.appendChild(box)
  return box
}
const isCut = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1

function show(el: HTMLElement) {
  const forced = (el as HTMLElement & { _tip?: string })._tip
  const text = (forced || el.innerText || '').trim()
  if (!text || (!forced && !isCut(el))) return
  const b = ensureBox()
  b.textContent = text
  b.classList.add('on')
  const r = el.getBoundingClientRect()
  const bw = Math.min(420, window.innerWidth - 24)
  b.style.maxWidth = `${bw}px`
  const left = Math.max(12, Math.min(r.left, window.innerWidth - b.offsetWidth - 12))
  const below = r.bottom + 8 + b.offsetHeight < window.innerHeight
  b.style.left = `${left}px`
  b.style.top = `${below ? r.bottom + 8 : r.top - b.offsetHeight - 8}px`
}
function hide() {
  clearTimeout(timer)
  box?.classList.remove('on')
}

const tip: Directive<HTMLElement & { _tip?: string }, string | undefined> = {
  mounted(el, binding) {
    el._tip = binding.value
    el.addEventListener('mouseenter', () => {
      clearTimeout(timer)
      timer = setTimeout(() => show(el), 250)
    })
    el.addEventListener('mouseleave', hide)
    el.addEventListener('mousedown', hide)
  },
  updated(el, binding) { el._tip = binding.value },
  beforeUnmount: hide,
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('tip', tip)
  window.addEventListener('scroll', hide, true)
})
