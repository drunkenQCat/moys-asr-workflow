// 装配顺序契约（真页面，行为断言）：
// O1 启动行为——完整 boot：桥接、波形、渲染、导出、合并撤销全链可用；
// O2 启动轨迹——初始化 trace 与构建序一致，首为 editor-boot，末为
//    startup/onboarding（清单位次的活证据）；
// O3 注册表——MAWE.list() 与 editor-modules.json 的 61 个工厂名一致
//    且无重复（真页面行为，vm 无法承载 phase-2 DOM 面）；
// O4 桥——8 个 externalBridges 在真页面以活访问器存在；
// O5 顺序红灯——同一棵源码树、打乱的清单：boot 后置时启动崩溃
//    （行为级证明清单位次被真实消费；PR 终态删除清单后本测试
//    改为「打乱后行为不变」）。
// O5 在临时副本上重建 bundle（full-convert + build-editor），约
// 30–60s；其余四条共享一个服务器。
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanupTempDir, disableOnboarding, findFreePort, generateWav,
  generateWaveformPayload, makeTempDir, startServer,
} from './helpers.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const DURATION_MS = 4_000;

let dir; let server; let page;
const moduleConfig = () => JSON.parse(readFileSync(join(repoRoot, 'web/editor-modules.json'), 'utf8'));

function writeProject(filePath) {
  const project = {
    schema: 'moy.asr.project.v1',
    media: 'synthetic.wav',
    language: 'en',
    model: 'synthetic',
    segments: [
      { id: 'a-1', start: 0, end: 2000, text: 'First', items: [{ start: 0, end: 2000, text: 'First' }] },
      { id: 'a-2', start: 2100, end: 4000, text: 'Second', items: [{ start: 2100, end: 4000, text: 'Second' }] },
    ],
    waveform: generateWaveformPayload(DURATION_MS),
  };
  writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
  return filePath;
}

test.beforeAll(async ({ browser }) => {
  dir = makeTempDir('assembly-order');
  const wav = join(dir, 'synthetic.wav');
  generateWav(wav, DURATION_MS / 1000);
  const project = writeProject(join(dir, 'project.json'));
  const port = await findFreePort();
  server = await startServer(project, wav, port);
  page = await browser.newPage();
  await disableOnboarding(page);
  await page.goto(server.url);
  await page.waitForFunction(() => Boolean(window.MAWE_EDITOR_BRIDGE && window.MaweCoreState?.waveformEditor));
  await page.waitForFunction(() => window.MaweBoot?.DATA?.segments?.length > 0);
});

test.afterAll(async () => {
  await page?.close();
  await server?.stop();
  cleanupTempDir(dir);
});

test('O1 boot completes: bridge, waveform, render, export, merge+undo', async () => {
  const result = await page.evaluate(() => {
    const srt = window.MaweExportSrt.buildSrt();
    const before = JSON.stringify(window.MaweBoot.DATA.segments);
    window.MaweSegmentOps.mergeSegments([0, 1]);
    const merged = window.MaweBoot.DATA.segments.length === 1;
    window.MaweHistory.performUndo();
    const undoRestored = JSON.stringify(window.MaweBoot.DATA.segments) === before;
    return { registrySize: window.MAWE.list().length, waveform: Boolean(window.MaweCoreState.waveformEditor),
      rendered: window.MaweCoreState.container.querySelectorAll('.cue').length > 0,
      srtHasCue: srt.includes('-->'), merged, undoRestored,
      segmentCount: window.MaweBoot.DATA.segments.length };
  });
  expect(result.segmentCount).toBe(2);
  expect(result.registrySize).toBeGreaterThanOrEqual(61);
  expect(result.waveform, JSON.stringify(result)).toBe(true);
  expect(result.rendered, JSON.stringify(result)).toBe(true);
  expect(result.srtHasCue, JSON.stringify(result)).toBe(true);
  expect(result.merged, JSON.stringify(result)).toBe(true);
  expect(result.undoRestored, JSON.stringify(result)).toBe(true);
});

test('O2 startup trace: registry creator, factories, bootstrap, then manifest', async () => {
  const trace = await page.evaluate(() => window.__mawEsmInitializationTrace);
  const manifest = readFileSync(join(repoRoot, 'web/editor-scripts.txt'), 'utf8')
    .split('\n').map((line) => line.split('#')[0].trim()).filter(Boolean);
  const config = moduleConfig();
  const bootstrap = config.bootstrap ?? [];
  const factoryFiles = config.modules.map((m) => m.file);
  const registryCreator = 'editor/boot/editor-runtime.js';
  const expected = [
    ...(bootstrap.includes(registryCreator) ? [registryCreator] : []),
    ...factoryFiles,
    ...bootstrap.filter((f) => f !== registryCreator && !factoryFiles.includes(f)),
    ...manifest.filter((f) => !bootstrap.includes(f) && !factoryFiles.includes(f)),
  ];
  expect(trace).toEqual(expected);
  expect(trace[0]).toBe('editor/boot/editor-runtime.js');
  expect(trace.at(-1)).toBe('editor/boot/editor-onboarding.js');
  expect(trace.at(-2)).toBe('editor/boot/editor-startup.js');
});

test('O3 registry names match editor-modules.json exactly', async () => {
  const names = await page.evaluate(() => window.MAWE.list());
  const expected = moduleConfig().modules.map((m) => m.name);
  // 运行时还有少量代码内注册的门面（editor-host/waveform/editor-
  // commands/editor-state/editor-view-updates/editor-utils），
  // 不是登记表管理的工厂；登记表工厂必须全部在列且无重名。
  for (const name of expected) expect(names, name).toContain(name);
  expect(new Set(names).size).toBe(names.length);
});

test('O4 bridges: 8 external bridges are live accessors on the page', async () => {
  const bridges = moduleConfig().externalBridges;
  const observed = await page.evaluate((names) => names.map((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(window, name);
    return { name, isAccessor: Boolean(descriptor?.get), hasValue: window[name] !== undefined };
  }), bridges.map((b) => b.name));
  expect(observed).toHaveLength(8);
  for (const item of observed) {
    expect(item.isAccessor, item.name).toBe(true);
    expect(item.hasValue, item.name).toBe(true);
  }
  // 写语义：函数名桥（转换器只发 getter）赋值抛 TypeError；
  // 可变量桥（let/var 绑定）赋值写回源绑定。按登记表 owner 的绑定
  // 种类分类——ASS_STYLE_LIBRARY 是 let，其余 7 个是函数/const。
  const semantics = await page.evaluate((items) => items.map(({ name, expectWrite }) => {
    const before = window[name];
    let rejected = false;
    try { window[name] = before; } catch { rejected = true; }
    return { name, rejected, unchanged: window[name] === before };
  }), bridges.map((b) => ({ name: b.name, expectWrite: b.mutable })));
  for (const item of semantics) {
    if (item.name === 'ASS_STYLE_LIBRARY') {
      expect(item.rejected, item.name).toBe(false);
    } else {
      expect(item.rejected, item.name).toBe(true);
    }
  }
});

// O5 家族共用：PR1 classic 树副本 + 转换 + 打乱清单 + 构建 + 渲染探测。
// 打乱基线必须是 classic 源（当前仓库 web/ 已是转换产物）；整树提取
// （render 需要 edit.py 与 maw/）；tests/e2e 与 editor-modules.json 用
// 当前版本（消费点扫描与 bootstrap 序都以当前配置为准）。
async function buildShuffledCopy(sandbox, shuffle, shuffleBootstrap = null) {
  mkdirSync(sandbox, { recursive: true });
  execFileSync('git', ['archive', 'feat/editor-esm-pr1-foundation'],
    { cwd: repoRoot, stdio: ['ignore', openSync(join(sandbox, 'base.tar'), 'w'), 'pipe'] });
  execFileSync('tar', ['-xf', 'base.tar'], { stdio: 'pipe', cwd: sandbox });
  rmSync(join(sandbox, 'base.tar'));
  cpSync(join(repoRoot, 'tests'), join(sandbox, 'tests'), { recursive: true });
  cpSync(join(repoRoot, 'web/editor-modules.json'), join(sandbox, 'web/editor-modules.json'));
  const manifest = readFileSync(join(sandbox, 'web/editor-scripts.txt'), 'utf8')
    .split('\n').map((line) => line.split('#')[0].trim()).filter(Boolean);
  writeFileSync(join(sandbox, 'web/editor-scripts.txt'), shuffle(manifest).join('\n') + '\n');
  if (shuffleBootstrap) {
    const sandboxConfig = JSON.parse(readFileSync(join(sandbox, 'web/editor-modules.json'), 'utf8'));
    sandboxConfig.bootstrap = shuffleBootstrap(sandboxConfig.bootstrap);
    writeFileSync(join(sandbox, 'web/editor-modules.json'), JSON.stringify(sandboxConfig, null, 2) + '\n');
  }
  execFileSync('cmd', ['/c', 'mklink', '/J',
    join(sandbox, 'node_modules').replaceAll('/','\\'),
    join(repoRoot, 'node_modules').replaceAll('/','\\')], { stdio: 'pipe' });
  writeFileSync(join(sandbox, '.esm-mechanical-sandbox.json'),
    '{"purpose":"esm-mechanical-research"}\n');
  execFileSync(process.execPath, [join(repoRoot, 'scripts/esm-mechanical/full-convert.mjs'),
    sandbox, '--sources-only'], { stdio: 'pipe', cwd: sandbox });
  execFileSync(process.execPath, [join(repoRoot, 'scripts/build-editor.mjs'), '--write', sandbox],
    { stdio: 'pipe', cwd: sandbox });
  const python = process.env.MAW_E2E_PYTHON ?? 'python';
  const renderPage = join(sandbox, 'probe-page.html');
  execFileSync(python, ['-c',
    'import edit, pathlib, sys\n'
    + 'original = edit.render_editor_page\n'
    + 'def render(**context):\n'
    + '    context[\'data_json\'] = \'{"segments":[]}\'\n'
    + '    return original(**context)\n'
    + 'edit.render_editor_page = render\n'
    + 'pathlib.Path(sys.argv[1]).write_text(edit.build_blank_html(), encoding=\'utf-8\', newline=\'\\n\')\n',
    renderPage], { stdio: 'pipe', cwd: sandbox });
  await page.goto(`file:///${renderPage.replaceAll('\\', '/')}`);
  await page.waitForTimeout(2500);
  return page.evaluate(() => ({
    bridge: Boolean(window.MAWE_EDITOR_BRIDGE),
    traceLength: (window.__mawEsmInitializationTrace ?? []).length,
    registry: window.MAWE?.list?.().length ?? 0,
    waveform: Boolean(window.MaweCoreState?.waveformEditor),
    utilsFacade: typeof window.AsrEditorUtils === 'object',
  }));
}

test('O5a order red light: bootstrap file after consumers breaks boot', async () => {
  test.setTimeout(300_000);
  const sandbox = join(dir, 'shuffle-red');
  try {
    const boot = 'editor/boot/editor-boot.js';
    const state = await buildShuffledCopy(sandbox,
      (manifest) => manifest.filter((f) => f !== boot).concat([boot]),
      (bootstrap) => bootstrap.filter((f) => f !== boot).concat([boot]));
    // 真页面实测：boot 在 bootstrap 序里被挪到消费者（state/utils）
    // 之后 → 消费者 phase-2 读 MaweBoot.DATA 崩溃，桥接未建立。
    expect(state.bridge).toBe(false);
    expect(state.traceLength).toBeLessThan(188);
  } finally { rmSync(sandbox, { recursive: true, force: true }); }
});

test('O5b order independence: full manifest shuffle keeps behavior', async () => {
  test.setTimeout(300_000);
  const sandbox = join(dir, 'shuffle-green');
  try {
    // 终态证明：phase-2 执行序完全由 bootstrap 数组（显式、可审计）
    // 决定，清单顺序不再被入口消费——整份清单反转后行为必须一致。
    // sandbox 的 bootstrap 从当前登记表复制，不随清单打乱。
    const state = await buildShuffledCopy(sandbox, (manifest) => [...manifest].reverse());
    expect(state.bridge, JSON.stringify(state)).toBe(true);
    expect(state.registry, JSON.stringify(state)).toBeGreaterThanOrEqual(61);
    expect(state.waveform, JSON.stringify(state)).toBe(true);
    expect(state.utilsFacade, JSON.stringify(state)).toBe(true);
    expect(state.traceLength, JSON.stringify(state)).toBe(188);
  } finally { rmSync(sandbox, { recursive: true, force: true }); }
});
