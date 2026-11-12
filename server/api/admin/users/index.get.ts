export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')
  return listAdminUsers(useDb(event))
})
