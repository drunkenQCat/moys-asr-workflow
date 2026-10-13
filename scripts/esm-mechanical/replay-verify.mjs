// 机械迁移可重放性检查：给定一个「classic 基线副本」（如 PR1 分支
// 检出，或历史发布副本），执行 full-convert 后与当前工作树的 web/
// 逐字节比较。证明提交的 ESM 源码完全由转换规则生成，无手工逐
// 文件补丁残留。
//
// 用法：node scripts/esm-mechanical/replay-verify.mjs CLASSIC_BASELINE
//   CLASSIC_BASELINE：含 web/ 的 classic 源副本目录；sandbox 标记由
//   本脚本注入。基线还必须有 tests/e2e/（externalBridges 从这里
//   收集跨文件消费点，决定哪些绑定发布为 getter）——副本缺它时
//   从当前仓库复制一份。
// 比较范围：清单声明的 188 个输入文件；web/package.json 与
// editor-sources.txt 是转换器自写产物，不在比较范围。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertAll } from './full-convert.mjs';

const baselineArg = process.argv[2];
if (!baselineArg) throw new Error('Usage: replay-verify.mjs CLASSIC_BASELINE');
const baseline = path.resolve(baselineArg);
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');

fs.writeFileSync(path.join(baseline, '.esm-mechanical-sandbox.json'),
  '{"purpose":"esm-mechanical-research"}\n');
if (!fs.existsSync(path.join(baseline, 'tests/e2e'))) {
  fs.mkdirSync(path.join(baseline, 'tests'), { recursive: true });
  fs.cpSync(path.join(repo, 'tests/e2e'), path.join(baseline, 'tests/e2e'), { recursive: true });
}
const { crossFileReferences } = await convertAll(baseline);

const manifest = fs.readFileSync(path.join(repo, 'web/editor-scripts.txt'), 'utf8')
  .split('\n').map((line) => line.split('#')[0].trim()).filter(Boolean);
let checked = 0; const mismatches = [];
for (const file of manifest) {
  const converted = path.join(baseline, 'web', file);
  const committed = path.join(repo, 'web', file);
  if (!fs.existsSync(converted)) { mismatches.push(`${file}: converter output absent`); continue; }
  if (fs.readFileSync(converted, 'utf8') !== fs.readFileSync(committed, 'utf8')) {
    mismatches.push(`${file}: differs from committed source`);
  }
  checked += 1;
}
console.log(JSON.stringify({ checked, crossFileReferences,
  ok: mismatches.length === 0, mismatches: mismatches.slice(0, 20) }, null, 2));
if (mismatches.length) process.exitCode = 1;
