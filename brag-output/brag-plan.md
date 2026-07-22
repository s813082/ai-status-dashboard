# Brag Plan: AI Status Dashboard

## What is this app?
本地常駐的迷你 web dashboard，把 Claude Code / Codex 的 AI 用量（額度、花費、歷史報表）做成一頁，用像素寵物萌化呈現運作狀態，讓桌邊閒置的 iPhone 當「常駐副螢幕」看。

## The angle
把「監控 AI 用量」這件很工程的事，用一隻**會工作、會偷懶、會睡著的像素小夥伴**當主角來說故事。萌寵是鉤子，資料視覺化是實力——輕快、可愛、但底子專業。

## Hook (first 2-3 seconds)
黑底卡片上一隻像素小夥伴睡到打呼（😴 Zzz 浮動），旁邊小字「AI Status」。反差萌：一個監控工具的主角居然在睡覺。

## Key moments (the middle)
- 小夥伴瞬間醒來開始奔跑（idle→working），兩個額度環數字 count-up 填充（Claude / Codex）。
- Launcher 六磚一顆顆彈入，點進「用量報表」。
- 資料視覺化蒙太奇：堆疊面積圖分工具畫出 → 甜甜圈工具佔比 → GitHub 綠格熱力圖。
- 中↔英一鍵切換的小 flourish（展現 i18n 細節）。

## Outro / punchline
拉遠：iPhone 立在桌邊當常駐副螢幕，小夥伴回到 idle 輕輕呼吸；結尾卡「AI Status Dashboard · tokscale-powered · 跨平台」。

## User flow worth showing
entry → key action → result：
1. 開 app 看到今日卡片（寵物 + 額度環）
2. 進 Launcher → 用量報表切換期間
3. 看報表視圖（面積圖／圓餅／熱力圖）呈現結果

## Tone
- Preset: default
- Creative direction: 輕快萌系、像素寵物主打的 launch 短片
- Interpretation: 節奏輕快但每個亮點有呼吸；用可愛角色帶專業資料，humor 來自「監控工具的吉祥物在睡覺」的反差，不硬搞笑。

## Format: vertical — 1080x1920
## Duration: 60s（v2：延長版，每段動畫完整播完再 hold；9 場景。詳見計畫檔 60 秒分鏡）

## Visual identity (from the project)
- Background: #16181d（深色；卡片 #1f2229）
- Accent: Claude #d97757 / Codex #10a37f；熱力圖綠 #40c463 / #216e39
- Text: #e6e8eb（次要 #9aa1ac）
- Display font: 乾淨圓潤無襯線（近 SF Pro / PingFang TC 系統字感）
- Body font: 同上、系統 sans
- Strongest visual element: 像素寵物（idle 呼吸 / working 奔跑 / exhausted 睡著）+ 圓形額度環 + 堆疊面積圖

> 版權注意：實際寵物 sprite 為第三方版權角色（未進版控），**短片請用通用、原創風格的可愛像素小夥伴**重繪，不得重現特定動漫角色。

## Share copy (draft)
把「盯 AI 用量」變成養一隻會工作會睡覺的像素小夥伴 🐾 額度、花費、週月報表一頁看完，桌邊 iPhone 當常駐副螢幕。#AIStatus

## Audio direction
- Role: 輕快明亮的音樂 bed + 節制的 UI 音效
- Music: 上揚、可愛輕快的 chiptune/合成流行感；bundled 曲若有 upbeat preset 優先
- Music treatment: 開場 0s 淡入輕柔、寵物醒來處能量上抬、結尾 2s 淡出
- Music cue guidance: 用 bundled upbeat 曲的 cue preset（若無則 composition 時偵測）；強拍對齊「寵物醒來」與「面積圖畫出」兩個主要時刻；Launcher 六磚用 beat-grid 逐顆彈入
- Audio-reactive treatment: subtle；額度環填充與寵物發光可隨節拍微呼吸，不加波形條
- SFX posture: moderate、motion-matched；睡覺輕鼾、醒來 pop、磚塊逐顆 tick、count-up 細碎點、切視圖 whoosh
- Audio-coupled moments: Zzz 泡泡、寵物醒來 pop、六磚逐顆、額度環 count-up、視圖快切
- Restraint rule: 音效不蓋過音樂、不要卡通過頭；保持輕快而非吵鬧

## Storyboard

### Scene 1 — 睡著的小夥伴（Hook）— 3.5s
黑底圓角卡片置中，一隻原創可愛像素小夥伴閉眼睡著，頭上 😴 Zzz 泡泡緩緩上飄；下方小字「AI Status」。字停留可讀。
Sequential/interaction: none
Audio intent: 輕柔、慵懶，帶一點俏皮的期待感
Audio-coupled idea: Zzz 泡泡輕微「呼～」氣音
Music: 輕柔前奏
Transition mood: soft → Scene 2

### Scene 2 — 醒來開工＋額度環 — 4.5s
小夥伴睜眼、彈起開始奔跑（working）；兩張卡片（Claude #d97757 / Codex #10a37f）各自的圓形額度環數字 count-up 填充（Claude 66% / 36%、Codex 14%），狀態字「工作中 ●」。
Sequential/interaction: yes — 額度環數字 count-up、寵物 idle→run 切換
Audio intent: 能量上抬、精神一振
Audio-coupled idea: 醒來 pop + count-up 細點音，對齊音樂強拍
Music: 主旋律進來
Transition mood: clean → Scene 3

### Scene 3 — Launcher 六磚 — 3.5s
畫面切到 Launcher 首頁，六張功能磚（今日/用量報表/工具佔比/熱力圖/額度警示/設定）**一顆顆彈入**，最後游標點「用量報表」。
Sequential/interaction: yes — 六磚 beat-grid 逐顆彈入 + 模擬點擊「用量報表」
Audio intent: 輕快、有節奏的堆疊感
Audio-coupled idea: 每顆磚一個 tick、點擊一個 soft click
Music: 節奏持續
Transition mood: clean wipe → Scene 4

### Scene 4 — 資料視覺化蒙太奇 — 5.5s
「用量報表」堆疊面積圖畫出（claude/codex 兩色堆疊，逐日）→ 快切 工具佔比甜甜圈（多色扇形）→ 快切 GitHub 綠格熱力圖（格子由淺到深亮起）。每個畫面短暫 hold 可辨識。
Sequential/interaction: yes — 面積圖描線繪出、甜甜圈扇形依序長出、熱力圖格子波狀亮起
Audio intent: 專業、資訊感、爽快
Audio-coupled idea: 面積圖描線 swoosh、切視圖 whoosh、熱力圖格子細碎點
Music: 主歌高點
Transition mood: soft crossfade → Scene 5

### Scene 5 — i18n 切換 + iPhone 情境收尾 — 5s
先一個小 flourish：介面文字繁中↔English 即時翻動（「今日用量 / Today」等）。接著鏡頭拉遠，變成一支 iPhone 立在桌邊，螢幕就是這個 dashboard，小夥伴回到 idle 輕輕呼吸；疊上結尾卡：「AI Status Dashboard」+ 小字「tokscale-powered · 跨平台」。
Sequential/interaction: yes — 文字語言翻動、鏡頭拉遠成 iPhone 情境
Audio intent: 收束、溫暖、俏皮結尾
Audio-coupled idea: 文字翻動輕點音；結尾一個乾淨 logo hit + 音樂淡出
Music: 收尾樂句 + 2s 淡出
Transition mood: soft → 結束

**Music mood for this video:** upbeat（輕快萌系）
**Audio summary:** 輕柔慵懶開場 → 寵物醒來能量上抬的明亮主旋律 → 報表蒙太奇的資訊感高點 → 溫暖俏皮收尾淡出，UI 音效全程 motion-matched 但不吵。
