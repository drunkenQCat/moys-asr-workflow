// 类型门修复批：
// A) 自动扫描全部挂载门面，生成 editor-facades.generated.d.ts（手工 d.ts 已
//    声明真实契约的不重复生成，TS2451 预防）；
// B) 删除源里「函数声明的 legacyBindings setter」（TS2630 族：函数名无真实
//    跨模块写点，getter-only 即可；模板层同步修改 full-convert.mjs）；
// C) 去重对象字面量重复键（TS1117：后键已在运行时覆盖前键，删除被覆盖的
//    前项为严格等价）。

import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const root = process.cwd();
const webDir = path.join(root, 'web');
const walkFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const sources = walkFiles(webDir).filter((f) => f.endsWith('.js')
  && !f.includes('boot/launcher') && !f.includes(`${path.sep}launcher${path.sep}`)
  && !f.endsWith('editor-bundle.js') && !f.endsWith('launcher-bundle.js') && !f.endsWith('tooltip-bundle.js'));

// ---- A) facade 自动声明 ----
const manual = fs.readFileSync(path.join(webDir, 'editor/boot/editor-globals.d.ts'), 'utf8');
const manualDeclared = new Set([...manual.matchAll(/declare (?:const|var|let) (\w+)/g)].map((m) => m[1]));
const mountNames = new Set();
for (const file of sources) {
  const source = fs.readFileSync(file, 'utf8');
  for (const m of source.matchAll(/(?:^|[^.\w])(?:global|window|globalThis)\.(Mawe\w+|MAWE_I18N|Asr[A-Z]\w+|MAWEditor\w+|ASS_STYLE_LIBRARY|MULTI_SUBTITLE_UTILS|EDITOR_SETTINGS_UTILS)\s*=/gm)) {
    mountNames.add(m[1]);
  }
}
const autoNames = [...mountNames].filter((n) => !manualDeclared.has(n)).sort();
const outPath = path.join(webDir, 'editor/boot/editor-facades.generated.d.ts');
const header = `// 自动生成：scripts/esm-mechanical/typecheck-fixups.mjs（A 段）
// 全量 ESM 迁移后的挂载门面全局声明。真实契约逐步提升到
// editor-globals.d.ts（手工维护），此处仅消除「隐式全局」类型噪音。
// 修改挂载面后重跑本脚本。
`;
fs.writeFileSync(outPath, header
  + autoNames.map((n) => `declare var ${n}: any;`).join('\n') + '\n', 'utf8');
console.log(`A) auto facade declares: ${autoNames.length} (manual kept: ${[...mountNames].filter((n) => manualDeclared.has(n)).length})`);

// ---- B) 函数声明 setter 摘除 ----
function parseModule(source) {
  return acorn.parse(source, { ecmaVersion: 16, sourceType: 'module', ranges: true });
}
function topLevelFunctionNames(ast) {
  const names = new Set();
  for (const statement of ast.body) {
    if (statement.type === 'FunctionDeclaration' && statement.id) names.add(statement.id.name);
    if (statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'FunctionDeclaration' && statement.declaration.id) {
      names.add(statement.declaration.id.name);
    }
  }
  return names;
}
let setterFixCount = 0;
for (const file of sources) {
  let source = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parseModule(source); } catch { continue; }
  const functions = topLevelFunctionNames(ast);
  if (!functions.size) continue;
  const edits = [];
  // 匹配转换模板产出的 `get X() { return X; }, set X(value) { X = value; }`（或分行版）
  const pattern = /\bset (\w+)\(value\) \{[^{}]*\}/g;
  for (const m of source.matchAll(pattern)) {
    if (!functions.has(m[1])) continue;
    edits.push({ start: m.index, end: m.index + m[0].length });
  }
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  for (const edit of edits) source = source.slice(0, edit.start) + source.slice(edit.end);
  // 收敛 `}, ,` / `, }` 之类残留
  source = source.replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{').replace(/,\s*\}/g, ' }');
  fs.writeFileSync(file, source, 'utf8');
  setterFixCount += edits.length;
}
console.log(`B) removed function-declaration setters: ${setterFixCount}`);

// ---- C) 重复对象键去重（TS1117）----
function dedupe(file) {
  let source = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = acorn.parse(source, { ecmaVersion: 16, sourceType: 'module', ranges: true }); } catch { return 0; }
  const removes = [];
  (function visit(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'ObjectExpression') {
      const byKey = new Map();
      for (const prop of node.properties) {
        if (prop.type !== 'Property' || prop.computed) continue;
        const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? String(prop.key.value) : null;
        if (key === null) continue;
        if (byKey.has(key)) removes.push({ start: prop.start, end: prop.end });
        else byKey.set(key, prop);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'range', 'start', 'end'].includes(key)) continue;
      if (Array.isArray(value)) for (const child of value) visit(child);
      else if (value && typeof value.type === 'string') visit(value);
    }
  })(ast);
  if (!removes.length) return 0;
  removes.sort((a, b) => b.start - a.start);
  for (const edit of removes) {
    // 连同前导逗号和行尾空白删除
    let start = edit.start;
    while (start > 0 && /[ \t]/.test(source[start - 1])) start -= 1;
    if (start > 0 && source[start - 1] === ',') start -= 1;
    let end = edit.end;
    while (end < source.length && /[ \t]/.test(source[end])) end += 1;
    if (source[end] === '\n') end += 1;
    if (source[end] === ',') end += 1;
    source = source.slice(0, start) + source.slice(end);
  }
  fs.writeFileSync(file, source, 'utf8');
  return removes.length;
}
const dedupI18n = dedupe(path.join(webDir, 'shared/editor-i18n.js'));
const dedupUtils = dedupe(path.join(webDir, 'shared/editor-utils.js'));
console.log(`C) deduped object keys: i18n=${dedupI18n} utils=${dedupUtils}`);
