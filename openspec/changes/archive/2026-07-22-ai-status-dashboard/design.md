## Context

從零建立一個本地常駐 web dashboard，讓桌上閒置 iPhone 用 Safari 連區網顯示 Claude Code / Codex 的用量狀態。資料源已定案為本機 CodexBar（`/opt/homebrew/bin/codexbar`）的 `codexbar serve`，它已處理 OAuth、Keychain、429 backoff、last-known-good 快取，我方只讀正規化後的 `/dashboard/v1/snapshot`。

已驗證的環境事實（直接採用，不再猜測）：

- codexbar 絕對路徑：`/opt/homebrew/bin/codexbar`；node 走 nvm 安裝，launchd plist 需寫死絕對路徑（`which node` 於實作時重新確認）。
- hostname：`YOUR-MAC` → iPhone 連 `http://YOUR-MAC.local:8787`。
- CodexBar serve 監聽 8080，我方 Node server 監聽 8787（啟動前各跑一次 `lsof -i :PORT` 確認）。
- serve 端點：`/health` 恆開；`/dashboard/v1/snapshot` 需 `Authorization: Bearer <token>`，無 token 時 401 fail-closed；token 走 `CODEXBAR_DASHBOARD_TOKEN` 環境變數（不用 `--dashboard-token` 參數，會被 ps 看到）。
- 本機 CodexBar 啟用多個 provider（gemini/openrouter 等會噴 error）→ 必須嚴格以 `id === 'codex'` 與 `id === 'claude'` filter，其餘忽略。

約束：純 `node:http`，無 Express、無前端框架、無圖表庫；憑證零貼上；所有產出限縮在專案目錄內。

## Goals / Non-Goals

**Goals:**

- 常駐、全自動、零手動：launchd `RunAtLoad` + `KeepAlive` + 前端自動 poll。
- 兩速資料流：額度/花費固定 60s（對齊 CodexBar refresh-interval）；活動狀態走前端 ~5s poll 即時更新。
- collector 失敗永不崩潰：一律 fallback 到快取/loading，並明確標記資料稍舊。
- iPhone Safari 可連並可「加入主畫面」全螢幕。

**Non-Goals:**

- 不自刻額度/花費 collector、backoff、OAuth、Keychain 邏輯（交給 CodexBar）。
- 不用 `ps` 判活動；不改用 `codexbar usage` CLI。
- 不做鏡射桌面、登入、歷史趨勢圖表。
- 不為即時性調低 CodexBar refresh-interval。

## Decisions

**D1. 資料源用 `codexbar serve` 而非 CLI 直呼。** serve 回傳正規化後的 snapshot（schemaVersion 化、windows/cost 一致），CLI `usage` 的原始 JSON 形狀不同且不穩定。以 snapshot 為單一真相。

**D2. 活動偵測只用檔案 mtime，不用 ps。** 掃 `~/.claude/projects/**/*.jsonl` 與 `~/.codex/sessions/**/*.jsonl` 的最新 mtime。理由：ps 判斷需要 process 名稱匹配、易誤判、成本高；mtime 便宜且可在每次 `/api/status` 請求時即時算，不需獨立 timer。門檻：`now - latestMtime < 60s` → working。

**D3. 兩速資料流分離。** 額度/花費由獨立 60s collector timer 更新記憶體快照；活動狀態不進 60s timer，改在每次 `/api/status` 請求時即時計算 mtime。前端 5s poll `/api/status` 取兩者。理由：額度受上游 rate limit 不宜更頻繁；活動狀態便宜可即時。

**D4. schemaVersion 檢查採 fail-loud。** 遇不認得的 `schemaVersion` 時，快照標記 `formatError: true`，前端顯示「資料格式不符」而非靜默顯示錯誤數字。

**D5. 睡著動畫用 idle 幀疊加。** petdex 無原生睡眠動作，`exhausted` 狀態用 idle 幀 + CSS/emoji「😴 Zzz」疊加表示。實作前先跑 `npx petdex-cli --help` 確認實際指令與素材格式。

**D6. token 零貼上。** plist 內為 placeholder，實際 token 走不進版控的 local plist / 環境變數帶入；`.gitignore` 排除含 token 的檔案。

## Implementation Contract

**Behavior（可觀測行為）：**

- 啟動我方 server 後，`GET http://127.0.0.1:8787/api/status` 回傳 JSON，含 `claude` 與 `codex` 各自的 `windows`（session/weekly 的 usedPercent/remainingPercent/resetAt）、`cost`（todayUSD/last30DaysUSD）、以及即時 `activity` 欄位（值為 `idle` / `working` / `exhausted` 之一）。
- `GET /` 回傳單一自包含 HTML dashboard；`GET /pets/*` 回傳靜態寵物素材。
- 手動觸發一次 Claude Code / Codex 對話後 5~10 秒內，對應 provider 的 `activity` 由 `idle` 轉 `working`；停手約 60 秒後回 `idle`。
- 停掉 `codexbar serve` 後，`/api/status` 仍回上次快取並帶「資料稍舊/CodexBar 未連上」標記，HTTP 不 500、頁面不崩。

**Interface / data shape：**

- `/api/status` 回傳形狀（欄位名以實作探勘的實際 snapshot 為準）：
  - `providers.claude` / `providers.codex`：`{ windows: [{ kind, usedPercent, remainingPercent, resetAt }], cost: { todayUSD, last30DaysUSD }, activity }`
  - `updatedAt`：最新快照時間；`stale`：boolean（快取是否過舊）；`formatError`：boolean（schemaVersion 不符）。
- collector 對外：`codexBarSnapshot.js` 匯出取得/刷新快照的函式；`activity.js` 匯出「傳入 provider 與 windows → 回傳 activity 字串」的純函式。
- 活動偵測資料源路徑：`~/.claude/projects/**/*.jsonl`、`~/.codex/sessions/**/*.jsonl`。

**Failure modes：**

- CodexBar 抓取失敗（連線拒絕/逾時/401/429）→ 沿用 `data/snapshot.json` 上一份，標 `stale: true`，不重寫 backoff。
- schemaVersion 不認得 → 標 `formatError: true`，前端顯示格式不符。
- 完全無快取可用（首次啟動且 serve 未就緒）→ 回 loading 狀態，前端顯示載入中，不崩潰。

**Acceptance criteria：** 對應 proposal/tasks 的 7 條驗收指令（snapshot providers 含 codex+claude、`/api/status` 含 activity、對話觸發 working、serve 停掉不崩、iPhone 可連、grep 無明文 token、logs 無未處理例外）。

**Scope boundaries：**

- 範圍內：collector 兩模組、node:http server 三路由、前端單頁、兩份 plist、README 安裝與除錯、iPhone 連線說明。
- 範圍外：CodexBar 本身的安裝/登入/backoff、實際 `launchctl load`（交使用者手動）、實際 commit/push、petdex 素材以外的圖庫。

## Risks / Trade-offs

- [CodexBar 為外部依賴，schemaVersion 可能改版] → schemaVersion 檢查 + fail-loud 標記，並可比對 `/health` 的 version 欄位偵測版本變動。
- [launchd 不載入 nvm shim，node 換版本 plist 不會自動更新] → 路徑寫死絕對路徑並在 README 註記維護提醒。
- [花費為本機 session log 推算，換電腦看不到歷史] → 花費數字旁標「本機推算」，額度環不加警語。
- [petdex 無原生睡眠幀] → 用 idle 幀 + CSS/emoji 疊加，不期待素材內建。
- [Keychain 背景常駐可能觸發授權彈窗] → README 指示將 CodexBar.app 加入 Keychain「Always allow」，一次性處理。
- [活動偵測 60s 門檻可能在長時間思考/串流時誤判 idle] → 接受此近似；決議 D2 已定案只用 mtime，避免 ps 複雜度。
