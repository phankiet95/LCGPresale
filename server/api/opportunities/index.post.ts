import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { normalizeCustomerName } from '#shared/normalize'

const Body = z.object({
  name: z.string().trim().min(1).max(200),
  customerId: z.number().int().positive().nullish(),
  newCustomerName: z.string().trim().max(200).nullish(),
  industry: optText(100),
  marketCode: z.string().length(2),
  countryId: z.number().int().positive(),
  partnerId: z.number().int().positive(),
  secondaryPartner: optText(100),
  solution: optText(200),
  isLaida: z.boolean().default(false),
  dealType: z.string().trim().min(1, 'Deal type is required').max(30),
  salesOwnerId: z.number().int().positive(),
  viOwnerId: z.number().int().positive().nullish(),
  amount: z.number().min(0).max(1e13),
  currency: z.string().length(3),
  stage: z.enum(['O', 'D', 'C', 'B', 'A']).default('O'),
  winRateOverride: z.number().int().min(0).max(100).nullish(),
  winRateReason: optText(300),
  priority: optText(10),
  expectedCloseDate: isoDate,
  nextAction: optText(),
  actionOwnerId: z.number().int().positive().nullish(),
  dueDate: isoDate.nullish(),
  backgroundNote: optText(4000),
  /** set after the user saw the duplicate warning and chose "save anyway" */
  confirmDuplicate: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readValidatedBody(event, Body.parse)
  if (!canCreateIn(user, body.marketCode)) {
    throw createError({ statusCode: 403, statusMessage: `You cannot create opportunities in market ${body.marketCode}` })
  }
  const db = useDb(event)
  const today = todayJst()
  const settings = await loadSettings(db, today)
  assertFx(settings, body.currency)
  assertWinRateReason(settings, body.stage, body.winRateOverride, body.winRateReason)

  const country = await db.query.countries.findFirst({ where: eq(tables.countries.id, body.countryId) })
  if (!country || country.marketCode !== body.marketCode) {
    throw createError({ statusCode: 400, statusMessage: 'Country does not belong to the selected market' })
  }

  // Customer: pick from master, or quick-create (matched by normalised name first — SRS 3.7 / 8.1)
  let customerId = body.customerId ?? null
  let customerIndustry: string | null = null
  if (customerId) {
    const c = await db.query.customers.findFirst({ where: eq(tables.customers.id, customerId) })
    if (!c) throw createError({ statusCode: 400, statusMessage: 'Customer not found' })
    customerIndustry = c.industry
  }
  else if (body.newCustomerName) {
    const normalizedName = normalizeCustomerName(body.newCustomerName)
    const existing = await db.query.customers.findFirst({ where: eq(tables.customers.normalizedName, normalizedName) })
    customerId = existing?.id ?? (await db.insert(tables.customers)
      .values({ name: body.newCustomerName, normalizedName, industry: body.industry })
      .returning({ id: tables.customers.id }))[0]!.id
    customerIndustry = existing?.industry ?? body.industry
  }
  else {
    throw createError({ statusCode: 400, statusMessage: 'Customer is required' })
  }

  if (!body.confirmDuplicate) {
    const duplicates = await findDuplicates(db, { customerId, partnerId: body.partnerId, name: body.name })
    if (duplicates.length) {
      throw createError({ statusCode: 409, statusMessage: 'POSSIBLE_DUPLICATE', data: { duplicates } })
    }
  }

  const oppCode = await nextOppCode(db, Number(today.slice(0, 4)))
  const [created] = await db.insert(tables.opportunities).values({
    oppCode,
    name: body.name,
    customerId,
    industry: body.industry ?? customerIndustry,
    marketCode: body.marketCode,
    countryId: body.countryId,
    partnerId: body.partnerId,
    secondaryPartner: body.secondaryPartner,
    solution: body.solution,
    isLaida: body.isLaida,
    dealType: body.dealType,
    salesOwnerId: body.salesOwnerId,
    viOwnerId: body.viOwnerId ?? null,
    amount: body.amount,
    currency: body.currency,
    winRateOverride: body.winRateOverride ?? null,
    winRateReason: body.winRateReason,
    priority: body.priority,
    stage: body.stage,
    status: 'Active',
    stageChangedAt: today,
    statusChangedAt: today,
    nextAction: body.nextAction,
    actionOwnerId: body.actionOwnerId ?? null,
    dueDate: body.dueDate ?? null,
    expectedCloseDate: body.expectedCloseDate,
    backgroundNote: body.backgroundNote,
    createdBy: user.id,
  }).returning({ id: tables.opportunities.id, oppCode: tables.opportunities.oppCode })

  await db.insert(tables.auditLog).values({
    entity: 'opportunity', entityId: created!.id, field: 'created', oldValue: null,
    newValue: `${oppCode} · stage ${body.stage}`, changedBy: user.id,
  })
  return created
})

