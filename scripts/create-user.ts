/**
 * Create (or reset) a user with a generated password — used to bootstrap the first Admin,
 * because the Admin screen needs someone logged in as admin.
 *
 *   node scripts/create-user.ts <account> [--role admin] [--name "Display Name"] [--email x@fpt.com] [--remote]
 *
 * Runs `wrangler d1 execute` against the local DB (default) or the real D1 (--remote).
 * If the account exists it is re-activated, its role updated and its password reset.
 * The password is printed once; the user must change it at first login.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { generateTempPassword, hashUserPassword } from '../server/utils/password.ts'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const account = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'))
if (!account) {
  console.error('Usage: node scripts/create-user.ts <account> [--role admin] [--name "Display Name"] [--email x@fpt.com] [--remote]')
  process.exit(1)
}
const role = flag('role') ?? 'admin'
if (!['admin', 'management', 'market_lead', 'sales', 'viewer'].includes(role)) {
  console.error(`Unknown role "${role}"`)
  process.exit(1)
}
const remote = args.includes('--remote')
const name = flag('name') ?? account
const email = flag('email') ?? null

const q = (v: string | null) => (v === null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)
const password = generateTempPassword()
const hash = await hashUserPassword(password)
const now = new Date().toISOString()

const sql = `
INSERT INTO users (account, email, display_name, role, is_active, password_hash, must_change_password, created_at, updated_at)
VALUES (${q(account)}, ${q(email)}, ${q(name)}, ${q(role)}, 1, ${q(hash)}, 1, ${q(now)}, ${q(now)})
ON CONFLICT DO UPDATE SET role = excluded.role, is_active = 1, password_hash = excluded.password_hash,
  must_change_password = 1, updated_at = excluded.updated_at;
`
const file = path.join(os.tmpdir(), `lcg-create-user-${Date.now()}.sql`)
fs.writeFileSync(file, sql)
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', remote ? '--remote' : '--local', `--file="${file}"`],
    { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' })
} finally {
  fs.rmSync(file, { force: true })
}
console.log(`\nUser "${account}" (${role}) is ready on the ${remote ? 'REMOTE' : 'local'} database.`)
console.log(`Temporary password: ${password}`)
console.log('It is shown only once. The user must change it at first login.\n')
