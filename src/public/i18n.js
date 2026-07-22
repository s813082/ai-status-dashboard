"use strict";
// 最簡 i18n：字串表 + data-i18n 靜態套用 + t(key) 動態查表。零依賴。
// 語言存 localStorage.lang，預設 tw。en 缺 key 時退回 tw，再退回 key 本身。
(function (global) {
  var I18N = {
    tw: {
      appTitle: "AI Status",
      "nav.back": "← 選單",
      "launcher.title": "AI 用量中心",
      "launcher.today": "今日用量",
      "launcher.weekly": "本週用量",
      "launcher.monthly": "本月用量",
      "launcher.custom": "自訂區間",
      "launcher.pie": "工具佔比",
      "launcher.heatmap": "使用熱力圖",
      "launcher.alerts": "額度警示",
      "launcher.settings": "設定",
      "launcher.today.desc": "即時額度環與寵物狀態",
      "launcher.weekly.desc": "近 7 天用量折線",
      "launcher.monthly.desc": "本月各項用量",
      "launcher.custom.desc": "自選起訖日期查詢",
      "launcher.pie.desc": "各工具花費佔比",
      "launcher.heatmap.desc": "連續使用貢獻圖",
      "launcher.alerts.desc": "接近額度上限提醒",
      "launcher.settings.desc": "頻率 / 語言 / 主題 / 寵物",
      "launcher.usage": "用量報表",
      "launcher.usage.desc": "週 / 月 / 自訂，可分工具",
      "usage.title": "用量報表",
      "usage.period": "期間",
      "usage.week": "本週",
      "usage.month": "本月",
      "usage.custom": "自訂",
      "pie.by": "分組",
      "pie.byTool": "依工具",
      "pie.byModel": "依模型",
      "ring.session": "5 小時",
      "ring.weekly": "本週",
      "ring.na": "無資料",
      "status.idle": "閒置",
      "status.working": "工作中",
      "status.exhausted": "額度用完（睡著）",
      "cost.today": "今日",
      "cost.last30": "近 30 天",
      "cost.note": "花費為本機推算（掃本機 session log）",
      "banner.stale": "資料稍舊 · tokscale 暫時無回應，顯示上次快取",
      "banner.format": "資料格式不符",
      "banner.notokscale": "找不到 tokscale · 請確認已安裝並在 PATH",
      "report.empty": "查無資料",
      "report.loading": "載入中…",
      "report.total": "合計",
      "chart.cost": "花費 (USD)",
      "custom.since": "起始日",
      "custom.until": "結束日",
      "custom.query": "查詢",
      "custom.invalid": "日期格式須為 YYYY-MM-DD 且起始不晚於結束",
      "settings.title": "設定",
      "settings.lang": "語言",
      "settings.theme": "主題",
      "settings.theme.auto": "跟隨系統",
      "settings.theme.light": "淺色",
      "settings.theme.dark": "深色",
      "settings.freq": "更新頻率（秒）",
      "settings.providers": "顯示的工具",
      "settings.wake": "🔆 螢幕恆亮（避免 iPhone 待機）",
      "settings.budgets": "花費預算與警示閾值",
      "settings.budget.usd": "月預算 (USD)",
      "settings.budget.threshold": "警示閾值 (%)",
      "settings.pets.claude": "Claude Code 寵物",
      "settings.pets.codex": "Codex 寵物",
      "settings.saved": "已儲存 ✓",
      "alerts.none": "目前沒有接近上限的額度",
      "alerts.near": "額度接近上限",
      "alerts.title": "額度警示",
      "footer": "AI Status Dashboard · 資料來源 tokscale · 運作狀態每 5 秒、額度/花費每 60 秒更新",
    },
    en: {
      appTitle: "AI Status",
      "nav.back": "← Menu",
      "launcher.title": "AI Usage Hub",
      "launcher.today": "Today",
      "launcher.weekly": "This Week",
      "launcher.monthly": "This Month",
      "launcher.custom": "Custom Range",
      "launcher.pie": "Tool Share",
      "launcher.heatmap": "Heatmap",
      "launcher.alerts": "Alerts",
      "launcher.settings": "Settings",
      "launcher.today.desc": "Live quota rings & pets",
      "launcher.weekly.desc": "Last 7 days usage line",
      "launcher.monthly.desc": "This month's usage",
      "launcher.custom.desc": "Query a custom date range",
      "launcher.pie.desc": "Cost share by tool",
      "launcher.heatmap.desc": "Contribution graph",
      "launcher.alerts.desc": "Near-limit reminders",
      "launcher.settings.desc": "Interval / language / theme / pets",
      "launcher.usage": "Usage Reports",
      "launcher.usage.desc": "Week / month / custom, by tool",
      "usage.title": "Usage Reports",
      "usage.period": "Period",
      "usage.week": "This Week",
      "usage.month": "This Month",
      "usage.custom": "Custom",
      "pie.by": "Group by",
      "pie.byTool": "By tool",
      "pie.byModel": "By model",
      "ring.session": "5-hour",
      "ring.weekly": "Weekly",
      "ring.na": "No data",
      "status.idle": "Idle",
      "status.working": "Working",
      "status.exhausted": "Quota used up (sleeping)",
      "cost.today": "Today",
      "cost.last30": "Last 30 days",
      "cost.note": "Cost is estimated locally (from session logs)",
      "banner.stale": "Data is stale · tokscale not responding, showing last cache",
      "banner.format": "Unrecognized data format",
      "banner.notokscale": "tokscale not found · ensure it is installed and on PATH",
      "report.empty": "No data",
      "report.loading": "Loading…",
      "report.total": "Total",
      "chart.cost": "Cost (USD)",
      "custom.since": "From",
      "custom.until": "To",
      "custom.query": "Query",
      "custom.invalid": "Dates must be YYYY-MM-DD and from <= to",
      "settings.title": "Settings",
      "settings.lang": "Language",
      "settings.theme": "Theme",
      "settings.theme.auto": "System",
      "settings.theme.light": "Light",
      "settings.theme.dark": "Dark",
      "settings.freq": "Refresh interval (s)",
      "settings.providers": "Visible tools",
      "settings.wake": "🔆 Keep screen awake (prevents iPhone sleep)",
      "settings.budgets": "Budget & alert threshold",
      "settings.budget.usd": "Monthly budget (USD)",
      "settings.budget.threshold": "Alert threshold (%)",
      "settings.pets.claude": "Claude Code pet",
      "settings.pets.codex": "Codex pet",
      "settings.saved": "Saved ✓",
      "alerts.none": "No quota near its limit right now",
      "alerts.near": "Quota near limit",
      "alerts.title": "Quota alerts",
      "footer": "AI Status Dashboard · Source: tokscale · Status every 5s, quota/cost every 60s",
    },
  };

  var lang = "tw";
  try {
    var stored = localStorage.getItem("lang");
    if (stored === "tw" || stored === "en") lang = stored;
  } catch (e) {}

  function t(key) {
    var table = I18N[lang] || I18N.tw;
    if (table[key] != null) return table[key];
    if (I18N.tw[key] != null) return I18N.tw[key];
    return key;
  }

  function getLang() { return lang; }

  function setLang(next) {
    if (next !== "tw" && next !== "en") return;
    lang = next;
    try { localStorage.setItem("lang", next); } catch (e) {}
    applyI18n();
  }

  // 套用所有 [data-i18n] 元素的文字（textContent）
  function applyI18n() {
    document.documentElement.setAttribute("lang", lang === "tw" ? "zh-Hant" : "en");
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }
  }

  global.I18N = { t: t, getLang: getLang, setLang: setLang, applyI18n: applyI18n };
})(window);
