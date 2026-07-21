## Context

AI Status Dashboard v0.1 已完成並常駐（純 node:http server on 8787、collector 讀 CodexBar snapshot、單頁 inline 前端、petdex 寵物、launchd 常駐）。本次 v0.2 為增量增強，不重寫核心。已驗證環境事實：專案根 `/Users/YOUR_USERNAME/Documents/vibe-coding/ai-status-dashboard`；前端閃爍根因在 `src/public/index.html` 的 `renderRings()`/`renderCost()` 每次輪詢 `innerHTML=` 重建 SVG；本機已裝 pet 於 `~/.codex/pets/{clawd,agumon,laichingte}`、`~/.petdex/pets/boba`，格式 spritesheet.webp(1536×1872＝8欄×9列、格192×208)+pet.json；petdex CLI 實名 `petdex`；`navigator.wakeLock` Safari 16.4+、加入主畫面 PWA 需 18.4+；CodexBar 僅 macOS/Linux 無 Windows serve。

約束：純 node:http、無框架、無圖表庫、無新 npm 依賴；不動 v0.1 已驗收的額度/花費/活動核心；憑證零貼上；產出限縮專案目錄內。

## Goals / Non-Goals

**Goals:**

- 消除額度環每 5 秒閃爍，同時保留 activity/更新時間的即時性。
- 讓使用者在網頁上（頂部齒輪面板）從本機已裝寵物中選擇、切換 Claude/Codex 兩欄寵物，選擇可持久化並於重整後保留。
- iPhone 開頁時螢幕恆亮（預設開），不支援的環境優雅降級。
- README 補齊自訂寵物、Windows、恆亮三章節。

**Non-Goals:**

- 網頁內安裝寵物、瀏覽 petdex 遠端圖庫。
- Windows 執行程式（本版只出文件）。
- 細分活動狀態（維持二態）。
- 引入任何新 npm 依賴或前端框架。

## Decisions

**D1. 閃爍以「資料簽章比對跳過重建」修，而非改 transition。** 在前端維護 per-column `lastSig`（`JSON.stringify({windows,cost})`）、`lastActivity`、`lastPetId`；簽章相同即不呼叫 `renderRings()`/`renderCost()`。理由：額度/花費 60s 才變，5s 輪詢中約 11/12 次可完全跳過 DOM 重建，直接消除閃爍源，且不需改動視覺 transition。替代方案（改成 in-place 更新 dasharray）較複雜且仍每次觸碰 DOM，故不採。

**D2. 素材庫改為專案自帶 `src/public/pets/library/<id>/`。** 理由：自包含、不依賴使用者 `~/.codex/pets` 是否還在；沿用現有 `GET /pets/*` 靜態路由即可服務。替代（直接讀 `~/.codex/pets`）會讓專案不自包含且路徑外洩，故不採。

**D3. 選擇持久化於 `data/pet-config.json`，sprite URL 以 pet id 為鍵。** `{claude,codex}` 兩鍵，缺檔回預設 `{claude:"clawd",codex:"boba"}`。前端 sprite 走 `/pets/library/<id>/spritesheet.webp`，換寵物即換 URL，天然避開瀏覽器快取舊圖。

**D4. 換寵物端點做允許清單驗證。** `POST /api/select` 的 `petId` 必須存在於 `GET /api/pets` 掃出的清單、`column` 僅接受 `claude`/`codex`，否則回 400。理由：server 綁 0.0.0.0 對區網開放，需防路徑注入與非法值；僅允許切換寵物這類低風險寫入。

**D5. 恆亮用原生 Screen Wake Lock，不引入 NoSleep.js。** `navigator.wakeLock.request('screen')` + `visibilitychange` 重取（鎖於頁面隱藏時自動釋放）；feature-detect，不支援靜默略過。理由：零依賴、符合簡約原則；舊 iOS 的 NoSleep.js hack 需使用者手勢且耗電、脆弱，只在 README 註明版本限制。

**D6. Windows 只出文件。** 因 CodexBar 無原生 Windows serve，實際支援需另闢資料源（WSL2 或 Win-CodexBar CLI），工程量大且非本版目標；README 誠實列三條路。

## Implementation Contract

**Behavior（可觀測行為）：**

- 開啟 `/` 連續觀察 ≥15 秒，額度環不再每 5 秒閃爍（其 SVG 節點不被每次輪詢重建）；activity 文字與「更新於 X 分鐘前」仍即時更新。
- 頂部齒輪 ⚙ 開啟一個面板，內含 Claude / Codex 兩區，各列出素材庫寵物縮圖；點某隻 → 對應欄寵物立即更換，且重整頁面後保留該選擇。
- iPhone（Safari 16.4+；加入主畫面 18.4+）開頁時螢幕保持恆亮，齒輪面板內「🔆 恆亮」開關預設為開、可關閉。

**Interface / data shape：**

- `GET /api/pets` → `[{ id, displayName, description }]`（掃 `src/public/pets/library/*/pet.json`）。
- `GET /api/config` → `{ claude, codex }`（缺檔回預設 clawd/boba）。
- `POST /api/select`（body `{ column, petId }`）→ 成功 `{ ok: true }` 並寫入 `data/pet-config.json`；`petId` 不在允許清單或 `column` 非法 → HTTP 400。
- `GET /api/status` → 於既有回應內新增 `petConfig: { claude, codex }`。
- 前端寵物 sprite 來源：`/pets/library/<selectedId>/spritesheet.webp`（沿用現有 `/pets/*` 靜態路由）。
- `scripts/add-pet.sh`：`npm run add-pet <slug>` → `npx petdex install <slug>` → 複製 `~/.codex/pets/<slug>/{spritesheet.webp,pet.json}` 至 `src/public/pets/library/<slug>/`。

**Failure modes：**

- `data/pet-config.json` 缺失或損毀 → 回預設選擇，不崩。
- `POST /api/select` 非法 `petId`/`column` → HTTP 400，不寫檔。
- `navigator.wakeLock` 不存在或 request 失敗 → 靜默略過，不報錯、不阻斷頁面。
- 素材庫某 pet 缺 spritesheet → 該縮圖/寵物顯示失敗但不影響其他欄與頁面。

**Acceptance criteria：** 見 tasks 驗收指令（`/api/pets` 回四隻、`/api/config` 兩鍵、`POST /api/select` 合法成功/非法 400、`/api/status` 含 petConfig、瀏覽器觀察無閃爍且可切換、恆亮開關存在、`add-pet` 補貨成功、README 三章節、無明文 token、logs 無新例外）。

**Scope boundaries：**

- 範圍內：`src/public/index.html`（閃爍修復、動態 sprite、齒輪面板、wakeLock）、`src/server.js`（三個新端點 + /api/status 併回選擇）、素材庫目錄與四隻種子寵物、`scripts/add-pet.sh` + package.json、README/CHANGELOG。
- 範圍外：v0.1 collector 與活動偵測核心、launchd plist、Windows 執行程式、新增細分活動狀態、任何新 npm 依賴。

## Risks / Trade-offs

- [pet-config 或 select 端點被區網其他裝置操作] → 僅允許切換寵物的低風險寫入 + 允許清單驗證；README 註明家用 LAN 假設。
- [不同 pet 的 sprite row 語意可能與 idle=0/working=2 假設不符] → petdex 標準佈局一致，沿用既有 PET_ROWS 常數；若個別 pet 不合可事後微調，非本版阻塞。
- [iPhone 低於 18.4 加入主畫面時恆亮不可靠] → 屬平台限制，README 誠實註明；不以 NoSleep.js 補（違簡約、脆弱）。
- [手動覆蓋同名 id 素材時瀏覽器仍快取舊圖] → URL 以 id 為鍵僅解決「換不同 pet」；README 註明覆蓋同名需清快取。
