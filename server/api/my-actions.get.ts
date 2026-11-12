import * as R from '#shared/rules'

/** S7 My Actions: open opps where I am the action owner, grouped Overdue / This week / Later (by due date). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { today, items } = await loadOpps(event, user, {})
  const mine = items.filter(i => i.status !== 'Closed' && i.actionOwnerId === user.id)
  const weekEnd = R.addDays(R.weekStart(today), 6)
  const byDue = (a: typeof mine[number], b: typeof mine[number]) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
  return {
    today,
    overdue: mine.filter(i => i.dueDate && i.dueDate < today).sort(byDue),
    thisWeek: mine.filter(i => i.dueDate && i.dueDate >= today && i.dueDate <= weekEnd).sort(byDue),
    later: mine.filter(i => !i.dueDate || i.dueDate > weekEnd).sort(byDue),
    // Opps I own as sales owner that miss next action / owner / due date (W4)
    missingNextStep: items.filter(i => i.status !== 'Closed' && i.salesOwnerId === user.id && i.warnings.includes('W4')),
  }
})
