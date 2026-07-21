## 1. 前置探勘與確認（唯讀）

- [x] 1.1 產生 dashboard token：執行 `openssl rand -hex 32` 取得 token 並暫存於環境變數；驗證：token 不出現在任何進版控檔案（後續 grep 步驟覆核）。
- [x] 1.2 手動啟動一次 `codexbar serve`（`CODEXBAR_DASHBOARD_TOKEN=<token> /opt/homebrew/bin/codexbar serve --host 127.0.0.1 --port 8080 --refresh-interval 60`），並 `curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:8080/dashboard/v1/snapshot | jq`；驗證：記下實際 `schemaVersion`、`providers[].id` 清單、`windows[].kind` 確切字串（session/weekly），程式以此為準。
- [x] 1.3 確認 port 空閒與 node 絕對路徑：`lsof -i :8080`、`lsof -i :8787` 皆空、`which node` 取得 nvm 絕對路徑；驗證：兩 port 無佔用、node 路徑記入 plist 撰寫依據。

## 2. 專案骨架

- [x] 2.1 建立 `package.json`（`"start": "node src/server.js"`，無 runtime 依賴）；驗證：`node -e "require('./package.json')"` 無誤且 start script 存在。
- [x] 2.2 建立 `.gitignore`（排除 `node_modules/`、`data/*.json`、`logs/`、含 token 的 local plist）與空的 `src/`、`data/`、`logs/`、`launchd/` 目錄樹；驗證：`git status --ignored` 顯示上述路徑被忽略。
- [x] 2.3 建立 `README.md`、`CHANGELOG.md` 骨架；驗證：README 含安裝/啟動/iPhone 連線/除錯章節標題（內容於第 7 節補齊）。

## 3. Collector — usage-collector capability

- [x] 3.1 實作 `src/collectors/codexBarSnapshot.js`：每 60s GET snapshot 帶 Bearer token，僅取 `id==='codex'/'claude'` 的 windows 與 cost，正規化後存記憶體 + 落地 `data/snapshot.json`，失敗沿用上一份標 `stale:true`，不認得的 schemaVersion 標 `formatError:true`；驗證：停掉 serve 後函式回傳上一份快取且 `stale===true`，不丟未捕捉例外。（涵蓋 spec Requirement: CodexBar snapshot polling、Provider filtering、Schema version validation）
- [x] 3.2 實作 `src/collectors/activity.js`：純 mtime（無 ps），掃 `~/.claude/projects/**/*.jsonl` 與 `~/.codex/sessions/**/*.jsonl` 最新 mtime，`<60s`→working、remainingPercent 觸底→exhausted、其餘→idle，匯出純函式於請求時即時計算；驗證：以 20s/120s/觸底三組輸入分別得到 working/idle/exhausted。（涵蓋 spec Requirement: File-mtime activity detection）

## 4. Server — dashboard-server capability

- [x] 4.1 實作 `src/server.js`（純 `node:http`，port 8787）三路由：`GET /`→index.html、`GET /pets/*`→靜態素材、`GET /api/status`→記憶體快照 + 即時 activity；啟動時載入 `data/snapshot.json` 墊底並啟動 60s collector timer；驗證：`curl -s http://127.0.0.1:8787/api/status | jq` 含 claude/codex 的 windows/cost 與 activity 欄位。（涵蓋 spec Requirement: HTTP server and routes）
- [x] 4.2 加入韌性處理：collector 失敗時 `/api/status` 回上次快取並帶 stale/disconnected 標記、冷啟動無快取回 loading，皆 HTTP 200 不 500；驗證：serve 停掉後 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/api/status` 回 200。（涵蓋 spec Requirement: Resilient status responses）

## 5. 前端 — dashboard-ui capability

- [x] 5.1 跑 `npx petdex-cli --help` 確認實際指令與素材格式，下載 Claude/Codex 各一組 sprite 至 `src/public/pets/`；驗證：`ls src/public/pets/` 兩組素材存在且 server `GET /pets/*` 可回傳。
- [x] 5.2 實作 `src/public/index.html`（inline CSS/JS，無框架/圖表庫）：兩欄各含 petdex 寵物動畫、兩條手刻 SVG 額度環（5hr/週）、今日/本週花費（標「本機推算」）、狀態文字 + 「更新於 X 分鐘前」；exhausted 用 idle 幀疊 CSS/emoji「😴 Zzz」；驗證：瀏覽器開 `/` 兩欄正常渲染，cost 旁顯示「本機推算」、額度環無警語。（涵蓋 spec Requirement: Two-column dashboard layout、Pet animation states）
- [x] 5.3 加入 5s `fetch('/api/status')` poll 就地更新 DOM（不重整），並加 `apple-mobile-web-app-capable` meta + `apple-touch-icon`；驗證：後端 activity 由 idle→working 後，5~10s 內寵物動畫切換且頁面不重整。（涵蓋 spec Requirement: Client-side polling、iPhone full-screen support）

## 6. launchd 常駐 — launchd-daemon capability

- [x] 6.1 撰寫 `launchd/com.barry.codexbar-serve.plist`：`/opt/homebrew/bin/codexbar serve ...`、`CODEXBAR_DASHBOARD_TOKEN` 用 placeholder、`RunAtLoad`+`KeepAlive`、log 導向 `logs/codexbar-serve.{out,err}.log`；驗證：`plutil -lint` 通過且 token 欄位為 placeholder。（涵蓋 spec Requirement: CodexBar serve daemon）
- [x] 6.2 撰寫 `launchd/com.barry.ai-status-dashboard.plist`：node 絕對路徑 + `src/server.js` 絕對路徑、`WorkingDirectory` 為專案根、token placeholder、`RunAtLoad`+`KeepAlive`、log 導向 `logs/out.log`/`logs/err.log`；驗證：`plutil -lint` 通過且 node 路徑為絕對路徑。（涵蓋 spec Requirement: Dashboard server daemon、Token stays out of version control）

## 7. 文件、iPhone 連線與驗收

- [x] 7.1 於 README 補齊安裝流程（openssl 生 token → cp 兩份 plist 到 `~/Library/LaunchAgents/` 並以 local plist 帶入實際 token → `launchctl load` → `launchctl list | grep` → `curl /health` → `curl /api/status`）、iPhone 連 `http://YOUR-MAC.local:8787`（mDNS 關閉時退回 LAN IP）、Keychain 授權與 nvm 路徑維護提醒；驗證：README 步驟可被使用者逐條照做。
- [x] 7.2 執行 7 條驗收指令並記錄輸出（token 遮罩）：snapshot providers 含 codex+claude、`/api/status` 含 activity、對話觸發 working 停手回 idle、serve 停掉不崩、iPhone/區網裝置可連、`grep -rInE "hex|Bearer [0-9a-f]{16}|dashboard-token"` 無明文 token、`logs/err.log` 無未處理例外；驗證：7 條輸出皆符合期望值。
