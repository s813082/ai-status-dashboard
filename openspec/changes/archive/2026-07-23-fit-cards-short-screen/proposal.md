## Why

當 i11 裝置當副螢幕（低高度 landscape，約 932×430）顯示「今日」畫面時，卡片內容全用固定 px 高度（header + 立繪 150px + 環圈 92px + 各 padding，總高約 480–490px）超出可視高度，導致卡片底部的費用數字被裁切、無法完整顯示。

初版採 JS 等比 scale-to-fit 塞進畫面，但會連帶把用不完的寬度方向一起縮小，立繪與文字都變小（932×430 實測 scale≈0.77）。實際上 932×430 是「很寬但很矮」，直向堆疊（立繪在上→環圈→費用）把高度吃爆、寬度大量閒置。故改以「偵測矮螢幕時改排版」為主，縮放僅作極矮螢幕保底。

## What Changes

- **主要方案 — 橫向重排**：新增 height-based + width-guard 的 media query（`max-height: 520px and min-width: 640px`），在矮且寬螢幕下把每張「今日」卡片內部由上下堆疊改為左右並排（立繪在左、環圈＋費用＋狀態在右），兩張卡片仍並排於同一畫面。立繪維持原尺寸 150px。
- 橫排以 CSS Grid `grid-template-areas` 重排卡片扁平子節點，並在此斷點把 `.grid` 最大寬度放寬到 900px 給兩張橫排卡片餘裕。
- **fallback — JS 等比 scale-to-fit（初版行為保留）**：對「今日」`#view-today .grid` 與「首頁選單」`#view-launcher .tiles` 套 `transform: scale()`，`scale = Math.min(1, 可用高度 / 內容自然高度)`；橫排後自然高度降到約 250–320px，一般矮螢幕（430px）下 scale=1（不縮放），只有極矮螢幕（如 300px）才回落到 scale<1 保底。以 `ResizeObserver` 接住輪詢後費用/環圈非同步 render 撐高。
- 兩機制同軸疊加：正常矮螢幕由橫排解決（全尺寸），極矮螢幕由 scale 保底，一律不裁切。

## Non-Goals (optional)

- 不隱藏角色立繪來省空間（會失去角色可愛感，且非使用者期望）；橫排下立繪維持 150px。
- 不對其他 view（報表、熱力圖、設定）套用橫排或縮放。
- 不設最小 scale 下限（極矮螢幕純 fit）。
- 不新增前端框架、build 工具或第三方套件。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `dashboard-ui`: 新增矮螢幕自適應行為——矮且寬螢幕以橫向重排（landscape reflow）讓「今日」卡片全尺寸完整顯示，並保留依高度等比縮放（fit-to-height）作為極矮螢幕保底，確保低高度視窗下不被裁切。

## Impact

- Affected specs: dashboard-ui
- Affected code:
  - Modified: src/public/index.html
