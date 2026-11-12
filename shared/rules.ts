// Copied verbatim from "docs from Kim/rules.ts" (reference implementation of SRS §5).
// Keep in sync with the business owner; tests in tests/rules.test.ts.
/**
 * LCG Opportunity Management — reference implementation of business rules.
 * Tham chiếu SRS v0.1 mục 5. Không phụ thuộc framework; dùng ở backend
 * (tính warnings, highlight, KPI) và có thể dùng lại ở frontend để hiển thị.
 *
 * Quy ước: mọi ngày là chuỗi ISO 'YYYY-MM-DD' theo giờ Asia/Tokyo.
 * "today" luôn được truyền vào (không gọi new Date() bên trong) để test được.
 */

// ---------------------------------------------------------------- Types
export type Stage = 'O' | 'D' | 'C' | 'B' | 'A' | 'W' | 'L';
export type Status = 'Active' | 'On Hold' | 'Closed';
export type Health = 'Green' | 'Amber' | 'Red' | 'Red (No update)' | 'Closed';
export type DealSize = '>200K' | '50-200K' | '<50K' | 'No estimate';
export type WarningCode = 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6' | 'W7';
export type Severity = 'High' | 'Medium' | 'Low';

export interface Opportunity {
  opp_code: string;
  name: string;
  customer: string;
  market_code: string;
  partner: string;
  deal_type?: string | null;
  sales_owner: string;
  amount: number;
  currency: string;
  win_rate_override?: number | null;
  status: Status;
  stage: Stage;
  latest_activity?: string | null;
  latest_update_date?: string | null;
  next_action?: string | null;
  action_owner?: string | null;
  due_date?: string | null;
  expected_close_date?: string | null;
  closed_at?: string | null;
  pending_reason?: string | null;
  lost_reason?: string | null;
  stage_changed_at?: string | null;   // ngày vào stage hiện tại
  status_changed_at?: string | null;  // ngày vào status hiện tại
  is_focus_pinned?: boolean;
  created_at?: string | null;
}

export interface Activity {
  opp_code: string;
  activity_date: string;
  type: string;
  content: string;
  is_customer_facing?: boolean;
  next_action?: string | null;
  action_owner?: string | null;
  due_date?: string | null;
  created_at?: string;               // ISO datetime, phá hoà khi cùng ngày
}

export interface Settings {
  defaultWinRate: Record<Stage, number>;
  healthGreenMax: number;            // 14
  healthAmberMax: number;            // 30
  warnNoUpdateDays: number;          // 14
  warnOnHoldDays: number;            // 30
  stageStuckDays: Partial<Record<Stage, number>>;
  topMgmtUsd: number;                // 200,000
  keyDealUsd: number;                // 200,000
  keyDealWinRate: number;            // 70
  highlightActivityTypes: string[];
  fxToUsd: Record<string, number>;   // { USD: 1, JPY: 0.0067, ... }
}

export const DEFAULT_SETTINGS: Settings = {
  defaultWinRate: { O: 10, D: 20, C: 40, B: 60, A: 80, W: 100, L: 0 },
  healthGreenMax: 14,
  healthAmberMax: 30,
  warnNoUpdateDays: 14,
  warnOnHoldDays: 30,
  stageStuckDays: { O: 30, D: 30, C: 45, B: 30, A: 21 },
  topMgmtUsd: 200_000,
  keyDealUsd: 200_000,
  keyDealWinRate: 70,
  highlightActivityTypes: ['Customer Meeting', 'Proposal Submission', 'Demo', 'Seminar'],
  fxToUsd: { USD: 1 },
};

export const STAGE_ORDER: Stage[] = ['O', 'D', 'C', 'B', 'A', 'W'];
export const WARNING_META: Record<WarningCode, { label: string; severity: Severity }> = {
  W1: { label: 'No update > 14d', severity: 'Medium' },
  W2: { label: 'On hold > 30d', severity: 'High' },
  W3: { label: 'Overdue close', severity: 'High' },
  W4: { label: 'Missing key fields', severity: 'High' },
  W5: { label: 'Action overdue', severity: 'Medium' },
  W6: { label: 'No estimate', severity: 'Medium' },
  W7: { label: 'Stuck in stage', severity: 'Low' },
};

// ---------------------------------------------------------------- Date utils
const DAY = 86_400_000;
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY);
export const addDays = (iso: string, n: number) => new Date(toUtc(iso) + n * DAY).toISOString().slice(0, 10);

/** Thứ Hai của tuần chứa ngày iso (tuần Thứ Hai → Chủ nhật). */
export function weekStart(iso: string): string {
  const dow = new Date(toUtc(iso)).getUTCDay();      // 0 = CN
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

/** "Hôm nay" theo giờ Tokyo, dùng ở tầng gọi (không dùng trong rules). */
export function todayJst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- 5.2 – 5.5
export const isOpen = (o: Opportunity) => o.status !== 'Closed';

export function amountUsd(o: Opportunity, s = DEFAULT_SETTINGS): number {
  const rate = s.fxToUsd[o.currency];
  if (rate === undefined) throw new Error(`Missing FX rate for ${o.currency}`);
  return Math.round(o.amount * rate * 100) / 100;
}

export function winRate(o: Opportunity, s = DEFAULT_SETTINGS): number {
  if (o.stage === 'W') return 100;
  if (o.stage === 'L') return 0;
  return o.win_rate_override ?? s.defaultWinRate[o.stage];
}

export const weightedUsd = (o: Opportunity, s = DEFAULT_SETTINGS) =>
  Math.round(amountUsd(o, s) * winRate(o, s)) / 100;

export function dealSize(o: Opportunity, s = DEFAULT_SETTINGS): DealSize {
  if (!o.amount) return 'No estimate';
  const usd = amountUsd(o, s);
  if (usd > 200_000) return '>200K';
  if (usd >= 50_000) return '50-200K';
  return '<50K';
}

export function daysSinceUpdate(o: Opportunity, today: string): number | null {
  return o.latest_update_date ? daysBetween(o.latest_update_date, today) : null;
}

export function health(o: Opportunity, today: string, s = DEFAULT_SETTINGS): Health {
  if (!isOpen(o)) return 'Closed';
  const d = daysSinceUpdate(o, today);
  if (d === null) return 'Red (No update)';
  if (d <= s.healthGreenMax) return 'Green';
  if (d <= s.healthAmberMax) return 'Amber';
  return 'Red';
}

// ---------------------------------------------------------------- 5.6 Warnings
export function warnings(o: Opportunity, today: string, s = DEFAULT_SETTINGS): WarningCode[] {
  if (!isOpen(o)) return [];
  const w: WarningCode[] = [];
  const dsu = daysSinceUpdate(o, today);
  if (dsu === null || dsu > s.warnNoUpdateDays) w.push('W1');
  if (o.status === 'On Hold') {
    const since = o.status_changed_at ?? o.latest_update_date;
    if (since && daysBetween(since, today) > s.warnOnHoldDays) w.push('W2');
  }
  if (o.expected_close_date && o.expected_close_date < today) w.push('W3');
  if (!o.latest_activity || !o.next_action || !o.action_owner || !o.due_date) w.push('W4');
  if (o.due_date && o.due_date < today) w.push('W5');
  if (!o.amount && ['C', 'B', 'A'].includes(o.stage)) w.push('W6');
  const stuck = s.stageStuckDays[o.stage];
  if (stuck !== undefined && o.stage_changed_at && daysBetween(o.stage_changed_at, today) > stuck) w.push('W7');
  return w;
}

const highCount = (codes: WarningCode[]) => codes.filter(c => WARNING_META[c].severity === 'High').length;

/** Thứ tự Warning List: số cảnh báo High ↓, amount_usd ↓, days since update ↓ (chưa update = lớn nhất). */
export function sortWarningList(opps: Opportunity[], today: string, s = DEFAULT_SETTINGS) {
  return opps
    .map(o => ({ o, codes: warnings(o, today, s) }))
    .filter(x => x.codes.length > 0)
    .sort((a, b) =>
      highCount(b.codes) - highCount(a.codes) ||
      amountUsd(b.o, s) - amountUsd(a.o, s) ||
      (daysSinceUpdate(b.o, today) ?? Infinity) - (daysSinceUpdate(a.o, today) ?? Infinity));
}

// ---------------------------------------------------------------- 5.7 Highlight
export interface HighlightReason { date: string; reason: string }

/** Cửa sổ highlight: [thứ Hai tuần này, Chủ nhật tuần sau]. */
export function highlightWindow(today: string): [string, string] {
  const mon = weekStart(today);
  return [mon, addDays(mon, 13)];
}

export function highlightReasons(o: Opportunity, acts: Activity[], today: string,
                                 s = DEFAULT_SETTINGS): HighlightReason[] {
  if (!isOpen(o)) return [];
  const [from, to] = highlightWindow(today);
  const inWin = (d?: string | null) => !!d && d >= from && d <= to;
  const r: HighlightReason[] = [];
  if (inWin(o.due_date)) r.push({ date: o.due_date!, reason: `Due: ${o.next_action ?? 'Next action'}` });
  for (const a of acts) {
    if (a.opp_code === o.opp_code && s.highlightActivityTypes.includes(a.type) && inWin(a.activity_date))
      r.push({ date: a.activity_date, reason: a.type });
  }
  if (o.is_focus_pinned) r.push({ date: today, reason: 'Pinned' });
  return r.sort((a, b) => a.date.localeCompare(b.date));
}

export const isKeyDeal = (o: Opportunity, s = DEFAULT_SETTINGS) =>
  isOpen(o) && (amountUsd(o, s) > s.keyDealUsd || winRate(o, s) >= s.keyDealWinRate);

export const isTopMgmt = (o: Opportunity, s = DEFAULT_SETTINGS) =>
  isOpen(o) && amountUsd(o, s) > s.topMgmtUsd;

export function top10ByRevenue(opps: Opportunity[], s = DEFAULT_SETTINGS) {
  return opps.filter(isOpen)
    .sort((a, b) => amountUsd(b, s) - amountUsd(a, s) ||
      (a.expected_close_date ?? '9999').localeCompare(b.expected_close_date ?? '9999'))
    .slice(0, 10);
}

// ---------------------------------------------------------------- 5.8 Transitions
export interface Transition { stage?: Stage; status?: Status; closed_at?: string;
  lost_reason?: string; pending_reason?: string; amount?: number; reason?: string }
export type Role = 'admin' | 'management' | 'market_lead' | 'sales' | 'viewer';

/** Trả về danh sách lỗi; rỗng = hợp lệ. Không sửa object đầu vào. */
export function validateTransition(o: Opportunity, t: Transition, role: Role): string[] {
  const e: string[] = [];
  const to = t.stage ?? o.stage;
  if (o.status === 'Closed' && (t.stage || t.status) && !['admin', 'market_lead'].includes(role))
    e.push('Chỉ Admin / Market Lead được mở lại opp đã đóng');
  if (o.status === 'Closed' && t.stage && !['W', 'L'].includes(t.stage) && !t.reason)
    e.push('Mở lại opp cần ghi lý do');
  if (to === 'W') {
    if (!(t.closed_at ?? o.closed_at)) e.push('Won cần ngày đóng (closed_at)');
    if (!((t.amount ?? o.amount) > 0)) e.push('Won cần giá trị hợp đồng > 0');
  }
  if (to === 'L') {
    if (!(t.closed_at ?? o.closed_at)) e.push('Lost cần ngày đóng (closed_at)');
    if (!(t.lost_reason ?? o.lost_reason)) e.push('Lost cần lý do thua');
  }
  if (t.status === 'On Hold' && !(t.pending_reason ?? o.pending_reason)) e.push('On Hold cần lý do');
  if (t.status === 'Closed' && !t.stage) e.push('Đóng opp bằng cách chuyển Stage sang W hoặc L');
  return e;
}

/** Áp transition hợp lệ, trả về opp mới + bản ghi stage_history (5.8). */
export function applyTransition(o: Opportunity, t: Transition, today: string) {
  const next: Opportunity = { ...o };
  if (t.stage && t.stage !== o.stage) { next.stage = t.stage; next.stage_changed_at = today; }
  if (next.stage === 'W' || next.stage === 'L') {
    next.status = 'Closed'; next.closed_at = t.closed_at ?? o.closed_at ?? today;
  } else if (t.status) {
    next.status = t.status;
  } else if (o.status === 'Closed') {
    next.status = 'Active'; next.closed_at = null;           // mở lại
  }
  if (next.status !== o.status) next.status_changed_at = today;
  if (t.lost_reason) next.lost_reason = t.lost_reason;
  if (t.pending_reason) next.pending_reason = t.pending_reason;
  if (t.amount !== undefined) next.amount = t.amount;
  const history = (next.stage !== o.stage || next.status !== o.status)
    ? { from_stage: o.stage, to_stage: next.stage, from_status: o.status, to_status: next.status,
        reason: t.reason ?? t.lost_reason ?? t.pending_reason ?? null, changed_at: today }
    : null;
  return { opp: next, history };
}

// ---------------------------------------------------------------- 5.9 Activity → opp
export function applyActivities(o: Opportunity, acts: Activity[], today: string): Opportunity {
  const past = acts.filter(a => a.opp_code === o.opp_code && a.activity_date <= today)
    .sort((a, b) => b.activity_date.localeCompare(a.activity_date) ||
      (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  if (!past.length) return o;
  const latest = past[0]!; // (non-null: checked above — added for strict TS)
  const contact = past.find(a => a.is_customer_facing);
  return {
    ...o,
    latest_activity: latest.content,
    latest_update_date: latest.activity_date,
    next_action: latest.next_action ?? o.next_action,
    action_owner: latest.action_owner ?? o.action_owner,
    due_date: latest.due_date ?? o.due_date,
    ...(contact ? { last_contact_date: contact.activity_date } as any : {}),
  };
}

// ---------------------------------------------------------------- 5.10 Filters & KPI
export interface Filter { markets?: string[]; partners?: string[]; owners?: string[];
  stages?: Stage[]; dealTypes?: string[]; health?: Health[] }

/** userMarkets = null nghĩa là xem tất cả (admin/management). Luôn giao với filter. */
export function applyFilter(opps: Opportunity[], f: Filter, userMarkets: string[] | null,
                            today: string, s = DEFAULT_SETTINGS) {
  const allowed = (m: string) => userMarkets === null || userMarkets.includes(m);
  const has = <T>(arr: T[] | undefined, v: T) => !arr || arr.length === 0 || arr.includes(v);
  return opps.filter(o => allowed(o.market_code) && has(f.markets, o.market_code) &&
    has(f.partners, o.partner) && has(f.owners, o.sales_owner) && has(f.stages, o.stage) &&
    has(f.dealTypes, o.deal_type ?? '') && has(f.health, health(o, today, s)));
}

export function kpis(opps: Opportunity[], today: string, s = DEFAULT_SETTINGS) {
  const open = opps.filter(isOpen);
  const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  return {
    totalOpps: opps.length,
    openOpps: open.length,
    totalPipelineUsd: sum(open.map(o => amountUsd(o, s))),
    weightedForecastUsd: sum(open.map(o => weightedUsd(o, s))),
    withWarnings: open.filter(o => warnings(o, today, s).length > 0).length,
    onHoldOver30: open.filter(o => warnings(o, today, s).includes('W2')).length,
    noUpdateOver14: open.filter(o => warnings(o, today, s).includes('W1')).length,
    overdueClose: open.filter(o => warnings(o, today, s).includes('W3')).length,
  };
}

export function groupPipeline(opps: Opportunity[], key: (o: Opportunity) => string, s = DEFAULT_SETTINGS) {
  const m = new Map<string, { count: number; pipelineUsd: number; weightedUsd: number }>();
  for (const o of opps.filter(isOpen)) {
    const g = m.get(key(o)) ?? { count: 0, pipelineUsd: 0, weightedUsd: 0 };
    g.count++; g.pipelineUsd += amountUsd(o, s); g.weightedUsd += weightedUsd(o, s);
    m.set(key(o), g);
  }
  return m;
}

// ---------------------------------------------------------------- 5.11 Duplicates
const trigrams = (s: string) => {
  const t = `  ${s.toLowerCase().replace(/\s+/g, ' ').trim()} `;
  const set = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
};
/** Giống pg_trgm similarity(): |A∩B| / |A∪B|. */
export function similarity(a: string, b: string): number {
  const A = trigrams(a), B = trigrams(b);
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}
export function findDuplicates(candidate: Pick<Opportunity, 'customer' | 'partner' | 'name'> & { opp_code?: string },
                               opps: Opportunity[], threshold = 0.6) {
  return opps.filter(o => isOpen(o) && o.opp_code !== candidate.opp_code &&
    o.customer === candidate.customer && o.partner === candidate.partner &&
    similarity(o.name, candidate.name) >= threshold);
}

// ---------------------------------------------------------------- 5.12 Week-over-week
export interface Snapshot { opp_code: string; stage: Stage; status: Status; amount_usd: number;
  expected_close_date?: string | null }

export function weekOverWeek(prev: Snapshot[], curr: Snapshot[], weekStartIso: string,
                             createdAt: Record<string, string | null | undefined> = {}) {
  const p = new Map(prev.map(x => [x.opp_code, x]));
  const rank = (st: Stage) => STAGE_ORDER.indexOf(st);
  const pipe = (xs: Snapshot[]) => xs.filter(x => x.status !== 'Closed').reduce((a, x) => a + x.amount_usd, 0);
  const r = { new: [] as string[], won: [] as string[], lost: [] as string[], stageUp: [] as string[],
    stageDown: [] as string[], slipped: [] as string[], pipelineDeltaUsd: pipe(curr) - pipe(prev) };
  for (const c of curr) {
    const b = p.get(c.opp_code);
    const created = createdAt[c.opp_code];
    if (!b) { if (!created || created >= weekStartIso) r.new.push(c.opp_code); continue; }
    if (c.stage === 'W' && b.stage !== 'W') r.won.push(c.opp_code);
    else if (c.stage === 'L' && b.stage !== 'L') r.lost.push(c.opp_code);
    else if (c.stage !== 'L' && b.stage !== 'L') {
      if (rank(c.stage) > rank(b.stage)) r.stageUp.push(c.opp_code);
      if (rank(c.stage) < rank(b.stage)) r.stageDown.push(c.opp_code);
    }
    if (b.expected_close_date && c.expected_close_date && c.expected_close_date > b.expected_close_date)
      r.slipped.push(c.opp_code);
  }
  return r;
}

// ---------------------------------------------------------------- 5.1 Code
export function formatOppCode(year: number, seq: number) {
  return `OPP-${year}-${String(seq).padStart(3, '0')}`;
}
