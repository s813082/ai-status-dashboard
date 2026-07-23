## 1. 遠端 collector 與聚合（remote-usage-aggregation）

- [ ] 1.1 實作 Data source selection via DATA_SOURCE 的 github 分支：新增 githubSnapshot collector，能以 GITHUB_TOKEN 從 GITHUB_DATA_REPO/GITHUB_DATA_BRANCH fetch devices/*.json 並解析。驗證：本機以 mock/private repo 起服務，能取回並解析多個裝置檔（手動打 /api/status 觀察 byDevice）。
- [ ] 1.2 實作 Cross-device aggregation rules 的聚合函式：cost.todayUSD/last30DaysUSD 對 error===null 裝置加總；windows 與 resetAt 取 generatedAt 最新裝置整組值；activity 任一 working 即 working。驗證：單元測試餵 cost 9/5 且 generatedAt 一新一舊 → 斷言 cost.todayUSD===14 且 windows 取到較新那台。
- [ ] 1.3 實作 Resilient remote fetch：fetch 失敗沿用上一份並標 stale、/api/status 永不 500；最新裝置 generatedAt 超過門檻（預設 15 分鐘）標頂層 stale；error!==null 的裝置排除於 cost 加總。驗證：模擬 fetch 失敗與過期資料，斷言回應為 stale 且非 500，且錯誤裝置未污染總額。
- [ ] 1.4 達成 Preserve the /api/status output contract：輸出對齊既有 /api/status 正規化 schema，另附 byDevice 明細且不改動既有欄位。驗證：比對 github 模式與 local 模式的 /api/status 欄位結構一致（provider/windows/cost/activity）。

## 2. 資料源切換與存取控制（server）

- [ ] 2.1 完成 Data source selection via DATA_SOURCE 的切換管線：server snapshot 管線依 DATA_SOURCE 選 local→現有 tokscaleSnapshot、github→新 githubSnapshot；未設或 local 時行為與現況完全一致。驗證：DATA_SOURCE=local 啟動，/api/status 結構與改動前一致（本機回歸），且 local 模式不觸發任何 GitHub fetch。
- [ ] 2.2 實作 Access control for the public dashboard：加入 DASHBOARD_TOKEN 前置存取控制中介，無有效憑證回 401 且不外露用量資料，正確憑證回 200。驗證：不帶 token 打 /api/status → 401；帶正確 token → 200。

## 3. Zeabur 部署組態（cloud-deployment）

- [ ] 3.1 達成 Containerized deployment to Zeabur：新增 Dockerfile（Node18-slim、npm start），確保容器綁 process.env.PORT 與 0.0.0.0。驗證：本機 docker build 成功且容器內服務可在指定 PORT 回應 /api/status。
- [ ] 3.2 落實 No credentials in source or logs：整理 Zeabur 環境變數清單與部署說明（DATA_SOURCE、GITHUB_TOKEN、GITHUB_DATA_REPO、GITHUB_DATA_BRANCH、REFRESH_MS、DASHBOARD_TOKEN），全部環境變數化不寫死。驗證：grep 原始碼與 diff 無任何 token/PAT/密鑰明文。

## 4. 裝置上傳端契約（device-usage-upload，實作前需定位 hermes-agent）

- [ ] 4.1 定位 hermes-agent 程式碼實際位置與結構並回報 Supervisor，取得補充後才進入實作。驗證：回報一份 hermes-agent 位置/結構說明，確認上傳步驟可掛入既有流程。
- [ ] 4.2 實作 Per-device usage snapshot upload contract 與 Upload credential isolation：本機跑 tokscale 產出正規化 snapshot（複用 tokscaleSnapshot 正規化邏輯），包上 deviceId/os/generatedAt(UTC)/tokscaleVersion，以 GitHub contents API 單一 PUT 覆寫 devices/<deviceId>.json（不走 git clone/commit/push）；憑證存本機憑證檔不進 code。驗證：實跑一次，資料 repo 出現對應裝置檔且內容合法、無任何憑證。
- [ ] 4.3 完成 Scheduled execution per platform：macOS 用 launchd（比照現有 plist 風格）、Windows 用 Task Scheduler，間隔 5–15 分鐘。驗證：排程註冊後於下一週期自動更新裝置檔。
- [ ] 4.4 撰寫「新增裝置 SOP」文件（裝 tokscale → 設 deviceId → 設 PAT → 註冊排程 → 首次上傳）。驗證：依文件在一台新裝置走一遍能成功首次以 API PUT 上傳裝置檔。

## 5. 端到端驗收

- [ ] 5.1 端到端：改動資料 repo 內某裝置檔 → dashboard 在一個 REFRESH_MS 週期內反映新數字。驗證：修改 devices/*.json 後於一個輪詢週期內 /api/status 數字更新。
