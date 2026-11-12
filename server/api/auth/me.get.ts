// Current user (fresh from DB) or null. Public so the login page can call it.
export default defineEventHandler(event => getCurrentUser(event))
