> 實作 spec 需求「Fit-to-height scaling on short viewports」（dashboard-ui）。

## 1. CSS 準備

- [x] 1.1 在 `src/public/index.html` 的 `.grid` 與 `.tiles` 樣式規則加上 `transform-origin: top center;`，讓縮放錨定頂部、水平置中。不新增任何 media query，縮放值由 JS 以 inline style 動態寫入。

## 2. fitScreen() 縮放邏輯（Fit-to-height scaling on short viewports）

- [x] 2.1 實作 Requirement: Fit-to-height scaling on short viewports — 在 `src/public/index.html` 內嵌 JS 新增 `fitScreen()` 函式：判斷目前 active view，若為 `#view-today` 取 `.grid`、若為 `#view-launcher` 取 `.tiles` 作為縮放目標；其餘 view 直接 return 並清空前述兩容器的 inline transform。
- [x] 2.2 在 `fitScreen()` 內先將目標容器 `style.transform = ""` 清空，再讀 `scrollHeight` 取得未縮放的自然高度 `natural`（確保量測不受既有縮放影響）。
- [x] 2.3 計算可用高度 `avail = window.innerHeight - 容器.getBoundingClientRect().top - 底部留白`，底部留白取 body 底 padding 基準（約 16px 加 `env(safe-area-inset-bottom)`）。
- [x] 2.4 計算 `scale = Math.min(1, avail / natural)`：當 `scale >= 1` 時清空 `style.transform`（正常螢幕維持現狀）；否則寫入 `style.transform = "scale(" + scale + ")"`。不設最小 scale 下限。

## 3. 觸發時機接線

- [x] 3.1 在既有 view 切換／路由邏輯（進入 `#/today` 或 `#/launcher` 後）呼叫 `fitScreen()`。
- [x] 3.2 綁定 `window` 的 `resize` 與 `orientationchange` 事件觸發 `fitScreen()`，以約 100ms debounce 去抖。
- [x] 3.3 以 `ResizeObserver` 觀察 `.grid` 與 `.tiles`，在容器內容尺寸變動（輪詢後環圈／費用 render 撐高）時呼叫 `fitScreen()`。為避免無限迴圈，量測以 `scrollHeight`（不受 transform 影響的 layout 高度）為準，並僅在 scale 值有變化時才寫入 transform，必要時以 `requestAnimationFrame` 去抖。

## 4. 驗證

- [x] 4.1 `npm start` 後於 Chrome DevTools 裝置模擬設 932×430 landscape，開 `#/today`：確認卡片底部費用（$…）、費用備註、狀態行完整顯示無裁切。
- [x] 4.2 同尺寸開 `#/`（首頁選單）：確認 6 個 tile 完整顯示無裁切。
- [x] 4.3 拖曳視窗高度：變矮→容器等比縮小；高度足夠（一般桌機視窗）→ scale=1，畫面與現狀完全一致、無異常留白。
- [x] 4.4 切到 `#/settings`、`#/usage` 再切回 `#/today`：確認縮放正確重算、其他頁面樣式與行為不受影響。
- [x] 4.5 等一次輪詢資料 render 後（環圈／費用出現）：確認高度自動重算、仍完整顯示、無跳動或殘影。

## 5. 橫向重排（Landscape reflow on short wide viewports）

- [x] 5.1 實作 Requirement: Landscape reflow on short wide viewports — 在 `src/public/index.html` 的 `<style>` 內、`.prov-err` 規則之後新增 media query `@media (max-height: 520px) and (min-width: 640px)`，作為矮且寬螢幕的橫排斷點。
- [x] 5.2 在該斷點內把 `.card` 設為 CSS Grid：`grid-template-columns: auto 1fr` 搭配 `grid-template-areas`（title 橫跨頂列、pet 佔左欄跨列、rings/cost/note/status/err 依序在右欄），並為 `h2`/`.pet-stage`/`.rings`/`.cost`/`.cost-note`/`.status`/`.prov-err` 各指派對應 `grid-area`；立繪 `.pet-stage` 高度維持 150px 不縮。
- [x] 5.3 在該斷點內把 `.grid` 的 `max-width` 放寬到 900px，讓兩張橫排卡片仍能並排於同一畫面。
- [x] 5.4 驗證 Requirement: Fit-to-height scaling as short-viewport fallback — 確認 scale-to-fit JS 邏輯不需改動：橫排後自然高度下降，一般矮螢幕 scale=1，極矮螢幕才回落 scale<1 保底（兩機制同軸疊加）。
- [x] 5.5 修復手機 pinch 縮放後轉向比例卡住：`fitScreen()` 可用高度改用 `document.documentElement.clientHeight`（版面視窗，pinch 穩定）而非 `window.innerHeight`（會被視覺視窗縮放污染）；新增 `window.visualViewport` 的 `resize`/`scroll` 監聽觸發重算，並讓 `orientationchange` 延遲（雙 rAF ＋ 300ms）再量測以待尺寸更新。
- [x] 5.6 轉向時自動把 pinch 縮放歸位到預設值：`orientationchange` 時暫將 viewport meta 加上 `maximum-scale=1` 逼瀏覽器重設縮放，350ms 後還原原 content 以保留使用者後續可自由縮放。

## 6. 橫排驗證

- [x] 6.1 932×430 開 `#/today`：兩張卡片並排、每張為橫向（立繪左、資料右）、立繪 150px 全尺寸、費用/備註/狀態完整無裁切，且 `#view-today .grid` 的 inline transform 為空（scale=1，未縮放）。
- [x] 6.2 932×300（極矮）：確認 scale fallback 介入（transform 出現 `scale(<1)`）、內容仍完整。
- [x] 6.3 1280×900（一般桌機）：確認斷點未觸發、`.card` 為 `display:block` 原直向堆疊、無縮放、與現狀一致。
- [x] 6.4 轉向來回序列（932×430 landscape → 430×932 portrait → 932×430 landscape）：確認轉回橫向後 `#view-today .grid` 狀態與初次一致（`display:grid`、transform 為空、費用完整），比例正確恢復不卡住；viewport meta 於轉向後正確還原為預設 content。
