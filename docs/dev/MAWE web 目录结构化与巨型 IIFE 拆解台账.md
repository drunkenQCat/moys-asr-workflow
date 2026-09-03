---
title: MAWE web 目录结构化与巨型 IIFE 拆解台账
created_at: 2026-09-03
updated_at: 2026-09-03
status: in_progress
---

# MAWE web 目录结构化与巨型 IIFE 拆解台账

本文件是 `web/` 这一轮重构的进度账本，配合 [`MAWE 前端渐进式重构企划案.md`](MAWE%20前端渐进式重构企划案.md) 的 Phase 2 使用。企划案说明"要往哪儿去"，本文件说明"现在实际到哪儿了"：每一项状态都以当前文件、diff 和测试输出为准，不按对话摘要记账。

处理中的问题状态只用：`待处理`、`进行中`、`已修复`、`仅说明`、`阻塞`。

## 本轮的两个问题

| # | 问题 | 处理顺序 |
| --- | --- | --- |
| 1 | `web/` 下 77 个编辑器脚本平铺，目录不表达任何结构，找文件靠猜 | 先做：先定分层规则，再搬家 |
| 2 | 部分脚本是单个极巨大的 IIFE（最大 5368 行一个闭包），改动无法局部评审 | 后做：搬家稳定后再拆闭包 |

先搬家后拆包的原因：`git` 对"纯移动"能给出 100% 相似度的证据，一旦先拆内容，重命名证据就消失，review 无法区分"搬走了"和"改坏了"。

## 问题 1 的设计：目录只表达归属，清单继续独占顺序

### 规则

1. **顺序仍由 `web/editor-scripts.txt` 独占。** 目录布局纯粹用于导航，不携带任何顺序语义；这一条写进清单头部注释，避免以后有人以为"按字母排序目录就行"。
2. **路径允许子目录，装配链不改协议。** `edit.py` 与 `desktop/src-tauri/build.rs` 各自把清单条目拼成路径（Rust 侧同步实现 `editor_script_path`），仍然拼成**一个** `__EDITOR_SCRIPTS_JS__` 脚本 token。不引入 ES module、不引入打包器、不改模板 token。
3. **路径只能向下。** `edit.editor_script_path()` 拒绝 `..` 和绝对路径逃逸；`read_editor_scripts_under(area)` 按区域读取，供契约测试对"某一层"断言。
4. **分层按"谁允许读谁"命名，不按文件大小或提交时间。** 顶层为 `shared/`（无 DOM、浏览器与 Node 共用）、`editor/`（编辑器层）、`server/`（与本地服务通信）、`boot/`（装配入口）。`editor/` 内再按域分：`lib/`、`state/`、`ui/`、`cues/`、`timeline/`、`playback/`、`input/`、`appearance/`、`split/`、`gap/`、`stickers/`、`text/`、`export/`、`project/`、`onboarding/`、`i18n/`、`waveform/`。
5. **测试断言装配结果，不断言单个文件路径。** 契约测试统一改成对 `edit.build_editor_scripts()` 或 `edit.read_editor_scripts_under("editor/waveform/")` 断言，模块日后继续拆细也不会让测试失效。

### 结果

- 77 个平铺脚本 → 子目录，`git show --stat -M` 显示 77 个 rename 全部 100% 相似度，即零内容改动。
- 清单条目数不变，生成链与 Tauri 构建共用同一份清单；`blank-editor.html` 重新生成。
- 新增 `tests/test_editor_script_syntax.mjs`：对清单里**每一个**脚本做全量解析，搬家过程中任何文件被截断都会在这里失败，而不是等到浏览器打开才发现。

## 问题 2 的判定标准：什么算"过大的 IIFE"

行数只能作为提示（企划案明确要求"不能为了达到数字而制造碎片化文件"）。判定用两个条件：

1. 文件顶层只有**一个** IIFE 表达式，也就是说整个文件是一个闭包，内部所有符号彼此可见；
2. 闭包行数达到约 800 行以上，人无法在一屏内确认改动影响面。

2026-09-03 实测排名（拆分前：`editor-scripts.txt` 104 个条目，共 36655 行）：

| 条目 | 行数 | 单 IIFE 行数 | 顶层语句 | 判定 |
| --- | ---: | ---: | ---: | --- |
| `editor/waveform/runtime.js` | 5371 | 5368 | 1 | 已拆（见下节） |
| `editor/split/core.js` | 1852 | 1847 | 1 | 待处理 |
| `shared/gap-remove-core.js` | 1409 | 1406 | 1 | 待处理 |
| `editor/ui/elements.js` | 1200 | 1195 | 1 | 待处理 |
| `editor/i18n/i18n.js` | 1119 | 1118 | 1 | 待处理（主体是词典） |
| `editor/text/timed-edit.js` | 839 | 834 | 1 | 待处理 |
| `editor/export/timeline.js` | 729 | 724 | 1 | 待处理（低于阈值，暂缓） |
| `editor/gap/ui.js` | 721 | 716 | 1 | 待处理（低于阈值，暂缓） |
| `editor/boot/entry.js` | 2813 | 无 IIFE | 423 | 待处理：问题不是闭包，是 423 条平铺接线语句 |
| `editor/onboarding/tour.js` | 630 | — | 1 | 仅说明：未达阈值 |

`editor/lib/utils.js` 原本以 4965 行排第二，本轮已拆完，故不在此表。

## `editor/lib/utils.js` 的拆解（已修复）

### 为什么先拆它

它是唯一"人人都读、自己谁都不读"的层：4965 行、单个 IIFE、258 条顶层语句、252 个顶层声明、内部 320 条交叉引用边，对外只暴露 147 个键（去重后 146）。把它拆干净，后面的域文件就有地方放共享逻辑，而不用再往一个筐里塞。

### 装配方式：内部命名空间 + 单一兼容出口

不引入 `import`，保持"拼成一个 `<script>`"的现实：

- `editor/lib/namespace.js` 是 `window.MaweLib` 的**唯一所有者**，重复初始化直接抛错。其余模块只做 `const U = global.MaweLib`；漏掉 namespace 条目会在加载期立刻炸，而不是留一个静默的 `global.MaweLib || (global.MaweLib = {})` 让顺序错误躲过检查。
- 各模块用 `Object.assign(U, { … })` 发布自己的内部符号。**新 helper 只进 `MaweLib`，不进兼容出口。**
- 模块内的**可变状态**用访问器发布：`Object.defineProperty(U, 'activeEndTrimPattern', { get: () => activeEndTrimPattern })`。值快照会把"每次重建正则"的语义变成"永远是第一次的正则"，这是本次最容易踩的坑。
- `editor/lib/compat-surface.js` 排在块尾，把整个表面**逐个键**快照回 `window.AsrEditorUtils`。原文件也只在加载期做一次对象字面量赋值，所以快照语义与拆分前一致。

### 拆出的 28 个模块

`namespace.js`、`json-value.js`、`audio-metadata.js`、`text-processing.js`、`cue-metrics.js`、`cue-timings.js`、`duration-format.js`、`split-candidates.js`、`cue-navigation.js`、`split-trim-symbols.js`、`settings-normalize.js`、`gap-remove-bridge.js`、`history-record.js`、`subtitles/normalize.js`、`subtitles/word-split.js`、`subtitles/bindings.js`、`timed-text/core.js`、`timed-text/structure.js`、`timed-text/boundary.js`、`export/srt-payload.js`、`export/plan.js`、`export/fcp7.js`、`export/artifacts.js`、`platform.js`、`preview-geometry.js`、`graphics/lottie.js`、`graphics/ograf.js`、`compat-surface.js`。最大 651 行，最小 17 行。

块内顺序自由（模块只在函数体内惰性读 `U.x`），只有两条硬约束写在清单头部：`namespace.js` 必须第一，`compat-surface.js` 必须最后。唯一的加载期跨块依赖是 `shared/gap-remove-core.js` 必须先于 `editor/lib/gap-remove-bridge.js`，由 `tests/test_editor_utils.mjs` 的顺序测试守住。

### 验证方式：差异测试，而不是"看起来一样"

契约测试只能证明键还在，证明不了行为没变。所以额外做了一次差分（临时脚本，不入库）：把 `git show HEAD:` 取到的旧实现与新块分别装进两个独立 `vm` 上下文，比对兼容出口的**键名与键序**，并对 131 个函数各发起至多 80 次调用（含边界输入），逐项比对返回值与抛错。结果：无行为差异。

拆解过程中的正确性由 codemod 自身的护栏保证，任何一条不满足就中止而不是猜：语句必须逐行、行分区必须无损、每个声明名必须有唯一所有者、不得跨模块写、不得遮蔽外模块同名符号、编辑锚点必须逐字节回验、发出的顺序必须满足全部加载期读、每个产物必须重新解析通过。

护栏在开发期抓到两个真问题：

1. `toleranceMs = MULTI_SUBTITLE_TOLERANCE_MS` 是参数默认值（一次**读**），按整体遍历 `params` 会被当成绑定，于是漏发一个无法解析的裸标识符——运行期 ReferenceError。修成 `AssignmentPattern` 分别处理左/右。
2. 简写属性 `{ foo }` 被改写成 `{ U.foo }` 会产生语法错误，需要显式输出 `{ foo: U.foo }`。

## `editor/waveform/runtime.js` 的拆解（已修复）

### 它和 `utils.js` 难在不是一回事

5371 行、单个 IIFE，里面是 115 条顶层语句加一个 **3960 行的 `class WaveformEditor`（155 个成员）**。`utils.js` 是"一堆互不相关的纯函数塞进一个筐"，按职责分堆即可；这里的核心难点是**一个类本身就是那个筐**——它的成员彼此用 `this.` 相连，还夹着访问器成员和实例字段，不能简单"搬到别的文件变成函数"。

### 装配方式：命名空间 + 原型混入

沿用 `editor/lib/` 的命名空间套路（`namespace.js` 独占创建 `window.MaweWaveform`、`compat-surface.js` 排最后重建 `window.AsrWaveform`），额外解决"类怎么跨文件"：

- 构造器留在 `editor/waveform/core.js`，那里也是 `class WaveformEditor` 唯一的声明处。
- 其余 154 个成员按职责搬到同目录的**原型混入模块**，加载期执行 `U.defineMethods(U.WaveformEditor.prototype, { … })`。成员本体逐字节原样搬运，方法体内的 `this.*` 一个不改——所以不需要"先想清楚怎么把方法变成自由函数"。
- 方法体外对旧顶层符号的引用改为 `U.xxx`；类内部的 `this.xxx` 保持原样。
- `defineMethods` 必须逐描述符复制（`Reflect.ownKeys` + `getOwnPropertyDescriptor`），**不能用 `Object.assign`**：类里有 `get durationMs()` 这类访问器，`Object.assign` 会调用它并只拷贝返回值，把访问器降级成数据属性，播放时长从此冻结在加载期。
- 由此产生两条硬顺序约束，写在清单头部并由契约测试守住：所有混入模块必须在 `core.js` **之后**（加载期就要拿到类）、在 `compat-surface.js` **之前**（出口要读到最终的原型）。

拆出 30 个文件：`namespace.js`、`constants.js`、`workspaces.js`、`labels.js`、`numeric.js`、`multi-row.js`、`layout-tree.js`、`settings-io.js`、`decode.js`、`spectral.js`、`scale.js`、`cue-timing.js`、`segment-split.js`、`cue-lookup.js`、`core.js`、`media.js`、`controls.js`、`hover-preview.js`、`layout.js`、`layout-edit.js`、`view.js`、`render.js`、`cue-blocks.js`、`pointer-time.js`、`pointer-create.js`、`cue-drag.js`、`keyboard-adjust.js`、`gap-drag.js`、`playback.js`、`compat-surface.js`。最大 526 行，最小 22 行。

### 验证方式：三层差分，逐层独立

类比纯函数更怕"搬错一个字符"，所以差分做了三层（临时脚本，不入库）：

| 层次 | 比什么 | 结果 |
| --- | --- | --- |
| 结构 | 两个 `vm` 上下文里 `window.AsrWaveform` 的对象结构、键名与键序 | 完全一致 |
| 源码 | 155 个原型成员 + 112 个顶层符号的函数源码文本（剥掉新侧的 `U.` 前缀后） | 逐字节一致 |
| 行为 | 对可读状态与函数发起 1748 次调用，比对返回值与抛错 | 0 处差异 |

源码层是关键：行为测试只能证明"我想到的输入上没变化"，源码逐字节一致才证明"我没顺手改逻辑"。护栏沿用 `utils.js` 那一套（行分区无损、声明名唯一所有者、不跨模块写、不遮蔽外模块、锚点逐字节回验、发出顺序满足全部加载期读、产物重新解析），并额外要求混入模块的成员名在整个块内不重复。

护栏在开发期抓到两个真问题：

1. acorn 把解构默认值 `{ minDuration = MIN_CUE_MS }` 标成 `shorthand: true`，改写器误当简写属性处理，产出 `{ minDuration = MIN_CUE_MS: U.MIN_CUE_MS }` 这样的语法错误。修成只有 `shorthand` 且值是纯 `Identifier` 才算简写读。
2. 顶层符号普查把每个模块私有的 `const U = global.MaweWaveform` 报成"同一个符号出现在 30 个模块"——它是 IIFE 私有，不属于块级共享名，普查需跳过。

### 已知未修：构造器内部的缩进

`WaveformEditor` 构造器内部有一批 4 空格缩进的语句（同文件其余是 2 空格），属拆分前既有。搬运要求逐字节原样，故本次未修；顺手格式化会破坏"剥前缀后逐字节一致"这条证据链。留给后续单独一次纯格式提交。

## 顺手挖出的重复与既有缺陷（仅说明）

这些是 46 个共享名普查的结果，不属于本轮改动范围，记录以免丢失：

| 发现 | 现状 | 处理 |
| --- | --- | --- |
| `normalizeKeyboardOperationReferenceMode` 在原 `utils.js` 里**声明并导出两次** | 函数声明提升使后者覆盖前者；两个实现对任意输入结果相同，因此线上无差异。兼容出口只保留首次出现位置，并在 `compat-surface.js` 头部注明 | 已修复（消除重复声明，行为不变） |
| `cloneJsonValue`、`clampInteger` 与 `shared/gap-remove-core.js` 中的同名实现逐字节相同 | 纯复制，两处会各自漂移 | 仅说明：合并会跨层引入依赖，等 Phase 3 再定 |
| `editor/lib/settings.js` 与本块 `settings-normalize.js` 的钳制函数族**并不相同** | 同名近似、边界不同 | 仅说明：这是需要维护者判断的真实分歧，**没有**擅自统一 |
| `gap-remove` 相关的几个别名 | 是有意的桥接垫片，不是重复 | 仅说明：保留 |

## 进度账本

| # | 事项 | 状态 | 验证 |
| --- | --- | --- | --- |
| 1 | 装配链允许 `web/` 子目录脚本路径 + 清单级全量语法检查 | 已修复 | `7a862f9`；`tests/test_editor_script_syntax.mjs` 当时 104 个条目全通过（清单现为 133 条） |
| 2 | 77 个平铺脚本按层与域归入子目录 | 已修复 | `7ce93a9`；77 个 rename 全 100% 相似度；Python 资产契约 + Node 套件通过 |
| 3 | `editor/lib/utils.js` 4965 行单 IIFE → 28 模块 | 已修复 | `0246ca5`；Node 252/252；`tests.test_editor_assets` 通过；差分测试无行为差异；`blank-editor.html` 已重生成并逐字节比对 |
| 4 | Playwright 全量回归 | 进行中 | 本工作树 16 失败 / 273 通过；与 `7ce93a9` 对照 worktree 的失败集合逐项比对尚未收尾，见下节 |
| 5 | `editor/waveform/runtime.js` 5371 行拆解 | 已修复 | `0a39d8b`；30 模块（最大 526 行）；Node 252/252；`tests.test_editor_assets tests.test_waveform` 39/39；三层差分零差异；`blank-editor.html` 已重生成并由契约测试逐字节比对 |
| 6 | `editor/split/core.js` 1852 / `shared/gap-remove-core.js` 1409 / `editor/ui/elements.js` 1200 / `editor/i18n/i18n.js` 1119 / `editor/text/timed-edit.js` 839 | 待处理 | 阈值以上，逐个独立处理 |
| 7 | `editor/boot/entry.js` 423 条平铺接线语句按接线域分组 | 待处理 | — |
| 8 | 文档同步（AGENTS.md 的 `web/` 树、`docs/DEVELOPMENT.md`、网站开发页、基线文档） | 已修复 | 目录树、`MaweLib` 规则、`MaweWaveform` 原型混入顺序规则均已写入 `AGENTS.md` 与 `docs/DEVELOPMENT.md`；网站开发页由 `scripts/sync-maw-docs.mjs` 重生成（只保留 `development.md`，其余 4 篇的既有漂移已还原，不夹带） |

## 验证记录（分层，不互相冒充）

| 层次 | 命令 | 结果 |
| --- | --- | --- |
| 语法 | `node --test tests\test_editor_script_syntax.mjs` | 通过（133 条目，逐个编译） |
| 装配顺序/重名 | `node --test tests\test_editor_script_order.mjs` | 通过（含 `namespace.js` 首位、`compat-surface.js` 末位、跨模块重名检测） |
| 波形块顺序契约 | `test_waveform_prototype_mixins_load_after_the_class_and_before_the_exit` | 通过（≥10 个混入模块全部落在 `core.js` 之后、出口之前） |
| JS 单测 + lib/waveform 契约 | `node --test tests\test_editor_script_syntax.mjs tests\test_editor_script_order.mjs tests\test_editor_utils.mjs tests\test_waveform_js.mjs tests\test_editor_runtime.mjs` | 252/252 通过 |
| Python 资产契约 | `uv run python -m unittest tests.test_editor_assets tests.test_waveform` | 39/39 通过 |
| Python 全量 | `uv run python -m unittest discover -s tests -p "test_*.py"` | 994 项，5 错误全部为既有环境问题：子进程 `stdout` 为 `None`（`test_gui_workflow` ×2、`test_local_editor_server` ×1、`test_local_runtime` ×2；单独运行同样失败，与本改造无关） |
| Lint | `uv run --frozen ruff check .` | 全部通过 |
| 空白 | `git diff --check` | 干净 |
| 产物一致性 | `test_committed_blank_editor_is_regenerated_from_web_sources` | 通过（提交内容与 `web/` 重新生成结果逐字节一致） |
| 浏览器交互 | Playwright | 进行中 |

`test_editor_script_payload_follows_manifest_order` 不再维护一张与清单 1:1 的"标记表"（拆细模块会让它错位），改为从每个脚本源码取第一行非注释行作为标记，在整包里顺序查找。

### Playwright 全量回归的做法与既有失败

浏览器回归不能只看"失败数一样"， timing 类失败会随机漂移。做法是在 `7ce93a9`（搬家完成、尚未拆任何闭包）另开一个对照 worktree，跑同一套 spec，然后**逐条比对失败标题集合**而不是比数字。两次运行必须串行：并发跑时资源竞争会凭空多出 timing 失败（实测出现过 `click-behavior.spec.mjs:365` 和多条 multi-subtitle 超时，串行后全部通过）。

- 对照基线 `7ce93a9`：16 失败 / 273 通过。
- 拆完 `editor/lib/utils.js` 后：16 失败 / 273 通过，**失败标题集合与基线逐条相同**（0 项新增、0 项消失）。
- 拆完 `editor/waveform/runtime.js` 后：同一套全量回归按同样方式比对，结果记在进度账本。

这 16 项在拆分之前就存在，集中在 launcher 交互、multi-subtitle 长流程、waveform 历史与两处 timing 敏感断言上，属分支既有状态，本轮不修（修 spec 或调超时属于另一件事，且会掩盖真实问题）。

其中一条值得单列：

`tests/e2e/cue-color-filter.spec.mjs:65` 在本轮改动之前的 `HEAD`（对照 worktree）上同样失败，**不是**本轮引入：`#color-filter-menu .color-filter-clear` 解析到 2 个元素——"全选过滤结果"按钮复用了 `.color-filter-clear` 类，spec 未随之更新。属陈旧 spec，未擅自修改（改 spec 会掩盖"这个类到底该不该复用"这个真实问题）。

## 未验证边界

- Node 与 Python 测试都在假 `window` / 无 DOM 环境里跑，覆盖不到拖动、播放、Seek、布局。
- Playwright 不覆盖便携单文件的真实双击打开路径；便携 HTML 目前只有生成一致性证据。
- Tauri 构建（`build.rs` 的 `editor_script_path`）未在本机跑 `cargo`，只有 Rust 侧语法与共享清单契约证据。
