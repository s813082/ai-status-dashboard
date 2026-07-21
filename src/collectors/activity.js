'use strict';

// 活動偵測：只用檔案 mtime，不用 ps（決議 D2）。
// 掃 ~/.claude/projects/**/*.jsonl 與 ~/.codex/sessions/**/*.jsonl 的最新 mtime。
// now - latestMtime < 60s → working；額度觸底 → exhausted（優先於 mtime）；其餘 → idle。
// classify 為純函式，於每次 /api/status 請求時即時計算（決議 D3）。

const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const WORKING_WINDOW_MS = 60_000;
const CACHE_MS = 3000; // 短期記憶，避免同一批請求重複掃描

const SESSION_ROOTS = {
  claude: path.join(os.homedir(), '.claude', 'projects'),
  codex: path.join(os.homedir(), '.codex', 'sessions'),
};

// 遞迴找 root 下所有 *.jsonl 的最新 mtime（毫秒）；目錄不存在或無檔回 0
async function latestJsonlMtime(root) {
  let latest = 0;
  let entries;
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) {
      const sub = await latestJsonlMtime(full);
      if (sub > latest) latest = sub;
    } else if (ent.isFile() && ent.name.endsWith('.jsonl')) {
      try {
        const st = await fsp.stat(full);
        if (st.mtimeMs > latest) latest = st.mtimeMs;
      } catch {
        // 檔案在掃描期間被刪/rename，略過
      }
    }
  }
  return latest;
}

// 純函式：依 provider 的 windows 與最新 mtime 判斷 activity
function classify(provider, latestMtimeMs, now) {
  const windows = (provider && provider.windows) || [];
  const exhausted = windows.some(
    (w) => w && w.remainingPercent != null && w.remainingPercent <= 0,
  );
  if (exhausted) return 'exhausted';
  if (latestMtimeMs > 0 && now - latestMtimeMs < WORKING_WINDOW_MS) return 'working';
  return 'idle';
}

const cache = { at: 0, values: { claude: 0, codex: 0 } };

// 回傳 { claude: activity, codex: activity }
async function computeActivities(snapshotProviders, now = Date.now()) {
  if (now - cache.at > CACHE_MS) {
    cache.values.claude = await latestJsonlMtime(SESSION_ROOTS.claude);
    cache.values.codex = await latestJsonlMtime(SESSION_ROOTS.codex);
    cache.at = now;
  }
  const result = {};
  for (const id of ['claude', 'codex']) {
    result[id] = classify(snapshotProviders && snapshotProviders[id], cache.values[id], now);
  }
  return result;
}

module.exports = {
  computeActivities,
  classify,
  latestJsonlMtime,
  WORKING_WINDOW_MS,
  SESSION_ROOTS,
};
