## Why

現行 dashboard 的用量資料來自本機 CodexBar 的 HTTP snapshot API，綁定 CodexBar serve 常駐與 `CODEXBAR_DASHBOARD_TOKEN`，且僅限 macOS、無法滿足跨平台（Windows/macOS）與日/週/月歷史報表需求。改以跨平台的 tokscale CLI 為資料源，是後續 Launcher 多視圖報表（另案 Change B）的前置基礎。本案先完成後端切換，維持對外 `/api/status` 契約與主畫面不變。

## What Changes

- 新增低階 tokscale CLI 封裝：以 `child_process.execFile('tokscale', …)` 統一 spawn，集中處理未安裝（`ENOENT`）、非零離開碼、JSON 解析失敗與版本偵測；報表類指令加 `--no-spinner` 避免非 JSON 輸出污染 stdout。
- 新增 tokscale 快照 collector，沿用與現行 CodexBar collector **完全相同的模組介面**（`init` / `startPolling` / `refresh` / `getSnapshot` / `normalize` / `DATA_FILE`），使伺服器進入點僅需替換 `require` 目標。
- **維持正規化契約不變（非破壞性）**：`providers.<id>` 仍輸出 `windows[]`（`kind` / `usedPercent` / `remainingPercent` / `resetAt`）、`cost`（`todayUSD` / `last30DaysUSD`）、`activity`、`error`、`missing`。
  - Claude 額度取自 `tokscale usage --json`（`provider == "Claude"`），label `Session` 對映 `kind: session`、`Weekly` 對映 `kind: weekly`。
  - Codex 額度取自 `tokscale codex status --json`；回傳 `{error}` 或 401 時 `windows` 為空陣列並記錄 `error`（前端既有 `usedPercent == null` 顯示「無資料」）。
  - 花費由 `tokscale graph` 推算：`graph -c <client> --today` 的 `summary.totalCost` 為 `todayUSD`；`graph -c <client> --since <執行當日往前 29 天>` 的 `summary.totalCost` 為 `last30DaysUSD`。
- 新增 provider 設定中心：以資料表描述每個 provider（識別碼、tokscale client 名、usage provider 名、額度來源、顯示名、色票），取代硬編碼的 provider 允許清單；為未來新增 provider（如 antigravity）預留只加一列的擴充點（本案不新增 antigravity）。
- 現行 CodexBar collector 解除接線並標示 deprecated（本案不刪除）；CodexBar serve 的 launchd plist 與 `CODEXBAR_DASHBOARD_TOKEN` 標示為待淘汰。

## Non-Goals

- 不改動前端多視圖、Launcher 首頁、圖表與報表 API（屬 Change B）。
- 不改動寵物系統與其既有端點。
- 不新增 antigravity provider（僅在設定中心預留擴充點）。
- 不刪除 CodexBar collector 檔案與其 launchd plist（僅解除接線與標示待淘汰，實體移除留待後續變更）。
- **前置條件（非本案任務）**：`tokscale codex status --json` 於本機目前回 401（Codex token refresh 失敗）。此為 tokscale 端授權/維運事項，須在實作開工前手動修復並確認能取回 Codex 額度；若最終無法修復，Codex 額度環退回「無資料」顯示，Claude 不受影響。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `usage-collector`: 資料來源由 CodexBar HTTP snapshot 改為 tokscale CLI；新增額度與花費的取值與對映規則、tokscale 未安裝／Codex 授權失敗／schema 漂移的容錯行為，並維持既有正規化輸出契約不變。

## Impact

- Affected specs: `usage-collector`（修改）
- Affected code:
  - New:
    - src/collectors/tokscale.js
    - src/collectors/tokscaleSnapshot.js
    - src/providers.js
  - Modified:
    - src/server.js
    - src/collectors/codexBarSnapshot.js
    - src/collectors/activity.js
    - package.json
  - Removed:
    - (none this change；launchd/com.barry.codexbar-serve.plist 與 CODEXBAR_DASHBOARD_TOKEN 標示待淘汰)
- Runtime dependency: 執行環境需可執行 tokscale CLI（跨平台）；不再依賴 CodexBar serve 與 `CODEXBAR_DASHBOARD_TOKEN`。
