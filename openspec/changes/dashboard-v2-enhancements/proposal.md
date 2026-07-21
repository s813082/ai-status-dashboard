## Why

v0.1 dashboard 已常駐上線，Barry 實際使用後回饋三個痛點與一個延伸需求：(1) 額度環每 5 秒閃爍一次，因前端輪詢每次都重建 SVG DOM；(2) 想在網頁上直接換寵物、不用回 CLI；(3) 當桌上副螢幕時 iPhone 會進待機、螢幕熄掉；(4) 家裡 Windows 電腦能否使用的疑問。本次 v0.2 收斂為：修掉閃爍、網頁可選/切換本機已裝寵物、iPhone 螢幕恆亮，並在 README 補齊自訂寵物與 Windows 說明。

## What Changes

- 修掉額度環閃爍：前端輪詢時，額度/花費（60s 才變）資料未變就不重建 SVG DOM；只有活動狀態或選定寵物改變時才更新對應 DOM，狀態文字與「更新於 X 分鐘前」仍每次以 textContent 更新。
- 新增網頁換寵物：素材庫改為專案自帶（`src/public/pets/library/<id>/`，內含 spritesheet.webp + pet.json），先放 clawd/boba/agumon/laichingte 四隻；server 新增 `GET /api/pets`、`GET /api/config`、`POST /api/select`，`/api/status` 併回目前選擇；前端頂部一個齒輪面板集中設定 Claude/Codex 兩欄寵物，點縮圖即切換，選擇存 `data/pet-config.json` 並於重整後保留；sprite URL 以 pet id 為鍵避免瀏覽器快取。
- 新增素材補貨 script：`npm run add-pet <slug>`（`npx petdex install` + 複製進素材庫），純 shell、無新依賴。
- 新增 iPhone 螢幕恆亮：以 `navigator.wakeLock` 於頁面可見時取得螢幕鎖、`visibilitychange` 變 visible 時重取，齒輪面板加「🔆 恆亮」開關（預設開），不支援的瀏覽器優雅略過。
- 更新 README/CHANGELOG：新增「自訂寵物」（三種入庫方式與素材格式）、「Windows」（三條路線與根本限制）、「恆亮」（iOS 版本需求）章節。

## Non-Goals (optional)

- 不做網頁內安裝寵物、不瀏覽整個 petdex 遠端圖庫（素材庫只列本機已裝，決議 D1）。
- Windows 本版只出 README 文件，不寫任何 Windows 執行程式（決議 D2）。
- 不新增細分活動狀態（思考中/用力思考中等）；維持 working/idle + exhausted 二態（決議 D3），因純檔案 mtime 無法誠實區分「思考中」與「這輪已結束」。
- 不引入 Express、前端框架、圖表庫、NoSleep.js 或任何新 npm 依賴。
- 不改動 v0.1 已驗收的額度/花費 collector 與活動偵測核心邏輯。

## Capabilities

### New Capabilities

- `pet-selection`: 專案自帶寵物素材庫、列出可選寵物、每欄選擇與持久化、以及頂部齒輪面板的網頁切換與素材補貨 script。
- `screen-wake-lock`: 以 Screen Wake Lock API 在頁面可見時保持 iPhone 螢幕恆亮，含可切換開關與不支援時的優雅降級。
- `render-efficiency`: 前端輪詢時避免重建未變動的 SVG DOM，消除額度環每 5 秒的閃爍。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `pet-selection`、`screen-wake-lock`、`render-efficiency` 三個 capability。
- Affected code:
  - New:
    - src/public/pets/library/clawd/spritesheet.webp
    - src/public/pets/library/clawd/pet.json
    - src/public/pets/library/boba/spritesheet.webp
    - src/public/pets/library/boba/pet.json
    - src/public/pets/library/agumon/spritesheet.webp
    - src/public/pets/library/agumon/pet.json
    - src/public/pets/library/laichingte/spritesheet.webp
    - src/public/pets/library/laichingte/pet.json
    - scripts/add-pet.sh
    - data/pet-config.json
  - Modified:
    - src/public/index.html
    - src/server.js
    - package.json
    - README.md
    - CHANGELOG.md
  - Removed: (none)
- 執行期產生且不進版控：data/pet-config.json（沿用現有 .gitignore 的 data/*.json 規則）。
- 外部工具：petdex CLI（僅 add-pet script 使用，一次性下載素材）。
