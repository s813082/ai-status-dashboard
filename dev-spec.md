# AI Status Dashboard — dev-spec

Claude Code + Codex 用量儀表板，本地 web dashboard，iPhone 用 Safari 連區網當常駐副螢幕。

## Context / 為什麼做這個

Barry 想在桌上放一台閒置 iPhone，隨時看到 Claude Code / Codex 目前的使用狀態：週額度、5 小時額度剩多少、花了多少錢，並且要有互動感——像 [codex-pets](https://codex-pets.net) 那樣的小寵物角色，工作中會動、額度用完會睡著。

不想花錢買螢幕鏡射軟體（Duet/Luna 之類）。已排除方案：Sidecar 不支援 iPhone；免費的 Deskreen 本質上還是要碰區網連線，跟自己架 server 是同一件事。結論：不鏡射整個 Mac 桌面，直接做一個本地 web dashboard，iPhone 開 Safari 連過去看，效果一樣但更簡單、免安裝、免費。

**資料來源已定案：[CodexBar](https://github.com/steipete/CodexBar)（Barry 已安裝並在使用中）**——macOS 選單列 App，MIT 授權，本身帶一支 CLI。它的 `codexbar serve` 指令會啟動本地 HTTP server，吐出 `/dashboard/v1/snapshot`：包含 Claude/Codex 各自的 session（5hr）與 weekly 用量百分比、reset 時間、cost（今日/近 30 天）。Keychain 讀取、OAuth 呼叫、429 backoff、快取全部它都處理好了。**這個專案完全不用自己刻額度/花費的 collector**，只要負責「讀 CodexBar 的 JSON → 判斷 working/idle → 串接寵物動畫 → 做成給 iPhone 看的網頁」。

## 已確認的關鍵事實

- Codex 和 Claude Code 都有「帳號層級」的用量端點，額度剩餘（週/5hr）換電腦一樣準（不是本機推算的近似值）。
- 唯一本機限定、換電腦看不到的，是「花了多少錢」——因為兩邊都沒有對應的「總花費」帳號端點，CodexBar 的 `cost` 欄位也是靠掃本機 session log 推算（其 README 明講 "scanned from local session logs without web/CLI access"）。
- CodexBar 的 `codexbar serve` 端點：
  - `GET /health` → `{"status":"ok","version":"..."}`，永遠不需要驗證。
  - `GET /dashboard/v1/snapshot`（需要 `Authorization: Bearer <token>`）→ 完整 payload，見下方 schema。
  - loopback bind（`127.0.0.1`）時 `/usage`、`/cost` 不需要 token；非 loopback bind 才強制全部路由都要 token。我們自己的用法只在本機呼叫，走 loopback 即可。

### CodexBar snapshot payload（`schemaVersion: 1`）

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-16T12:00:00Z",
  "staleAfterSeconds": 180,
  "host": { "codexBarVersion": "0.37.2", "refreshIntervalSeconds": 60 },
  "providers": [
    {
      "id": "codex",
      "name": "Codex",
      "enabled": true,
      "source": "oauth",
      "status": { "level": "ok", "label": "Operational", "updatedAt": "..." },
      "identity": { "accountEmail": "redacted@example.com", "plan": "Pro 20x" },
      "windows": [
        { "kind": "session", "label": "Session", "usedPercent": 28, "remainingPercent": 72, "resetAt": "..." }
      ],
      "credits": { "remaining": 112.4, "unit": "credits" },
      "cost": { "todayUSD": 1.04, "last30DaysUSD": 18.22 },
      "display": { "accentColor": "#49A3B0", "sortKey": 0, "priority": "normal" },
      "error": null,
      "updatedAt": "..."
    }
  ]
}
```

`providers[]` 裡會有 `id === "codex"` 跟 `id === "claude"` 兩筆（各自的 `windows` 陣列裡通常有 session/5hr 跟 weekly 兩種 `kind`，實作時印出實際回應確認 `kind` 的確切字串值，不要憑這份 spec 猜）。

## 前置設定（Barry 已完成安裝，實作時只需確認/補齊）

1. ~~`brew install --cask codexbar`~~ 已安裝並在使用中。
2. 確認 Settings → Providers 裡 Codex、Claude 都已啟用且完成登入（跑一次 `codexbar usage --format json` 確認兩個 provider 都有正常回應，不是 error）。
3. 確認 CLI 可直接呼叫：`which codexbar`（記下絕對路徑，launchd plist 要用）。
4. 生成 dashboard token：`openssl rand -hex 32`，記下來（不要貼進對話、不要寫進會進 git 版控的檔案，走環境變數）。

## 專案結構

```
30_Projects/ai-status-dashboard/
├── dev-spec.md                # 本文件
├── README.md                  # 安裝/啟動/除錯步驟、iPhone 連線網址、已知限制
├── CHANGELOG.md
├── package.json                # "start": "node src/server.js"
├── .gitignore                  # node_modules/, data/*.json, logs/, *.cache, 任何含 token 的 local plist
├── src/
│   ├── server.js                 # node:http，launchd 執行的進入點
│   ├── collectors/
│   │   ├── codexBarSnapshot.js      # 呼叫本機 codexbar serve 的 /dashboard/v1/snapshot
│   │   └── activity.js                 # log mtime + ps 檢查 → idle/working 判斷（CodexBar 不提供這個）
│   └── public/
│       ├── index.html              # 單一自包含 dashboard 頁面（inline CSS/JS，無框架）
│       └── pets/                   # petdex 格式 spritesheet.webp + pet.json，Claude/Codex 各一組
├── data/snapshot.json            # 最新快照，server 重啟時先用這個墊著
├── launchd/
│   ├── com.barry.codexbar-serve.plist       # 常駐執行 `codexbar serve`（資料源頭）
│   └── com.barry.ai-status-dashboard.plist   # 常駐執行我們自己的 Node server（畫面）
└── logs/                          # stdout/stderr，gitignored
```

## Collector 設計

**服務一：`codexbar serve`（launchd 常駐，資料源頭）**
- 指令：`codexbar serve --host 127.0.0.1 --port 8080 --refresh-interval 60`
- Token 走 `CODEXBAR_DASHBOARD_TOKEN` 環境變數（不要用 `--dashboard-token` 參數，會被 `ps` 看到）。
- Bind 在 127.0.0.1，只有本機程式打得到，iPhone/其他裝置都連不到（也不需要，這只是內部資料源）。

**我們自己的兩個 collector 模組**
- `codexBarSnapshot.js`：每 60 秒（跟 CodexBar 的 `--refresh-interval` 對齊，不用更頻繁）打 `GET http://127.0.0.1:8080/dashboard/v1/snapshot` 帶 `Authorization: Bearer <token>`，解析出 `providers[]` 裡 `id === 'codex'` 和 `id === 'claude'` 各自的 `windows`（session/weekly 的 `usedPercent`/`remainingPercent`/`resetAt`）與 `cost`（`todayUSD`/`last30DaysUSD`）。CodexBar 自己已處理快取、429 退避、last-known-good fallback，這層只要單純轉存進記憶體＋`data/snapshot.json`，失敗就沿用上一份，不用重寫 backoff 邏輯。要檢查 `schemaVersion`，遇到不認得的版本要明確顯示「資料格式不符」而不是靜默顯示錯誤數字。
- `activity.js`：CodexBar 不追蹤「現在是不是正在跑」，這個要自己判斷——最近修改的 `~/.claude/projects/**/*.jsonl` 或 `~/.codex/sessions/**/*.jsonl` 檔案 mtime 在近 12 秒內，或 `ps` 找到對應 process 在跑 → `working`；`windows` 裡 `remainingPercent` 觸底 → `exhausted`；其餘 → `idle`。

**花費說明**：CodexBar 的 `cost` 欄位是本機 session log 推算，換電腦看不到歷史花費；`windows`（額度百分比）是帳號真相，換電腦一樣準。畫面上花費數字旁標註「本機推算」，額度環不用加警語。

## Server

純 `node:http`，不用 Express（只有兩三個路由，加框架沒必要）。路由：
- `GET /` → dashboard 頁面
- `GET /pets/*` → 素材靜態檔
- `GET /api/status` → 回傳記憶體內的最新快照 JSON（含 activity 狀態），不觸發即時抓取

Port 待實作時挑一個未被佔用的（如 8787，先 `lsof -i :PORT` 確認；注意 CodexBar 自己吃掉 8080，不要撞）。

## 前端 Dashboard

單一 `src/public/index.html`，無框架、無圖表庫（延續 vault 裡 `ai-usage-report` skill 那種手刻 inline SVG 的簡約風格）。兩欄（Claude Code / Codex），各含：
- **寵物動畫**：用 [petdex](https://petdex.dev) 免費開源素材庫（`npx petdex-cli` 安裝，9×8 格 spritesheet，每格 192×208px，內建 `idle/wave/run/failed/review/jump/extra1/extra2` 動作列）。`idle` 對應閒置、`wave`/`run` 對應 working；petdex 沒有原生「睡著」動作，用 `idle` 幀疊加一個 CSS/emoji「😴 Zzz」小動畫表示額度用完。
- 兩條額度環（5hr / 週），兩邊都是帳號真相，畫面上一致呈現即可。
- 今日/本週花費數字（標註本機推算）。
- 狀態文字：閒置／工作中／額度用完，以及「更新於 X 分鐘前」。

`fetch('/api/status')` 每 5 秒 poll 一次更新 DOM，不重整頁面。加上 `apple-mobile-web-app-capable` meta + `apple-touch-icon`，讓 iPhone「加入主畫面」後是全螢幕 app 感覺。

## launchd 常駐（兩支獨立服務）

**服務一：`com.barry.codexbar-serve`**
- `ProgramArguments`：`codexbar` 的絕對路徑（`which codexbar` 確認）+ `["serve", "--host", "127.0.0.1", "--port", "8080", "--refresh-interval", "60"]`
- `EnvironmentVariables`：`CODEXBAR_DASHBOARD_TOKEN`
- `RunAtLoad: true`、`KeepAlive: true`，log 導到 `logs/codexbar-serve.{out,err}.log`

**服務二：`com.barry.ai-status-dashboard`**
- Node 是 nvm 裝的（本機路徑例：`/Users/YOUR_USERNAME/.nvm/versions/node/v22.17.0/bin/node`，實作時用 `which node` 重新確認），不是系統 Node。launchd 不會載入 `.zshrc`/nvm shim，`ProgramArguments` 必須寫死絕對路徑。`WorkingDirectory` 設為專案根目錄。
- 同樣需要 `EnvironmentVariables` 帶 `CODEXBAR_DASHBOARD_TOKEN`，給 `codexBarSnapshot.js` 用。
- `RunAtLoad: true`、`KeepAlive: true`，log 導到 `logs/out.log`/`logs/err.log`。
- 兩支服務啟動順序不重要——我們的 server 對 CodexBar 呼叫失敗時要 fallback 到上次快取／顯示 loading，不能整頁掛掉。
- 安裝步驟：`cp` 兩份 plist 到 `~/Library/LaunchAgents/` → 分別 `launchctl load` → `launchctl list | grep -E "codexbar-serve|ai-status-dashboard"` 確認都有載入 → `curl http://localhost:8080/health` → `curl http://localhost:PORT/api/status`。

## iPhone 連線方式

首選 `<Mac主機名>.local`（macOS 內建 Bonjour/mDNS，零設定，iOS Safari 原生支援解析），比每次查 IP 穩定，DHCP 換 IP 不受影響。用 `scutil --get LocalHostName` 確認確切名稱。若某些網路環境（公司/訪客網路關 mDNS）解析失敗，退而求其次用當下 LAN IP。iPhone 開啟後 Safari「加入主畫面」變成全螢幕圖示。

## 已知風險（不隱藏）

1. **CodexBar 是外部依賴**：額度/花費資料正確性完全依賴它。實作時要對 `schemaVersion` 做檢查，格式不符要明確顯示錯誤而非靜默顯示錯誤數字；也可比對 `/health` 的 `version` 欄位偵測版本變動。
2. **Keychain 授權彈窗**：CodexBar 文件本身提到背景常駐可能觸發 Keychain 授權彈窗（`docs/keychain-prompts.md`），需要照文件指示把 CodexBar.app 加入 Keychain「Always allow」清單，一次性處理。
3. **Token 保存**：plist 裡的 `EnvironmentVariables` 明碼存 token（本機檔案權限保護範圍內），若 plist 要進 git，要用 placeholder，實際 token 走不進版控的方式帶入。
4. **nvm node 路徑寫死**：換 nvm 預設版本不會自動更新 plist（不影響已啟動的 process，只影響下次全新啟動），寫進 README 維護提醒。
5. **petdex 素材下載的確切步驟**（`npx petdex-cli --help`）留到實作時再跑一次確認。
6. **兩支 launchd 服務的相依性**：確認我們的 server 在 CodexBar 尚未就緒時是「顯示 loading/沿用快取」而不是報錯崩潰。

## 驗證方式

1. `curl http://localhost:8080/dashboard/v1/snapshot -H "Authorization: Bearer $TOKEN"` 確認 CodexBar 有正確吐出 Claude + Codex 兩筆資料。
2. `curl http://localhost:PORT/api/status` 確認我們自己的 server 有把資料轉存並加上 activity 狀態。
3. 手動觸發一次 Claude Code / Codex 對話，觀察 dashboard 上對應寵物是否在 ~12 秒內從 idle 切到 working。
4. 重開機或登入後不用手動下任何指令，直接用 iPhone Safari 開 `<hostname>.local:PORT` 就能看到頁面。
5. 暫時 `launchctl unload` CodexBar 那支 plist，確認 dashboard 不會報錯，而是顯示「資料稍舊/CodexBar 未連上」。
6. 檢查 `logs/err.log` 與 CodexBar 自己的 log，確認沒有未處理例外或 401/429 沒被優雅處理的痕跡。
