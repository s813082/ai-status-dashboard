## Context

現行 `src/collectors/codexBarSnapshot.js` 每 60 秒對本機 CodexBar serve 發 `GET http://127.0.0.1:8080/dashboard/v1/snapshot`（帶 `CODEXBAR_DASHBOARD_TOKEN`），正規化為 `providers.{claude,codex}` 的 `windows[]`/`cost` 供 `src/server.js` 的 `/api/status` 與前端額度環使用；`src/collectors/activity.js` 另讀本機 session log mtime 判定 idle/working/exhausted。此路線僅限 macOS 且依賴 CodexBar。

本案改以 tokscale CLI 為資料源。本機驗證：tokscale v4.0.8，`usage --json` 只回 Claude 與 Copilot（無 Codex），Codex 需 `codex status --json` 且目前回 401；`graph` 預設即輸出 JSON（不吃 `--json`），其 `summary.totalCost` 可作花費來源。

## Goals / Non-Goals

**Goals:**

- 以 tokscale CLI 取代 CodexBar 作為額度與花費資料源，達成跨平台。
- 對外 `/api/status` 契約與前端主畫面（兩個額度環、花費、寵物狀態）零改動。
- 建立可測試、可容錯的 CLI 存取層，並集中 provider 設定以利未來擴充。

**Non-Goals:**

- 前端多視圖、報表 API、圖表（屬 Change B）。
- 新增 antigravity provider（僅預留擴充點）。
- 刪除 CodexBar collector 與其 launchd plist（僅解除接線、標示 deprecated）。
- 修復 tokscale 的 Codex 401 授權（前置維運事項，非本案程式任務）。

## Decisions

### 以同介面 sibling collector 取代 CodexBar，server.js 僅換 require

新增 `src/collectors/tokscaleSnapshot.js`，輸出與 `codexBarSnapshot.js` 完全相同的模組介面（`init` / `startPolling` / `refresh` / `getSnapshot` / `normalize` / `DATA_FILE`）。`src/server.js` 只需將 collector 的 `require` 由 CodexBar 換成 tokscale。理由：把資料源差異封裝在 collector 內，伺服器與前端不需認知後端變更，回歸風險最小。替代方案（在既有檔案內加分支切換 CodexBar/tokscale）會讓兩種語意糾纏、擴大測試面，故不採。

### 額度分兩指令取得：Claude 走 usage、Codex 走 codex status

Claude 額度由 `tokscale usage --json` 取 `provider == "Claude"`，metric label `Session`→`kind:session`、`Weekly`→`kind:weekly`，`used_percent`/`remaining_percent`/`resets_at` 對映 `usedPercent`/`remainingPercent`/`resetAt`。Codex 額度由 `tokscale codex status --json` 取得，其 metric label 為 `5h`（對映 `kind:session`）；**Codex 目前無 weekly 視窗**，故 `windows` 只有一個 session 環，前端 weekly 環顯示「無資料」。理由：授權有效時 `usage --json` 其實同時回 Claude 與 Codex，但 `codex status` 另提供 `reset_credits` 等 Codex 專屬明細且語意明確，故 Codex 走 `codex status`。前置：`tokscale codex import` 修復授權後 `codex status` 方能回傳（已於實作前置驗證）。替代方案（Codex 也走 usage）可行但少了 reset_credits，不採。

### 花費由 tokscale graph 的 summary.totalCost 推算

`usage --json` 不含花費欄位。改以 `tokscale graph -c <client> --today` 的 `summary.totalCost` 作 `todayUSD`、`graph -c <client> --since <執行當日往前 29 天>` 的 `summary.totalCost` 作 `last30DaysUSD`。理由：graph 是 tokscale 唯一能給定期間花費彙總的指令。取不到時該花費欄為 `null`（前端 `fmtUSD` 已顯示「—」）。

### provider 設定中心化，取代硬編碼允許清單

新增 `src/providers.js`，以資料表列出每個 provider 的 `{ id, tokscaleClient, usageProvider, quotaSource, displayName, color }`，取代 `codexBarSnapshot.js` 內硬編碼的 provider 允許清單。snapshot collector 與（後續 Change B 的）前端皆讀此表；未來新增 provider 只需加一列。理由：集中設定降低擴充成本並避免多處散落的常數漂移。

### CodexBar collector 解除接線並標 deprecated，本案不刪

`codexBarSnapshot.js` 於 `server.js` 不再被 `require`，檔頭標示 deprecated；CodexBar serve 的 launchd plist 與 `CODEXBAR_DASHBOARD_TOKEN` 標示待淘汰。理由：保留可回退，實體移除與 launchd 清理留待後續變更，降低單次變更風險。

## Implementation Contract

- **Behavior**：伺服器啟動後每 60 秒經 tokscale CLI 更新快照；`/api/status` 回傳的 `providers.claude` 與 `providers.codex` 結構、欄位與型別與切換前一致，前端主畫面兩個額度環、花費與寵物狀態顯示不變。
- **Interface / data shape**：
  - `src/collectors/tokscale.js` 匯出封裝函式，內部以 `execFile('tokscale', args, { timeout, maxBuffer })` 執行並 `JSON.parse` stdout；報表類指令帶 `--no-spinner`。
  - `src/collectors/tokscaleSnapshot.js` 匯出 `init` / `startPolling` / `refresh` / `getSnapshot` / `normalize` / `DATA_FILE`，介面與 `codexBarSnapshot.js` 相同。
  - 正規化輸出：`providers.<id> = { windows: [{ kind, usedPercent, remainingPercent, resetAt }], cost: { todayUSD, last30DaysUSD }, activity, error, missing }`，`kind ∈ { session, weekly }`。Claude 產生 session 與 weekly 兩環；**Codex 僅產生 session 環（來源 label `5h`），無 weekly**。
  - `src/providers.js` 匯出 provider 設定陣列，元素形如 `{ id, tokscaleClient, usageProvider, quotaSource, displayName, color }`。
- **Failure modes**（皆不使 process 崩潰、`/api/status` 永不 500）：
  - tokscale 未安裝（`execFile` `ENOENT`）→ 具名錯誤；快照標 `error`、`windows`/`cost` 空，冷啟沿用 `data/snapshot.json`；前端顯 banner 與空狀態。
  - Codex `codex status` 回 `{error}`/401 → 該 provider `windows: []` 並記 `error`；Claude 不受影響。
  - JSON 解析失敗 / schema 漂移（label 改名、欄位缺）→ 防禦式取值，映不到的 metric 該環顯「無資料」而非崩潰；整體抓取失敗沿用上一份並標 `stale`。
  - graph 無該 client 花費 → 對應花費欄 `null`。
- **Acceptance criteria**：
  - `npm start` 後 `curl -s localhost:8787/api/status`：`providers.claude.windows[]` 含 `kind` 為 `session` 與 `weekly` 的項目且 `usedPercent` 為數值，`cost.todayUSD`/`cost.last30DaysUSD` 有值或明確為 `null`。
  - Codex 於 401 情境：`providers.codex.windows` 為空且 `providers.codex.error` 有值，回應仍為 200、Claude 欄位正常。
  - 將 tokscale 指令路徑改為不存在後重啟：`/api/status` 仍回 200 且帶 `error`/空狀態，process 不崩。
- **Scope boundaries**：
  - 範圍內：`src/collectors/tokscale.js`、`src/collectors/tokscaleSnapshot.js`、`src/providers.js`、`src/server.js` 的 collector require 替換、`codexBarSnapshot.js` 解除接線與 deprecated 標示、`package.json`（版本 0.3.0 與必要 scripts）、`activity.js` 確認 `remainingPercent` 供給不變。
  - 範圍外：前端 `src/public/index.html` 任何多視圖／圖表改動、報表 API、antigravity provider、CodexBar 檔案與 launchd plist 的實體移除。

## Risks / Trade-offs

- [tokscale Codex 授權 401 無法及時修復] → Codex 額度環退回「無資料」，Claude 與花費不受影響；前置條件明列於 proposal，實作前先驗證。
- [每 60 秒 spawn 多個 tokscale 子行程（usage + 每 provider 兩次 graph + codex status）造成負載] → 集中於單一 collector、維持 60 秒節奏、`execFile` 設 timeout 與 `maxBuffer`；報表 on-demand 不在本案。
- [tokscale 版本/schema 未來漂移] → 封裝層集中版本偵測與防禦式取值，映不到即降級為「無資料」而非崩潰。
- [保留 deprecated CodexBar collector 造成短期雙軌困惑] → 檔頭明確標示、`server.js` 不再接線，實體移除排入後續變更。
