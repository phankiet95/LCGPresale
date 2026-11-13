import { eq } from 'drizzle-orm'
import { z } from 'zod'

/**
 * Delete an opportunity (soft delete: deleted_at is set, the row and its history stay for audit,
 * the OPP code is never reused). It disappears from every list, report and the next snapshots.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { db, row, item } = await loadOppByCode(event, user, String(getRouterParam(event, 'code')))
  if (!item.canDelete) throw createError({ statusCode: 403, statusMessage: 'You cannot delete this opportunity' })
  const { reason } = await readValidatedBody(event, z.object({
    reason: z.string().trim().min(1, 'Please give a reason for deleting').max(300),
  }).parse)
  const now = new Date().toISOString()
  await db.batch([
    db.update(tables.opportunities).set({ deletedAt: now, updatedAt: now }).where(eq(tables.opportunities.id, row.o.id)),
    db.insert(tables.auditLog).values({
      entity: 'opportunity', entityId: row.o.id, field: 'deleted', oldValue: null, newValue: reason, changedBy: user.id, changedAt: now,
    }),
  ])
  return { ok: true, oppCode: item.oppCode }
})
