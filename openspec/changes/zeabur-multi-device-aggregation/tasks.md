> 執行順序為增量 A（第 1–2 組）→ 增量 C（第 3 組）→ 增量 B（第 4 組）→ 端到端（第 5 組）。
> 增量 A 不需要資料 repo、Zeabur 或任何憑證即可完成並驗證。

## 1. 聚合核心與遠端 collector（remote-usage-aggregation）— 增量 A

- [ ] 1.1 實作 Cross-device aggregation rules — `src/collectors/aggregate.js` 聚合純函式（不含任何 I/O）：`cost.todayUSD`／`last30DaysUSD` 對 `error===null` 的裝置加總；`windows` 與 `resetAt` 取 `generatedAt` 最新裝置的整組值，嚴禁百分比相加；`activity` 任一裝置 `working` 即 `working`；`error!==null` 的裝置排除於花費加總但其額度仍可參與「取最新」。驗證：單元測試餵三份 mock 裝置 JSON（cost 9／5／0，`generatedAt` 一新一舊一最舊，其中一台 `error!==null`）→ 斷言 `cost.todayUSD===14`、`windows` 取到最新那台、錯誤裝置未污染總額。
- [ ] 1.2 實作 Data source selection via DATA_SOURCE 的 github 分支 — `src/collectors/githubSnapshot.js`：以 `GITHUB_TOKEN` 從 `GITHUB_DATA_REPO`／`GITHUB_DATA_BRANCH` 取得 `devices/*.json` 並解析，對外提供與 `tokscaleSnapshot.js` 相同的 `init`／`startPolling`／`refresh`／`getSnapshot` 介面（Node 18 內建 `fetch`，不新增相依）。驗證：以攔截 fetch 的假回應注入兩份裝置 JSON，斷言 `getSnapshot()` 回傳聚合後結果且欄位結構與 local 模式一致。
- [ ] 1.3 實作 Resilient remote fetch — 遠端韌性：fetch 失敗時沿用上一份快照並標 `stale`、`/api/status` 永不 500；最新裝置 `generatedAt` 超過門檻（預設 15 分鐘）時標頂層 `stale`；單一裝置檔 JSON 解析失敗時跳過該檔而不使整批失敗。驗證：單元測試模擬 fetch throw、逾期資料、單檔壞 JSON 三種情況，斷言回應非 500、`stale===true`、其餘裝置仍正常計入。
- [ ] 1.4 達成 Preserve the /api/status output contract — 對齊輸出契約：github 模式輸出的 `providers[].windows`／`cost`／`activity`／頂層 `stale`、`loading` 欄位與 local 模式完全一致，另附 `byDevice` 明細陣列且不改動既有欄位。驗證：以相同 mock 資料分別跑 local 與 github 兩模式，比對 `/api/status` 的鍵集合一致（`byDevice` 除外）。

## 2. 資料源切換與 activity 修正（server）— 增量 A

- [ ] 2.1 新增 `src/collectors/index.js` factory：依 `DATA_SOURCE` 回傳 collector（`github` → githubSnapshot、未設或 `local` → 現有 tokscaleSnapshot），`src/server.js` 改由此 factory 取得 collector（目前直接 require 的三處為 `snapshot.init()`、`snapshot.startPolling()`、`snapshot.getSnapshot()`）。驗證：`DATA_SOURCE=local` 啟動時 `/api/status` 結構與改動前一致，且以 spy 斷言未發出任何 GitHub 請求；`DATA_SOURCE=github` 啟動時斷言未 spawn tokscale 子行程。
- [ ] 2.2 實作 Activity source follows the selected data source — 修正 `buildStatus` 的 activity 來源：目前無條件呼叫 `activity.computeActivities()`（讀本機 `~/.claude/projects`／`~/.codex/sessions` 的 mtime），在雲端容器會全數回 `idle` 並覆蓋聚合結果。改為 local 模式維持現行行為、github 模式改用聚合出的 activity 且不觸碰本機路徑。驗證：github 模式下以不存在本機 session 路徑的環境啟動，斷言某 provider 的 activity 仍能因裝置回報而為 `working`。
- [ ] 2.3 實作 Access control for the public dashboard — `DASHBOARD_TOKEN` 存取控制中介：以 `?token=<值>` 比對成功後 Set-Cookie（httpOnly、Secure、SameSite=Lax、長效期）並轉址；後續請求以 cookie 驗證；未通過者回 401 且不外露任何用量或花費資料。驗證：無 token 打 `/api/status` → 401 且回應主體不含 `cost`／`windows`；帶正確 `?token=` → 302 且帶 Set-Cookie；僅帶該 cookie → 200。

## 3. 裝置上傳端（device-usage-upload）— 增量 C

- [ ] 3.1 落實 Upload credential isolation — 建立 GitHub private 資料 repo（建議 `s813082/ai-usage-data`）並建立 `devices/` 目錄；產生僅具該 repo contents 寫入權限的憑證，存於各宿主的本機憑證檔或環境變數，不進版控。驗證：以該憑證手動 PUT 一個測試檔成功，且 repo 為 private。
- [ ] 3.2 實作 Per-device usage snapshot upload contract — `scripts/upload-usage.js`（三種宿主共用單一實作）：呼叫 tokscale 取額度與花費、複用 `tokscaleSnapshot.normalize()` 正規化、包上 `deviceId`／`os`／`generatedAt`（UTC ISO）／`tokscaleVersion`，以 GitHub contents API 單一 PUT 覆寫 `devices/<deviceId>.json`（不走 git clone／commit／push）。宿主差異僅限 `deviceId` 與排程註冊方式。驗證：在 macOS 實跑一次，資料 repo 出現 `devices/mac.json`，內容含全部必填欄位且 grep 不到任何憑證。
- [ ] 3.3 完成 Scheduled execution per host type 的 macOS 與 Windows 部分（間隔 5–15 分鐘）：macOS 新增 `launchd/com.barry.ai-usage-upload.plist`（比照現有 plist 風格，需填絕對路徑與 `PATH`）；Windows 沿用 `scripts/windows/setup.ps1` 既有的排程註冊邏輯新增一項上傳工作。驗證：兩台各等一個週期後，`devices/mac.json` 與 `devices/windows.json` 的 `generatedAt` 均自動更新。
- [ ] 3.4 落實 Hosts without local session logs still report — 處理 hermes-agent 容器：先確認容器內 tokscale 執行檔實際位置（`/opt/data/.config/tokscale` 設定目錄存在但互動 shell 的 PATH 找不到執行檔），必要時重裝並確認 `tokscale usage --json` 可回額度；再掛上容器內 cron。若確認該容器無 session log，其 `cost` 回報為 0／null，僅貢獻額度。驗證：`devices/hermes.json` 出現於資料 repo 且 `generatedAt` 隨週期更新。
- [ ] 3.5 使容器排程在重啟後仍生效：crontab 寫入持久化磁碟（`/opt/data`）或於容器啟動時重新套用，擇一實作並在文件記錄所選方式與理由。驗證：重啟該 service 後等一個週期，`devices/hermes.json` 仍持續更新。
- [ ] 3.6 撰寫「新增裝置 SOP」文件（安裝 tokscale → 設定 `deviceId` → 佈署憑證 → 註冊排程 → 首次上傳驗證），並註明 hermes-agent 若被範本重建需重跑此流程。驗證：依文件在一台全新裝置走一遍，能成功完成首次上傳。

## 4. Zeabur 部署組態（cloud-deployment）— 增量 B

- [ ] 4.1 達成 Containerized deployment to Zeabur — 新增 `Dockerfile`（Node 18-slim、`npm start`），確保容器綁 `process.env.PORT` 與 `0.0.0.0`，且映像內不含 tokscale 與任何憑證。驗證：本機 `docker build` 成功，以 `-e PORT=9000` 啟動後容器內 `/api/status` 於 9000 埠回應。
- [ ] 4.2 落實 No credentials in source or logs — 部署至 Zeabur 並設定環境變數（`DATA_SOURCE=github`、`GITHUB_TOKEN`、`GITHUB_DATA_REPO`、`GITHUB_DATA_BRANCH`、`REFRESH_MS`、`DASHBOARD_TOKEN`），全部環境變數化不寫死；整理部署說明。驗證：`grep -rE "ghp_|github_pat_|sk-" src/ scripts/ Dockerfile` 無任何命中，且雲端 `/api/status` 帶正確 cookie 可回 200。

## 5. 端到端驗收

- [ ] 5.1 端到端：三台裝置皆有上傳後，確認雲端 dashboard 的花費為三台加總、額度取自最新回報者。驗證：以各裝置檔中的 `cost.todayUSD` 手算總和，與畫面顯示數字相符；額度數值與 `generatedAt` 最新的裝置檔一致。
- [ ] 5.2 端到端：手動修改資料 repo 內某裝置檔的花費數字 → dashboard 在一個 `REFRESH_MS` 週期內反映新數字。驗證：修改後於一個輪詢週期內重打 `/api/status`，數字已更新。
- [ ] 5.3 iPhone 實機：以 `?token=` 開啟一次後加入主畫面，確認後續啟動免再驗證，且畫面能正常顯示聚合數字。驗證：實機操作確認，並於 cookie 效期內重啟 app 不跳驗證。
