## Why

Barry 想在桌上放一台閒置 iPhone 當常駐副螢幕，隨時看到 Claude Code / Codex 目前的用量狀態（週額度、5 小時額度剩餘、今日/本週花費），並要有互動感——像 codex-pets 那樣的小寵物角色，工作中會動、額度用完會睡著。既有的螢幕鏡射方案（Sidecar 不支援 iPhone、Duet/Luna 要付費、Deskreen 本質仍是連區網），都不如直接做一個本地 web dashboard 給 iPhone Safari 連來得簡單、免安裝、免費。

## What Changes

- 新增一個純 `node:http` 的本地 web server（監聽 8787），提供 `GET /`（dashboard 頁面）、`GET /pets/*`（寵物素材）、`GET /api/status`（記憶體內最新快照 + 即時活動狀態）三個路由。
- 新增 collector 層：每 60 秒向本機 `codexbar serve` 的 `/dashboard/v1/snapshot` 抓取正規化後的用量/花費（僅取 `id === 'codex'` 與 `id === 'claude'`，其餘 provider 忽略），並落地到 `data/snapshot.json`；抓取失敗沿用上一份快取。
- 新增純檔案 mtime 的活動偵測（**不使用 ps**）：掃 `~/.claude/projects/**/*.jsonl` 與 `~/.codex/sessions/**/*.jsonl` 最新 mtime，近 60 秒內有寫入 = `working`，額度觸底 = `exhausted`，其餘 = `idle`；於每次 `/api/status` 請求時即時計算。
- 新增單一自包含前端頁面（inline CSS/JS，無框架、無圖表庫，手刻 inline SVG）：兩欄（Claude Code / Codex），各含 petdex 寵物動畫、兩條額度環（5hr / 週）、今日/本週花費（標「本機推算」）、狀態文字與「更新於 X 分鐘前」。前端每 ~5 秒 poll `/api/status` 更新 DOM。
- 新增兩支 launchd 常駐服務：`com.barry.codexbar-serve`（資料源頭）與 `com.barry.ai-status-dashboard`（我方 server），皆 `RunAtLoad` + `KeepAlive`，路徑寫死絕對路徑，token 走環境變數。
- 新增 iPhone 連線支援：首選 `YOUR-MAC.local:8787`（Bonjour/mDNS），加 `apple-mobile-web-app-capable` 與 `apple-touch-icon` 支援「加入主畫面」全螢幕。

## Non-Goals (optional)

- 不自己實作額度/花費的抓取、OAuth、Keychain 讀取、429 backoff、last-known-good 快取——這些一律交給 CodexBar，我方只讀正規化後的 snapshot（決議 D1）。
- 不改用 CLI 直呼 `codexbar usage`（其原始 JSON 形狀與 snapshot 不同，一律以 snapshot 為準）。
- 不使用 `ps` 判斷活動狀態（決議 D2）。
- 不引入 Express、前端框架、圖表庫，不裝與本專案無關的套件。
- 不做鏡射整個 Mac 桌面；不做帳號登入/多使用者；不做歷史趨勢圖表（花費換電腦看不到歷史）。
- 不為了更即時而調低 CodexBar 的 `--refresh-interval`（會觸發 429），額度/花費固定 60s；即時性靠前端 5s poll 活動狀態達成（決議 D4）。

## Capabilities

### New Capabilities

- `usage-collector`: 從本機 CodexBar serve 抓取正規化用量/花費快照並落地快取，含 schemaVersion 檢查與失敗 fallback；以及純檔案 mtime 的 working/idle/exhausted 活動偵測。
- `dashboard-server`: 純 `node:http` 服務，提供頁面、靜態素材與 `/api/status` JSON 端點，永不因 collector 失敗而崩潰。
- `dashboard-ui`: 單一自包含前端頁面，含 petdex 寵物動畫（含額度用完睡著效果）、額度環、花費、狀態文字，5s 前端 poll 與 iPhone 全螢幕支援。
- `launchd-daemon`: 兩支 launchd 常駐服務定義與安裝流程，token 以 placeholder 進版控、實際值走不進版控的方式帶入。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `usage-collector`、`dashboard-server`、`dashboard-ui`、`launchd-daemon` 四個 capability。
- Affected code:
  - New:
    - package.json
    - .gitignore
    - README.md
    - CHANGELOG.md
    - src/server.js
    - src/collectors/codexBarSnapshot.js
    - src/collectors/activity.js
    - src/public/index.html
    - src/public/pets/
    - launchd/com.barry.codexbar-serve.plist
    - launchd/com.barry.ai-status-dashboard.plist
  - Modified: (none，全新專案)
  - Removed: (none)
- 外部依賴：CodexBar（`/opt/homebrew/bin/codexbar`，資料源）、petdex-cli（寵物素材，一次性下載）。
- 執行環境：macOS launchd（不載入 nvm shim，node 路徑寫死絕對路徑）。
