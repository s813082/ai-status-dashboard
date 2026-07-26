'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildInvocation,
  run,
  runJson,
  TokscaleNotInstalledError,
  TokscaleError,
} = require('../src/collectors/tokscale.js');

test('darwin and linux executables keep the original argv array', () => {
  for (const platform of ['darwin', 'linux']) {
    const args = ['usage', '--json', 'value with spaces'];
    const invocation = buildInvocation({ binary: '/opt/tokscale', args, platform });
    assert.equal(invocation.file, '/opt/tokscale');
    assert.deepEqual(invocation.args, args);
    assert.equal(invocation.windowsVerbatimArguments, false);
  }
});

test('win32 exe executes directly regardless of extension case', () => {
  const args = ['usage', '--json'];
  const invocation = buildInvocation({
    binary: 'C:\\Program Files\\tokscale\\tokscale.EXE',
    args,
    platform: 'win32',
  });
  assert.equal(invocation.file, 'C:\\Program Files\\tokscale\\tokscale.EXE');
  assert.deepEqual(invocation.args, args);
  assert.equal(invocation.windowsVerbatimArguments, false);
});

test('win32 cmd and bat shims use the injected ComSpec', () => {
  for (const extension of ['cmd', 'BAT']) {
    const invocation = buildInvocation({
      binary: `C:\\Tools\\tokscale.${extension}`,
      args: ['usage', '--json'],
      platform: 'win32',
      comSpec: 'C:\\Windows\\System32\\cmd.exe',
    });
    assert.equal(invocation.file, 'C:\\Windows\\System32\\cmd.exe');
    assert.deepEqual(invocation.args.slice(0, 3), ['/d', '/s', '/c']);
    assert.equal(invocation.windowsVerbatimArguments, true);
  }
});

test('win32 cmd falls back to cmd.exe when ComSpec is absent', () => {
  const previousComSpec = process.env.ComSpec;
  delete process.env.ComSpec;
  try {
    const invocation = buildInvocation({
      binary: 'tokscale.cmd',
      args: ['--version'],
      platform: 'win32',
      comSpec: '',
    });
    assert.equal(invocation.file, 'cmd.exe');
  } finally {
    if (previousComSpec === undefined) delete process.env.ComSpec;
    else process.env.ComSpec = previousComSpec;
  }
});

test('cmd command string preserves binary and argument token boundaries', () => {
  const invocation = buildInvocation({
    binary: 'C:\\Program Files\\tokscale cli\\tokscale.cmd',
    args: ['graph', 'value with spaces', '', '--json'],
    platform: 'win32',
    comSpec: 'cmd.exe',
  });
  const command = invocation.args[3];
  assert.equal(
    command,
    '"C:\\Program^ Files\\tokscale^ cli\\tokscale.cmd ^^^"graph^^^" ^^^"value^^^ with^^^ spaces^^^" ^^^"^^^" ^^^"--json^^^""',
  );
});

test('cmd metacharacters are escaped and newlines are rejected', () => {
  const invocation = buildInvocation({
    binary: 'C:\\Tools & More\\tokscale.cmd',
    args: ['a&b', 'c|d', '100%', '!value!', 'quote"value'],
    platform: 'win32',
    comSpec: 'cmd.exe',
  });
  const command = invocation.args[3];
  assert.match(command, /\^&/);
  assert.match(command, /\^\^\^&/);
  assert.match(command, /\^\^\^\|/);
  assert.match(command, /\^\^\^%/);
  assert.throws(
    () => buildInvocation({ binary: 'tokscale.cmd', args: ['usage\r\nwhoami'], platform: 'win32' }),
    TokscaleError,
  );
});

test('run passes adapter output and bounded hidden execFile options', async () => {
  let captured;
  const stdout = await run(['usage', '--json'], {
    binary: 'C:\\Program Files\\tokscale.cmd',
    platform: 'win32',
    comSpec: 'C:\\Windows\\cmd.exe',
    timeoutMs: 4321,
    execFileFn(file, args, options, callback) {
      captured = { file, args, options };
      callback(null, '{"ok":true}');
    },
  });
  assert.equal(stdout, '{"ok":true}');
  assert.equal(captured.file, 'C:\\Windows\\cmd.exe');
  assert.equal(captured.options.timeout, 4321);
  assert.equal(captured.options.maxBuffer, 16 * 1024 * 1024);
  assert.equal(captured.options.windowsHide, true);
  assert.equal(captured.options.windowsVerbatimArguments, true);
  assert.equal(Object.hasOwn(captured.options, 'shell'), false);
});

test('ENOENT preserves TokscaleNotInstalledError semantics', async () => {
  await assert.rejects(
    run(['--version'], {
      binary: 'missing-tokscale',
      platform: 'linux',
      execFileFn(file, args, options, callback) {
        const err = new Error('not found');
        err.code = 'ENOENT';
        callback(err, '');
      },
    }),
    (err) => err instanceof TokscaleNotInstalledError && err.code === 'TOKSCALE_NOT_INSTALLED',
  );
});

test('non-zero and timeout failures preserve TokscaleError semantics', async () => {
  for (const code of [1, 'ETIMEDOUT']) {
    await assert.rejects(
      run(['usage'], {
        binary: 'tokscale.cmd',
        platform: 'win32',
        comSpec: 'cmd.exe',
        execFileFn(file, args, options, callback) {
          const err = new Error(`failed with ${code}`);
          err.code = code;
          callback(err, '');
        },
      }),
      (err) => err instanceof TokscaleError && err.code === 'TOKSCALE_ERROR',
    );
  }
});

test('invalid JSON preserves TokscaleError parse semantics', async () => {
  await assert.rejects(
    runJson(['usage', '--json'], {
      execFileFn(file, args, options, callback) {
        callback(null, 'not-json');
      },
    }),
    (err) => err instanceof TokscaleError && /non-JSON output/.test(err.message),
  );
});

// 回歸：npm 全域安裝只放 .cmd／.ps1 shim，沒有 .exe。未設 TOKSCALE_BIN 時
// execFile('tokscale') 會直接 ENOENT，導致 npx／npm start 啟動的 Windows
// dashboard 抓不到任何資料（0.7.0 前僅 start-dashboard.ps1 預先解析路徑才能運作）。
test('win32 bare binary resolves an npm .cmd shim from PATH', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokscale-shim-'));
  try {
    fs.writeFileSync(path.join(dir, 'tokscale.cmd'), '@echo off\n');
    const invocation = buildInvocation({
      binary: 'tokscale',
      args: ['usage', '--json'],
      platform: 'win32',
      comSpec: 'C:\Windows\System32\cmd.exe',
      env: { PATH: dir },
    });
    assert.equal(invocation.file, 'C:\Windows\System32\cmd.exe');
    assert.equal(invocation.windowsVerbatimArguments, true);
    assert.match(invocation.args[3], /tokscale\.cmd/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('win32 bare binary prefers .exe over .cmd when both exist', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokscale-shim-'));
  try {
    fs.writeFileSync(path.join(dir, 'tokscale.exe'), '');
    fs.writeFileSync(path.join(dir, 'tokscale.cmd'), '@echo off\n');
    const invocation = buildInvocation({
      binary: 'tokscale',
      args: ['usage'],
      platform: 'win32',
      env: { PATH: dir },
    });
    assert.equal(invocation.file, path.join(dir, 'tokscale.exe'));
    assert.equal(invocation.windowsVerbatimArguments, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('win32 bare binary stays bare when no shim is on PATH, preserving ENOENT', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokscale-empty-'));
  try {
    const invocation = buildInvocation({
      binary: 'tokscale',
      args: ['usage'],
      platform: 'win32',
      env: { PATH: dir },
    });
    assert.equal(invocation.file, 'tokscale');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('non-win32 bare binary is never PATH-scanned', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokscale-shim-'));
  try {
    fs.writeFileSync(path.join(dir, 'tokscale.cmd'), '@echo off\n');
    for (const platform of ['darwin', 'linux']) {
      const invocation = buildInvocation({
        binary: 'tokscale',
        args: ['usage'],
        platform,
        env: { PATH: dir },
      });
      assert.equal(invocation.file, 'tokscale');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
