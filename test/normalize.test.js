'use strict';

// tokscaleSnapshot 純函式測試：labelToKind（metric label→環種類）與 normalize（原始資料→providers 結構）。
// 皆為既有 export，測試不需改動 production code。

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { normalize, labelToKind } = require('../src/collectors/tokscaleSnapshot.js');

test('labelToKind: session 映射為 session', () => {
  assert.equal(labelToKind('session'), 'session');
});

test('labelToKind: weekly 與 5h 皆映射為 weekly', () => {
  assert.equal(labelToKind('weekly'), 'weekly');
  assert.equal(labelToKind('5h'), 'weekly');
});

test('labelToKind: 大小寫不敏感', () => {
  assert.equal(labelToKind('Session'), 'session');
  assert.equal(labelToKind('WEEKLY'), 'weekly');
});

test('labelToKind: 未知或空 label 回 null', () => {
  assert.equal(labelToKind('unknown'), null);
  assert.equal(labelToKind(''), null);
  assert.equal(labelToKind(undefined), null);
});

test('normalize: 空輸入仍產出 claude/codex 兩 provider，並標明 error', () => {
  const snap = normalize({});
  assert.ok(snap.providers.claude, 'claude 應存在');
  assert.ok(snap.providers.codex, 'codex 應存在');
  assert.deepEqual(snap.providers.claude.windows, []);
  assert.equal(snap.providers.claude.error, 'no usage entry for Claude');
  assert.equal(snap.providers.codex.error, 'no codex status');
  assert.equal(snap.providers.claude.cost.todayUSD, null);
  // 頂層相容欄位存在
  assert.equal(snap.formatError, false);
  assert.ok('providers' in snap && 'schemaVersion' in snap);
});

test('normalize: 有 usage/codexStatus/cost 時正確填入 windows 與 cost', () => {
  const raw = {
    usage: [
      {
        provider: 'Claude',
        metrics: [
          { label: 'session', used_percent: 30, remaining_percent: 70, resets_at: '2026-07-23T06:30:00Z' },
          { label: 'weekly', used_percent: 46, remaining_percent: 54, resets_at: '2026-07-28T08:00:00Z' },
        ],
      },
    ],
    codexStatus: {
      usage: { metrics: [{ label: '5h', used_percent: 54, remaining_percent: 46, resets_at: '2026-07-28T23:50:40Z' }] },
    },
    cost: {
      claude: { todayUSD: 9.02, last30DaysUSD: 414.38 },
      codex: { todayUSD: 0, last30DaysUSD: 44.29 },
    },
  };
  const snap = normalize(raw);

  const claude = snap.providers.claude;
  assert.equal(claude.error, null);
  assert.equal(claude.windows.length, 2);
  assert.deepEqual(claude.windows.map((w) => w.kind), ['session', 'weekly']);
  assert.equal(claude.windows[0].usedPercent, 30);
  assert.equal(claude.windows[1].remainingPercent, 54);
  assert.equal(claude.cost.todayUSD, 9.02);
  assert.equal(claude.cost.last30DaysUSD, 414.38);

  const codex = snap.providers.codex;
  assert.equal(codex.error, null);
  assert.equal(codex.windows.length, 1);
  assert.equal(codex.windows[0].kind, 'weekly'); // 5h → weekly
  assert.equal(codex.cost.todayUSD, 0);
});
