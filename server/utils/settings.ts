import { eq } from 'drizzle-orm'
import { DEFAULT_SETTINGS, type Settings, type Stage } from '#shared/rules'

/** Business thresholds from the `settings` table + plan FX rates of the fiscal year (SRS 5.2, Q5: calendar year). */
export async function loadSettings(db: Db, today: string): Promise<Settings> {
  const [rows, fx] = await Promise.all([
    db.select().from(tables.settings),
    db.select().from(tables.fxRates).where(eq(tables.fxRates.fiscalYear, Number(today.slice(0, 4)))),
  ])
  const v = Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)])) as Record<string, any>
  const s: Settings = structuredClone(DEFAULT_SETTINGS)
  if (v.default_win_rate) s.defaultWinRate = v.default_win_rate as Record<Stage, number>
  if (v.health_days) {
    s.healthGreenMax = v.health_days.green_max ?? s.healthGreenMax
    s.healthAmberMax = v.health_days.amber_max ?? s.healthAmberMax
  }
  if (v.warn_no_update_days) s.warnNoUpdateDays = v.warn_no_update_days[0]
  if (v.warn_on_hold_days) s.warnOnHoldDays = v.warn_on_hold_days[0]
  if (v.warn_stage_stuck_days) s.stageStuckDays = v.warn_stage_stuck_days
  if (v.top_mgmt_threshold_usd) s.topMgmtUsd = v.top_mgmt_threshold_usd[0]
  if (v.key_deal) {
    s.keyDealUsd = v.key_deal.amount_usd ?? s.keyDealUsd
    s.keyDealWinRate = v.key_deal.win_rate ?? s.keyDealWinRate
  }
  if (v.highlight_activity_types) s.highlightActivityTypes = v.highlight_activity_types
  s.fxToUsd = { USD: 1, ...Object.fromEntries(fx.map(r => [r.currency, r.rateToUsd])) }
  return s
}
