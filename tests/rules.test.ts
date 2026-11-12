// Chạy: node --test rules.test.ts   (Node ≥ 22.18, hỗ trợ TypeScript sẵn)
// Mỗi test ứng với 1 quy tắc trong SRS mục 5 — dev port sang ngôn ngữ khác thì giữ nguyên bộ case.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as R from '../shared/rules';

const TODAY = '2026-11-11'; // thứ Tư
const base = (p: Partial<R.Opportunity> = {}): R.Opportunity => ({
  opp_code: 'OPP-2026-001', name: 'OutSystems Migration', customer: 'LIXIL', market_code: 'JP',
  partner: 'OutSystems', sales_owner: 'SonTV16', amount: 100_000, currency: 'USD',
  status: 'Active', stage: 'C', latest_activity: 'Sent proposal', latest_update_date: '2026-11-05',
  next_action: 'Follow up', action_owner: 'SonTV16', due_date: '2026-11-20',
  expected_close_date: '2026-12-31', stage_changed_at: '2026-11-01', status_changed_at: '2026-10-01',
  ...p,
});

test('5.1 opp code', () => {
  assert.equal(R.formatOppCode(2026, 7), 'OPP-2026-007');
});

test('5.2 currency conversion + missing rate throws', () => {
  const s = { ...R.DEFAULT_SETTINGS, fxToUsd: { USD: 1, JPY: 0.0067 } };
  assert.equal(R.amountUsd(base({ amount: 10_000_000, currency: 'JPY' }), s), 67_000);
  assert.throws(() => R.amountUsd(base({ currency: 'VND' })));
});

test('5.3 win rate: default by stage, override, W/L fixed', () => {
  assert.equal(R.winRate(base()), 40);
  assert.equal(R.winRate(base({ win_rate_override: 55 })), 55);
  assert.equal(R.winRate(base({ stage: 'W', status: 'Closed', win_rate_override: 30 })), 100);
  assert.equal(R.winRate(base({ stage: 'L', status: 'Closed', win_rate_override: 30 })), 0);
  assert.equal(R.weightedUsd(base()), 40_000);
});

test('5.3 pipeline & forecast exclude closed opps', () => {
  const k = R.kpis([base(), base({ opp_code: 'X', stage: 'W', status: 'Closed', amount: 999_999 })], TODAY);
  assert.equal(k.totalPipelineUsd, 100_000);
  assert.equal(k.weightedForecastUsd, 40_000);
  assert.equal(k.openOpps, 1);
});

test('5.4 deal size boundaries', () => {
  assert.equal(R.dealSize(base({ amount: 0 })), 'No estimate');
  assert.equal(R.dealSize(base({ amount: 49_999 })), '<50K');
  assert.equal(R.dealSize(base({ amount: 50_000 })), '50-200K');
  assert.equal(R.dealSize(base({ amount: 200_000 })), '50-200K');
  assert.equal(R.dealSize(base({ amount: 200_001 })), '>200K');
});

test('5.5 health boundaries', () => {
  assert.equal(R.health(base({ latest_update_date: '2026-10-28' }), TODAY), 'Green'); // 14 ngày
  assert.equal(R.health(base({ latest_update_date: '2026-10-27' }), TODAY), 'Amber'); // 15
  assert.equal(R.health(base({ latest_update_date: '2026-10-12' }), TODAY), 'Amber'); // 30
  assert.equal(R.health(base({ latest_update_date: '2026-10-11' }), TODAY), 'Red');   // 31
  assert.equal(R.health(base({ latest_update_date: null }), TODAY), 'Red (No update)');
  assert.equal(R.health(base({ stage: 'L', status: 'Closed' }), TODAY), 'Closed');
});

test('5.6 warnings W1–W7', () => {
  assert.deepEqual(R.warnings(base(), TODAY), []);
  assert.deepEqual(R.warnings(base({ latest_update_date: '2026-10-27' }), TODAY), ['W1']);
  assert.ok(R.warnings(base({ status: 'On Hold', status_changed_at: '2026-10-01' }), TODAY).includes('W2'));
  assert.ok(!R.warnings(base({ status: 'On Hold', status_changed_at: '2026-10-20' }), TODAY).includes('W2'));
  assert.ok(R.warnings(base({ expected_close_date: '2026-11-10' }), TODAY).includes('W3'));
  assert.ok(!R.warnings(base({ expected_close_date: TODAY }), TODAY).includes('W3'));
  for (const f of ['latest_activity', 'next_action', 'action_owner', 'due_date'] as const)
    assert.ok(R.warnings(base({ [f]: null }), TODAY).includes('W4'), f);
  assert.ok(R.warnings(base({ due_date: '2026-11-10' }), TODAY).includes('W5'));
  assert.ok(R.warnings(base({ amount: 0, stage: 'C' }), TODAY).includes('W6'));
  assert.ok(!R.warnings(base({ amount: 0, stage: 'D' }), TODAY).includes('W6'));
  assert.ok(R.warnings(base({ stage: 'C', stage_changed_at: '2026-09-01' }), TODAY).includes('W7'));
  assert.deepEqual(R.warnings(base({ stage: 'L', status: 'Closed', due_date: '2020-01-01' }), TODAY), []);
});

test('5.6 warning list ordering', () => {
  const a = base({ opp_code: 'A', expected_close_date: '2026-11-01', amount: 10_000 });          // 1 High
  const b = base({ opp_code: 'B', expected_close_date: '2026-11-01', next_action: null, amount: 5 }); // 2 High
  const c = base({ opp_code: 'C', expected_close_date: '2026-11-01', amount: 900_000 });        // 1 High, lớn hơn
  assert.deepEqual(R.sortWarningList([a, b, c], TODAY).map(x => x.o.opp_code), ['B', 'C', 'A']);
});

test('5.7 highlight window = Mon this week .. Sun next week', () => {
  assert.deepEqual(R.highlightWindow(TODAY), ['2026-11-09', '2026-11-22']);
  assert.deepEqual(R.highlightWindow('2026-11-15'), ['2026-11-09', '2026-11-22']); // Chủ nhật
});

test('5.7 highlight reasons', () => {
  const o = base({ due_date: '2026-11-25' });
  const acts: R.Activity[] = [
    { opp_code: o.opp_code, activity_date: '2026-11-14', type: 'Customer Meeting', content: 'Onsite' },
    { opp_code: o.opp_code, activity_date: '2026-11-13', type: 'Internal', content: 'Review' },
  ];
  assert.deepEqual(R.highlightReasons(o, acts, TODAY), [{ date: '2026-11-14', reason: 'Customer Meeting' }]);
  assert.equal(R.highlightReasons(base({ due_date: '2026-11-18' }), [], TODAY)[0].date, '2026-11-18');
  assert.equal(R.highlightReasons(base({ due_date: '2026-12-01', is_focus_pinned: true }), [], TODAY).length, 1);
});

test('5.7 key deal / top mgmt / top10', () => {
  assert.ok(R.isKeyDeal(base({ win_rate_override: 70 })));
  assert.ok(R.isKeyDeal(base({ amount: 250_000 })));
  assert.ok(!R.isTopMgmt(base({ amount: 250_000, stage: 'W', status: 'Closed' })));
  const list = [base({ opp_code: 'S', amount: 5 }), base({ opp_code: 'B', amount: 9e5 }),
                base({ opp_code: 'W', amount: 9e9, stage: 'W', status: 'Closed' })];
  assert.deepEqual(R.top10ByRevenue(list).map(o => o.opp_code), ['B', 'S']);
});

test('5.8 transitions', () => {
  assert.ok(R.validateTransition(base(), { stage: 'L' }, 'sales').length === 2);
  assert.deepEqual(R.validateTransition(base(), { stage: 'L', closed_at: TODAY, lost_reason: 'Price' }, 'sales'), []);
  assert.ok(R.validateTransition(base({ amount: 0 }), { stage: 'W', closed_at: TODAY }, 'sales').length === 1);
  assert.ok(R.validateTransition(base(), { status: 'On Hold' }, 'sales').length === 1);
  const closed = base({ stage: 'L', status: 'Closed', closed_at: '2026-10-01', lost_reason: 'x' });
  assert.ok(R.validateTransition(closed, { stage: 'C', reason: 'Khách mở lại' }, 'sales').length === 1);
  assert.deepEqual(R.validateTransition(closed, { stage: 'C', reason: 'Khách mở lại' }, 'market_lead'), []);

  const { opp, history } = R.applyTransition(base(), { stage: 'W', closed_at: TODAY }, TODAY);
  assert.equal(opp.status, 'Closed');
  assert.equal(history?.to_stage, 'W');
  const reopened = R.applyTransition(closed, { stage: 'C', reason: 'x' }, TODAY).opp;
  assert.equal(reopened.status, 'Active');
  assert.equal(reopened.closed_at, null);
});

test('5.9 activities drive the 4 key fields; future activity ignored', () => {
  const o = base({ latest_update_date: '2026-10-01', next_action: null });
  const acts: R.Activity[] = [
    { opp_code: o.opp_code, activity_date: '2026-11-10', type: 'Email', content: 'Sent Q&A',
      next_action: 'Wait answer', action_owner: 'DuyTD4', due_date: '2026-11-17', created_at: '2026-11-10T09:00' },
    { opp_code: o.opp_code, activity_date: '2026-11-10', type: 'Customer Meeting', content: 'Hearing',
      is_customer_facing: true, created_at: '2026-11-10T08:00' },
    { opp_code: o.opp_code, activity_date: '2026-11-20', type: 'Demo', content: 'Planned demo' },
  ];
  const u = R.applyActivities(o, acts, TODAY) as any;
  assert.equal(u.latest_activity, 'Sent Q&A');
  assert.equal(u.latest_update_date, '2026-11-10');
  assert.equal(u.next_action, 'Wait answer');
  assert.equal(u.action_owner, 'DuyTD4');
  assert.equal(u.last_contact_date, '2026-11-10');
});

test('5.10 market filter intersects user scope', () => {
  const opps = [base({ opp_code: 'J' }), base({ opp_code: 'K', market_code: 'KR' }),
                base({ opp_code: 'A', market_code: 'AP' })];
  assert.deepEqual(R.applyFilter(opps, {}, ['JP', 'KR'], TODAY).map(o => o.opp_code), ['J', 'K']);
  assert.deepEqual(R.applyFilter(opps, { markets: ['AP'] }, ['JP'], TODAY), []);
  assert.deepEqual(R.applyFilter(opps, { markets: ['AP'] }, null, TODAY).map(o => o.opp_code), ['A']);
});

test('5.11 duplicate detection (Mubadala case)', () => {
  const existing = [base({ opp_code: 'OPP-2026-042', customer: 'Mubadala', partner: 'OutSystems',
                           name: 'Mubadala M-App', market_code: 'ME' })];
  assert.equal(R.findDuplicates({ customer: 'Mubadala', partner: 'OutSystems', name: 'Mubadala M-App Phase 1' },
                                 existing).length, 1);
  assert.equal(R.findDuplicates({ customer: 'Mubadala', partner: 'OutSystems', name: 'HR Portal' },
                                 existing).length, 0);
});

test('5.12 week over week', () => {
  const prev: R.Snapshot[] = [
    { opp_code: 'A', stage: 'D', status: 'Active', amount_usd: 100, expected_close_date: '2026-12-01' },
    { opp_code: 'B', stage: 'C', status: 'Active', amount_usd: 200 },
    { opp_code: 'C', stage: 'C', status: 'Active', amount_usd: 300 }];
  const curr: R.Snapshot[] = [
    { opp_code: 'A', stage: 'C', status: 'Active', amount_usd: 150, expected_close_date: '2027-01-31' },
    { opp_code: 'B', stage: 'W', status: 'Closed', amount_usd: 200 },
    { opp_code: 'C', stage: 'D', status: 'Active', amount_usd: 300 },
    { opp_code: 'D', stage: 'O', status: 'Active', amount_usd: 50 }];
  const r = R.weekOverWeek(prev, curr, '2026-11-09', { D: '2026-11-10' });
  assert.deepEqual(r.new, ['D']); assert.deepEqual(r.won, ['B']);
  assert.deepEqual(r.stageUp, ['A']); assert.deepEqual(r.stageDown, ['C']);
  assert.deepEqual(r.slipped, ['A']); assert.equal(r.pipelineDeltaUsd, 500 - 600);
});
