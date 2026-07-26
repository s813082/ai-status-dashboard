# Changelog

本專案的所有重要變更都記錄於此檔。格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號採語意化版本。

## [0.7.1] — 2026-07-26

### Fixed

- **Windows 上未設 `TOKSCALE_BIN` 時抓不到任何資料**：npm 全域安裝只放 `tokscale.cmd`／`.ps1` shim，並不產生 `.exe`，而 `execFile` 在 Windows 不做 PATHEXT 解析，因此裸名 `tokscale` 直接 ENOENT。原先 `buildInvocation` 的 ComSpec 分支只在 binary 已帶 `.cmd`／`.bat` 副檔名時才觸發，等於只有預先解析路徑的 `start-dashboard.ps1` 能運作；`npx`、`npm start`、`node src/server.js` 啟動的 dashboard 全部顯示「無資料」。現在在 win32 且 binary 無副檔名時掃 PATH 尋找 `.exe`／`.cmd`／`.bat` shim，找不到則維持原樣以保留既有 ENOENT 語意。此缺陷自 0.6.0 起存在，由 0.7.0 的 npx 啟動路徑曝出。

### Validation

- 測試 26/26 PASS（新增 4 個 shim 解析回歸測試：PATH 命中 `.cmd`、`.exe` 優先於 `.cmd`、PATH 無 shim 時維持裸名、非 win32 不掃 PATH）。
- 實機驗證：未設 `TOKSCALE_BIN` 直接啟動，`/api/status` 由 `reachable:false` ＋ `tokscale CLI not found` 轉為 `reachable:true`、`lastError:null` 並帶回真實 Claude／Codex 額度。

## [0.7.0] — 2026-07-26

### Added

- npx 一行啟動：新增 `bin/cli.js` 進入點與 `package.json` 的 `bin` 欄位，macOS 與 Windows 皆可用 `npx github:s813082/ai-status-dashboard` 直接執行，不需 clone 或發布至 npm registry。啟動時列出 localhost 與所有 LAN 網址，省去使用者自行查 IP。
- 新增 `src/dataDir.js`：執行期資料目錄解析，順序為 `AISD_DATA_DIR` > 專案 clone 的 `data/` > `~/.ai-status-dashboard`。套件被安裝進 `node_modules`（npx／npm i）時一律走 home，避免寵物選擇與設定被寫進暫時性的 npm 快取而在下次執行時遺失。

### Changed

- `npm start` 改走 `bin/cli.js`；`snapshot.json`、`pet-config.json`、`settings.json` 三處寫檔路徑改由 `dataDir` 解析。既有 clone 安裝維持使用專案 `data/`，行為不變。
- README 全面重整：篇幅由 510 行縮至約 310 行；快速開始改以 npx 一行指令起手；macOS 與 Windows 的常駐設定改為相鄰段落並輔以日常操作對照表，不再分散於文件兩端；Changelog 改為表格摘要並連向本檔。
- CHANGELOG 補回 0.3.0–0.5.0 的完整條目（先前僅存在於 README）並統一補上日期。

### Validation

- 測試 22/22 PASS。
- 以 `npm pack` 打包後安裝至臨時專案驗證：bin shim 正確產生，資料目錄落在 `~/.ai-status-dashboard`；於 repo 內直接執行則仍使用專案 `data/`。
- launchd plist 與 Windows 工作排程皆直接呼叫 `src/server.js`，`require.main` 守衛保留，兩條常駐路徑不受影響。
- `npx github:` 指令需待本次變更 push 至 GitHub 後才能端到端實測。

## [0.6.0] — 2026-07-26

### Added

- Windows LAN MVP：新增 PowerShell 5.1 相容的 setup／startup 腳本，可安裝與驗證 tokscale、建立目前使用者登入排程、限制至 `node.exe` 的 Private-only TCP 8787 Firewall rule，並立即驗證 localhost／LAN API 與顯示 iPhone URL。
- 新增 tokscale Windows command adapter 測試，涵蓋 `.cmd`／`.bat`、`.exe`、macOS／Linux、空白路徑、參數邊界與既有錯誤語意。

### Changed

- tokscale 低階封裝在 Windows 遇到 npm `.cmd`／`.bat` shim 時改由 ComSpec `/d /s /c` 安全啟動並隱藏子程序視窗；直接 executable 與 macOS／Linux 行為維持不變，未啟用全域 `shell: true`。
- README Windows 章節改為已驗證的安裝、啟動、iPhone 連線、除錯與移除流程。

### Validation

- 完整測試 22/22 PASS（既有 12 ＋ Windows adapter 10），PowerShell 5.1 parser 與 setup `-WhatIf` 均通過。
- Windows 實機確認 tokscale、單一登入排程、單一 Private Firewall rule、Node TCP 8787 listener，以及 localhost／Private LAN `/api/status` HTTP 200。

## [0.5.0] — 2026-07-23

### Added

- 矮螢幕／橫向副螢幕自適應：裝置橫放當低高度副螢幕（如 932×430）時，「今日」卡片自動由上下堆疊改為左右並排（寵物左、額度環＋花費＋狀態右），內容維持原尺寸、兩卡並排、底部花費不被裁切。觸發條件為視窗高度 ≤ 520px 且寬度 ≥ 640px；一般桌機與直向手機不受影響。
- 等比縮放保底（fit-to-height）：極矮視窗重排後仍塞不下時，對容器套用 `transform: scale()` 整體縮小保底，確保內容永不裁切。
- 轉向自動歸位縮放：`orientationchange` 時把 pinch 縮放重設回預設比例。

### Fixed

- 手機 pinch 縮放後轉向時比例卡在錯值：改用版面視窗高度 `document.documentElement.clientHeight`（而非受縮放污染的 `window.innerHeight`）計算縮放，並監聽 `visualViewport` 變動即時重算。

## [0.4.0] — 2026-07-22

### Added

- Launcher 首頁與 hash 多視圖：`#/`、`#/today`、`#/usage`、`#/pie`、`#/heatmap`、`#/alerts`、`#/settings`；原主畫面收為 `#/today`。
- 用量報表頁（`#/usage`）：期間下拉（本週／本月／自訂區間），以 Chart.js 堆疊面積圖呈現逐日、分工具花費。
- 工具佔比（`#/pie`）：甜甜圈圖，可切「依工具」或「依模型」分組。
- 使用熱力圖（`#/heatmap`）：手刻 CSS grid 的年度貢獻圖。
- 額度警示（`#/alerts`）：達警示閾值（預設 85%）時桌面 Notification，iPhone LAN 降級為頁內橫幅，同一 reset 週期只提醒一次。
- i18n：繁中／English 即時切換（`src/public/i18n.js`），偏好持久化。
- 設定頁：更新頻率、語言、主題（淺／深／跟隨系統）、各工具顯示開關、螢幕恆亮、花費預算與警示閾值、寵物選擇。
- 報表 API：`/api/usage/{daily,monthly,models,graph,custom}`、`/api/settings`、`/vendor/*`、`/i18n.js`。
- 本地 vendored Chart.js（`src/public/vendor/chart.umd.min.js`，離線可用）。

### Changed

- 報表資料經 `tokscaleReports.js` 短 TTL 快取 ＋ in-flight 串行化；報表視圖暫停 5s `/api/status` 輪詢。

## [0.3.0] — 2026-07-22

### Changed

- 資料源由 CodexBar 改為 tokscale CLI（跨平台）。新增 `tokscale.js`（CLI 封裝）、`tokscaleSnapshot.js`（同介面 collector）、`providers.js`（provider 設定中心）；`/api/status` 對外契約不變。
- Claude 額度取自 `tokscale usage --json`、Codex 取自 `tokscale codex status --json`、花費由 `tokscale graph` 推算。
- Codex `5h` metric 依 `resets_at`（約 7 天）對映為 weekly 環。

### Added

- Claude 額度間歇抓不到時的 usage 重試 ＋ 逐 provider carry-forward，避免額度環閃空白。

### Deprecated

- `codexBarSnapshot.js` 與 `com.barry.codexbar-serve.plist`／`CODEXBAR_DASHBOARD_TOKEN` 標記待淘汰（解除接線，本版未刪）。

## [0.2.0] — 2026-07-21

### Added

- 首次公開發布。
- 網頁換寵物：專案自帶素材庫 `src/public/pets/library/`，齒輪面板可切換 Claude／Codex 兩欄寵物，選擇存 `data/pet-config.json` 並於重整後保留；新增 `GET /api/pets`、`GET /api/config`、`POST /api/select`（允許清單驗證）端點，`/api/status` 併回 `petConfig`。
- 一鍵補貨 script：`npm run add-pet <slug>`（petdex install ＋ 複製進素材庫）。
- iPhone 螢幕恆亮：Screen Wake Lock ＋ 齒輪面板「🔆 恆亮」開關（預設開），含即時「恆亮狀態」診斷；無原生 API 時以隱藏靜音循環影片（`keepawake.mp4`，點一下啟動）備援。
- 標題列即時時鐘（`yyyy/mm/dd HH:MM:SS`，每秒更新）。
- 頁尾極小 live 動畫（三點跳動，裝飾用）。

### Fixed

- 額度環每 5 秒閃爍：前端輪詢時額度／花費資料未變即跳過 SVG 重建，寵物僅在 activity／選定寵物改變時才更新 DOM。
- 閒置寵物閃爍：部分 sprite 的 idle 列不足 8 幀、尾格空白，`steps(8)` 掃到空白會閃；閒置改為靜態幀 ＋ 極細微（約 1px）呼吸縮放，不再掃幀。

## [0.1.0]

### Added

- 初始版本：CodexBar snapshot collector（60s）、mtime 活動偵測、`node:http` server（port 8787）、單頁 dashboard（petdex 寵物動畫、額度環、花費、活動狀態）、兩支 launchd 常駐服務、iPhone Safari 連線支援。
