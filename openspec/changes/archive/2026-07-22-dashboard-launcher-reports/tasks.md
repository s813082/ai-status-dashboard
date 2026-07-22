> 依賴：須先完成 change `swap-tokscale-backend`（報表資料來自 tokscale CLI）。前置條件（非本清單任務）：tokscale Codex 授權 401 已於 Change A 前置修復或 Codex 以「無資料」呈現。

## 1. 後端報表與設定端點

- [x] 1.1 於 src/collectors/tokscaleReports.js 建立報表資料層，實作設計決策「報表 API 經 tokscaleReports.js 短 TTL 快取與 in-flight 串行化」並滿足需求「Report data caching」：對 daily/monthly/models/graph/custom 各方法加 60–120 秒 TTL 記憶體快取與同 key in-flight 串行化。驗證：連續兩次同 key 呼叫，斷言第二次命中快取未再 spawn（以呼叫計數或 spy 驗證）。
- [x] 1.2 於 src/server.js 新增報表端點 `GET /api/usage/daily?range=week|month`、`/api/usage/monthly`、`/api/usage/models`、`/api/usage/graph?range=year|month`、`/api/usage/custom?since=&until=`，滿足需求「Usage report endpoints」：成功回 `{ ok:true, data }`、失敗回 `{ ok:false, error, data:null }`、`Cache-Control: no-store`，且 `custom` 對非 `YYYY-MM-DD` 或過大區間拒絕且不 spawn。驗證：`curl -s localhost:8787/api/usage/monthly` 等各端點回含 `ok` 的合法 JSON；非法 `custom` 參數回錯誤且未觸發 tokscale。
- [x] 1.3 於 src/server.js 新增 `GET`/`POST /api/settings` 並以 data/settings.json 持久化，實作設計決策「集中設定以 data/settings.json 與 /api/settings 持久化」，滿足需求「Settings endpoints」與需求「Persisted user settings」的持久層：結構含 `pollIntervalMs`/`lang`/`theme`/`keepAwake`/`providerVisibility`/`pets`/`budgets[]`，寫入失敗沿用舊值並回錯誤。驗證：`POST` 一項後 `GET /api/settings` 反映變更；模擬寫入失敗斷言回錯誤且保留舊值。
- [x] 1.4 於 src/server.js 新增 `GET /vendor/<asset>` 靜態路由（比照 `/pets/` 路徑穿越防護），滿足需求「Vendor static route」。驗證：`curl -s -o /dev/null -w "%{http_code}" localhost:8787/vendor/chart.umd.min.js` 回 200；逃逸路徑請求被拒。

## 2. 前端路由與多視圖

- [x] 2.1 於 src/public/index.html 加 hash router 與 Launcher 首頁，實作設計決策「單一 index.html 內以 hash 路由切換多視圖」，滿足需求「Launcher home page and hash routing」與需求「Two-column dashboard layout」：`#/` 顯示 8 項選單，現有主畫面 DOM/JS 原封包進 `#/today` section，切換僅改各 section 的 `hidden`。驗證：瀏覽器載入 `/` 顯示 Launcher；點 today 後額度環與寵物與改動前一致；切換路由僅對應 section 可見。
- [x] 2.2 實作設計決策「Route-aware 輪詢，報表頁暫停 5 秒 tick」，滿足需求「Route-aware status polling」：僅 `#/`/`#/today` 執行 5 秒 `/api/status` 輪詢，切至報表頁暫停、返回恢復。驗證：切到 `#/weekly` 後以 network 面板或 log 斷言 `/api/status` 停止輪詢，返回 `#/today` 後恢復。

## 3. 圖表與報表視覺化

- [x] 3.1 置入 src/public/vendor/chart.umd.min.js 並實作設計決策「本地 vendored Chart.js 繪折線與圓餅，熱力圖手刻」，滿足需求「Consolidated usage report view」與「Contribution heatmap」：`#/usage` 以本地 Chart.js **堆疊面積圖**畫逐日、分工具（`byClient`）花費，期間下拉切本週/本月/自訂；連續使用熱力圖（`#/heatmap`）以 `intensity`(0–4) 手刻 52 週×7 天 CSS grid；報表 API 回 `{ok:false}` 時顯空狀態。驗證：各報表頁有資料時繪圖、無資料時顯空狀態；Chart.js 由 `/vendor/` 載入無外部請求。
- [x] 3.2 於 `#/usage` 視圖的「自訂」期間實作需求「Consolidated usage report view」的自訂區間：以 `YYYY-MM-DD` 起訖呼叫 `GET /api/usage/custom` 並渲染；並實作需求「Tool-share breakdown」：`#/pie` 甜甜圈圖，分組可切依工具（client）或依模型（model）。驗證：選有效區間後渲染對應用量、無效輸入不送出或顯 hint；圓餅切工具/模型各正確聚合。

## 4. i18n

- [x] 4.1 新增 src/public/i18n.js 並實作設計決策「i18n 以 data-i18n 屬性與 t(key) 查表實作」，滿足需求「Traditional Chinese and English localization」：定義 `{tw,en}`，靜態文字標 `data-i18n`、動態文字改 `t(key)`，語言存 `localStorage`、預設 `tw`，取代硬編碼繁中字串。驗證：切 en/tw 後 UI 文字即時切換；重整後沿用上次語言。

## 5. 設定頁前端

- [x] 5.1 於 `#/settings` 視圖實作需求「Persisted user settings」的前端套用：呼叫頻率、語言、主題（light/dark/auto 手動覆寫）、螢幕恆亮（現有 wake-lock 邏輯搬入）、各 provider 顯示開關、寵物樣式（沿用 `/api/pets`、`/api/select`）、花費預算上限＋警示閾值，載入時套用並經 `/api/settings` 持久化。驗證：於設定頁切主題/隱藏 provider/調頻率後，`#/today` 反映變更且重整後保留。

## 6. 額度警示

- [x] 6.1 實作設計決策「額度警示通知含 iPhone 非安全來源降級」，滿足需求「Weekly quota threshold alerting」：`weekly.usedPercent` 達閾值（預設 85%）時桌面/localhost 用 Notification API、iPhone LAN 降級頁內橫幅，並以 `localStorage` 記 `resetAt` 使同週期只提醒一次。驗證：localhost 達標觸發桌面通知；模擬 `Notification` 不可用時顯橫幅；同週期多次輪詢僅提醒一次。

## 7. 版本與驗收

- [x] 7.1 package.json 版本更新為 0.4.0。驗證：`node -p "require('./package.json').version"` 輸出 `0.4.0`。
- [x] 7.2 端到端驗收：`curl` 各 `/api/usage/*`、`/api/settings`、`/vendor/chart.umd.min.js` 皆如契約回應；瀏覽器走訪 Launcher→各視圖，確認 `#/today` 回歸、報表有資料/空狀態、語言切換、閾值通知/橫幅、route-aware 輪詢暫停恢復皆符合。驗證：逐項對照本任務各驗證輸出，全部通過。
