## Why

目前 tokscale 透過 npm 安裝於 Windows 時通常解析為 `.cmd` shim，但 Node.js `execFile()` 無法直接啟動該 shim，且專案缺少可重複執行的 Windows 常駐與區網開放流程。此變更讓 Windows 電腦可安全執行 Node＋tokscale，並讓同一 Private LAN 的 iPhone Safari 透過 TCP 8787 查看該電腦現有的 Claude／Codex 狀態。

## What Changes

- 修改 tokscale 低階封裝：Windows 的 `.cmd`／`.bat` 經由 `ComSpec` 執行，`.exe` 與非 Windows executable 維持直接 `execFile()`。
- 新增 Windows 啟動與安裝腳本，包含 Node／tokscale 檢查、登入前置驗證、使用者登入排程、Private-only Firewall rule、LAN URL 與立即健康檢查。
- 新增 command adapter 單元測試，覆蓋跨平台 invocation、空白路徑、參數邊界與既有錯誤語意。
- 更新 Windows 操作文件、變更紀錄與 MINOR 版本號。
- 維持 `/api/status` 契約、前端畫面、macOS launchd 與既有 Zeabur change 不變。

## Capabilities

### New Capabilities

- `windows-lan-runtime`: Windows 安裝、背景啟動、Private Firewall、登入排程、LAN URL 與服務驗證流程。

### Modified Capabilities

- `usage-collector`: tokscale command invocation 新增 Windows `.cmd`／`.bat` 安全執行，同時維持 `.exe`、macOS 與 Linux 行為。

## Impact

- Affected specs: `usage-collector`, `windows-lan-runtime`
- Affected code:
  - New: `openspec/changes/windows-lan-iphone-support/specs/windows-lan-runtime/spec.md`, `openspec/changes/windows-lan-iphone-support/specs/usage-collector/spec.md`, `test/tokscale-command.test.js`, `scripts/windows/start-dashboard.ps1`, `scripts/windows/setup.ps1`
  - Modified: `src/collectors/tokscale.js`, `README.md`, `CHANGELOG.md`, `package.json`
  - Removed: none
- Runtime dependencies: no new npm runtime dependency; tokscale remains a globally installed external CLI.
- System impact: creates or updates the current-user logon task `AI Status Dashboard` and a Private-profile inbound TCP 8787 Firewall rule restricted to the resolved `node.exe`.
