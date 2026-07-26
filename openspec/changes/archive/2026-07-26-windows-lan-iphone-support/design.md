## Context

專案目前由 `src/collectors/tokscale.js` 以 Node.js `execFile()` 啟動 `TOKSCALE_BIN`。macOS／Linux 的 executable 可直接執行，但 Windows 全域 npm 安裝通常提供 `tokscale.cmd`；Node.js 在 Windows 直接 `execFile()` 該 shim 會回 `EINVAL`。此外，專案只有 macOS launchd 流程，Windows 尚無可重複、可逆且只開放 Private LAN 的常駐設定。

這次維持單機資料模型：Windows 電腦只提供自己的 Claude Code／Codex 狀態，iPhone 是同一 LAN 上的瀏覽器用戶端。現有 `/api/status`、前端頁面、collector 上層、macOS launchd 和 Zeabur change 都是相容性邊界。

## Goals / Non-Goals

**Goals:**

- 在 Windows 安全啟動 `.cmd`／`.bat` tokscale shim，並保持 `.exe`、macOS、Linux 的直接 executable 行為。
- 提供相容 Windows PowerShell 5.1 的安裝與啟動腳本，建立可重跑的登入排程與 Private-only Firewall rule。
- 安裝後立即啟動 dashboard，驗證 localhost 與 Private LAN URL，並留下清楚的登入／移除指引。
- 以單元測試保護 command invocation、參數邊界與既有具名錯誤語意。

**Non-Goals:**

- 不新增 OS／device 顯示、`deviceId`、`devices[]`、`byDevice`、裝置切換或多機聚合。
- 不修改前端、`/api/status` schema、provider 顯示邏輯、server、activity、snapshot、reports 或 launchd。
- 不部署 Zeabur，不修改 `zeabur-multi-device-aggregation` change。
- 不加入登入頁、遠端認證、雲端資料源或 npm runtime dependency。
- 不自動把 Public network 改為 Private，也不在 Public profile 開放 TCP 8787。

## Decisions

### tokscale Windows command adapter

新增最小純函式，輸入 binary path、args、platform 與 ComSpec，輸出 `execFile` 的 `file` 與 `args`。非 Windows與 Windows `.exe` 直接執行；Windows `.cmd`／`.bat` 改執行 `process.env.ComSpec || 'cmd.exe'`，參數為 `/d /s /c` 加上一個經 Windows cmd quoting 的完整 command 字串。`/d` 禁用 AutoRun，`/s /c` 讓 command string 的引號解析一致。

只對已由設定或 PATH 決定的 binary path 與程式內部 args 做逐項 quoting；每個 token 皆以雙引號包住，內部 `"`、`%`、`!`、`^` 與 cmd metacharacters 以拒絕或跳脫策略處理，確保參數不會被合併或解讀為額外 command。呼叫仍使用 `execFile()`，不啟用全域 `shell: true`，並設定 `windowsHide: true`、既有 timeout 與 maxBuffer。

替代方案 `exec()` 或全域 `shell: true` 會放大注入面且改變所有平台行為，因此不採用。把 `.cmd` 解析搬到上層 collector 會重複邏輯，也不採用。

### Windows start-dashboard runtime

`start-dashboard.ps1` 從 `$PSScriptRoot` 往上兩層取得 repo root，不寫死使用者路徑。它解析 `node.exe` 並檢查版本至少 18；解析 tokscale 時先使用 `where.exe`，再以 `Get-Command` 補足，僅接受 `Application` 且副檔名為 `.exe`、`.cmd` 或 `.bat`，排除 PowerShell `.ps1` shim。腳本只在目前 process 設定 `TOKSCALE_BIN`。

腳本建立被 Git 忽略的 `logs` 目錄，以隱藏視窗的 `Start-Process` 從 repo root 啟動 `src/server.js`，將 stdout 與 stderr 分別寫入固定 log 檔。啟動前若 TCP 8787 已由 Node 監聽，視為冪等成功；若由其他 process 佔用則明確失敗。

### Windows setup, Private Firewall and logon task

`setup.ps1` 使用 `CmdletBinding(SupportsShouldProcess)`，所有會改變系統的安裝、排程、Firewall 與啟動動作都經 `ShouldProcess`，因此 `-WhatIf` 不改系統。tokscale 缺少時執行全域 `npm install --global tokscale@latest`，再以實際 binary 驗證 `--version`、`usage --json`、`codex status --json`。若 provider 尚未授權，回報需執行的 CLI 登入或 import 命令，不讀取或輸出任何憑證。

排程名稱固定為 `AI Status Dashboard`，使用目前登入者的 interactive token、登入觸發器與 PowerShell 5.1 呼叫 `start-dashboard.ps1`；重跑會更新同名排程而非新增。Firewall rule 同名，先移除同名舊 rule 再建立僅 `Private`、`Inbound`、`Allow`、`TCP`、`LocalPort 8787` 且 `Program` 限定當前 `node.exe` 的 rule。若目前任何已連線網路不是 Private，Firewall 階段在變更前停止並回報，絕不自動開 Public。

替代方案 Windows service 需要額外 service wrapper 與更高權限；登入排程足以符合「使用者登入時常駐」且更容易移除，因此不採用 service。

### Verification and compatibility boundary

自動驗證依序包含 command adapter 單元測試、PowerShell parser、setup `-WhatIf`、tokscale 三個 CLI 命令、排程／Firewall 狀態、TCP 8787 listener、localhost 與 LAN `/api/status`。`providers.claude` 與 `providers.codex` 的 JSON 形狀沿用既有 server；不因 Windows 增加任何欄位。macOS launchd 檔案與行為不得變更。

## Implementation Contract

### Command adapter contract

- 匯出的純函式接收 `{ binary, args, platform, comSpec }`（或等價可測介面），回傳 `execFile` 可直接使用的 `{ file, args }`。
- `darwin`／`linux` 任意 executable 與 `win32` `.exe` 回傳原 binary 與完全相同的 args array。
- `win32` `.cmd`／`.bat` 回傳 ComSpec 作為 file；傳入含空白的 binary path與各個 args 在 command string 中維持 token 邊界。
- `run()` 保留 `TOKSCALE_BIN`、timeout、16 MiB maxBuffer、`TokscaleNotInstalledError`、`TokscaleError` 與 JSON parse error 語意，並一律傳入 `windowsHide: true`。
- 底層 `execFile` 回 `ENOENT` 時仍辨識為未安裝；Windows 啟動腳本會先拒絕不存在的 `.cmd`／`.bat` 路徑，而已進入 ComSpec 後的非零 exit、timeout、無效 JSON 保持 `TokscaleError`，不得誤分類為 `ENOENT`。

### Windows runtime contract

- `start-dashboard.ps1` 與 `setup.ps1` 可由 Windows PowerShell 5.1 parser 成功解析，且不依賴 PowerShell 7-only syntax。
- `setup.ps1 -WhatIf` 列出 tokscale 安裝、排程、Firewall 與啟動的預計動作，且不建立或修改這些資源。
- 實際 setup 完成後，同名排程只有一個，同名 Firewall rule 只允許 Private/TCP/8787/目前 node.exe；不得存在由本流程新增的 Public 8787 allow rule。
- setup 立即啟動服務；`http://localhost:8787/api/status` 與顯示的非 loopback、非 APIPA Private IPv4 URL 回 HTTP 200 且 JSON 含 `providers.claude` 與 `providers.codex`。
- provider 授權失敗時腳本保留服務與安全設定的診斷資訊，明確列出互動式登入／import 待辦，但不索取、顯示或記錄 token。
- 重跑 setup 更新既有資源，不產生重複排程或 Firewall rule。

### Acceptance and scope contract

- `npm test`、兩支 PowerShell parser 指令、setup `-WhatIf`、`spectra validate windows-lan-iphone-support --strict` 與 `git diff --check` 全部成功。
- 實際 Windows 設定需有 tokscale version、Task Scheduler、Firewall、listener、localhost API 與 LAN API 的輸出證據。
- iPhone Safari 實機 UAT 只能標記等待 Barry 在同一 Wi-Fi 開啟 URL 後確認；未確認前 change 不 archive。
- 實作只能修改 proposal 所列檔案；`src/public/**`、`src/server.js`、`src/collectors/activity.js`、`src/collectors/tokscaleSnapshot.js`、`src/collectors/tokscaleReports.js`、`launchd/**` 與既有 Zeabur change 全部在範圍外。

## Risks / Trade-offs

- [cmd.exe quoting 對特殊字元敏感] → command adapter 只接受已解析的 binary 與程式內部 args，逐 token quote，測試空白路徑與 metacharacter 邊界，不接受任意完整 command string。
- [Firewall cmdlets 需要系統管理員權限] → setup 明確失敗並要求以系統管理員 PowerShell 重跑；`-WhatIf` 可先預覽。
- [目前網路為 Public] → 在建立 Firewall 前停止，不降級安全限制。
- [tokscale 或上游 CLI 未登入] → 分開回報安裝、shim、authorization 與 schema 狀態；不把 provider 登入失敗誤判成 dashboard 啟動失敗。
- [登入排程只在使用者登入後執行] → 這是刻意的 MVP 邊界，避免儲存密碼或引入 service wrapper。
- [iPhone UAT 無法自動化] → 完成本機與 LAN IP API 驗證後保留為唯一人工驗收項目，change 不 archive。

## Migration Plan

1. 以 setup `-WhatIf` 預覽所有變更。
2. 在系統管理員 PowerShell 執行 setup，安裝／驗證 tokscale、更新排程與 Private Firewall rule，立即啟動服務。
3. 驗證 localhost 與 LAN API，最後由 Barry 使用同一 Wi-Fi 的 iPhone Safari 開啟 LAN URL。
4. 回復時停用並移除 `AI Status Dashboard` 排程、移除同名 Firewall rule、停止對應 node process；全域 tokscale 是否移除由使用者另行決定。

## Open Questions

無；iPhone Safari 實機結果屬部署後 UAT，不影響已鎖定的實作決策。
