'use strict';

// AI Status Dashboard server — 純 node:http，port 8787（決議 D4）。
// 路由：GET / → dashboard 頁面；GET /pets/* → 靜態素材；GET /api/status → 記憶體快照 + 即時 activity。
// 韌性：/api/status 永不 500、不崩潰。collector 失敗回上次快取並標 stale；冷啟動無快取回 loading。

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const snapshot = require('./collectors/tokscaleSnapshot.js');
const activity = require('./collectors/activity.js');
const reports = require('./collectors/tokscaleReports.js');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0'; // 綁 0.0.0.0 讓區網 iPhone 連得到
const PUBLIC_DIR = path.join(__dirname, 'public');
const REFRESH_MS = 60_000;
const LIBRARY_DIR = path.join(PUBLIC_DIR, 'pets', 'library');
const PET_CONFIG_FILE = path.join(__dirname, '..', 'data', 'pet-config.json');
const DEFAULT_PET_CONFIG = { claude: 'clawd', codex: 'boba' };
const VENDOR_DIR = path.join(PUBLIC_DIR, 'vendor');
const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');
const DEFAULT_SETTINGS = {
  pollIntervalMs: 5000,
  lang: 'tw',
  theme: 'auto',
  keepAwake: true,
  providerVisibility: { claude: true, codex: true },
  budgets: [
    { provider: 'claude', budgetUSD: null, thresholdPercent: 85 },
    { provider: 'codex', budgetUSD: null, thresholdPercent: 85 },
  ],
};
const MAX_CUSTOM_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = CONTENT_TYPES[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
  stream.on('open', () => {
    res.writeHead(200, { 'Content-Type': type });
  });
  stream.pipe(res);
}

// 掃素材庫 src/public/pets/library/*/pet.json → [{id,displayName,description}]
function listPets() {
  const pets = [];
  let entries;
  try {
    entries = fs.readdirSync(LIBRARY_DIR, { withFileTypes: true });
  } catch {
    return pets;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, ent.name, 'pet.json'), 'utf8'));
      // id 一律用「資料夾名」當鍵：sprite 由 /pets/library/<id>/ 提供服務，
      // 若改用 pet.json 的 id（可能與資料夾名不同，如 frieren-3 vs frieren）會導致取圖 404 破圖。
      pets.push({
        id: ent.name,
        displayName: meta.displayName || ent.name,
        description: meta.description || '',
      });
    } catch {
      // 無 pet.json 或格式錯：略過該資料夾
    }
  }
  return pets;
}

// 讀選擇，缺檔/損毀回預設；只信任存在於素材庫的 id，其餘退回預設
function readPetConfig() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(PET_CONFIG_FILE, 'utf8'));
  } catch {
    cfg = {};
  }
  const ids = listPets().map((p) => p.id);
  return {
    claude: ids.includes(cfg.claude) ? cfg.claude : DEFAULT_PET_CONFIG.claude,
    codex: ids.includes(cfg.codex) ? cfg.codex : DEFAULT_PET_CONFIG.codex,
  };
}

function writePetConfig(cfg) {
  fs.mkdirSync(path.dirname(PET_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(PET_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// 讀設定：缺檔/損毀回預設；淺層合併 DEFAULT_SETTINGS 以補齊新欄位（韌性比照 pet-config）
function readSettings() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    cfg = {};
  }
  return {
    ...DEFAULT_SETTINGS,
    ...cfg,
    providerVisibility: { ...DEFAULT_SETTINGS.providerVisibility, ...(cfg.providerVisibility || {}) },
    budgets: Array.isArray(cfg.budgets) ? cfg.budgets : DEFAULT_SETTINGS.budgets,
  };
}

// 寫設定：合併部分更新後落地。寫入失敗拋錯（呼叫端沿用舊值並回錯誤）
function writeSettings(partial) {
  const merged = { ...readSettings(), ...partial };
  if (partial && partial.providerVisibility) {
    merged.providerVisibility = { ...readSettings().providerVisibility, ...partial.providerVisibility };
  }
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}

// 驗證自訂區間：YYYY-MM-DD 且 since<=until 且不超過上限；回 {ok, error?}
function validateRange(since, until) {
  if (!DATE_RE.test(since || '') || !DATE_RE.test(until || '')) {
    return { ok: false, error: 'since/until must be YYYY-MM-DD' };
  }
  const s = Date.parse(`${since}T00:00:00Z`);
  const u = Date.parse(`${until}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(u)) return { ok: false, error: 'invalid date' };
  if (s > u) return { ok: false, error: 'since must be <= until' };
  if ((u - s) / 86_400_000 > MAX_CUSTOM_RANGE_DAYS) {
    return { ok: false, error: `range exceeds ${MAX_CUSTOM_RANGE_DAYS} days` };
  }
  return { ok: true };
}

// 報表端點共用：跑 producer，成功包 {ok:true,data}，失敗包 {ok:false,error,data:null}，永不 throw
async function reportEnvelope(producer) {
  try {
    const data = await producer();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err), data: null };
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// 合併快照與即時 activity，組出 /api/status 回應。永不 throw。
async function buildStatus() {
  const snap = snapshot.getSnapshot();

  // 冷啟動：完全無快取（首次啟動且 serve 尚未就緒）
  if (!snap) {
    return {
      loading: true,
      stale: true,
      reachable: false,
      formatError: false,
      updatedAt: null,
      providers: {},
      petConfig: readPetConfig(),
    };
  }

  let activities = { claude: 'idle', codex: 'idle' };
  try {
    activities = await activity.computeActivities(snap.providers);
  } catch {
    // 活動偵測失敗不致命，退回 idle
  }

  const providers = {};
  for (const id of ['claude', 'codex']) {
    const p = snap.providers[id];
    providers[id] = p
      ? { ...p, activity: activities[id] }
      : { id, enabled: null, windows: [], cost: { todayUSD: null, last30DaysUSD: null }, error: null, activity: 'idle', missing: true };
  }

  return {
    loading: false,
    stale: !!snap.stale,
    reachable: !!snap.reachable,
    formatError: !!snap.formatError,
    schemaVersion: snap.schemaVersion,
    codexBarVersion: snap.codexBarVersion,
    generatedAt: snap.generatedAt,
    updatedAt: snap.fetchedAt,
    lastError: snap.lastError || null,
    providers,
    petConfig: readPetConfig(),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (pathname === '/' || pathname === '/index.html') {
      return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
    }

    if (pathname === '/api/status') {
      // 即使內部出錯也回 200 + 標記，不 500、不崩潰
      let status;
      try {
        status = await buildStatus();
      } catch (err) {
        status = { loading: false, stale: true, reachable: false, formatError: false, updatedAt: null, providers: {}, lastError: String(err && err.message ? err.message : err) };
      }
      return sendJson(res, 200, status);
    }

    if (pathname === '/api/pets') {
      return sendJson(res, 200, listPets());
    }

    if (pathname === '/api/config') {
      return sendJson(res, 200, readPetConfig());
    }

    if (pathname === '/api/select') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Method not allowed');
      }
      let body;
      try {
        body = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { ok: false, error: 'invalid json' });
      }
      const column = body.column;
      const petId = body.petId;
      const ids = listPets().map((p) => p.id);
      if ((column !== 'claude' && column !== 'codex') || !ids.includes(petId)) {
        return sendJson(res, 400, { ok: false, error: 'invalid column or petId' });
      }
      const cfg = readPetConfig();
      cfg[column] = petId;
      writePetConfig(cfg);
      return sendJson(res, 200, { ok: true, petConfig: cfg });
    }

    // 報表端點（全 GET、永不 500、no-store）
    if (pathname === '/api/usage/daily') {
      const range = url.searchParams.get('range') === 'month' ? 'month' : 'week';
      return sendJson(res, 200, await reportEnvelope(() => reports.daily(range)));
    }
    if (pathname === '/api/usage/monthly') {
      return sendJson(res, 200, await reportEnvelope(() => reports.monthly()));
    }
    if (pathname === '/api/usage/models') {
      return sendJson(res, 200, await reportEnvelope(() => reports.models()));
    }
    if (pathname === '/api/usage/graph') {
      const range = url.searchParams.get('range') === 'month' ? 'month' : 'year';
      return sendJson(res, 200, await reportEnvelope(() => reports.graph(range)));
    }
    if (pathname === '/api/usage/custom') {
      const since = url.searchParams.get('since');
      const until = url.searchParams.get('until');
      const v = validateRange(since, until);
      if (!v.ok) return sendJson(res, 400, { ok: false, error: v.error, data: null });
      return sendJson(res, 200, await reportEnvelope(() => reports.custom(since, until)));
    }

    // 設定端點
    if (pathname === '/api/settings') {
      if (req.method === 'GET') {
        return sendJson(res, 200, readSettings());
      }
      if (req.method === 'POST') {
        let body;
        try {
          body = JSON.parse((await readBody(req)) || '{}');
        } catch {
          return sendJson(res, 400, { ok: false, error: 'invalid json' });
        }
        try {
          return sendJson(res, 200, { ok: true, settings: writeSettings(body) });
        } catch (err) {
          // 寫入失敗：沿用舊值並回錯誤
          return sendJson(res, 200, { ok: false, error: String(err && err.message ? err.message : err), settings: readSettings() });
        }
      }
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Method not allowed');
    }

    // 本地 vendored 資源（比照 /pets/ 路徑穿越防護）
    if (pathname.startsWith('/vendor/')) {
      const rel = decodeURIComponent(pathname.slice('/vendor/'.length));
      const target = path.join(VENDOR_DIR, rel);
      if (!target.startsWith(VENDOR_DIR + path.sep) && target !== VENDOR_DIR) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Forbidden');
      }
      return sendFile(res, target);
    }

    if (pathname.startsWith('/pets/')) {
      // 防路徑穿越：解析後必須仍在 pets 目錄內
      const rel = decodeURIComponent(pathname.slice('/pets/'.length));
      const target = path.join(PUBLIC_DIR, 'pets', rel);
      const petsDir = path.join(PUBLIC_DIR, 'pets');
      if (!target.startsWith(petsDir + path.sep) && target !== petsDir) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Forbidden');
      }
      return sendFile(res, target);
    }

    // 其他靜態檔（apple-touch-icon 等）
    if (pathname === '/apple-touch-icon.png' || pathname === '/favicon.ico' || pathname === '/keepawake.mp4' || pathname === '/i18n.js') {
      return sendFile(res, path.join(PUBLIC_DIR, pathname.slice(1)));
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    // 保底：任何未預期錯誤都不讓 process 崩潰
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal error');
  }
});

function start() {
  snapshot.init(); // 用落地快取墊底
  snapshot.startPolling(REFRESH_MS); // 60s 抓額度/花費
  server.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`[ai-status-dashboard] listening on http://${HOST}:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { server, start, buildStatus, PORT };
