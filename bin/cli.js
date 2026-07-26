#!/usr/bin/env node
'use strict';

// `npx github:s813082/ai-status-dashboard` 的進入點。
// 只做兩件事：啟動 server、把 iPhone 該打的 LAN 網址印出來。

const os = require('node:os');
const { start, PORT } = require('../src/server.js');
const { DATA_DIR } = require('../src/dataDir.js');

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((ni) => ni && ni.family === 'IPv4' && !ni.internal)
    .map((ni) => ni.address);
}

start();

const urls = [`http://localhost:${PORT}`, ...lanAddresses().map((ip) => `http://${ip}:${PORT}`)];
console.log('');
console.log('  AI Status Dashboard');
for (const url of urls) console.log(`    ${url}`);
console.log(`  資料目錄：${DATA_DIR}`);
console.log('  iPhone 請用上面的 LAN 網址（非 localhost），並確認與本機同一個 Wi-Fi。');
console.log('');
