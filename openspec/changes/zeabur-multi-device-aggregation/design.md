## Context

現行 dashboard 為純本機 Node node:http 服務，透過 execFile 呼叫本機 tokscale CLI 取得 Claude／Codex 額度與花費，並以 launchd 常駐（僅 macOS）。tokscale 讀取的是本機 session log，故跨電腦無法彙整。dev-spec.md 已記載：額度百分比為「帳號真相」換機一致，而 cost 為本機推算換機看不到歷史。本設計要在「不破壞既有 local 行為、不改前端」前提下，新增「雲端部署 + 多裝置聚合」能力。

現有可複用資產：tokscaleSnapshot.js 的正規化 schema 與 labelToKind 映射、carry-forward／staleWindows 韌性寫法；activity.js 的 working/exhausted/idle 三態語意；providers.js 的 provider 註冊表；server.js 已使用 process.env.PORT 且綁 0.0.0.0，天然相容 Zeabur。

## Goals / Non-Goals

**Goals:**

- dashboard 可從 GitHub private repo 讀取多台裝置的用量 JSON 並聚合為單一視圖。
- 以 DATA_SOURCE 環境變數在 local（tokscale）與 github（遠端聚合）間切換，local 行為零變更。
- 花費跨裝置相加、額度取最新裝置，/api/status 輸出 schema 不變。
- 可容器化部署到 Zeabur，且公開 URL 有存取控制。
- 明確定義每台裝置的上傳契約，供後續 apply 實作。

**Non-Goals:**

- 不改前端 index.html 與既有前端資產。
- 不改既有 tokscale collector 的 local 路徑行為。
- 不採「裝置直接 POST」推送模型。
- 不追求秒級即時性（分鐘級可接受）。
- 本次不實作 hermes-agent 上傳端（僅定義契約，待定位程式碼後另行 apply）。

## Decisions

- **資料層用 GitHub private repo（而非直接 POST 或 DB）**：免基礎設施、天生版本化可稽核、低頻資料維運成本最低；代價是即時性降為分鐘級。已否決「裝置直接 POST 到 dashboard」（需 dashboard 常駐 + 自建 auth 與儲存）。
- **每裝置一檔、固定覆寫（devices/<id>.json）**：控制 commit 噪音，聚合以「檔案集合」為單位，新增裝置零改 code。
- **DATA_SOURCE 切換而非取代**：新增 githubSnapshot collector 與現有 tokscaleSnapshot 並存，server 依 DATA_SOURCE 選用；確保雲端不 spawn tokscale、本機行為不變。
- **聚合鐵律：花費相加、額度取最新裝置**：花費具可加性；額度為帳號層級每機一致，取 generatedAt 最新那台的整組值，嚴禁百分比相加（會 >100%）。依 Barry 決策採「最新時間戳」而非「指定主裝置」。
- **存取控制以 DASHBOARD_TOKEN**：上雲後公開 URL 會外露花費金額，加一層 token/Basic Auth 中介，憑證走環境變數。

## Implementation Contract

**行為（Behavior）：**
- 當 DATA_SOURCE=github：dashboard 定時（沿用現有 REFRESH_MS 輪詢）fetch 資料 repo 的 devices/*.json，聚合後供應 /api/status；輸出結構與 DATA_SOURCE=local 時一致。
- 當 DATA_SOURCE 未設或為 local：行為與現況完全相同（呼叫 tokscale）。
- 未帶正確 DASHBOARD_TOKEN 的請求回 401；帶正確憑證回 200。

**介面／資料形狀（Interface / Data shape）：**
- 每裝置檔 devices/<id>.json：{ deviceId, os, generatedAt(UTC ISO), tokscaleVersion, providers: { claude:{windows[],cost:{todayUSD,last30DaysUSD},error}, codex:{...} } }。
- /api/status 正規化輸出：維持現有 tokscaleSnapshot 正規化契約（providers[].windows[{kind,usedPercent,remainingPercent,resetAt}]、cost、activity、頂層 stale／fetchedAt 等），另可附 byDevice 明細陣列（不影響前端）。
- 聚合函式（逐 provider）：cost.* 為所有 error===null 裝置之總和；windows 與 resetAt 取 generatedAt 最新裝置之整組值；activity 任一裝置 working 即 working；頂層 stale 為最新裝置 generatedAt 超過門檻（預設 15 分鐘）。
- 環境變數：DATA_SOURCE、GITHUB_TOKEN、GITHUB_DATA_REPO、GITHUB_DATA_BRANCH、REFRESH_MS、DASHBOARD_TOKEN。

**失敗模式（Failure modes）：**
- 遠端 fetch 失敗：沿用上一份快照並標 stale（比照現有 carry-forward／staleWindows 行為），/api/status 永不 500。
- 冷啟動無快取：回 loading 狀態（比照現況）。
- 某裝置檔解析失敗或 error!==null：該裝置排除於 cost 加總，不污染總額。
- 憑證缺失：以非 200（401）明確拒絕，不得靜默放行。

**驗收標準（Acceptance criteria）：**
- local 回歸：DATA_SOURCE=local 啟動，/api/status 結構與改動前一致。
- 聚合單元：餵兩份 mock device JSON（cost 9 與 5、generatedAt 一新一舊）→ 聚合 cost.todayUSD 等於 14，且 windows 取到較新那台的值。
- github 模式：private repo 放 devices/mac.json 與 devices/windows.json，DATA_SOURCE=github 啟動 → /api/status 聚合與 stale 行為正確。
- 存取控制：無 token → 401；正確 token → 200。
- 安全掃描：diff 與新增檔 grep 不到任何 token／PAT／密鑰明文。

**範圍邊界（Scope boundaries）：**
- In scope：githubSnapshot collector、聚合邏輯、DATA_SOURCE 切換、Dockerfile／Zeabur 組態、DASHBOARD_TOKEN 存取控制、device-usage-upload 契約文件。
- Out of scope：前端改動、既有 local collector 邏輯變更、hermes-agent 上傳端實作（僅定義契約）。

## Risks / Trade-offs

- [即時性由秒級降為分鐘級（上傳間隔 + GitHub raw CDN 約 5 分鐘快取）] → UI 顯示資料時間戳；raw vs contents API 由實作取捨並回報。
- [額度取最新裝置，若各機 tokscale 估算分歧可能非帳號真值] → dev-spec.md 認為此值換機一致風險低；以最新者為準並標時間戳。
- [花費資料上雲的隱私風險] → 資料 repo 必須 private、dashboard 必須存取控制、JSON 與 commit 不得含憑證。
- [commit 噪音] → 每裝置覆寫同一檔；必要時改推 data-only 分支。
- [hermes-agent 位置未定位] → device-usage-upload 僅落契約，實作前須先定位程式碼並回報，不得憑空捏造路徑。

## Migration Plan

1. 新增 githubSnapshot collector 與聚合邏輯，先以 mock／private repo 資料在本機驗證（DATA_SOURCE=github）。
2. server 加入 DATA_SOURCE 切換與 DASHBOARD_TOKEN 中介；確認 local 回歸通過。
3. 新增 Dockerfile／Zeabur 組態並部署，設定雲端環境變數。
4. 定位 hermes-agent 後，依 device-usage-upload 契約實作上傳端與排程，完成端到端。
5. 既有 launchd 本機用法可保留（local 模式）不受影響。
