# AI Status Dashboard

> 本地常駐的迷你 web dashboard——把 **Claude Code** 與 **Codex** 的用量狀態做成一頁，讓桌上閒置的 iPhone 用 Safari 連區網當「常駐副螢幕」看。附 [petdex](https://petdex.dev) 像素寵物：工作中會動、閒置會呼吸、額度用完會睡著。

<!-- 若要放置截圖，於此加入： ![screenshot](docs/screenshot.png) -->

資料來源是本機的 [CodexBar](https://github.com/steipete/CodexBar) `codexbar serve`，本專案只負責「讀 → 判斷運作狀態 → 畫成給手機看的頁面」，不自己碰帳號、OAuth 或 rate-limit。

- **純 `node:http`**：無 Express、無前端框架、無圖表庫、無執行期相依套件。
- **兩速資料流**：額度/花費每 60s 更新（對齊 CodexBar refresh-interval）；運作狀態走前端 ~5s 輪詢即時更新。
- **全自動常駐**：兩支 launchd 服務 `RunAtLoad` + `KeepAlive`，開機自動起、零手動。

---

## 目錄

- [運作原理](#運作原理)
- [快速開始](#快速開始教學)
- [How-to 指南](#how-to-指南)
  - [自訂／切換寵物](#自訂切換寵物)
  - [讓 iPhone 螢幕恆亮](#讓-iphone-螢幕恆亮)
  - [在 Windows 上使用](#在-windows-上使用)
- [參考](#參考)
  - [HTTP API](#http-api)
  - [專案結構](#專案結構)
  - [設定與連接埠](#設定與連接埠)
- [已知限制](#已知限制)
- [疑難排解](#疑難排解)
- [維護提醒](#維護提醒)
- [Changelog](#changelog)
- [授權與素材聲明](#授權與素材聲明)

---

## 運作原理

```
codexbar serve (127.0.0.1:8080)  ──60s──▶  src/collectors/codexBarSnapshot.js  ──▶  data/snapshot.json（記憶體 + 落地）
                                                                                          │
~/.claude/projects/**/*.jsonl                                                             ▼
~/.codex/sessions/**/*.jsonl     ──mtime──▶  src/collectors/activity.js  ──即時──▶  src/server.js (0.0.0.0:8787)
                                                                                          │
                                                                      GET /api/status ◀──5s 輪詢── iPhone Safari
```

- **額度／花費**：`codexBarSnapshot.js` 每 60 秒抓 CodexBar 的 `/dashboard/v1/snapshot`，只保留 `codex` 與 `claude`，正規化後存記憶體並落地 `data/snapshot.json`；抓取失敗沿用上一份快取並標記「資料稍舊」。
- **運作狀態**：`activity.js` 只看檔案 mtime（不掃 process）。`~/.claude/projects` 或 `~/.codex/sessions` 底下的 `.jsonl` 在 60 秒內有寫入 → `working`；額度觸底 → `exhausted`；其餘 → `idle`。此判斷在每次 `/api/status` 請求時即時計算。
- **前端**：單一自包含 `index.html`（inline CSS/JS、手刻 SVG 額度環），每 5 秒輪詢 `/api/status` 就地更新，不重整頁面。

---

## 快速開始（教學）

### 需求

- macOS。
- 已安裝並登入 [CodexBar](https://github.com/steipete/CodexBar)（預設 `/opt/homebrew/bin/codexbar`），且 Settings → Providers 已啟用並登入 Codex、Claude。
- Node.js（本專案以 nvm 安裝的 Node 測試；launchd 需要 node 的**絕對路徑**，見下方）。

### 1. 取得程式碼並確認可跑

```bash
git clone <your-repo-url> ai-status-dashboard
cd ai-status-dashboard
which node          # 記下絕對路徑，稍後填進 launchd plist
```

> 本 repo **不內附寵物 sprite**（見[授權與素材聲明](#授權與素材聲明)），素材庫初始為空；先加至少一隻寵物再啟動較完整（見[自訂／切換寵物](#自訂切換寵物)），或先跳過、之後再從網頁面板加。

### 2. 產生 dashboard token

```bash
openssl rand -hex 32
```

記下輸出，**不要**貼進對話或寫入任何進版控的檔案。它只會被填入複製到 `~/Library/LaunchAgents/` 的 plist 副本；repo 內的 plist 永遠只保留 placeholder。

### 3. 佈署兩支 launchd 服務

先編輯 `launchd/` 內兩份 plist，把 `/Users/YOUR_USERNAME/...` 換成你的實際絕對路徑（node 路徑、專案路徑）。接著：

```bash
# 複製到 LaunchAgents
cp launchd/com.barry.codexbar-serve.plist    ~/Library/LaunchAgents/
cp launchd/com.barry.ai-status-dashboard.plist ~/Library/LaunchAgents/

# 只在「複製後」的副本填入真實 token（勿改 repo 內原檔）
sed -i '' 's/__REPLACE_WITH_DASHBOARD_TOKEN__/貼上你的token/' \
  ~/Library/LaunchAgents/com.barry.codexbar-serve.plist \
  ~/Library/LaunchAgents/com.barry.ai-status-dashboard.plist

# 載入
launchctl load ~/Library/LaunchAgents/com.barry.codexbar-serve.plist
launchctl load ~/Library/LaunchAgents/com.barry.ai-status-dashboard.plist
```

### 4. 驗證

```bash
launchctl list | grep -E "codexbar-serve|ai-status-dashboard"   # 兩支都在
curl -s http://localhost:8080/health                             # {"status":"ok",...}
curl -s http://localhost:8787/api/status | jq                    # 含 claude/codex + activity
```

### 5. 用 iPhone 連線

- 首選 Bonjour/mDNS：iPhone Safari 開 **`http://YOUR-MAC.local:8787`**（主機名以 `scutil --get LocalHostName` 查）。
- mDNS 被關（部分公司/訪客網路）時，改用當下 LAN IP：`http://<LAN-IP>:8787`（用 `ipconfig getifaddr en0` 查）。
- Safari「加入主畫面」→ 變成全螢幕 app（已含 `apple-mobile-web-app-capable` meta 與 apple-touch-icon）。

> 想在本機直接跑（不透過 launchd）：`CODEXBAR_DASHBOARD_TOKEN=<token> npm start`。

---

## How-to 指南

### 自訂／切換寵物

**在網頁上切換**：點右上角 **⚙ 齒輪**開設定面板，Claude、Codex 兩區各列出素材庫裡的寵物縮圖，點一下即切換。選擇存進 `data/pet-config.json`，重整後保留。

**把寵物加進素材庫**（三選一）：

1. **一鍵補貨（petdex 圖庫）**——先 `npx petdex list` 找 slug，再：
   ```bash
   npm run add-pet <slug>
   ```
   會自動 `petdex install` 並複製進 `src/public/pets/library/<slug>/`。實際 CLI 名為 `petdex`（非 `petdex-cli`）。
2. **自己丟資料夾**——把一組 `spritesheet.webp` + `pet.json` 放進 `src/public/pets/library/<你的名字>/`。`pet.json` 至少要有：
   ```json
   { "id": "<你的名字>", "displayName": "顯示名", "spritesheetPath": "spritesheet.webp" }
   ```
3. **請他人代放**——把上述兩個檔交給協作者放進素材庫。

**素材格式**：spritesheet 為 **8 欄 × 9 列**、每格 **192×208px**（整張 1536×1872）；第 0 列為 idle、第 2 列為 working 動作幀（petdex 標準佈局）。

### 讓 iPhone 螢幕恆亮

依裝置選最省事的方式：

| 情境 | 做法 |
| --- | --- |
| **舊 iPhone（iOS < 16.4）當專用副螢幕** | **設定 → 顯示與亮度 → 自動鎖定 → 永不**（系統層級、100% 有效，首選） |
| **較新 iPhone（Safari 16.4+）** | 面板「🔆 螢幕恆亮」開著即可（加入主畫面全螢幕建議 iOS 18.4+） |
| **原生 API 不支援時的備援** | 頁面內建隱藏靜音循環影片 `keepawake.mp4`，**點一下畫面**啟動、且需**關閉低耗電模式**；舊 iOS 時靈時不靈 |
| **Mac 當副螢幕** | 終端跑 `caffeinate -d` 最直接 |

> **原理**：網頁本身（含時鐘、CSS 動畫）**無法**阻止系統休眠——那由作業系統電源管理控制。只有 Screen Wake Lock API 或影片播放能維持不熄；皆不可行時，請用上表的系統設定。

### 在 Windows 上使用

CodexBar **沒有原生 Windows 版**（僅 macOS/Linux），而額度/花費完全依賴它，因此無法直接照搬。三條路：

1. **WSL2 跑 Linux 版 codexbar serve（推薦、零程式改動）**——在 WSL2 裝 CodexBar 官方 Linux CLI，一樣 `codexbar serve --host 127.0.0.1 --port 8080`，本專案 server 照舊連 HTTP 介面。注意 Linux 上瀏覽器登入模式受限，額度 % 欄位以實際 snapshot 為準確認。
2. **原生 [Win-CodexBar](https://github.com/nesszer/Win-CodexBar)（需改程式）**——有 `codexbar-cli.exe`（`usage`/`cost`）能報 5h+週+花費，但**沒有 `serve` HTTP 指令**；要接本專案需新增「改呼叫 CLI 取數」的 collector 分支（本版未做）。
3. **只靠本機 log**——Windows 上 Claude Code / Codex 一樣寫 `%USERPROFILE%\.claude\projects`、`%USERPROFILE%\.codex\sessions`，運作狀態可運作，但**拿不到帳號層額度 %**。

---

## 參考

### HTTP API

我方 server 監聽 `0.0.0.0:8787`，所有路由皆本機/區網存取，無需驗證（家用 LAN 假設）。

| Method | 路徑 | 說明 |
| --- | --- | --- |
| `GET` | `/` | Dashboard 頁面（`index.html`） |
| `GET` | `/api/status` | 記憶體內最新快照 + 即時 activity + `petConfig`；永不回 500，失敗回快取並標 `stale`，冷啟動回 `loading` |
| `GET` | `/api/pets` | 素材庫寵物清單 `[{ id, displayName, description }]` |
| `GET` | `/api/config` | 目前每欄選擇 `{ claude, codex }`（缺檔回預設 `clawd`/`boba`） |
| `POST` | `/api/select` | body `{ column, petId }`；`column` 限 `claude`/`codex`、`petId` 須存在於素材庫，否則回 `400` |
| `GET` | `/pets/library/<id>/spritesheet.webp` | 寵物 sprite 靜態檔（含路徑穿越防護） |
| `GET` | `/keepawake.mp4` | keep-awake 備援影片 |

`GET /api/status` 回應（節錄）：

```json
{
  "loading": false,
  "stale": false,
  "reachable": true,
  "formatError": false,
  "updatedAt": "2026-07-21T04:20:37.669Z",
  "petConfig": { "claude": "clawd", "codex": "boba" },
  "providers": {
    "claude": {
      "windows": [{ "kind": "session", "usedPercent": 19, "remainingPercent": 81, "resetAt": "..." }],
      "cost": { "todayUSD": 48.66, "last30DaysUSD": 492.95 },
      "error": null,
      "activity": "working"
    },
    "codex": { "windows": [...], "cost": {...}, "error": null, "activity": "idle" }
  }
}
```

`activity` 值域：`idle` | `working` | `exhausted`。

### 專案結構

```
ai-status-dashboard/
├── package.json                 # scripts：start / add-pet
├── src/
│   ├── server.js                  # node:http 進入點（port 8787）
│   ├── collectors/
│   │   ├── codexBarSnapshot.js      # 60s 抓 CodexBar snapshot、正規化、落地、fallback
│   │   └── activity.js              # 純 mtime 的 working/idle/exhausted 判斷
│   └── public/
│       ├── index.html             # 單頁 dashboard（inline CSS/JS）
│       ├── keepawake.mp4          # keep-awake 備援影片
│       └── pets/library/<id>/     # 寵物素材庫（sprite 不進版控，見素材聲明）
├── scripts/add-pet.sh           # npm run add-pet <slug>
├── launchd/                     # 兩份 plist（token 為 placeholder）
├── data/                        # snapshot.json / pet-config.json（gitignored）
└── logs/                        # stdout/stderr（gitignored）
```

### 設定與連接埠

| 項目 | 值 | 備註 |
| --- | --- | --- |
| CodexBar serve | `127.0.0.1:8080` | 資料源，僅本機 |
| Dashboard server | `0.0.0.0:8787` | 供區網 iPhone 連 |
| `CODEXBAR_DASHBOARD_TOKEN` | 環境變數 | 由 launchd plist 帶入，勿進版控 |
| `PORT` | 環境變數（預設 8787） | 可覆寫 dashboard 連接埠 |
| `data/snapshot.json` | 執行期產生 | 最新快照落地，重啟時墊底 |
| `data/pet-config.json` | 執行期產生 | 每欄選擇的寵物 |

---

## 已知限制

- **花費為本機推算**：CodexBar 的 `cost` 是掃本機 session log 得來，換電腦看不到歷史；額度百分比則是帳號真相、換電腦一樣準。畫面花費已標「本機推算」。
- **額度/花費 60s 更新**：受上游 rate limit，60s 是實務最佳點；勿為求即時調低 `--refresh-interval`（會觸發 429）。即時性由前端 5s 輪詢的運作狀態提供。
- **運作狀態用檔案 mtime**：純 mtime 無法區分「思考中」與「這輪已結束」，故只提供 `working`/`idle`/`exhausted` 二態+觸底，不做更細分類。
- **provider 可能暫時無資料**：CodexBar 對某 provider 回 error 或空 windows 時（例如 Claude usage 暫時逾時），該欄額度環顯示「無資料」並帶錯誤說明，不影響其他欄。

---

## 疑難排解

```bash
tail -f logs/err.log                    # dashboard server 錯誤
tail -f logs/out.log                    # dashboard server 輸出
tail -f logs/codexbar-serve.err.log     # CodexBar serve 錯誤
lsof -i :8080 ; lsof -i :8787           # 確認兩服務有在 listen
launchctl unload ~/Library/LaunchAgents/com.barry.ai-status-dashboard.plist  # 停用
```

- **停掉 CodexBar serve 後頁面不會崩**：會顯示上次快取並標「資料稍舊 · CodexBar 未連上」。
- **啟動後短暫顯示「資料稍舊」**：兩服務同時啟動時，dashboard 首次抓取可能撞上 serve 尚未就緒，下一輪 60s 輪詢會補上。
- **iPhone 連不到**：確認在同一區網、mDNS 未被關；退回用 LAN IP。

---

## 維護提醒

- **nvm node 路徑寫死**：`com.barry.ai-status-dashboard.plist` 的 node 路徑為絕對路徑。換 nvm 預設版本後，需更新 `~/Library/LaunchAgents/` 內該 plist 的路徑並 `launchctl unload`/`load` 重載，否則下次全新啟動會失敗。
- **Keychain 授權彈窗**：CodexBar 背景常駐可能觸發 Keychain 授權彈窗，依 CodexBar `docs/keychain-prompts.md` 將 CodexBar.app 加入 Keychain「Always allow」，一次性處理。
- **CodexBar 改版**：程式對 `schemaVersion` 做檢查，遇不認得的版本會在畫面顯示「資料格式不符」而非錯誤數字；亦可比對 `/health` 的 `version` 偵測版本變動。

---

## Changelog

格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號採語意化版本。

### [0.2.0] — 2026-07-21

首次公開發布。以下為本版全部功能（含開發過程中的修正）。

#### 資料與後端

- CodexBar snapshot collector：每 60s 抓 `/dashboard/v1/snapshot`，只保留 `codex`/`claude`，正規化 windows/cost，落地 `data/snapshot.json`，抓取失敗沿用快取並標 `stale`，`schemaVersion` 不符時標 `formatError`（fail-loud）。
- 純檔案 mtime 的運作狀態偵測（不掃 process）：`working` / `idle` / `exhausted`，於每次 `/api/status` 即時計算。
- 純 `node:http` server（port 8787）：`/`、`/api/status`、`/api/pets`、`/api/config`、`/api/select`、靜態素材路由；`/api/status` 韌性化，永不回 500、冷啟動回 loading。

#### 前端

- 單頁 dashboard：兩欄（Claude Code / Codex），各含寵物、兩條手刻 SVG 額度環（5hr／週）、今日/近 30 天花費（標「本機推算」）、狀態文字。
- petdex 寵物動畫：working 掃幀動畫、idle 靜態幀 + 極細微呼吸、exhausted 靜態幀 + 「😴 Zzz」。
- **網頁換寵物**：右上齒輪面板列出素材庫縮圖，點選即換，選擇持久化並於重整後保留（sprite URL 以 pet id 為鍵，天然避開快取）。
- 標題列即時時鐘（`yyyy/mm/dd HH:MM:SS`，每秒更新）。
- **螢幕恆亮**：Screen Wake Lock + 面板「🔆 恆亮」開關（預設開）+ 即時診斷；無原生 API 時以隱藏靜音影片備援，並提供分裝置的實務建議。
- 效能：輪詢時額度/花費資料未變即跳過 SVG 重建，寵物僅在 activity/選定寵物改變時才更新 DOM（消除閃爍）。
- iPhone：`apple-mobile-web-app-capable` meta + apple-touch-icon，支援「加入主畫面」全螢幕。

#### 常駐與工具

- 兩支 launchd 服務（`codexbar-serve` 資料源 + `ai-status-dashboard` 畫面），`RunAtLoad` + `KeepAlive`，token 走環境變數、版控內為 placeholder。
- `npm run add-pet <slug>`：從 petdex 補貨寵物到素材庫。

#### 修正

- 額度環每 5 秒閃爍：輪詢時資料未變即不重建 SVG DOM。
- 閒置寵物閃爍：部分 sprite 的 idle 列不足 8 幀、尾格空白，`steps(8)` 掃到空白會閃；閒置改為靜態幀 + 約 1px 呼吸縮放，不再掃幀。

---

## 授權與素材聲明

- 程式碼授權：<!-- 依你選擇填入，例如 MIT -->。
- **寵物素材（sprite）不隨本 repo 散布**：petdex 圖庫上的寵物為第三方投稿，可能涉及版權或肖像權，故 `src/public/pets/library/` 內的 `spritesheet.webp` 與衍生 icon 均以 `.gitignore` 排除。請自行透過 `npm run add-pet` 取得，或放入你有權使用的素材。
- 資料源 [CodexBar](https://github.com/steipete/CodexBar)（MIT）與 [petdex](https://petdex.dev) 皆為各自作者所有。
