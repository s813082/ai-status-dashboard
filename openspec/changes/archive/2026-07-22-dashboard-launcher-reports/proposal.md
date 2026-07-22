## Why

現有 dashboard 是單頁、只有一個主畫面（兩張 provider 卡＋額度環＋花費）。在 Change A 完成 tokscale 後端切換後，tokscale 已能提供日/週/月歷史用量與貢獻圖資料，但前端無處呈現。本案新增 Launcher 導覽首頁與多視圖，把主畫面收為其中一頁，並補上歷史報表（折線／圓餅／熱力圖）、i18n、集中設定頁與額度警示通知，讓 dashboard 從「即時額度看板」升級為「即時＋歷史」的完整用量中心。

## What Changes

- **Launcher 首頁與 hash 路由**：以 hash-based route 在單一 `index.html` 內切換視圖：`#/`（Launcher 選單）、`#/today`（現有額度環主畫面）、`#/usage`（週/月/自訂合併）、`#/pie`、`#/heatmap`、`#/alerts`、`#/settings`。現有主畫面 DOM/JS 原封包進 `#/today`。
- **Route-aware 輪詢**：僅 `#/` 與 `#/today` 執行既有 5 秒 `/api/status` 輪詢；切至報表頁暫停該輪詢並改抓對應報表 API，避免報表頁高頻 spawn tokscale。
- **報表 API 與快取**：新增 `GET /api/usage/daily`、`/api/usage/monthly`、`/api/usage/models`、`/api/usage/graph`、`/api/usage/custom`，資料經短 TTL 記憶體快取與同 key in-flight 串行化。
- **圖表**：本地 vendored Chart.js（不走 CDN、離線可用）。`#/usage` 以**堆疊面積圖**呈現逐日、分工具花費；`#/pie` 甜甜圈圖並可切「依工具／依模型」；連續使用熱力圖以手刻 CSS grid 呈現（不引第三方）。**BREAKING**（對 `dashboard-ui` 既有「不引圖表庫」約束）：本案允許引入單一 vendored 圖表庫。
- **i18n**：新增最簡 tw/en 語言機制（`data-i18n` 屬性 + `t(key)` 查表），取代硬編碼繁中字串，語言偏好持久化。
- **集中設定頁**（`#/settings`，讀寫 `data/settings.json`）：API 呼叫頻率、語言、主題（light/dark/auto 手動覆寫）、螢幕恆亮（現有 wake-lock 邏輯搬入）、各 provider 顯示開關、寵物樣式（沿用既有端點）、花費預算上限＋警示閾值。新增 `GET`/`POST /api/settings`。
- **額度警示通知**：`weekly.usedPercent` 達設定閾值（預設 85%）時，桌面/localhost 用 Notification API 通知；iPhone LAN（http 非安全來源）降級為頁內固定橫幅；同一 `resetAt` 週期只提醒一次。
- **靜態資源**：新增 `/vendor/*` 靜態路由（比照 `/pets/` 路徑穿越防護）供本地載入 Chart.js。

## Non-Goals

- 不新增 antigravity provider（其資料源接線屬後續）。
- 不改動 Change A 已定的 `/api/status` 正規化契約與 collector 內部。
- 不重寫寵物系統，僅在設定頁沿用既有 `/api/pets`、`/api/select` 端點。
- 不引入前端框架或打包工具；除單一 vendored 圖表庫外維持零 npm 執行期依賴。

## Capabilities

### New Capabilities

- `usage-reports`: 取得並視覺化日/週/月/自訂區間用量、各工具佔比與連續使用熱力圖，含報表 API 與資料快取。
- `app-settings`: 以 `data/settings.json` 持久化並透過 `/api/settings` 讀寫使用者偏好（呼叫頻率、語言、主題、螢幕恆亮、provider 顯示、預算與警示閾值）。
- `dashboard-i18n`: 前端 tw/en 語言切換機制與字串資源。
- `quota-alerts`: 額度接近閾值時的通知與（非安全來源）降級橫幅。

### Modified Capabilities

- `dashboard-ui`: 由單一畫面改為含 Launcher 首頁與 hash 路由的多視圖；解除「不引圖表庫」約束以允許單一 vendored 圖表庫；現有主畫面成為 `#/today` 視圖並套用 route-aware 輪詢。
- `dashboard-server`: 新增報表與設定的 HTTP 端點，以及 `/vendor/*` 靜態路由。

## Impact

- Affected specs: `dashboard-ui`（修改）、`dashboard-server`（修改）、`usage-reports`（新）、`app-settings`（新）、`dashboard-i18n`（新）、`quota-alerts`（新）
- Affected code:
  - New:
    - src/collectors/tokscaleReports.js
    - src/public/i18n.js
    - src/public/vendor/chart.umd.min.js
    - data/settings.json
  - Modified:
    - src/server.js
    - src/public/index.html
    - package.json
  - Removed:
    - (none)
- Depends on: Change `swap-tokscale-backend`（報表資料來自 tokscale CLI，須先完成後端切換）。
