'use strict';

// 報表資料層（決議「報表 API 經 tokscaleReports.js 短 TTL 快取與 in-flight 串行化」）。
// 每個報表方法帶記憶體 TTL 快取，並串行化同 key 的 in-flight 請求，
// 避免報表頁重複/快速請求時每次都 spawn 一個 tokscale 子行程。

const tokscale = require('./tokscale.js');

const TTL_MS = 90_000; // 90s：報表為歷史資料，短快取即可
const cache = new Map(); // key -> { at, value }
const inflight = new Map(); // key -> Promise

// 帶 TTL 快取 + in-flight 合流的取值。fn 失敗不寫快取（讓下次重試）。
function cached(key, fn) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return Promise.resolve(hit.value);
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const value = await fn();
      cache.set(key, { at: Date.now(), value });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// graph contributions → 精簡陣列（date + cost + tokens + intensity + 逐工具花費 byClient）
function mapContributions(graphObj) {
  const list = (graphObj && Array.isArray(graphObj.contributions)) ? graphObj.contributions : [];
  return list.map((c) => {
    const byClient = {};
    const cls = (c && Array.isArray(c.clients)) ? c.clients : [];
    cls.forEach((cl) => {
      if (!cl || cl.client == null) return;
      byClient[cl.client] = (byClient[cl.client] || 0) + (cl.cost != null ? cl.cost : 0);
    });
    return {
      date: c && c.date != null ? c.date : null,
      cost: c && c.totals && c.totals.cost != null ? c.totals.cost : 0,
      tokens: c && c.totals && c.totals.tokens != null ? c.totals.tokens : 0,
      intensity: c && c.intensity != null ? c.intensity : 0,
      byClient: byClient,
    };
  });
}

// 日趨勢折線：range = 'week' | 'month'
function daily(range) {
  const flag = range === 'month' ? '--month' : '--week';
  return cached(`daily:${range}`, async () => {
    const g = await tokscale.graphJson([flag]);
    return { range, points: mapContributions(g), totalCost: g && g.summary ? g.summary.totalCost : null };
  });
}

// 月報：tokscale monthly --json
function monthly() {
  return cached('monthly', async () => {
    const m = await tokscale.runJson(['monthly', '--json']);
    return { entries: (m && m.entries) || [], totalCost: m && m.totalCost != null ? m.totalCost : null };
  });
}

// 各工具/模型佔比：tokscale models --json（供圓餅）
function models() {
  return cached('models', async () => {
    const m = await tokscale.runJson(['models', '--json']);
    return { entries: (m && m.entries) || [], totalCost: m && m.totalCost != null ? m.totalCost : null };
  });
}

// 熱力圖資料：range = 'year' | 'month'
// 注意：tokscale 的 --year 需帶年份值（--year YYYY），--month 為裸旗標
function graph(range) {
  if (range === 'month') {
    return cached('graph:month', async () => {
      const g = await tokscale.graphJson(['--month']);
      return { range, points: mapContributions(g) };
    });
  }
  const year = new Date().getFullYear();
  return cached(`graph:year:${year}`, async () => {
    const g = await tokscale.graphJson(['--year', String(year)]);
    return { range, points: mapContributions(g) };
  });
}

// 自訂區間：since/until 為 YYYY-MM-DD（呼叫端須先驗證）
function custom(since, until) {
  return cached(`custom:${since}:${until}`, async () => {
    const g = await tokscale.graphJson(['--since', since, '--until', until]);
    return { since, until, points: mapContributions(g), totalCost: g && g.summary ? g.summary.totalCost : null };
  });
}

module.exports = { daily, monthly, models, graph, custom, TTL_MS };
