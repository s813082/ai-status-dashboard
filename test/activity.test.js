'use strict';

// activity.classify 純函式測試：三態優先序 exhausted > working > idle。
// classify(provider, latestMtimeMs, now) 為既有 export。

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { classify, WORKING_WINDOW_MS } = require('../src/collectors/activity.js');

const NOW = 1_700_000_000_000; // 固定基準（避免依賴當前時間）

test('classify: 額度觸底（remainingPercent<=0）回 exhausted', () => {
  const provider = { windows: [{ kind: 'weekly', remainingPercent: 0 }] };
  assert.equal(classify(provider, NOW, NOW), 'exhausted');
});

test('classify: exhausted 優先於 working（即使 mtime 很新）', () => {
  const provider = { windows: [{ kind: 'weekly', remainingPercent: 0 }] };
  assert.equal(classify(provider, NOW - 1000, NOW), 'exhausted');
});

test('classify: 額度充足且 mtime 在工作窗內回 working', () => {
  const provider = { windows: [{ kind: 'weekly', remainingPercent: 54 }] };
  assert.equal(classify(provider, NOW - (WORKING_WINDOW_MS - 1000), NOW), 'working');
});

test('classify: mtime 超過工作窗回 idle', () => {
  const provider = { windows: [{ kind: 'weekly', remainingPercent: 54 }] };
  assert.equal(classify(provider, NOW - (WORKING_WINDOW_MS + 1000), NOW), 'idle');
});

test('classify: 無 mtime（0）回 idle', () => {
  const provider = { windows: [{ kind: 'weekly', remainingPercent: 54 }] };
  assert.equal(classify(provider, 0, NOW), 'idle');
});

test('classify: 無 provider / 無 windows 不炸，回 idle', () => {
  assert.equal(classify(null, 0, NOW), 'idle');
  assert.equal(classify({}, 0, NOW), 'idle');
});
