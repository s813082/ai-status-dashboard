'use strict';

// CodexBar snapshot collector。
// 每 60s GET 本機 codexbar serve 的 /dashboard/v1/snapshot，帶 Bearer token，
// 僅保留 id==='codex' / 'claude'，正規化後存記憶體 + 落地 data/snapshot.json。
// 失敗沿用上一份並標 stale（不自行 backoff，CodexBar 已處理）。
// schemaVersion 不認得時標 formatError（fail-loud）。

const fs = require('node:fs');
const path = require('node:path');

const SNAPSHOT_URL = 'http://127.0.0.1:8080/dashboard/v1/snapshot';
const KNOWN_SCHEMA_VERSIONS = [1];
const WANTED_PROVIDERS = ['codex', 'claude'];
const FETCH_TIMEOUT_MS = 10_000;
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'snapshot.json');

let current = null; // 正規化後最新快照（含 meta）

function token() {
  return process.env.CODEXBAR_DASHBOARD_TOKEN || '';
}

// 探勘現實：window kind 可能缺、usedPercent/remainingPercent 可能 null
function normalizeWindow(w) {
  return {
    kind: w?.kind ?? null,
    usedPercent: w?.usedPercent ?? null,
    remainingPercent: w?.remainingPercent ?? null,
    resetAt: w?.resetAt ?? null,
  };
}

// 探勘現實：windows 可能為空 []、provider 可能帶 error、cost 欄位可能 null
function normalizeProvider(p) {
  return {
    id: p.id,
    enabled: p.enabled ?? null,
    source: p.source ?? null,
    windows: Array.isArray(p.windows) ? p.windows.map(normalizeWindow) : [],
    cost: {
      todayUSD: p?.cost?.todayUSD ?? null,
      last30DaysUSD: p?.cost?.last30DaysUSD ?? null,
    },
    error: p.error ?? null,
  };
}

function normalize(raw) {
  const schemaVersion = raw?.schemaVersion;
  const formatError = !KNOWN_SCHEMA_VERSIONS.includes(schemaVersion);
  const providers = {};
  if (!formatError && Array.isArray(raw?.providers)) {
    for (const p of raw.providers) {
      if (p && WANTED_PROVIDERS.includes(p.id)) providers[p.id] = normalizeProvider(p);
    }
  }
  return {
    schemaVersion: schemaVersion ?? null,
    generatedAt: raw?.generatedAt ?? null,
    staleAfterSeconds: raw?.staleAfterSeconds ?? null,
    codexBarVersion: raw?.host?.codexBarVersion ?? null,
    formatError,
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

async function fetchSnapshot() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(SNAPSHOT_URL, {
      headers: { Authorization: `Bearer ${token()}` },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`snapshot HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 抓一次並更新 current；失敗沿用上一份並標 stale
async function refresh() {
  try {
    const norm = normalize(await fetchSnapshot());
    current = {
      ...norm,
      fetchedAt: new Date().toISOString(),
      stale: false,
      reachable: true,
      lastError: null,
    };
    persist(current);
    return current;
  } catch (err) {
    const base = current || loadPersisted();
    current = base
      ? { ...base, stale: true, reachable: false, lastError: String(err && err.message ? err.message : err) }
      : {
          schemaVersion: null,
          generatedAt: null,
          staleAfterSeconds: null,
          codexBarVersion: null,
          formatError: false,
          providers: {},
          fetchedAt: null,
          stale: true,
          reachable: false,
          lastError: String(err && err.message ? err.message : err),
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
  SNAPSHOT_URL,
};
