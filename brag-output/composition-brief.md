# Hyperframes Composition Brief: AI Status Dashboard

## Objective
約 22 秒、輕快萌系、像素吉祥物主打的 launch 短片。

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 22s

## Source Material
- Project root: /Users/barry.tsai/Documents/vibe-coding/ai-status-dashboard
- Primary files read: src/public/index.html（多視圖 UI）、README.md
- Product name: AI Status Dashboard
- Tagline / strongest claim: 把 AI 用量做成一頁、桌邊 iPhone 當常駐副螢幕；萌寵呈現運作狀態
- Key UI to recreate: 額度環雙卡、Launcher 六磚、堆疊面積圖、甜甜圈佔比、綠格熱力圖、iPhone 情境
- Copy verbatim：「AI 用量中心」「今日用量/用量報表/工具佔比/使用熱力圖/額度警示/設定」「工作中」「AI Status Dashboard」「tokscale-powered · 跨平台」

## Creative Direction
- Tone preset: default
- Creative direction: 輕快萌系、像素吉祥物主打
- Interpretation: 節奏輕快每亮點有呼吸；反差萌（監控工具吉祥物在睡覺）帶專業資料視覺化。
- Angle: 用會工作/偷懶/睡著的吉祥物當主角說「監控 AI 用量」。
- Hook: 吉祥物睡到打呼（💤）+「AI Status」。
- Outro: iPhone 立桌邊當副螢幕 + 結尾卡「AI Status Dashboard · tokscale-powered · 跨平台」。
- Avoid: 通用 SaaS 語彙、抽象填充、重現第三方版權角色（用原創 emoji 吉祥物）。

## Visual Identity
- Background: #16181d（卡片 #1f2229）
- Text: #e6e8eb / #9aa1ac
- Accent: Claude #d97757 / Codex #10a37f / 熱力圖綠 #39d353
- Display/Body font: 系統 sans（SF Pro / PingFang TC）
- Visual references: 額度環、堆疊面積圖、甜甜圈、GitHub 綠格熱力圖、iPhone 框

## Storyboard
以 `brag-output/brag-plan.md` 為創意契約。
1. 睡著吉祥物 Hook — 3.7s — 💤 + 「AI Status」
2. 醒來 + 額度環 — 4.7s — Claude 66%/36%、Codex 本週14%(5小時無資料)、「工作中」
3. Launcher 六磚 — 3.8s — 逐顆彈入、點「用量報表」
4. 報表蒙太奇 — 5.7s — 面積圖 draw → 甜甜圈 → 熱力圖
5. i18n + iPhone 收尾 — 5.0s — 繁中↔English → iPhone 副螢幕 + 結尾卡

## Audio
- Audio role: 輕快明亮音樂 bed（happy-beats vol-1，120 BPM）
- Audio arc: 柔和開場 → 醒來能量上抬 → 報表資訊感 → 溫暖俏皮收尾淡出
- Music: assets/music/track.mp3（data-timeline-role="music"）
- Music treatment: 全程 0.82 音量；drop 段（16s+）對齊報表/收尾強拍
- Music cue guidance: bundled preset（vol-1，tempo 120）；strongCues 16–23s；beats 從 3.0s 每 0.5s
  - beat-locked: 熱力圖 15.7s 近 16.02 強拍；結尾卡 20.0s 近 20.02 強拍
  - beat-grid: Launcher 六磚 8.2s 起每 0.24s（近 0.5s 拍點的偶數拍節奏）
- Audio-reactive treatment: none（本次以固定 timeline 為主，未接 RMS）— 已記錄
- SFX posture: 本次未加獨立 SFX（時間/穩定性考量），以音樂 bed 為主 — 已記錄
- Restraint rule: 音樂不蓋畫面節奏

## Hyperframes Instructions
- 單一 index.html、composition id "main"、GSAP paused timeline 註冊於 window.__timelines。
- 顯示真實 UI 元素（額度環/報表/熱力圖/Launcher）。
- 文字皆可讀、總長 22s。
- 已含音樂層；未接 audio-reactive 與獨立 SFX（已於上方記錄原因）。
- render 前跑 `npm run check`。
