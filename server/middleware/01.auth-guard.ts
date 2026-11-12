// Defence in depth: every /api route requires a logged-in, active user whose password
// is not a pending temporary one — except the few auth endpoints below.
const PUBLIC = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/me'])
const PASSWORD_CHANGE_ALLOWED = new Set(['/api/auth/change-password'])

export default defineEventHandler(async (event) => {
  const path = event.path.split('?')[0]!
  if (!path.startsWith('/api/') || path.startsWith('/api/_auth/') || PUBLIC.has(path)) return
  await requireUser(event, { allowPasswordChange: PASSWORD_CHANGE_ALLOWED.has(path) })
})
