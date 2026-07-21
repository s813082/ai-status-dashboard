## 1. 前端閃爍修復（render-efficiency）

- [x] 1.1 在 `src/public/index.html` 加 per-column 快取 `lastSig`（`JSON.stringify({windows,cost})`），`renderProvider()` 於 sig 未變時跳過 `renderRings()`/`renderCost()`，資料變動時才重建；狀態文字與「更新於 X 分鐘前」仍每次以 `textContent` 更新。驗證：瀏覽器開 `/` 連續觀察 ≥15s，額度環 SVG 節點不再每 5s 重建、無閃爍；改變額度值後對應欄環會更新。（涵蓋 spec Requirement: Skip unchanged DOM rebuilds on poll）
- [x] 1.2 加 per-column `lastActivity`、`lastPetId`，只有 activity 或選定寵物改變才改寵物 `className`/`background-image`。驗證：activity 與選定寵物不變時，寵物元素的 class/背景圖不被重設（無動畫重啟）。（涵蓋 spec Requirement: Minimal pet DOM updates）

## 2. 網頁換寵物 — server 端（pet-selection）

- [x] 2.1 在 `src/server.js` 加 `GET /api/pets`：掃 `src/public/pets/library/*/pet.json`，回 `[{id,displayName,description}]`。驗證：`curl -s localhost:8787/api/pets | jq 'length'` 等於 library 實際隻數。（涵蓋 spec Requirement: Project-bundled pet library）
- [x] 2.2 在 `src/server.js` 加 `GET /api/config`（回 `data/pet-config.json`，缺檔回 `{claude:"clawd",codex:"boba"}`）並在 `/api/status` 併回 `petConfig`。驗證：`curl -s localhost:8787/api/config | jq` 含 claude/codex 兩鍵；`curl -s localhost:8787/api/status | jq .petConfig` 反映目前選擇。（涵蓋 spec Requirement: Per-column pet selection persistence）
- [x] 2.3 在 `src/server.js` 加 `POST /api/select`（body `{column,petId}`）：`column` 僅 `claude`/`codex`、`petId` 必須在 `/api/pets` 允許清單，合法才寫 `data/pet-config.json` 回 `{ok:true}`，否則回 HTTP 400 不寫檔。驗證：合法 POST 回 `{ok:true}` 且 config 更新；非法 petId 或 column 回 400 且 config 不變。（涵蓋 spec Requirement: Pet selection endpoint with allowlist validation）

## 3. 網頁換寵物 — 素材庫、前端面板、補貨 script（pet-selection）

- [x] 3.1 建素材庫 `src/public/pets/library/<id>/{spritesheet.webp,pet.json}`，複製本機 clawd/boba/agumon/laichingte 四隻入庫（不動使用者 `~/.codex`、`~/.petdex` 原檔）。驗證：`ls src/public/pets/library` 四個資料夾、各含 spritesheet.webp + pet.json；`GET /pets/library/clawd/spritesheet.webp` 回 200 image/webp。（涵蓋 spec Requirement: Project-bundled pet library）
- [x] 3.2 前端：寵物 `background-image` 改讀 config `/pets/library/<id>/spritesheet.webp`（URL 以 id 為鍵）；頂部加齒輪 ⚙ 鈕開一個面板，內分 Claude/Codex 兩區列出 `/api/pets` 寵物縮圖（sprite 第 0 幀預覽），點選 → `POST /api/select` → 就地更新該欄 sprite。驗證：網頁齒輪面板可切換兩欄寵物、對應欄 sprite 更換、重整後保留選擇。（涵蓋 spec Requirement: In-page pet switching via gear panel）
- [x] 3.3 加 `scripts/add-pet.sh` 與 `package.json` 的 `add-pet` script：`npm run add-pet <slug>` = `npx petdex install <slug>` + 複製 `~/.codex/pets/<slug>/{spritesheet.webp,pet.json}` 到 library，純 shell 無新依賴。驗證：`npm run add-pet <slug>` 後 `src/public/pets/library/<slug>/spritesheet.webp` 存在、面板多一隻。（涵蓋 spec Requirement: Pet library restock script）

## 4. iPhone 螢幕恆亮（screen-wake-lock）

- [x] 4.1 前端加 `requestWakeLock()`：`navigator.wakeLock.request('screen')`，`visibilitychange` 變 visible 時重取；feature-detect，不存在或失敗靜默略過、不引入 NoSleep.js。驗證：頁面原始碼含 `'wakeLock' in navigator` 分支；桌機 Chrome 開頁可取得鎖不報錯；不支援環境不丟例外。（涵蓋 spec Requirement: Screen wake lock to keep display awake、Graceful degradation when unsupported）
- [x] 4.2 齒輪面板加「🔆 恆亮」開關，預設開；關閉時 `wakeLock.release()` 且在開之前不重取。驗證：面板有恆亮開關且預設為開；切關後不再持有鎖。（涵蓋 spec Requirement: Wake lock toggle defaulting on）

## 5. 文件（README / CHANGELOG）

- [x] 5.1 README 加「自訂寵物」章節：三種入庫（`npm run add-pet <slug>`／自行把 `spritesheet.webp`(8欄×9列、格192×208)+`pet.json` 放進 `src/public/pets/library/<名字>/`／把兩個檔交給協作者代放）與齒輪面板選法。驗證：README 具「自訂寵物」章節且步驟可照做。
- [x] 5.2 README 加「Windows」章節（三條路：WSL2 跑 Linux codexbar serve 推薦零改動／`nesszer/Win-CodexBar` 的 `codexbar-cli.exe` 有 CLI 無 serve 需改 collector／只靠本機 log 僅活動狀態無額度%，並點明 CodexBar 無原生 Windows serve 是根本限制）與「恆亮」章節（iOS 16.4+、加入主畫面 18.4+）。驗證：README 具「Windows」「恆亮」章節、內容與已驗證事實一致。
- [x] 5.3 CHANGELOG 記 v0.2 變更（閃爍修復、網頁換寵物、恆亮、文件）。驗證：CHANGELOG 有 v0.2 條目涵蓋四項。

## 6. 整合驗收

- [x] 6.1 重載 dashboard 服務後逐條執行並記錄輸出（token 遮罩）：`/api/pets` 回四隻、`/api/config` 兩鍵、合法 `POST /api/select` 成功且非法回 400、`/api/status` 含 petConfig、瀏覽器觀察無閃爍且可切換寵物、恆亮開關存在且預設開、`npm run add-pet` 補貨成功、`grep -rInE "Bearer [0-9a-f]{16}|[0-9a-f]{64}"` 專案非 .gitignore 檔無明文 token、`logs/err.log` 無新未處理例外。驗證：以上各條輸出皆符合期望值。
