# Editor 全量 ESM 化评估与推进方案

日期：2026-10-12；基线 `d2d12b42`（origin/main，#214 之后）。
评估分支：`feat/editor-full-esm-audit`。
依据：本分支实地勘察 + `docs/logs/unversioned/2026-10-08/esm-research/` 三份前人研究（完整图实验已在隔离副本跑通）。

## 一、现状快照

| 项 | 数值 |
| --- | --- |
| 清单总数 | 188 个模块 |
| 已 ESM 工厂 | 61（host 3 / utils 域 / waveform 域） |
| classic 剩余 | 127 个文件 / 41,212 行 |
| classic 按域 | cues 36、ui 22、io 20、media 14、styles 11、state 9、boot 7、markers 3、shared 5 |
| wiring 文件 | 37 个 / 9,915 行 |
| 外部桥（externalBridges） | 8 个（ASS 存储与管理器、overlay 转移/拆分） |
| 跨模块共享作用域读写 | 234 处读 / 9 处写 |
| 类型门 | 当前绿（仅覆盖 ESM 文件；基线 1 条已修） |

关键认知：**现在的「61 个 ESM」不是真 ESM 语义**。构建器把工厂包进
`initializeLegacy()` 的 classic 共享函数作用域，经 `window.MAWE.register`
注册、依赖袋注入后才可用；classic 模块靠裸名共享作用域互访。全量 ESM 的
本质是让 188 个文件全部改为真 `import`/`export`，由 esbuild 依赖图装配，
然后拆掉这整层运行时脚手架。

## 二、可行性判定：可行，且已被完整图实验证实

2026-10-08 的隔离实验（非主工作区）已把 180 个文件全转 ESM + esbuild 装配：

- 新门禁 E1–E10：10 pass / 0 fail；
- Node 全量：445 pass / 0 fail；
- 9 个 e2e spec（含拖动/播放/Seek/撤销/导入导出/便携页）：86 pass；
- 三页行为探针（Python 基线 / 正式 file 页 / 真实 localhost）：13/13；
- 三消费端（edit.py / serve.py / Tauri）读同一 classic bundle，实测通过。

**剩余风险集中在四处，均有明确清单**：

1. **类型门扩全图会爆 235 条诊断**（实验数据）：60 条 TS2630 来自生成的
   函数 setter 模板，其余为访问器模板与全局声明问题。不能靠 `any`/缩范围
   消除，需先修访问器生成模板与类型契约。
2. **12 个 Python 旧结构红灯**：资产契约测试查源码拼接原文，需按
   `ESM_CONTRACT_MIGRATION.md` 的逐项处置表换成运行时/产物契约。
3. **开发工作流变化**：Server 不能再直接反映未构建源码，需要 watch/构建
   流程与 CI 新鲜度门；纯 Python 最终用户仍无需 Node，但发布必须带新鲜产物。
4. **性能与体积未基准**：产物约 2.41 MB 未优化，565 处访问器引用无生产
   性能基准；选定测试未见问题 ≠ 无开销。

另有两点既有资产可直接复用：bundle 退出 Git 的四层自动构建方案已在
`codex/bundle-build-artifact` 分支验证（release CI 三平台绿）；launcher 侧
#192 的清单装配模式与编辑器同构，工具链可互相借鉴。

## 三、全量 ESM 后可去除的技术债

按「随终态 PR 直接删」归类：

| # | 债 | 说明 |
| --- | --- | --- |
| 1 | `window.MAWE` 注册表 + `editor/boot/editor-runtime.js` | 兼容层，import 图闭合后无存在必要 |
| 2 | `initializeLegacy()` 共享作用域包装 | build-editor 中的 classic 拼接段 |
| 3 | `editor-modules.json` 双轨登记 | modules + externalBridges 两段登记表；终态只剩纯构建元数据或整个退役 |
| 4 | 8 个 externalBridges | ESM 工厂引用 wiring 全局的过渡桥 |
| 5 | 依赖袋注入（`create*(environment)`） | 换成直接 import |
| 6 | get/set 访问器对门面 | 可变状态仿真，换真模块导出；顺带消掉 TS2630 一族 |
| 7 | classic/module 双语法检查路径 | 语法与顺序测试统一为 module 解析 + 依赖闭合检查 |
| 8 | VM 测试加载器 | `tests/helpers/editor-module-loader.mjs` 一类夹具改为直接 import 工厂 |
| 9 | classic 作用域改写工具族 | ns-rewrite / qualify-refs / merge-flow 的限定器（scope-core 保留，仍有审计价值） |
| 10 | 顺序断言测试 | 加载顺序保证由 import 图取代；`test_editor_script_order.mjs` 退役 |

## 四、文件清除：树内删除 与 历史清除 分开决策

### 树内删除（随终态 PR，零争议）

- `web/editor-modules.json`（若注册表退役）
- `scripts/esm-mechanical/`（过渡 codemod 工具，使命完成）
- `scripts/refactor-tools/` 中仅服务共享作用域改写的工具（split-cluster、
  ns-rewrite-editor 等；scope-core 保留）
- 对应的旧结构测试与夹具

### 历史清除（git filter-repo 级，维护者专属决策）

全历史聚合体积（工作区实测）：

| 路径 | 全史累计 | 版本数 | 说明 |
| --- | --- | --- | --- |
| `blank-editor.html` | **412 MB** | 331 | 树内仍需保留（便携产物）；历史可截断或转 LFS |
| `web/editor.js` | **189 MB** | 336 | 单体已亡，历史纯死重 |
| `web/editor/boot/editor-bundle.js` | **105 MB** | 73 | 若 bundle 退 Git（已验证方案）则树内+历史双清 |

pack 压缩后仓库 61.5 MiB，逻辑 churn 已显著。但**历史重写会改所有
commit 哈希、破坏全部 fork 与既有 PR 引用**——这是上游维护者的决策，
不是重构 PR 的一部分。稳妥路径：bundle 先退树（PR 级可行），历史清除
留到某个大版本节点（如 2.0）一次性评估，或接受现状。

## 五、PR 拆分方案（7 个功能 PR + 2 个可选）

原则：每批可独立合并、可独立回滚（原子恢复该批源码/入口/消费端/加载器/
产物，不留半态）；批次间 main 可继续演进，import 图对 merge 天然友好
（这正是机械拆分时代做不到的——共享作用域的合并冲突从此消失）。

| PR | 内容 | 规模预估 | 验收门 |
| --- | --- | --- | --- |
| **PR-A 准备：类型门扩全图** | 修访问器 setter 模板（TS2630 族）、补 ESM 文件类型契约，tsconfig include 逐步扩到当前全部 ESM 文件 | 中 | typecheck 绿；不迁任何源码 |
| **PR-B 准备：Python 契约迁移** | 按 ESM_CONTRACT_MIGRATION 处置表把 12 个旧结构测试换成运行时/产物契约 | 中 | 新契约先红后绿；旧拼接断言删除 |
| **PR-C 准备：构建与 CI 门** | 产物新鲜度门、开发 watch 约定、Node ≥22.7 版本钉、发布携带规则成文 | 小 | CI 全绿；「--write 才写产物」纯读检查 |
| **PR-D 域批次 1：cues（36 文件）** | 真化最大域；依赖袋消费方就地改 import | 大（~9k 行） | node + 域 e2e + 顺序测试仍守剩余 classic |
| **PR-E 域批次 2：io + media + markers（37 文件）** | 导出/保存/波形域 | 大 | 同上 |
| **PR-F 域批次 3：ui + styles + state（42 文件）** | 8 个外部桥随本批消解 | 大 | 同上 |
| **PR-G 域批次 4：boot + shared + wiring（49 文件）** | 最后的 classic；终态切换：esbuild 直接产 ESM bundle，退役注册表/依赖袋/包装 | 大 | E1–E10 类门禁全绿；三消费端探针 |
| **PR-H 终态清理** | 删第三节表列全部脚手架与旧测试；AGENTS/文档改写 | 小 | 全量 node/python/e2e + 三页探针 |
| PR-I（可选）bundle 退 Git | 复用 `codex/bundle-build-artifact` 已验证四层自动构建 | 中 | release CI 三平台 |
| PR-J（可选）历史清除 | filter-repo 截断 blank-editor/editor.js/bundle 历史 | — | 维护者决策，独立于本线 |

依赖链：A、B、C 可并行；D→E→F→G 顺序推进（也可按依赖倒序微调）；
H 依赖 G；I、J 独立。

## 六、结论

全量 ESM 可行性**已被完整图实验证实**，剩余工作是工程执行而非技术未知：
三道准备 PR 把类型门、Python 契约、构建门立稳，四个域批次把 127 个
classic 文件真化，终态 PR 拆掉全部运行时脚手架。最大的隐性收益不是
「用了 ESM」，而是**合并模型从「共享作用域符号级三方重放」退化为普通
文本 merge**——merge-flow 时代最难的那类冲突从此结构性消失。历史清除
（412+189+105 MB）收益明确但破坏性大，应作为维护者的独立决策与大版本
节点挂钩，不与重构 PR 混做。
