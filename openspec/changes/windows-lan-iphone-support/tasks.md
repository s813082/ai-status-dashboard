## 1. tokscale 跨平台命令執行

- [x] 1.1 依「tokscale Windows command adapter」、「Command adapter contract」與「tokscale CLI collection resilience」contract，在 `src/collectors/tokscale.js` 匯出可注入 platform、ComSpec、binary、args 的純 invocation 函式；Windows `.cmd`／`.bat` 經 ComSpec 安全保留 token 邊界，`.exe`／darwin／linux 直接執行，`run()` 保留 timeout、maxBuffer、具名錯誤並加入 `windowsHide: true`。以 `node --test test/tokscale-command.test.js` 驗證空白路徑、參數未合併、ENOENT、非零 exit 與無效 JSON。

## 2. Windows 執行環境

- [x] 2.1 依「Windows start-dashboard runtime」、「Windows runtime contract」與「Windows dashboard startup」contract 新增 `scripts/windows/start-dashboard.ps1`：從 `$PSScriptRoot` 推導 repo root、拒絕 Node <18、解析 application 型別的 tokscale `.exe`／`.cmd`／`.bat` 並排除 `.ps1`、設定 process-scoped `TOKSCALE_BIN`、建立 ignored logs、以隱藏背景 Node process 啟動或辨識既有 listener。以 Windows PowerShell 5.1 parser 與啟動行為檢查驗證。
- [x] 2.2 依「Windows setup, Private Firewall and logon task」、「Idempotent Windows setup」與「Private LAN firewall boundary」contract 新增 `scripts/windows/setup.ps1`：支援 `SupportsShouldProcess`／`-WhatIf`、缺少時全域安裝 tokscale、執行三個無憑證輸出的 CLI 驗證、以 interactive token 更新單一登入排程、僅在已連線 profile 全為 Private 時更新單一 node.exe 限定的 TCP 8787 inbound rule，並提供授權待辦。以 parser、`-WhatIf`、排程與 Firewall 查詢驗證。
- [x] 2.3 依「Windows service and LAN verification」contract 讓 setup 立即啟動排程，驗證 Node listener、localhost `/api/status` 與非 loopback／非 APIPA Private IPv4 的 LAN `/api/status`，顯示 iPhone URL 並保留實機 UAT 待 Barry 確認；以 `Get-NetTCPConnection`、`Invoke-RestMethod` 與實際 LAN IP 請求驗證。

## 3. 文件、版本與相容邊界

- [x] 3.1 更新 `README.md` 的 Windows 章節與 `CHANGELOG.md`，記錄 setup、啟動、iPhone 連線、診斷、移除排程／Firewall 與 Windows LAN MVP；將 `package.json` MINOR 版本由 0.5.0 升為 0.6.0，且不新增 runtime dependency。以文件內容檢查與 `node -p "require('./package.json').version"` 驗證。
- [x] 3.2 依「Verification and compatibility boundary」與「Existing dashboard interfaces remain unchanged」contract 驗證 `/api/status`、前端、provider 邏輯、launchd 與 `zeabur-multi-device-aggregation` 無變更；以限制路徑 `git diff` 為空白及 API JSON 欄位檢查驗證。

## 4. 完整驗收

- [x] 4.1 依「Acceptance and scope contract」執行 `npm test`、兩支 PowerShell 5.1 parser、`setup.ps1 -WhatIf`、實際 setup 重跑、tokscale version、Task Scheduler、Private-only Firewall、TCP 8787、localhost／LAN API、`git diff --check`、secret pattern 與允許範圍檢查；實際輸出須證明自動化項目通過，iPhone Safari UAT 明確維持 pending。
- [x] 4.2 執行 `spectra analyze windows-lan-iphone-support --json`、`spectra validate windows-lan-iphone-support --strict` 與 `spectra status --change windows-lan-iphone-support --json`，確認 artifacts 一致、tasks 完成且 change 在 Barry iPhone UAT 前保持 active、不 archive。
