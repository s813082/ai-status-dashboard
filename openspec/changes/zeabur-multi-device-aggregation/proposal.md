## Why

現況 dashboard 是純本機服務（src/server.js 以 macOS launchd 常駐），資料全部來自 shell 呼叫本機 tokscale CLI，而 tokscale 只讀「這台機器」的 session log。因此在 Mac 開只看到 Mac 的用量、在 Windows 開只看到 Windows 的用量，跨電腦數字兜不起來，也算不出「全部裝置的總花費」。目標是把 dashboard 部署到雲端（Zeabur）常駐、任何裝置可連，並透過 GitHub private repo 聚合多台裝置的用量，使新增裝置只需多上傳一個 JSON、零改 code。

## What Changes

- 新增遠端資料源與聚合能力：dashboard 可從 GitHub private repo 讀取每台裝置的用量 JSON（devices/<id>.json），並聚合成單一視圖。
- 以環境變數 DATA_SOURCE 切換資料源：local（現有 tokscale collector，本機行為完全不變）與 github（新遠端 collector）。**現有 local 流程不得破壞。**
- 聚合鐵律：花費（cost.todayUSD／last30DaysUSD）跨裝置相加；額度百分比（session%／weekly%／resetAt）取 generatedAt 最新那台裝置的整組值，嚴禁把百分比相加。
- /api/status 對前端輸出的 schema 維持不變，前端 index.html 零改動。
- 新增 Zeabur 容器化部署設定與環境變數化組態。
- 新增 dashboard 存取控制：上雲後為公開 URL 會外露花費金額，需以 DASHBOARD_TOKEN 做 token/Basic Auth 前置驗證。
- 定義每台裝置的上傳契約：定時產出正規化 snapshot、包上裝置中繼資料、覆寫同檔 push 到資料 repo。

## Non-Goals (optional)

- 不改前端 index.html 與既有前端資產（維持 /api/status 契約即可）。
- 不改既有 tokscale 相關 collector 的 local 行為，只新增資料源切換。
- 不採「裝置直接 POST 到 dashboard」的推送模型（已評估，改用 GitHub private repo 作為 durable 儲存 + 稽核，成本與維運更低）。
- 不追求秒級即時性：受上傳間隔與 GitHub CDN 快取影響，即時性為分鐘級，屬可接受取捨。
- 本次不完成 hermes-agent 上傳端實作：repo 內尚未定位 hermes-agent 程式碼，device-usage-upload 僅定義契約，實作待定位後另行 apply。

## Capabilities

### New Capabilities

- `remote-usage-aggregation`: dashboard 從 GitHub private repo 讀取多台裝置用量 JSON 並聚合（花費相加、額度取最新裝置），以 DATA_SOURCE 切換 local／github，維持 /api/status schema 不變。
- `cloud-deployment`: 容器化部署到 Zeabur 的組態與環境變數化設定，並提供以 DASHBOARD_TOKEN 為基礎的存取控制。
- `device-usage-upload`: 每台裝置定時產出正規化用量 snapshot、附裝置中繼資料並覆寫同檔 push 到資料 repo 的上傳契約。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 remote-usage-aggregation、cloud-deployment、device-usage-upload
- Affected code:
  - New:
    - src/collectors/githubSnapshot.js（遠端 fetch + 聚合）
    - Dockerfile（Zeabur 容器化）
    - hermes 上傳腳本與排程檔（待定位 hermes-agent 後補齊）
  - Modified:
    - src/server.js（DATA_SOURCE 資料源切換、DASHBOARD_TOKEN 存取控制中介）
  - Removed: （無）
- 環境變數：DATA_SOURCE、GITHUB_TOKEN、GITHUB_DATA_REPO、GITHUB_DATA_BRANCH、REFRESH_MS、DASHBOARD_TOKEN（全走環境變數，禁寫死）
- 外部相依：新增一個獨立的 GitHub private 資料 repo（建議 s813082/ai-usage-data）；Zeabur 部署環境
- 安全：花費資料上雲，資料 repo 必須 private、dashboard 必須有存取控制、JSON 內容與 commit 不得含任何憑證
