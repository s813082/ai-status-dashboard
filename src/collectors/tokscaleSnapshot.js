'use strict';

// tokscale 快照 collector。介面與 codexBarSnapshot.js 完全相同
// （init / startPolling / refresh / getSnapshot / normalize / DATA_FILE），
// 讓 server.js 只需替換 require 目標。
//
// 資料來源（皆經 ./tokscale.js 封裝）：
//   Claude 額度 → `tokscale usage --json`（provider==="Claude"，label Session/Weekly）
//   Codex 額度  → `tokscale codex status --json`（label "5h" → kind:session；無 weekly）
//   花費        → `tokscale graph -c <client> --today / --since <29天前>` 的 summary.totalCost
// 容錯：整體抓取失敗沿用上一份並標 stale；label/欄位缺以防禦式取值降級為「無資料」。

const fs = require('node:fs');
const path = require('node:path');

const tokscale = require('./tokscale.js');
const PROVIDERS = require('../providers.js');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'snapshot.json');

let current = null; // 正規化後最新快照（含 meta）

// tokscale metric label → 正規化 window kind。未知 label 回 null（略過 → 該環無資料）。
// 說明：Codex（Plus）經 tokscale 只回單一 metric，label 雖為 "5h"，但其 resets_at
// 實測約 7 天後才重置 → 語意上是「週額度」而非 5 小時視窗，故映到 weekly 環，
// 讓 Codex 的 session（5 小時）環顯示「無資料」，避免把週額度誤標成 5 小時。
function labelToKind(label) {
  switch (String(label || '').toLowerCase()) {
    case 'session':
      return 'session';
    case 'weekly':
    case '5h':
      return 'weekly';
    default:
      return null;
  }
}

// 探勘現實：used/remaining/resets 可能缺；label 可能未知
function metricToWindow(m) {
  const kind = labelToKind(m && m.label);
  if (!kind) return null;
  return {
    kind,
    usedPercent: m && m.used_percent != null ? m.used_percent : null,
    remainingPercent: m && m.remaining_percent != null ? m.remaining_percent : null,
    resetAt: m && m.resets_at != null ? m.resets_at : null,
  };
}

function metricsToWindows(metrics) {
  return (Array.isArray(metrics) ? metrics : []).map(metricToWindow).filter(Boolean);
}

// tokscale 抓各家「訂閱額度」是間歇性的（Anthropic/OpenAI 額度端點偶爾逾時/限流），
// 某次 usage --json 可能漏掉 Claude。重試數次以提高命中，仍缺則靠 carry-forward。
async function fetchUsageWithRetry() {
  const wantUsage = PROVIDERS.filter((p) => p.quotaSource === 'usage').map((p) => p.usageProvider);
  let last = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const out = await tokscale.runJson(['usage', '--json']);
    last = Array.isArray(out) ? out : (out && (out.data || out.providers)) || [];
    const haveAll = wantUsage.every((name) => last.find((u) => u && u.provider === name));
    if (haveAll) return last;
  }
  return last; // 仍缺者交給 carry-forward 處理
}

// 純函式：把彙整後的原始資料正規化為 providers 結構。
// raw = { usage: <usage --json 陣列>, codexStatus: <codex status --json 物件|null>,
//         cost: { <id>: { todayUSD, last30DaysUSD } } }
function normalize(raw = {}) {
  const usageList = Array.isArray(raw.usage)
    ? raw.usage
    : (raw.usage && (raw.usage.data || raw.usage.providers)) || [];
  const providers = {};

  for (const cfg of PROVIDERS) {
    let windows = [];
    let error = null;

    if (cfg.quotaSource === 'usage') {
      const entry = usageList.find((p) => p && p.provider === cfg.usageProvider);
      if (entry) windows = metricsToWindows(entry.metrics);
      else error = `no usage entry for ${cfg.usageProvider}`;
    } else if (cfg.quotaSource === 'codex-status') {
      const cs = raw.codexStatus;
      if (!cs || cs.error) {
        error = (cs && cs.error) || 'no codex status';
      } else {
        windows = metricsToWindows(cs.usage && cs.usage.metrics);
      }
    }

    const cost = (raw.cost && raw.cost[cfg.id]) || { todayUSD: null, last30DaysUSD: null };
    providers[cfg.id] = {
      id: cfg.id,
      enabled: true,
      source: 'tokscale',
      windows,
      cost: {
        todayUSD: cost.todayUSD != null ? cost.todayUSD : null,
        last30DaysUSD: cost.last30DaysUSD != null ? cost.last30DaysUSD : null,
      },
      error,
    };
  }

  return {
    schemaVersion: null,
    generatedAt: null,
    staleAfterSeconds: null,
    codexBarVersion: null, // 保留欄位相容；tokscale 版本另記於 tokscaleVersion
    formatError: false,
    providers,
  };
}

function persist(snap) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(snap, null, 2));
  } catch {
    // 落地失敗不致命：記憶體快照仍可用
  }
}

function loadPersisted() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return null;
  }
}

// YYYY-MM-DD（本地日期），供 graph --since 用
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 單一 provider 的花費：graph --today 與 graph --since <29天前>。
// 花費取不到不致命（回 null），不使整體快照失敗。
async function fetchCost(client) {
  const out = { todayUSD: null, last30DaysUSD: null };
  try {
    const today = await tokscale.graphJson(['-c', client, '--today']);
    out.todayUSD = today && today.summary && today.summary.totalCost != null
      ? today.summary.totalCost
      : null;
  } catch {
    // 保留 null
  }
  try {
    const since = isoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
    const last30 = await tokscale.graphJson(['-c', client, '--since', since]);
    out.last30DaysUSD = last30 && last30.summary && last30.summary.totalCost != null
      ? last30.summary.totalCost
      : null;
  } catch {
    // 保留 null
  }
  return out;
}

// 需要 usage 的 provider 是否存在；codexStatus 是否需要抓
function needsUsage() {
  return PROVIDERS.some((p) => p.quotaSource === 'usage');
}
function needsCodexStatus() {
  return PROVIDERS.some((p) => p.quotaSource === 'codex-status');
}

// 抓一次並更新 current；失敗沿用上一份並標 stale
async function refresh() {
  try {
    const raw = { usage: [], codexStatus: null, cost: {} };

    if (needsUsage()) {
      raw.usage = await fetchUsageWithRetry();
    }
    if (needsCodexStatus()) {
      // codex status 回 {error} 仍是合法 JSON，交給 normalize 處理（不視為整體失敗）
      raw.codexStatus = await tokscale.runJson(['codex', 'status', '--json']);
    }
    for (const cfg of PROVIDERS) {
      raw.cost[cfg.id] = await fetchCost(cfg.tokscaleClient);
    }

    const prev = current;
    const norm = normalize(raw);
    // 逐 provider carry-forward：本次抓不到額度（windows 空且有 error），但上一份有 → 沿用上一份
    // 並標 staleWindows，避免 tokscale 間歇失敗時額度環閃成空白。
    for (const cfg of PROVIDERS) {
      const p = norm.providers[cfg.id];
      const prevP = prev && prev.providers && prev.providers[cfg.id];
      if (p && (!p.windows || !p.windows.length) && p.error && prevP && (prevP.windows || []).length) {
        p.windows = prevP.windows;
        p.staleWindows = true;
      }
    }
    current = {
      ...norm,
      tokscaleVersion: await tokscale.getVersion(),
      fetchedAt: new Date().toISOString(),
      stale: false,
      reachable: true,
      lastError: null,
    };
    persist(current);
    return current;
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    const base = current || loadPersisted();
    current = base
      ? { ...base, stale: true, reachable: false, lastError: message }
      : {
          schemaVersion: null,
          generatedAt: null,
          staleAfterSeconds: null,
          codexBarVersion: null,
          tokscaleVersion: null,
          formatError: false,
          providers: {},
          fetchedAt: null,
          stale: true,
          reachable: false,
          lastError: message,
        };
    return current;
  }
}

// 啟動時先用落地快取墊底（標 stale，直到第一次 refresh 成功）
function init() {
  const persisted = loadPersisted();
  if (persisted) current = { ...persisted, stale: true, reachable: false };
}

function startPolling(intervalMs = 60_000) {
  refresh();
  const timer = setInterval(refresh, intervalMs);
  if (timer.unref) timer.unref();
  return timer;
}

function getSnapshot() {
  return current;
}

module.exports = {
  init,
  startPolling,
  refresh,
  getSnapshot,
  normalize,
  DATA_FILE,
};
