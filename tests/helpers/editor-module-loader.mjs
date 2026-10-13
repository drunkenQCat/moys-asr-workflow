// 编辑器模块测试加载器：把 classic/ESM 源按生产同构的入口装配成 bundle 并在 vm 中执行。
//
// 单一事实源：清单只读 web/editor-scripts.txt（与 build-editor.readSources 相同），
// 闭包只从源码 import 语句推导（转换体的 provider 边 = import 边）。不依赖
// 任何转换期副产物（full-conversion.json / editor-sources.txt）。
//
// 语义与生产装配一致（scripts/build-editor.mjs compileEsmEntry）：
//   工厂文件按 exportName 导入并在清单位注册；转换体（export function*
//   initialize）两阶段驱动——第一轮全体发布闭包，第二轮按清单序交错执行
//   语句与注册。provider 的 phase2 副作用（如 MAWE.resolve 挂门面）必须
//   执行，否则消费方面对空门面——所以没有「只跑目标」的捷径；需要完整
//   启动链的断言请走浏览器测试，不要在这里堆假 DOM。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import * as acorn from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const web = path.join(root, 'web');
const manifest = fs.readFileSync(path.join(web, 'editor-scripts.txt'), 'utf8')
  .split('\n').map((line) => line.split('#')[0].trim()).filter(Boolean);
const manifestIndex = new Map(manifest.map((file, i) => [file, i]));
const modulesConfig = JSON.parse(fs.readFileSync(path.join(web, 'editor-modules.json'), 'utf8'));
const factoryByFile = new Map(modulesConfig.modules.map((item) => [item.file, item]));

// provider 边：文件源码里的相对 import（转换体与工厂都适用）。解析失败或
// 目标不在清单内（如 ./boot.js 之类的非清单路径）忽略。
const importGraphCache = new Map();
function importTargets(file) {
  if (importGraphCache.has(file)) return importGraphCache.get(file);
  const targets = new Set();
  try {
    const source = fs.readFileSync(path.join(web, file), 'utf8');
    const ast = acorn.parse(source, {
      ecmaVersion: 16, sourceType: file.endsWith('.mjs') ? 'module' : 'module', locations: false,
    });
    for (const statement of ast.body) {
      if (statement.type === 'ImportDeclaration' && statement.source.type === 'Literal'
        && typeof statement.source.value === 'string' && statement.source.value.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), statement.source.value));
        if (manifestIndex.has(target)) targets.add(target);
      }
    }
  } catch { /* 非 ESM 源（classic 或夹具自建）：无 import 边 */ }
  importGraphCache.set(file, targets);
  return targets;
}

// 依赖集合：直接 import 边（转换体的 provider 即 import 源），按清单序输出。
// 不做递归拉深——传递 provider 由 esbuild 照常打进 bundle 但不执行 initialize，
// 其 legacyBindings 只在被直接依赖的路径求值时访问；递归闭包会把 wiring 层的
// 事件监听语句拉进 phase2 执行，正是假 DOM 膨胀的源头（copy 实测回归 +21）。
export function fixtureClosure(file) {
  return [file, ...importTargets(file)]
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort((a, b) => manifestIndex.get(a) - manifestIndex.get(b));
}

const cache = new Map();
// 模板占位符：生产由 serve.py/edit.py 渲染注入；测试 bundle 给中性 JSON 字面量。
const DEFINES = {
  __DATA_JSON__: '{"segments":[]}',
  __FILENAME_BASE_JSON__: '""',
  __STICKERS_JSON__: '[]',
  __STICKER_ROOT_JSON__: '""',
  __STICKER_URL_PREFIX_JSON__: '""',
  __SERVER_CONFIG_JSON__: '{}',
  __NINJA_SFX_BASE_URL_JSON__: '""',
};

function compile(files, entry, { phase2All = true } = {}) {
  const key = `${files.join(',')}|${entry}|${phase2All ? 'all' : 'target'}`;
  if (cache.has(key)) return cache.get(key);
  const imports = [], classicFiles = [], classicIndex = new Map();
  files.forEach((file, i) => {
    const factory = factoryByFile.get(file);
    if (factory) imports.push(`import { ${factory.exportName} as factory${i} } from ${JSON.stringify('./' + file)};`);
    else {
      imports.push(`import { initialize as init${classicFiles.length} } from ${JSON.stringify('./' + file)};`);
      classicIndex.set(file, classicFiles.length);
      classicFiles.push(file);
    }
  });
// 隐式 window 契约门面：生产里由清单中更早的模块挂上（如 MaweFloatingPanel
// 由 markers/ass-frame 挂、dom 面板在其后按裸名引用）。单元夹具的闭包不含
// 挂载方时，入口预挂中性桩（以源码字面量嵌入 bundle）：测试自备的顶层同名
// stub 优先；束内真实挂载是无条件赋值，覆盖预挂——时序与生产一致。
const IMPLICIT_FACADE_SOURCE = {
  MaweMultiSubtitleCore: "({ MULTI: 'main', getActiveExtensionTrack: () => ({ segments: [] }),"
    + " getExtensionSubtitleSplitMode: () => 'word', getMainSubtitleSplitMode: () => 'word',"
    + " getMultiSubtitleState: () => ({ enabled: false, tracks: [] }),"
    + " normalizeMultiSubtitleState: (state) => state ?? { enabled: false, tracks: [] } })",
  MaweDom: "(() => { const store = new Map(); const el = () => ({ style: { setProperty() {} },"
    + " classList: { add() {}, remove() {}, toggle() {}, contains: () => false },"
    + " dataset: {}, addEventListener() {}, removeEventListener() {}, appendChild() {}, append() {},"
    + " removeChild() {}, querySelector: () => null, querySelectorAll: () => [], textContent: '', value: '',"
    + " hidden: false, disabled: false, checked: false, title: '',"
    + " getBoundingClientRect: () => ({ width: 0, height: 0 }) });"
    + " return new Proxy({}, { get: (_t, k) => { if (!store.has(k)) store.set(k, el()); return store.get(k); } }); })()",
  MaweFloatingPanel: "(() => { const el = () => ({ style: { setProperty() {} },"
    + " classList: { add() {}, remove() {}, toggle() {}, contains: () => false },"
    + " dataset: {}, addEventListener() {}, removeEventListener() {}, appendChild() {}, append() {},"
    + " removeChild() {}, querySelector: () => null, querySelectorAll: () => [], textContent: '', value: '',"
    + " hidden: false, disabled: false, getBoundingClientRect: () => ({ width: 0, height: 0 }) });"
    + " return { createFloatingPanel: () => ({ root: el(), card: el(), body: el(), titleBar: el(), overlay: el(), show() {}, hide() {} }),"
    + " bindFloatingSurfaceActivation() {}, syncFloatingSurfaceLayers() {}, bringFloatingSurfaceToFront() {},"
    + " floatingSurfaceIsOpen: () => false, floatingSurfaceStack: [], autoMergeFloatingPanel() {},"
    + " subtitleExtendFloatingPanel: () => ({ titleBar: el(), body: el(), card: el(), overlay: el() }) }; })()",
};

// 浏览器语义对齐：window === globalThis。测试把 stub 挂在 sandbox.window 上，
// 装配体（及模块自身 `global.MaweX = ...` 挂载）都假定两者同一。入口第一句
// 把 window stub 的自有键并入顶层（不覆盖测试已备好的同名 stub——单元测试
// 的隔离语义优先），再别名 window，最后预挂缺失的隐式门面。
const IDENTITY_SOURCE = '(() => { const w = globalThis.window;'
  + ' if (w && w !== globalThis) { for (const k of Object.getOwnPropertyNames(w))'
  + ' if (!(k in globalThis)) { try { globalThis[k] = w[k]; } catch { /* getter-only */ } }'
  + ' try { globalThis.window = globalThis; } catch { /* read-only elsewhere */ } }'
  + Object.entries(IMPLICIT_FACADE_SOURCE).map(([name, source]) =>
      ` if (!('${name}' in globalThis)) globalThis.${name} = ${source};`).join('')
  + ' })();';
  const statements = [IDENTITY_SOURCE,
    'const steps = [' + classicFiles.map((f) => `init${classicIndex.get(f)}()`).join(',') + '];',
    'for (const step of steps) step.next();',
    ...files.flatMap((file, i) => {
      const factory = factoryByFile.get(file);
      const isTarget = file === entry;
      const ops = [];
      if (factory) {
        if (phase2All || isTarget) ops.push(`window.MAWE.register(${JSON.stringify(factory.name)}, factory${i});`);
      } else {
        if (phase2All || isTarget) ops.push(`steps[${classicIndex.get(file)}].next();`);
      }
      if (isTarget) ops.unshift('globalThis.__mawBeforeFixture?.(window);');
      return ops;
    })];
  const result = esbuild.buildSync({
    stdin: { contents: [...imports, ...statements].join('\n'), resolveDir: web, loader: 'js', sourcefile: 'fixture-entry.mjs' },
    absWorkingDir: root, bundle: true, format: 'iife', write: false, logLevel: 'silent',
    banner: { js: "'use strict';" }, define: DEFINES,
  });
  const code = result.outputFiles[0].text;
  cache.set(key, code); return code;
}

const fixtureCache = new Map();
export function compileEditorFixture(file) {
  if (fixtureCache.has(file)) return fixtureCache.get(file);
  const code = compile(fixtureClosure(file), file);
  fixtureCache.set(file, code);
  return code;
}

// 全清单 bundle：与生产等价的完整装配（真实接线）。
export function compileEditorBundle() { return compile(manifest, manifest[manifest.length - 1]); }

// 指定文件集合的装配 bundle（classic iife，可注入真浏览器）：自动并入各
// 文件的直接 provider 闭包、去重、按清单序排列；entry 默认清单序最后一项。
export function compileEditorFiles(files, entry) {
  const ordered = [...new Set(files)].sort((a, b) => manifestIndex.get(a) - manifestIndex.get(b));
  const closure = [...new Set(ordered.flatMap((file) => fixtureClosure(file)))].sort(
    (a, b) => manifestIndex.get(a) - manifestIndex.get(b));
  return compile(closure, entry ?? ordered[ordered.length - 1]);
}

// 通用中性 DOM 元素（懒生成、按属性缓存）：单元夹具引用 MaweDom 等门面时，
// 用它替代逐个枚举 id——只是事件/样式管道，不模拟任何编辑器逻辑。
export function neutralElement() {
  const element = {
    style: new Proxy({ setProperty() {}, removeProperty() {} }, { get: (t, k) => t[k] ?? (() => '') }),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false, replace() {} },
    dataset: {}, textContent: '', value: '', id: '', title: '', innerHTML: '', hidden: false, checked: false, disabled: false,
    setAttribute() {}, removeAttribute() {}, toggleAttribute() {},
    appendChild() {}, append() {}, removeChild() {}, replaceChildren() {}, prepend() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector: () => null, querySelectorAll: () => [], closest: () => element, contains: () => false,
    focus() {}, blur() {}, click() {}, remove() {}, scrollIntoView() {}, select() {},
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
  };
  return element;
}
export function makeFacadeStub() {
  const store = new Map();
  return new Proxy({}, { get: (_t, key) => {
    if (!store.has(key)) store.set(key, neutralElement());
    return store.get(key);
  } });
}

// document 桩：中性元素工厂 + 常用查询。overrides 可为对象，或接收基础
// document 返回增量（如按 id 优先返回测试自有按钮、未命中回退中性元素）。
export function makeDocumentStub(overrides = {}) {
  const byId = new Map();
  const document = {
    createElement: () => neutralElement(),
    createTextNode: (text) => ({ textContent: text }),
    getElementById: (id) => { if (!byId.has(id)) byId.set(id, neutralElement()); return byId.get(id); },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    documentElement: Object.assign(neutralElement(), { lang: '' }),
    body: neutralElement(),
    head: neutralElement(),
    fonts: { addEventListener() {}, removeEventListener() {}, ready: Promise.resolve() },
    readyState: 'complete',
    activeElement: null,
  };
  const extra = typeof overrides === "function" ? overrides(document) : overrides;
  return Object.assign(document, extra);
}

export function loadEditorModule(context, entry, beforeEntry = () => {}) {
  // 固定域集合（与 copy 通过态一致）：boot 运行时 + host 域 + utils/waveform 目录
  // + 目标。import 闭包只用于 compileEditorFixture；此处不并入，避免改变既有
  // 测试的加载范围。
  const directories = entry === 'shared/editor-utils.js' ? ['shared/utils/'] : ['editor/media/waveform/'];
  const files = manifest.filter((name) => name === 'editor/boot/editor-runtime.js' || name === 'editor/boot/editor-host.js'
    || name.startsWith('shared/host/') || name === 'shared/gap-remove-core.js' || name === entry
    || directories.some((prefix) => name.startsWith(prefix)));
  context.__mawBeforeFixture = beforeEntry;
  try { vm.runInNewContext(compile(files, entry), context); }
  finally { delete context.__mawBeforeFixture; }
  return context.window;
}
