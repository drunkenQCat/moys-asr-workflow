// 清单内全部源的语法检查（终态契约）。
//
// 迁移前：源码是 classic script，用 vm.Script 编译（零依赖，任何环境可跑）。
// 终态：清单源全部是 ESM 模块——源码一律按 module 解析；「classic 产物」这一
// 保证移交 test_editor_bundle：产物 bundle 用 vm.Script 编译（classic）+ 构建器
// 的入口校验。acorn 为 devDependency（package.json 显式声明），缺失时本测试
// 直接崩红而非静默 skip——语法层不许无声失守。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..", "web");

const manifest = readFileSync(join(webDir, "editor-scripts.txt"), "utf8")
  .split("\n")
  .map((line) => line.split("#", 1)[0].trim())
  .filter(Boolean);

test("editor-scripts.txt 内每个源都是合法 ESM 模块", () => {
  assert.ok(manifest.length > 1, "清单不应为空");
  const broken = [];
  for (const entry of manifest) {
    const source = readFileSync(join(webDir, ...entry.split("/")), "utf8");
    try {
      // 只解析，不执行：与 node --check 同等语法覆盖，不要求源文件能独立运行。
      acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
    } catch (error) {
      broken.push(`${entry}: ${error.message}`);
    }
  }
  assert.deepEqual(broken, [], "存在语法错误的编辑器源");
});
