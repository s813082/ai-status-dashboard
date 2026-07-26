## Why

現況 dashboard 是純本機服務（src/server.js 以 macOS launchd 常駐，0.6.0 起另支援 Windows 工作排程），資料全部來自 shell 呼叫本機 tokscale CLI，而 tokscale 的花費是掃「這台機器」的 session log 推算。因此在 Mac 開只看到 Mac 的用量、在 Windows 開只看到 Windows 的用量，跨電腦數字兜不起來，也算不出「全部裝置的總花費」。

此外另有第三個消耗來源：部署於 Zeabur 的 hermes-agent 容器（service `6a2ec6d8125703f5be365196`）同樣使用本帳號的 AI 工具，其 tokscale 設定目錄存在於 `/opt/data/.config/tokscale`。由於額度為帳號層級、花費為本機推算，該容器的消耗**已反映在額度環卻完全不計入任何一台的花費統計**，是目前「額度掉得比花費快」的主因之一。

目標是把 dashboard 部署到雲端（Zeabur）常駐、任何裝置可連，並透過 GitHub private repo 聚合 macOS／Windows／hermes-agent 容器三個來源的用量，使新增來源只需多上傳一個 JSON、零改 code。

## What Changes

- 新增遠端資料源與聚合能力：dashboard 可從 GitHub private repo 讀取每台裝置的用量 JSON（devices/<id>.json），並聚合成單一視圖。
- 以環境變數 DATA_SOURCE 切換資料源：local（現有 tokscale collector，本機行為完全不變）與 github（新遠端 collector）。**現有 local 流程不得破壞。**
- 聚合鐵律：花費（cost.todayUSD／last30DaysUSD）跨裝置相加；額度百分比（session%／weekly%／resetAt）取 generatedAt 最新那台裝置的整組值，嚴禁把百分比相加。
- /api/status 對前端輸出的 schema 維持不變，前端 index.html 零改動。
- 新增 Zeabur 容器化部署設定與環境變數化組態。
- 新增 dashboard 存取控制：上雲後為公開 URL 會外露花費金額，需以 DASHBOARD_TOKEN 做 token/Basic Auth 前置驗證。
- 定義每台裝置的上傳契約：定時產出正規化 snapshot、包上裝置中繼資料、以 GitHub contents API 單一 PUT 覆寫同檔到資料 repo（不走 git clone/commit/push）。上傳腳本置於本 repo，三種宿主共用同一支實作。
- 支援三種宿主的排程：macOS launchd、Windows 工作排程、**Linux 容器內 cron**（hermes-agent）。前兩者複用既有機制（`launchd/` plist 與 `scripts/windows/setup.ps1` 的排程註冊邏輯）。

## Non-Goals (optional)

- 不改前端 index.html 與既有前端資產（維持 /api/status 契約即可）。
- 不改既有 tokscale 相關 collector 的 local 行為，只新增資料源切換。
- 不採「裝置直接 POST 到 dashboard」的推送模型（已評估，改用 GitHub private repo 作為 durable 儲存 + 稽核，成本與維運更低）。
- 不追求秒級即時性：受上傳間隔與 GitHub CDN 快取影響，即時性為分鐘級，屬可接受取捨。
- 不改 hermes-agent 本身：它是從 Zeabur 範本部署的第三方 AI agent（NousResearch Hermes，同專案另有 postgresql 與 mission-control）。本變更只在其容器內加裝 tokscale 與上傳排程，把它當成第三個**資料來源**，不介入其既有功能。
- 不讓雲端 dashboard 自行執行 tokscale：該作法可省去上傳延遲，但需將 Claude／Codex 憑證放進 dashboard 容器，而額度資料透過裝置上傳本來就會取得，不值得為此擴大憑證暴露面。維持「dashboard 容器無憑證」。

## Capabilities

### New Capabilities

- `remote-usage-aggregation`: dashboard 從 GitHub private repo 讀取多台裝置用量 JSON 並聚合（花費相加、額度取最新裝置），以 DATA_SOURCE 切換 local／github，維持 /api/status schema 不變。
- `cloud-deployment`: 容器化部署到 Zeabur 的組態與環境變數化設定，並提供以 DASHBOARD_TOKEN 為基礎的存取控制。
- `device-usage-upload`: 每台裝置定時產出正規化用量 snapshot、附裝置中繼資料並以 GitHub contents API 單一 PUT 覆寫同檔到資料 repo 的上傳契約。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 remote-usage-aggregation、cloud-deployment、device-usage-upload
- Affected code:
  - New:
    - src/collectors/githubSnapshot.js（遠端 fetch，含快取與 carry-forward）
    - src/collectors/aggregate.js（跨裝置聚合純函式，可單元測試）
    - src/collectors/index.js（依 DATA_SOURCE 選用 collector 的 factory）
    - scripts/upload-usage.js（三種宿主共用的上傳腳本）
    - Dockerfile（Zeabur 容器化）
    - launchd/com.barry.ai-usage-upload.plist、hermes 容器 crontab（排程檔）
  - Modified:
    - src/server.js（DATA_SOURCE 資料源切換、DASHBOARD_TOKEN 存取控制中介、github 模式下不使用本機 activity）
    - scripts/windows/setup.ps1（沿用既有排程註冊邏輯，新增上傳工作）
  - Removed: （無）
- 環境變數：DATA_SOURCE、GITHUB_TOKEN、GITHUB_DATA_REPO、GITHUB_DATA_BRANCH、REFRESH_MS、DASHBOARD_TOKEN（全走環境變數，禁寫死）
- 外部相依：新增一個獨立的 GitHub private 資料 repo（建議 s813082/ai-usage-data）；Zeabur 部署環境
- 安全：花費資料上雲，資料 repo 必須 private、dashboard 必須有存取控制、JSON 內容與 commit 不得含任何憑證
