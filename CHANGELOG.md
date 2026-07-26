# Changelog

本專案的所有重要變更都記錄於此檔。格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號採語意化版本。

## [0.6.0]

### Added

- Windows LAN MVP：新增 PowerShell 5.1 相容的 setup／startup 腳本，可安裝與驗證 tokscale、建立目前使用者登入排程、限制至 `node.exe` 的 Private-only TCP 8787 Firewall rule，並立即驗證 localhost／LAN API 與顯示 iPhone URL。
- 新增 tokscale Windows command adapter 測試，涵蓋 `.cmd`／`.bat`、`.exe`、macOS／Linux、空白路徑、參數邊界與既有錯誤語意。

### Changed

- tokscale 低階封裝在 Windows 遇到 npm `.cmd`／`.bat` shim 時改由 ComSpec 安全啟動；直接 executable 與 macOS／Linux 行為維持不變，所有子程序隱藏互動視窗。
- README Windows 章節改為已驗證的安裝、啟動、iPhone 連線、除錯與移除流程。

## [0.2.0]

### Added

- 網頁換寵物：專案自帶素材庫 `src/public/pets/library/`，右上角齒輪面板可切換 Claude/Codex 兩欄寵物，選擇存 `data/pet-config.json` 並於重整後保留；新增 `GET /api/pets`、`GET /api/config`、`POST /api/select`（允許清單驗證）端點，`/api/status` 併回 `petConfig`。
- 一鍵補貨 script：`npm run add-pet <slug>`（petdex install + 複製進素材庫）。
- iPhone 螢幕恆亮：Screen Wake Lock + 齒輪面板「🔆 恆亮」開關（預設開），含即時「恆亮狀態」診斷；無原生 API 時以隱藏靜音循環影片（`keepawake.mp4`，點一下啟動）備援，仍不行則建議系統「自動鎖定→永不」。
- 標題列即時時鐘（`yyyy/mm/dd HH:MM:SS`，每秒更新）。
- 頁尾極小 live 動畫（三點跳動，裝飾用）。
- README 新增「自訂寵物」「螢幕恆亮」「Windows 可行性」章節，含分裝置的恆亮實務建議。

### Fixed

- 額度環每 5 秒閃爍：前端輪詢時額度/花費資料未變即跳過 SVG 重建，寵物僅在 activity/選定寵物改變時才更新 DOM。
- 閒置寵物閃爍：部分 sprite 的 idle 列不足 8 幀、尾格空白，`steps(8)` 掃到空白會閃；閒置改為靜態幀 + 極細微（約 1px）呼吸縮放，不再掃幀。

## [0.1.0]

### Added

- 初始版本：CodexBar snapshot collector（60s）、mtime 活動偵測、`node:http` server（port 8787）、單頁 dashboard（petdex 寵物動畫、額度環、花費、活動狀態）、兩支 launchd 常駐服務、iPhone Safari 連線支援。
