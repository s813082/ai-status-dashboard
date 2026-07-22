'use strict';

// Provider 設定中心（取代 codexBarSnapshot.js 內硬編碼的 WANTED_PROVIDERS）。
// 未來新增 provider（如 antigravity）只需在此加一列，collector 與前端皆讀此表。
//
// 欄位：
//   id            — 內部識別碼與 /api/status 的 provider key
//   tokscaleClient — tokscale `graph -c <client>` 用的 client 名
//   usageProvider  — `tokscale usage --json` 中的 provider 名（無則 null）
//   quotaSource    — 額度來源：'usage'（走 usage --json）或 'codex-status'（走 codex status --json）
//   displayName    — 前端顯示名
//   color          — 前端色票

const PROVIDERS = [
  {
    id: 'claude',
    tokscaleClient: 'claude',
    usageProvider: 'Claude',
    quotaSource: 'usage',
    displayName: 'Claude Code',
    color: '#d97757',
  },
  {
    id: 'codex',
    tokscaleClient: 'codex',
    usageProvider: null,
    quotaSource: 'codex-status',
    displayName: 'Codex',
    color: '#10a37f',
  },
];

module.exports = PROVIDERS;
