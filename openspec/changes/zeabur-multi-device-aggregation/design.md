## Context

現行 dashboard 為純本機 Node node:http 服務，透過 execFile 呼叫本機 tokscale CLI 取得 Claude／Codex 額度與花費，並以 launchd 常駐（僅 macOS）。tokscale 讀取的是本機 session log，故跨電腦無法彙整。dev-spec.md 已記載：額度百分比為「帳號真相」換機一致，而 cost 為本機推算換機看不到歷史。本設計要在「不破壞既有 local 行為、不改前端」前提下，新增「雲端部署 + 多裝置聚合」能力。

現有可複用資產：tokscaleSnapshot.js 的正規化 schema 與 labelToKind 映射、carry-forward／staleWindows 韌性寫法（`normalize` 已於 module.exports 匯出，可直接供上傳腳本複用）；activity.js 的 working/exhausted/idle 三態語意；providers.js 的 provider 註冊表；server.js 已使用 process.env.PORT 且綁 0.0.0.0，天然相容 Zeabur；0.6.0 起 `scripts/windows/setup.ps1` 已具備 Windows 工作排程註冊邏輯，`launchd/` 已有 plist 範本，兩者可供上傳排程沿用。

**第三個資料來源的調查結論**：Zeabur 專案 `hermes-agent`（`6a2ec567125703f5be365143`）下的 service `hermes-agent-miter`（`6a2ec6d8125703f5be365196`）為第三方 AI agent（NousResearch Hermes，PREBUILT_V2 範本，同專案另有 postgresql 與 mission-control）。實地檢查其容器：`HOME=/opt/data`，**不存在** `.claude`／`.codex` session log 目錄，故它無法取得 Mac／Windows 的資料，不能擔任收集中樞；但 `/opt/data/.config/tokscale` 存在，代表 tokscale 曾在該容器設定過（互動 shell 的 PATH 目前找不到執行檔，需重新確認安裝位置）。結論是它應被視為與 Mac／Windows 並列的**第三個資料來源**。

**額度與花費的來源差異（本設計的核心前提）**：`tokscale usage --json` 的額度為帳號層級，任何持有憑證的機器都能取得，故三台回報的額度應一致；`tokscale graph` 的花費則是掃本機 session log 推算，各台互不重疊。這正是「花費相加、額度取最新」聚合鐵律的成因，也解釋了為何 hermes-agent 的消耗已反映在額度環、卻不計入任何一台的花費。

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

## Architecture

```
┌── 資料來源：三台各自跑 tokscale，只看得到自己這台的 session log ──┐
│                                                                    │
│   macOS                  Windows                 hermes-agent      │
│   ~/.claude/projects     %USERPROFILE%\.claude   (Zeabur 容器)     │
│   ~/.codex/sessions      %USERPROFILE%\.codex    /opt/data/.config │
│        │                      │                        │          │
│   launchd 排程           工作排程                  容器內 cron      │
│        │                      │                        │          │
│        └──────────┬───────────┴────────────────────────┘          │
│                   │                                                │
│         scripts/upload-usage.js（三台共用同一支）                   │
│         tokscale → normalize() → 包 deviceId/os/generatedAt         │
│         → GitHub contents API 單一 PUT                              │
└───────────────────┼────────────────────────────────────────────────┘
                    ▼
       ┌─────────────────────────────────────┐
       │  GitHub private repo                │
       │  s813082/ai-usage-data              │
       │    devices/mac.json                 │
       │    devices/windows.json             │
       │    devices/hermes.json              │
       └─────────────┬───────────────────────┘
                     │ fetch（REFRESH_MS 輪詢）
                     ▼
       ┌─────────────────────────────────────┐
       │  Zeabur：ai-status-dashboard        │
       │  DATA_SOURCE=github                 │
       │    githubSnapshot.js   抓取＋快取    │
       │    aggregate.js        聚合（純函式）│
       │    DASHBOARD_TOKEN     cookie 驗證   │
       │  ※ 容器內不跑 tokscale、不放憑證     │
       └─────────────┬───────────────────────┘
                     │ https
                     ▼
          iPhone / 瀏覽器（任何地方，不限區網）
```

聚合規則：花費三台相加（各自 log 不重疊）；額度取 `generatedAt` 最新那台的整組值（帳號層級，各台應一致）；狀態任一台 working 即 working；`error !== null` 的裝置排除於花費加總。

## Decisions

- **資料層用 GitHub private repo（而非直接 POST 或 DB）**：免基礎設施、天生版本化可稽核、低頻資料維運成本最低；代價是即時性降為分鐘級。已否決「裝置直接 POST 到 dashboard」（需 dashboard 常駐 + 自建 auth 與儲存）。
- **每裝置一檔、固定覆寫（devices/<id>.json）**：控制 commit 噪音，聚合以「檔案集合」為單位，新增裝置零改 code。
- **DATA_SOURCE 切換而非取代**：新增 githubSnapshot collector 與現有 tokscaleSnapshot 並存，server 依 DATA_SOURCE 選用；確保雲端不 spawn tokscale、本機行為不變。
- **聚合鐵律：花費相加、額度取最新裝置**：花費具可加性；額度為帳號層級每機一致，取 generatedAt 最新那台的整組值，嚴禁百分比相加（會 >100%）。依 Barry 決策採「最新時間戳」而非「指定主裝置」。
- **存取控制以 DASHBOARD_TOKEN，採 cookie 而非 Basic Auth**：上雲後公開 URL 會外露花費金額，需前置驗證。流程為「首次以 `?token=<DASHBOARD_TOKEN>` 開啟 → server 比對後 Set-Cookie（httpOnly、Secure、SameSite=Lax、長效期）→ 之後免帶 token」。選 cookie 的原因是本 dashboard 的主要用法是 iPhone「加入主畫面」當常駐副螢幕，Basic Auth 在 iOS 全螢幕模式有機會每次啟動重跳帳密框；cookie 過期時使用者只需重打一次帶 token 的網址，無須改動雲端設定。DASHBOARD_TOKEN 本身存於環境變數且不過期。
- **hermes-agent 為第三個資料來源，而非收集中樞**：其容器內無 `.claude`／`.codex` session log，取不到 Mac／Windows 的資料，架構上不可能擔任收集者；但它自身消耗帳號額度且花費未被任何一台統計到，故納入為第三台裝置。已否決「dashboard 向 hermes-agent 查詢」的模型。
- **雲端 dashboard 不執行 tokscale、不持有憑證**：已評估「dashboard 自跑 tokscale 取額度以省去上傳延遲」，否決之——額度資料透過裝置上傳本來就會取得，該作法僅為省少量延遲而需將 Claude／Codex 憑證放入 dashboard 容器，擴大憑證暴露面且多出一條程式路徑。維持 remote-usage-aggregation 既有的 `MUST NOT spawn the tokscale CLI` 要求。
- **上傳腳本單一實作、三種排程**：`scripts/upload-usage.js` 為三種宿主共用，差異只在排程註冊方式（launchd／工作排程／容器內 cron）與 `deviceId`。避免為每個平台各寫一份而產生行為漂移。

## Implementation Contract

**行為（Behavior）：**
- 當 DATA_SOURCE=github：dashboard 定時（沿用現有 REFRESH_MS 輪詢）fetch 資料 repo 的 devices/*.json，聚合後供應 /api/status；輸出結構與 DATA_SOURCE=local 時一致。
- 當 DATA_SOURCE 未設或為 local：行為與現況完全相同（呼叫 tokscale）。
- **activity 來源需隨資料源切換**：`src/server.js` 的 `buildStatus` 目前無條件呼叫 `activity.computeActivities()`，而該函式讀取本機 `~/.claude/projects`／`~/.codex/sessions` 的 mtime。雲端容器內不存在這些路徑，若不處理會全數回 `idle` 並覆蓋掉聚合出的 activity。故 github 模式下 `buildStatus` MUST NOT 呼叫本機 activity，改用聚合結果（任一裝置 working 即 working）。
- 未帶正確 DASHBOARD_TOKEN 的請求回 401；帶正確憑證回 200。帶 `?token=` 且比對成功時 Set-Cookie 後轉址，後續請求以 cookie 驗證。

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
- [hermes-agent 容器內 tokscale 執行檔位置未確認] → `/opt/data/.config/tokscale` 設定目錄存在但互動 shell 找不到執行檔，實作前須先確認安裝路徑（或重裝）並確認該容器是否真的產生 session log；若確認無花費資料，該裝置僅回報額度、花費為 0，不影響聚合正確性。
- [hermes-agent 為第三方範本服務，非本 repo 掌控] → 只在容器內加裝 tokscale 與 cron，不修改其應用程式；若該服務被重建（範本更新／重新部署），上傳設定會遺失，需重跑安裝步驟。此風險以「新增裝置 SOP」文件涵蓋。
- [容器內排程隨容器重啟失效] → 容器重建後 crontab 不保留，除非寫入持久化磁碟（`/opt/data`）或改由 Zeabur 排程機制驅動；實作時擇一並記錄。

## Migration Plan

分三個可獨立驗收的增量，順序為 A → C → B（先有資料再上雲，否則部署上去只會看到空畫面）：

1. **增量 A — 聚合核心**：新增 aggregate.js（純函式）與 githubSnapshot collector，以 mock JSON 單元測試驗證聚合鐵律；加入 DATA_SOURCE factory 與 activity 來源切換；確認 DATA_SOURCE=local 回歸通過。**此增量不需要 GitHub repo、Zeabur 或任何憑證即可完成並驗證。**
2. **增量 C — 上傳端**：建立資料 repo，實作 scripts/upload-usage.js，依序在 macOS（launchd）、Windows（複用 setup.ps1 排程邏輯）、hermes-agent 容器（先確認 tokscale 安裝位置再設 cron）掛上排程，撰寫新增裝置 SOP。
3. **增量 B — 上雲**：新增 Dockerfile 與 DASHBOARD_TOKEN cookie 存取控制，部署至 Zeabur 並設定環境變數，完成端到端驗收。
4. 既有 launchd／Windows 排程的本機 dashboard 用法可保留（local 模式）不受影響。
