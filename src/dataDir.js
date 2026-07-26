'use strict';

// 執行期資料（snapshot / pet-config / settings）的落地目錄。
// 解析順序：AISD_DATA_DIR > 專案 clone 的 data/ > ~/.ai-status-dashboard。
// 套件被裝進 node_modules（npx / npm i）時一律走 home：npm 快取是暫時的，
// 寫在那裡的寵物選擇與設定下次執行就不見了。

const os = require('node:os');
const path = require('node:path');

const PKG_ROOT = path.join(__dirname, '..');
const INSTALLED = PKG_ROOT.split(path.sep).includes('node_modules');

function resolveDataDir() {
  if (process.env.AISD_DATA_DIR) return path.resolve(process.env.AISD_DATA_DIR);
  if (INSTALLED) return path.join(os.homedir(), '.ai-status-dashboard');
  return path.join(PKG_ROOT, 'data');
}

const DATA_DIR = resolveDataDir();

module.exports = {
  DATA_DIR,
  dataFile: (name) => path.join(DATA_DIR, name),
};
