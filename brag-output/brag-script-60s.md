# AI Status Dashboard — 宣傳短片腳本（v2 · 60 秒）

> 這份是「目前實際 render 出來的 60 秒版本」腳本備份。之後要推廣時，從這份改（Barry 傾向再縮短）。
> 對應合成：`brag-output/composition/index.html`（GSAP timeline `main`，時間單位＝秒）。
> 調性：輕快萌系、像素小雞 🐥 主角；直式 1080×1920；配樂 `assets/music/track.mp3`（120 BPM）。

## 9 場景（含精確時間）

| # | 場景 | 起訖(s) | 內容 / 動畫 |
|---|---|---|---|
| 1 | 睡著小雞 Hook | 0.0–5.2 | 卡片彈入、🐥 呼吸、💤 飄兩輪、「AI Status」進、hold |
| 2 | 醒來 + 今日雙卡額度環 | 4.6–13.0 | 醒來彈跳、雙卡進、三環依序填充（Claude 66%/36%、Codex 本週 14%、5小時無資料）、「● 工作中」、**hold ~6s 讀卡** |
| 3 | Launcher 六磚 | 12.6–18.6 | 六磚逐顆彈入（每 0.42s）、hold、點「用量報表」 |
| 4 | 用量報表：面積圖 + 期間切換 | 18.2–27.6 | 本週面積圖描出(width 揭示~1.7s)、hold → pill「本週→本月」、本月面積圖 re-animate、hold |
| 5 | 工具佔比：依工具→依模型 | 27.0–34.4 | 甜甜圈長出、hold → pill「依工具→依模型」+ 換 legend、5 段甜甜圈 re-animate、hold |
| 6 | 使用熱力圖（重點）| 33.8–41.6 | 13×7 綠格**逐格波狀長出 ~2.9s**（強度分佈見 index.html JS）、**hold ~3s** |
| 7 | 額度警示 | 41.0–46.4 | 琥珀橫幅「🔔 額度接近上限」滑入 + 「Claude·本週 88%（≥85%）」列滑入、hold |
| 8 | 設定頁 | 45.8–51.2 | 語言/主題/更新頻率三列滑入；語言切 EN(48.2s)、主題切淺色(49.0s) |
| 9 | i18n + iPhone 收尾 | 50.8–60.0 | 繁中→English 翻動、鏡頭拉遠成 iPhone 副螢幕、🐥 呼吸、結尾卡「AI Status Dashboard · tokscale-powered · 跨平台」hold 到 60 |

## Beat sync（vol-1，120 BPM，beats 每 0.5s 從 3.0s 起）
- beat-locked：S2 醒來 ~4.5s；S6 熱力圖起點 ~34.0s；S9 結尾卡 ~56.0s。
- beat-grid：S3 六磚每 ~0.42s。

## 之後要縮短的建議（目標 ~35–40s）
1. **砍場景**：拿掉 S7 額度警示、S8 設定頁（各省 ~5s）→ 約 50s。
2. **砍期間/分組切換**：S4 只留「本週」不切本月、S5 只留「依工具」不切依模型（各省 ~3s）。
3. **縮 hold**：S2 讀卡 hold 6s→3s；S6 熱力圖 hold 3s→2s、build 2.9s→2s。
4. 綜合以上可壓到 ~30–35s，仍保留 Hook→額度環→Launcher→(面積圖/圓餅/熱力圖)→收尾主線。
> 縮短時：同步改 `index.html` root `data-duration`、各 scene `data-start/data-duration`、GSAP 時間，並更新 `audio#music` 的 `data-duration`。

## 素材與版權
- 寵物用**原創 emoji 小雞 🐥/🐤**，不重現第三方版權角色（app 內實際 sprite 為 gitignore 的第三方素材）。
- 音樂：happy-beats vol-1（ende.app），已 vendored 於 `composition/assets/music/track.mp3`。
