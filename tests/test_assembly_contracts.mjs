// 装配契约（批 1 红灯测试，行为断言）：
// C1 桥契约——externalBridges 以活访问器装配：getter 读到实现、
//    mutable 桥赋值写回源绑定、const 桥赋值抛 TypeError；
// C2 顺序敏感行为——同一组源文件，boot 置于消费者之后时启动崩溃，
//    证明清单位次被真实消费（打乱真清单的浏览器级红灯在
//    tests/e2e/assembly-order.spec.mjs）。
// 注册表契约（61 个注册名与登记表一致、真页面行为）在
// tests/e2e/assembly-order.spec.mjs：真实 bundle 在 vm 里 phase-2
// 依赖持续加深的 DOM 面，假 DOM 桩不可信（PR-2 教训）。
// 全部走行为面（vm 执行 / 入口语义），不比对生成文本。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const builder = new URL('../scripts/build-editor.mjs', import.meta.url);

function modulesConfig() {
  return JSON.parse(fs.readFileSync(path.join(root, 'web/editor-modules.json'), 'utf8'));
}

function makeContext(extraWindow = {}) {
  // 夹具级装配无模板占位符；window/globalThis 在 vm 里分离，
  // 源码经 window.MaweBoot 等门面访问（与生产一致）。
  const window = { MAWE: { register() {}, resolve() {}, list: () => [] },
    addEventListener() {}, removeEventListener() {}, ...extraWindow };
  const context = { window, console };
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

test('C1 bridges: live accessors — mutable writes through, const rejects', async () => {
  const { compileSources } = await import(builder);
  const source = new Map([
    ['owner.js', 'let lib = {v:1}; function loadAssStyleLibrary(name){ return lib[name] ?? 0; }\n'
      + 'window.loadProbe = () => loadAssStyleLibrary("x");'],
    ['const-owner.js', 'const assModeToggle = {on: false};'],
  ]);
  const bridges = [
    { file: 'owner.js', name: 'loadAssStyleLibrary', mutable: true },
    { file: 'owner.js', name: 'lib', mutable: true },
    { file: 'const-owner.js', name: 'assModeToggle', mutable: false },
  ];
  const { code } = await compileSources(root, ['owner.js', 'const-owner.js'], [],
    file => source.get(file), { bridges });
  const context = makeContext();
  vm.runInContext(code, context);
  const w = context.window;
  // getter 活绑定：读到实现
  assert.equal(typeof w.loadAssStyleLibrary, 'function');
  assert.equal(w.loadProbe(), 0);
  assert.equal(w.lib.v, 1);
  // mutable 桥 setter 写回源绑定（源内随后读到新值）
  w.lib = { v: 42 };
  assert.equal(w.lib.v, 42);
  // const 桥：赋值抛 TypeError
  assert.equal(typeof w.assModeToggle, 'object');
  assert.throws(() => { w.assModeToggle = {}; }, /TypeError|constant/i);
  // 真实登记表：8 个桥，名称合法、owner 文件存在
  const realBridges = modulesConfig().externalBridges;
  assert.equal(realBridges.length, 8);
  for (const bridge of realBridges) {
    assert.match(bridge.name, /^[A-Za-z_$][\w$]*$/, bridge.name);
    assert.equal(typeof bridge.mutable, 'boolean', bridge.name);
    assert.ok(fs.existsSync(path.join(root, 'web', bridge.file)), bridge.file);
  }
});

test('C2 order: consumer before boot breaks boot semantics', async () => {
  const { compileSources } = await import(builder);
  const boot = 'const DATA = {segments: [1,2]};\nwindow.MaweBoot = {DATA};\nwindow.bootRan = true;';
  const consumer = 'const { segments } = window.MaweBoot.DATA;\n'
    + 'window.consumerSaw = segments.length;\nwindow.bootRanAtConsumer = Boolean(window.bootRan);';
  const source = new Map([['boot.js', boot], ['consumer.js', consumer]]);
  const { code } = await compileSources(root, ['consumer.js', 'boot.js'], [],
    file => source.get(file), {});
  const bad = makeContext();
  assert.throws(() => vm.runInContext(code, bad), /Cannot destructure|undefined/);
  const ordered = await compileSources(root, ['boot.js', 'consumer.js'], [],
    file => source.get(file), {});
  const good = makeContext();
  vm.runInContext(ordered.code, good);
  assert.equal(good.window.bootRan, true);
  assert.equal(good.window.consumerSaw, 2);
});
