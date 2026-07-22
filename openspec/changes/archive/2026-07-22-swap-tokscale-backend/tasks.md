> 前置條件（非本清單任務）：`tokscale codex status --json` 目前回 401，須在開工前手動修好 tokscale 的 Codex 授權並確認能取回 Codex 額度；若無法修復，Codex 額度環退回「無資料」，Claude 與花費不受影響。

## 1. tokscale CLI 存取層

- [x] 1.1 於 src/collectors/tokscale.js 提供 tokscale 執行封裝：以 `execFile('tokscale', args, { timeout, maxBuffer })` 執行、`JSON.parse` stdout，報表類指令帶 `--no-spinner`；`ENOENT`、非零離開碼、JSON 解析失敗各拋具名錯誤，並提供快取後的 `--version` 偵測。此為需求「tokscale CLI collection resilience」的存取層基礎。驗證：以單元測試或臨時 REPL 呼叫封裝，斷言正常指令回傳解析後物件、將 tokscale 改名不存在時拋出具名的「未安裝」錯誤而非未捕捉例外。

## 2. provider 設定中心

- [x] 2.1 於 src/providers.js 匯出 provider 設定陣列，元素含 `{ id, tokscaleClient, usageProvider, quotaSource, displayName, color }`，涵蓋 `claude` 與 `codex`（不含 antigravity）。實作設計決策「provider 設定中心化，取代硬編碼允許清單」，並滿足需求「Provider filtering」。驗證：`node -e` 載入模組並斷言陣列含 `claude`/`codex` 兩筆且各欄位齊備。

## 3. tokscale 快照 collector

- [x] 3.1 於 src/collectors/tokscaleSnapshot.js 實作與 codexBarSnapshot.js 相同的模組介面（`init` / `startPolling` / `refresh` / `getSnapshot` / `normalize` / `DATA_FILE`），輸出 `providers.<id>` 的 `windows[]`（`kind`/`usedPercent`/`remainingPercent`/`resetAt`）、`cost`（`todayUSD`/`last30DaysUSD`）、`activity`、`error`、`missing`。實作設計決策「以同介面 sibling collector 取代 CodexBar，server.js 僅換 require」。驗證：以模擬的 tokscale 輸出呼叫 `normalize`，斷言輸出結構與欄位型別與現行 CodexBar 快照一致。
- [x] 3.2 Claude 額度取自 `tokscale usage --json`（`provider == "Claude"`），label `Session`→`kind:session`、`Weekly`→`kind:weekly`，並映 `used_percent`/`remaining_percent`/`resets_at`。實作設計決策「額度分兩指令取得：Claude 走 usage、Codex 走 codex status」的 Claude 分支，滿足需求「tokscale CLI quota and cost collection」。驗證：以含 Claude 的 usage 樣本斷言產生 session 與 weekly 兩個 window 且 `usedPercent` 為數值。
- [x] 3.3 Codex 額度取自 `tokscale codex status --json`，metric label `5h`→單一 `kind:session` 環（Codex 無 weekly，不合成 weekly 環）；回 `{error}`/401 時該 provider `windows: []` 並記 `error`，Claude 不受影響。實作設計決策「額度分兩指令取得：Claude 走 usage、Codex 走 codex status」的 Codex 分支，滿足需求「tokscale CLI quota and cost collection」。驗證：以正常 codex status 樣本斷言 `providers.codex.windows` 只有一個 `kind:session` 且 `usedPercent` 為數值、無 weekly；以回傳 error 的樣本斷言 `providers.codex.windows` 為空且 `error` 有值、`providers.claude` 正常。
- [x] 3.4 花費由 `tokscale graph -c <client> --today` 與 `graph -c <client> --since <執行當日往前 29 天>` 的 `summary.totalCost` 分別填 `todayUSD`/`last30DaysUSD`；缺值時該欄為 `null`。實作設計決策「花費由 tokscale graph 的 summary.totalCost 推算」，滿足需求「tokscale CLI quota and cost collection」。驗證：以有/無 `summary.totalCost` 的 graph 樣本斷言對應花費欄為數值或 `null`。
- [x] 3.5 容錯：整體抓取失敗沿用上一份並標 `stale: true`，冷啟讀 `data/snapshot.json` 墊底；JSON 解析失敗或 label/欄位缺以防禦式取值降級為該 window「無資料」而不崩。滿足需求「tokscale CLI collection resilience」。驗證：模擬抓取例外後斷言回傳沿用快取且 `stale` 為 true；餵入缺欄樣本斷言不拋例外且該 window 標記無資料。

## 4. 伺服器接線與活動狀態

- [x] 4.1 src/server.js 將 collector 的 `require` 由 codexBarSnapshot 換成 tokscaleSnapshot，`/api/status` 路由與回應結構不變。完成設計決策「以同介面 sibling collector 取代 CodexBar，server.js 僅換 require」的接線。驗證：`npm start` 後 `curl -s localhost:8787/api/status` 回 200，`providers.claude.windows[]` 含 `session` 與 `weekly` 且 `usedPercent` 為數值、`cost` 欄存在。
- [x] 4.2 確認 src/collectors/activity.js 的 `classify` 仍取得 `windows[].remainingPercent`（exhausted 判定所需），新快照有正確供給。驗證：對額度觸底的樣本斷言對應 provider activity 為 `exhausted`。

## 5. 汰換標示與版本

- [x] 5.1 src/collectors/codexBarSnapshot.js 於 server.js 不再被 require，檔頭加 deprecated 標示；launchd/com.barry.codexbar-serve.plist 與 `CODEXBAR_DASHBOARD_TOKEN` 加待淘汰註記（本案不刪檔）。實作設計決策「CodexBar collector 解除接線並標 deprecated，本案不刪」，並落實移除需求「CodexBar snapshot polling」與「Schema version validation」（其行為由 tokscale collector 取代）。驗證：`grep -n "codexBarSnapshot" src/server.js` 無有效 require 命中；檔頭可見 deprecated 標示。
- [x] 5.2 package.json 版本更新為 0.3.0。驗證：`node -p "require('./package.json').version"` 輸出 `0.3.0`。

## 6. 端到端驗收

- [x] 6.1 Codex 401 情境不影響整體：驗證 `curl -s localhost:8787/api/status` 回 200，`providers.codex.windows` 為空且帶 `error`，`providers.claude` 額度與花費正常。
- [x] 6.2 tokscale 不可用降級：將 tokscale 指令路徑暫改為不存在後重啟，驗證 `/api/status` 仍回 200 並帶 `error`/空狀態、process 不崩，前端顯示安裝 banner 與空狀態。
