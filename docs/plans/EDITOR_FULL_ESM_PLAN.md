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

### 历史清除（决策：不做）

全历史聚合体积（工作区实测）：

| 路径 | 全史累计 | 版本数 | 说明 |
| --- | --- | --- | --- |
| `blank-editor.html` | **412 MB** | 331 | 树内保留（便携产物） |
| `web/editor.js` | **189 MB** | 336 | 单体已亡，历史纯死重 |
| `web/editor/boot/editor-bundle.js` | **105 MB** | 73 | 随 PR-1 退树，历史保留 |

历史重写会改所有 commit 哈希、破坏全部 fork 与既有 PR 引用。**决策：
不做历史清除**，接受全史死重，换取引用稳定性；数据留档备未来大版本
节点复议。

## 五、PR 拆分方案（3 个 PR）

原则：每批可独立合并、可独立回滚（原子恢复该批源码/入口/消费端/加载器，
不留半态）；import 图对 merge 天然友好——这正是机械拆分时代做不到的，
共享作用域的合并冲突从此结构性消失。**决策：不实施历史清除**（412+189+105 MB
的全史死重接受现状）；**bundle 退 Git 提前到 PR-1**，此后所有重构 PR 只动
源码、不提交任何 bundle 产物。

### PR-1 基建：让后续 PR 不再背 bundle（一个 PR）

| 内容 | 说明 |
| --- | --- |
| bundle 退 Git + 四层自动构建 | **直接 cherry-pick** `codex/bundle-build-artifact` 的两个提交（`5ba2baa1` 构建产物不入库 + 运行时入口自动重建、`ddb36b7a` frozen 包内只做存在性检查）；两提交基于 d2d12b42，与本分支同源可干净 pick。效果：serve.py / maw_gui.py / edit.py 陈旧自建 + release CI 构建三平台已绿；`.gitignore` 收编产物，仓库瘦身 1.4 MB/文件、终止后续 bundle 噪声 diff |
| 构建与 CI 门 | 产物新鲜度检查、开发 watch 约定（Server 不再直接反映未构建源码）、Node ≥22.7 版本钉、发布携带规则成文 |
| 类型门扩全图 | 修访问器 setter 模板（TS2630 族 60 条）、补 ESM 文件类型契约，include 逐步扩到当前全部 ESM 文件 |
| Python 契约迁移 | 按 `ESM_CONTRACT_MIGRATION.md` 处置表把 12 个旧结构测试换成运行时/产物契约（新契约先红后绿） |

验收：CI 全绿 + typecheck 绿 + bundle 退 Git 后 release 流程实测；不迁移任何产品源码。

### PR-2 全量真化：127 个 classic 文件一次转 ESM（一个 PR）

- 四域一批：cues(36) → io/media/markers(37) → ui/styles/state(42) → boot/shared/wiring(49)；
  用 `scripts/esm-mechanical/` codemod 机械转换 + 依赖袋消费方就地改 import。
- 终态切换随批完成：esbuild 直接产 ESM bundle，真 `import`/`export` 语义生效。
- 8 个外部桥随批消解；共享作用域裸引用由 codemod 按依赖图改写。
- 规模：~41k 行 churn，全在源码侧；**无 bundle diff**（PR-1 已退 Git）。

验收：新门禁（E1–E10 同型）全绿；全量 node/python/e2e；三页行为探针
（Python 基线 / 正式 file / 真实 localhost）；顺序类旧测试随域退役。

### PR-3 终态清理：拆脚手架（一个 PR）

- 删：`window.MAWE` 注册表与 `editor-runtime.js`、`initializeLegacy()` 包装、
  `editor-modules.json` 双轨登记、依赖袋注入形态、get/set 访问器对门面、
  双语法检查路径、VM 测试加载器、classic 作用域改写工具族（scope-core 保留）、
  顺序断言测试、`scripts/esm-mechanical/`。
- 改写：AGENTS 装配约定、开发文档。
- 验收：全量三线测试 + 依赖图闭合检查；仓库中不再存在 classic/module 双轨。

### 依赖关系

PR-1 → PR-2 → PR-3 严格串行（PR-2 的无 bundle diff 前提是 PR-1 的退 Git；
PR-3 的脚手架拆除前提是 PR-2 的真化完成）。每批回滚原子恢复该批源码/
入口/消费端/加载器，不退源码留新 bundle。

## 六、SubAgent 执行编排

### 6.1 编排总则

- **一个主控（orchestrator）+ 按任务书派发的子代理**。主控持有 git 写权限
  （commit / cherry-pick / push / 开 PR）；子代理只在自己工作树内改代码、
  跑测试、回报结论，**永不 push、永不碰主检出**。
- **一个子代理一个 worktree**：`.qwen/worktrees/esm-<lane>`，从当前集成分支
  拉出；集成只发生在主控的 `esm-integration` 工作树。并发子代理的文件所有权
  不得重叠（见 6.3 分配表）。
- **账本纪律**：沿用仓库「边做边落盘」约定，账本
  `docs/logs/unversioned/<日期>/esm-migration/`，每完成一个子任务即时回写
  （状态：待处理/进行中/已修复/阻塞），子代理回报与账本对不上以账本为准。
- **测试纪律**：长命令一律 `python scripts/run_check.py --timeout 180 -- …`；
  e2e 按域单跑，全量留给集成门；连续两轮不过即停，回报而不是循环重试。
- **升级条件**：同一失败点两次修复尝试无效、或需要改子任务书范围之外的东西
  （package.json、构建器、AGENTS），子代理停止并回报，由主控决策。

### 6.2 PR-1 编排（基建）

PR-1 内部三条泳道，文件所有权互斥，可两两并行：

| 泳道 | 内容 | 主要文件所有权 | 并行性 |
| --- | --- | --- | --- |
| L1 bundle 退 Git | cherry-pick `5ba2baa1`+`ddb36b7a`，解冲突，跑 release 构建冒烟 | `scripts/build-editor.mjs`、`.gitignore`、MAW.spec | 先行独立完成 |
| L2 类型门扩全图 | 修访问器 setter 模板（TS2630×60 族）→ 全量诊断分类 → 按类修复 | `scripts/build-editor.mjs` 生成模板段、`web/editor-globals.d.ts`、`tsconfig.typecheck.json` | 与 L3 并行 |
| L3 Python 契约迁移 | 按 `ESM_CONTRACT_MIGRATION.md` 处置表逐项换 12 个旧结构测试 | `tests/test_editor_assets.py` 等 Python 测试 | 与 L2 并行 |

- L1 由主控亲自做（cherry-pick 需要跨分支操作与 push 权限）。
- L2 拆两步：主控先修生成模板（一处改动消 60 条诊断），剩余诊断由
  **诊断分类子代理**（只读分析，产出分类清单）+ **按类修复子代理**
  （每类一个，各自 worktree）处理；`tsconfig.typecheck.json` 的 include
  扩大由主控统一执行，避免并发改同一文件。
- L3 一个子代理按处置表顺序执行，新契约先红后绿的证据写入账本。
- **集成门（主控）**：typecheck 绿 + `run_check.py` 全量 Python + bundle
  退 Git 后 release 冒烟 + 确认 diff 中无任何 bundle 产物。

### 6.3 PR-2 编排（全量真化）

机械转换由主控串行执行（codemod 是确定性的，无需智能），**子代理的价值
在按域修复转换 fallout**：

1. 主控按域序执行 codemod：cues → io/media/markers → ui/styles/state →
   boot/shared/wiring，每域一轮 `--write` + 依赖图闭合检查 + 全量 node 测试。
2. 每域转换后若该域测试出现行为红灯，派发**域修复子代理**：

| 域批次 | 文件数 | 修复子代理工作树 | 所有权边界 |
| --- | --- | --- | --- |
| cues | 36 | `esm-fix-cues` | `web/editor/cues/**` + 对应 e2e/spec 断言 |
| io/media/markers | 37 | `esm-fix-io-media` | `web/editor/io|media|markers/**` |
| ui/styles/state | 42 | `esm-fix-ui-state` | `web/editor/ui|styles|state/**`（8 外部桥所在域，最后转） |
| boot/shared/wiring | 49 | `esm-fix-boot-shared` | `web/editor/boot|shared/**`、wiring 尾段 |

3. 域子代理任务书要素：只许改本域文件；先复现（跑哪个 spec/测试）、再修、
   修后重跑证据；禁止改构建器与共享域；发现的跨域问题记账本不越界修。
4. **集成门（主控，每域合入后）**：全量 node + Python + 域 e2e；
   终域后加三页行为探针（Python 基线 / file / localhost）与 E1–E10 同型门禁。

### 6.4 PR-3 编排（终态清理）

单个清理子代理 + 主控复核即可：删除清单已在本文第三节钉死，子代理按清单
执行删除与 AGENTS/文档改写，主控做全量验收与 diff 审查（删除类 diff 逐行
过一遍防误删 scope-core 等保留项）。

### 6.5 子代理任务书模板（要点）

每份任务书必须自包含：基线 commit、worktree 路径、文件所有权（正/负清单）、
复现命令（含 `run_check.py` 包装与超时）、验收标准、回报格式（结论/证据/
未验证边界/阻塞原因）、以及仓库红线（无 AI 署名、`.env` 不读、删文件进
回收站、测试输出走摘要入口）。任务书之外的需求一律走账本升级，不口头扩权。

## 七、结论

全量 ESM 可行性**已被完整图实验证实**，剩余工作是工程执行而非技术未知。
三个 PR 的节奏：PR-1 把 bundle 从版本控制里摘出去并立好三道门（类型/契约/
新鲜度），PR-2 一次性完成 127 个 classic 文件的真化与终态切换，PR-3 拆掉
全部运行时脚手架。最大的隐性收益不是「用了 ESM」，而是**合并模型从
「共享作用域符号级三方重放」退化为普通文本 merge**——merge-flow 时代
最难的那类冲突从此结构性消失。历史清除不做（决策已定）：412+189+105 MB
的全史死重接受现状，换取全部 fork 与 commit 引用的稳定。
