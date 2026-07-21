'use strict';

// AI Status Dashboard server — 純 node:http，port 8787（決議 D4）。
// 路由：GET / → dashboard 頁面；GET /pets/* → 靜態素材；GET /api/status → 記憶體快照 + 即時 activity。
// 韌性：/api/status 永不 500、不崩潰。collector 失敗回上次快取並標 stale；冷啟動無快取回 loading。

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const snapshot = require('./collectors/codexBarSnapshot.js');
const activity = require('./collectors/activity.js');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0'; // 綁 0.0.0.0 讓區網 iPhone 連得到
const PUBLIC_DIR = path.join(__dirname, 'public');
const REFRESH_MS = 60_000;
const LIBRARY_DIR = path.join(PUBLIC_DIR, 'pets', 'library');
const PET_CONFIG_FILE = path.join(__dirname, '..', 'data', 'pet-config.json');
const DEFAULT_PET_CONFIG = { claude: 'clawd', codex: 'boba' };

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
      pets.push({
        id: meta.id || ent.name,
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
    if (pathname === '/apple-touch-icon.png' || pathname === '/favicon.ico' || pathname === '/keepawake.mp4') {
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
