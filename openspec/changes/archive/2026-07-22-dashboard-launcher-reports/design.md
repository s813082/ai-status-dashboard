## Context

Change A 完成後，資料由 tokscale CLI 提供，`/api/status` 契約與現有主畫面不變，且 tokscale 具備歷史用量能力（`monthly --json`、`models --json`、`graph`）。現有前端為單一 `src/public/index.html`（inline CSS/JS、無框架、無圖表庫、無前端路由、硬編碼繁中），設定僅有齒輪 modal（螢幕恆亮 + 換寵物）。本案在不引入框架的前提下擴充為多視圖並補歷史報表與體驗層。

## Goals / Non-Goals

**Goals:**

- 新增 Launcher 首頁與可切換的多視圖，現有主畫面成為其一，回歸零風險。
- 呈現日/週/月/自訂區間折線、工具佔比圓餅、連續使用熱力圖。
- 提供 i18n（tw/en）、集中設定頁與額度警示通知。
- 除單一 vendored 圖表庫外維持零 npm 執行期依賴、離線可用。

**Non-Goals:**

- 不改 Change A 的 `/api/status` 契約與 collector 內部。
- 不新增 antigravity provider。
- 不引入前端框架或打包工具。
- 不重寫寵物系統。

## Decisions

### 單一 index.html 內以 hash 路由切換多視圖

以極簡 hash-based router（監聽 `hashchange`，用一張 route→render 對照表切換各 `<section>` 的 `hidden`）在單檔內提供 `#/`、`#/today`、`#/usage`、`#/pie`、`#/heatmap`、`#/alerts`、`#/settings`。週/月/自訂區間報表**合併於單一 `#/usage` 視圖**，以期間下拉切換（而非三個獨立路由），降低視圖數與導覽複雜度。現有 header 與兩張卡的 DOM/JS 原封包進 `#/today` section。理由：維持零框架與單檔架構，回歸風險最低。替代方案（改多 HTML 檔或引入前端框架）違反專案零依賴哲學，不採。

### Route-aware 輪詢，報表頁暫停 5 秒 tick

僅在 `#/` 或 `#/today` 執行既有 5 秒 `/api/status` 輪詢；切離時暫停，進入報表頁改為一次性（或較長間隔）抓對應報表 API。理由：報表資料來自 spawn tokscale，若維持 5 秒節奏會造成過量子行程。

### 報表 API 經 tokscaleReports.js 短 TTL 快取與 in-flight 串行化

新增 `src/collectors/tokscaleReports.js`，對 daily/monthly/models/graph/custom 各方法加記憶體快取（TTL 60–120 秒）並串行化同 key 的 in-flight 請求；`server.js` 的報表端點只讀此層。理由：避免每個 HTTP 請求都 spawn tokscale，並吸收前端重複請求。

### 本地 vendored Chart.js 繪折線與圓餅，熱力圖手刻

將 `chart.umd.min.js` 置於 `src/public/vendor/` 並經 `/vendor/*` 靜態路由本地載入（不走 CDN）。`#/usage` 用 Chart.js **堆疊面積圖**（line + `fill` + y 軸 `stacked`）呈現逐日、分工具（`byClient`）花費——比長條更能同時看出趨勢與組成；`#/pie` 用甜甜圈圖，並提供「依工具 / 依模型」分組切換；連續使用熱力圖以 `graph` 的 `intensity`（0–4）手刻 52 週 × 7 天 CSS grid。理由：面積/圓餅用宣告式圖表庫最省事，熱力圖手刻比第三方 matrix plugin 更輕可控；本地打包確保離線可用。替代方案 D3 過於低階、維護成本高，不採。

### i18n 以 data-i18n 屬性與 t(key) 查表實作

新增 `src/public/i18n.js` 定義 `{ tw, en }` 字串表；HTML 靜態文字標 `data-i18n`，`applyI18n(lang)` 走訪填入，JS 動態文字改 `t(key)`；語言存 `localStorage` 並可持久化至設定。理由：零依賴、可增量替換現有硬編碼字串。

### 集中設定以 data/settings.json 與 /api/settings 持久化

新增 `data/settings.json`（讀寫韌性比照 `pet-config.json`）與 `GET`/`POST /api/settings`，涵蓋呼叫頻率、語言、主題、螢幕恆亮、各 provider 顯示、寵物樣式（沿用既有端點）、花費預算上限與警示閾值。齒輪 modal 的功能升級為 `#/settings` 視圖。

### 額度警示通知含 iPhone 非安全來源降級

前端在每次 `/api/status` 取得 `windows` 後判斷 `weekly.usedPercent >= thresholdPercent`（預設 85%）：桌面/localhost 用 `Notification` API；`Notification` 不可用（iPhone LAN 走 http 非安全來源或權限遭拒）時降級為頁內固定橫幅；以 `localStorage` 記錄當前 `resetAt`，同一週期只提醒一次。理由：Notification API 僅在安全來源可用，必須有降級路徑。

## Implementation Contract

- **Behavior**：開啟 `/` 先看到 Launcher 首頁（8 項可點）；`#/today` 呈現與現況相同的額度環與寵物；`#/weekly`、`#/monthly` 顯示折線、`#/pie` 顯示工具佔比圓餅、`#/heatmap` 顯示連續使用熱力圖、`#/custom` 可選區間查詢；`#/settings` 可調整偏好並持久化；`#/alerts` 與全域判斷在達閾值時通知或顯示橫幅；切換至報表視圖時 5 秒 `/api/status` 輪詢暫停、返回 `#/today` 恢復。
- **Interface / data shape**：
  - 報表端點（皆 GET、no-store、永不 500）：`/api/usage/daily?range=week|month`、`/api/usage/monthly`、`/api/usage/models`、`/api/usage/graph?range=year|month`、`/api/usage/custom?since=&until=`；成功回 `{ ok: true, data }`，失敗回 `{ ok: false, error, data: null }`。
  - 設定端點：`GET /api/settings` 回目前設定物件；`POST /api/settings` 接受部分更新並回合併後結果。
  - 靜態：`GET /vendor/<asset>` 回 `src/public/vendor/` 下檔案，含路徑穿越防護。
  - `src/collectors/tokscaleReports.js` 匯出各報表取用函式，內建 TTL 快取與同 key in-flight 串行化。
  - `src/public/i18n.js` 匯出 `I18N`（`{ tw, en }`）與 `applyI18n` / `t`。
  - `data/settings.json` 結構含 `pollIntervalMs`、`lang`、`theme`、`keepAwake`、`providerVisibility`、`pets`、`budgets[{ provider, budgetUSD, thresholdPercent }]`。
- **Failure modes**：任一報表端點於 tokscale 未裝/失敗回 `{ ok: false, error, data: null }`，前端顯空狀態；`custom` 端點對非 `YYYY-MM-DD` 輸入或過大區間回 400/錯誤且不 spawn；`/api/settings` 寫入失敗沿用舊值並回錯誤；`Notification` 不可用時降級橫幅、不拋錯。
- **Acceptance criteria**：
  - `curl -s "localhost:8787/api/usage/monthly"`、`/api/usage/models`、`/api/usage/daily?range=week`、`/api/usage/graph?range=year`、`/api/usage/custom?since=2026-07-01&until=2026-07-07` 皆回合法 JSON 且含 `ok` 欄。
  - `curl -s localhost:8787/api/settings` 回設定物件；`POST` 一項後再 `GET` 反映變更。
  - `curl -s -o /dev/null -w "%{http_code}" localhost:8787/vendor/chart.umd.min.js` 回 200。
  - 瀏覽器：`#/today` 額度環與寵物動畫正常（回歸）；報表各頁有資料或空狀態；切視圖時 5 秒輪詢暫停/恢復；切換語言即時換字；閾值達標時桌面通知或 iPhone 橫幅。
- **Scope boundaries**：
  - 範圍內：`src/public/index.html`（router/多視圖/圖表/i18n 套用/通知/設定頁）、`src/collectors/tokscaleReports.js`、`src/public/i18n.js`、`src/public/vendor/chart.umd.min.js`、`data/settings.json`、`src/server.js`（報表/設定/`/vendor` 端點）、`package.json`（版本 0.4.0）。
  - 範圍外：Change A 的 collector 與 `/api/status` 契約、antigravity provider、寵物系統重寫、CodexBar 檔案移除。

## Risks / Trade-offs

- [報表頁高頻請求 spawn 過量 tokscale] → route-aware 暫停 5 秒 tick + tokscaleReports 短 TTL 快取 + `custom` 區間上限與日期白名單。
- [引入 Chart.js 破壞零依賴哲學] → 僅單一 vendored 檔、本地載入、離線可用；於 `dashboard-ui` spec 明確解除舊約束並限定單一圖表庫。
- [Notification 在 iPhone LAN 不可用] → 一律提供頁內橫幅降級，判斷 `('Notification' in window)` 與權限狀態。
- [多視圖改動誤傷現有主畫面] → 現有 DOM/JS 原封包入 `#/today`、不改內部邏輯，僅外層包 section 與路由。
- [設定/語言/主題狀態分散易不同步] → 單一 `data/settings.json` 為真實來源，前端載入時套用。
