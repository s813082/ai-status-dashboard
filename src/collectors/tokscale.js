'use strict';

// tokscale CLI 低階封裝（決議「以同介面 sibling collector 取代 CodexBar」的存取層）。
// 統一以 execFile 執行 tokscale，集中處理：未安裝（ENOENT）、非零離開碼、
// JSON 解析失敗、版本偵測。所有對 tokscale 的呼叫都應經由此模組。

const { execFile } = require('node:child_process');

const BIN = process.env.TOKSCALE_BIN || 'tokscale';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BUFFER = 16 * 1024 * 1024; // graph 年資料可能較大
const CMD_META_CHARS = /([()%!^<>&|;,"'\s])/g;

// 未安裝：呼叫端據此顯示安裝 banner 並退回空狀態
class TokscaleNotInstalledError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokscaleNotInstalledError';
    this.code = 'TOKSCALE_NOT_INSTALLED';
  }
}

// 其他執行/解析錯誤（非零離開碼、逾時、非 JSON 輸出）
class TokscaleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokscaleError';
    this.code = 'TOKSCALE_ERROR';
  }
}

function escapeCmdToken(value, { doubleEscape = false } = {}) {
  let token = String(value);
  if (/[\0\r\n]/.test(token)) {
    throw new TokscaleError('tokscale command arguments must not contain NUL or newlines');
  }

  token = token.replace(/(\\*)"/g, '$1$1\\"');
  token = token.replace(/(\\*)$/, '$1$1');
  token = `"${token}"`.replace(CMD_META_CHARS, '^$1');
  if (doubleEscape) token = token.replace(CMD_META_CHARS, '^$1');
  return token;
}

function escapeCmdCommand(value) {
  const command = String(value);
  if (/[\0\r\n]/.test(command)) {
    throw new TokscaleError('tokscale binary path must not contain NUL or newlines');
  }
  return command.replace(CMD_META_CHARS, '^$1');
}

// Windows npm shims are .cmd files. Node cannot execFile() them directly, so only
// that case goes through ComSpec. Direct executables keep the original argv array.
function buildInvocation({ binary = BIN, args = [], platform = process.platform, comSpec } = {}) {
  const direct = {
    file: binary,
    args: [...args],
    windowsVerbatimArguments: false,
  };
  if (platform !== 'win32' || !/\.(?:cmd|bat)$/i.test(binary)) return direct;

  const command = [
    escapeCmdCommand(binary),
    ...args.map((arg) => escapeCmdToken(arg, { doubleEscape: true })),
  ].join(' ');

  return {
    file: comSpec || process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', `"${command}"`],
    windowsVerbatimArguments: true,
  };
}

// 執行 tokscale，resolve stdout 字串。ENOENT → 具名「未安裝」錯誤。
function run(
  args,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    binary = BIN,
    platform = process.platform,
    comSpec = process.env.ComSpec,
    execFileFn = execFile,
  } = {},
) {
  return new Promise((resolve, reject) => {
    let invocation;
    try {
      invocation = buildInvocation({ binary, args, platform, comSpec });
    } catch (err) {
      reject(err);
      return;
    }

    execFileFn(
      invocation.file,
      invocation.args,
      {
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
        windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      },
      (err, stdout) => {
        if (err) {
          if (err.code === 'ENOENT') {
            return reject(new TokscaleNotInstalledError(`tokscale CLI not found (bin: ${binary})`));
          }
          return reject(new TokscaleError(`tokscale ${args.join(' ')} failed: ${err.message}`));
        }
        resolve(stdout);
      },
    );
  });
}

// 執行並解析 stdout 為 JSON；解析失敗拋 TokscaleError（未安裝錯誤仍透傳）。
async function runJson(args, opts) {
  const stdout = await run(args, opts);
  try {
    return JSON.parse(stdout);
  } catch {
    throw new TokscaleError(`tokscale ${args.join(' ')} produced non-JSON output`);
  }
}

// graph 預設即輸出 JSON（不吃 --json），且需 --no-spinner 避免非 JSON 汙染 stdout。
function graphJson(clientArgs, opts) {
  return runJson(['graph', ...clientArgs, '--no-spinner'], opts);
}

let versionCache; // 偵測一次即快取
async function getVersion() {
  if (versionCache !== undefined) return versionCache;
  try {
    const out = await run(['--version']);
    const m = String(out).match(/\d+\.\d+\.\d+/);
    versionCache = m ? m[0] : String(out).trim();
  } catch {
    versionCache = null;
  }
  return versionCache;
}

module.exports = {
  run,
  runJson,
  graphJson,
  getVersion,
  TokscaleNotInstalledError,
  TokscaleError,
  buildInvocation,
  BIN,
};
