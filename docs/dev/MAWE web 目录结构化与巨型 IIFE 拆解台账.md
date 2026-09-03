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
| `editor/split/core.js` | 1852 | 1847 | 1 | 已拆（见下节） |
| `shared/gap-remove-core.js` | 1409 | 1406 | 1 | 已拆（见下节） |
| `editor/ui/elements.js` | 1200 | 1195 | 1 | 已拆（见下节） |
| `editor/i18n/i18n.js` | 1119 | 1118 | 1 | 已拆（见下节） |
| `editor/text/timed-edit.js` | 839 | 834 | 1 | 已拆（见下节） |
| `editor/export/timeline.js` | 729 | 724 | 1 | 待处理（低于阈值，暂缓） |
| `editor/gap/ui.js` | 721 | 716 | 1 | 待处理（低于阈值，暂缓） |
| `editor/boot/entry.js` | 2813 | 无 IIFE | 423 | 已拆（见下节）：问题不是闭包，是 423 条平铺接线语句 |
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

块内顺序自由（模块只在函数体内惰性读 `U.x`），只有两条硬约束写在清单头部：`namespace.js` 必须第一，`compat-surface.js` 必须最后。唯一的加载期跨块依赖是 `shared/gap-remove/` 整块必须先于 `editor/lib/gap-remove-bridge.js`（后者在加载期就 `const GAP_REMOVE_CORE = window.AsrGapRemoveCore` 并判空抛错），由 `tests/test_editor_utils.mjs` 的顺序测试守住。

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

## `editor/split/core.js`：1852 行 → 12 个模块

`editor/split/` 本来就有 `mode.js`、`trim.js`、`context-menu.js` 三个独立脚本，`core.js` 是这块的主闭包：1847 行、顶层一条语句，对外只留一个冻结门面 `window.MaweSplitCore`（53 个键，含一对 `pendingLinkedSplit` 读写访问器）。

拆法与 `editor/lib/` 同构，不同点只在门面是 `Object.freeze(...)` 包起来的字面量：

| 模块 | 行 | 职责 |
| --- | ---: | --- |
| `namespace.js` | 13 | 独占创建 `window.MaweSplit`，重复初始化直接抛错 |
| `pending-state.js` | 19 | `pendingLinkedSplit`，以访问器形式发布到命名空间 |
| `offset-timing.js` | 73 | 文本偏移 ↔ 时间换算 |
| `item-cut.js` | 321 | 条目切分与合并 |
| `lane-state.js` | 215 | 分轨待提交状态 |
| `lane-controls.js` | 214 | 分轨控件事件 |
| `lane-render.js` | 281 | 分轨渲染 |
| `auto-submit.js` | 70 | 自动提交 |
| `modal.js` | 185 | 弹窗开关 |
| `commit.js` | 298 | 提交链路 |
| `cursor-split.js` | 285 | 游标切分 |
| `compat-surface.js` | 66 | 按原文逐字节重建冻结门面 |

关键技术点：

1. **`Object.freeze` 不妨碍访问器写入。** 门面里 `set pendingLinkedSplit(v)` 仍然可调用，冻结只锁属性描述符的增删，所以重建时把原文的 `get`/`set` 成对搬过来即可，不需要改变门面的可写性语义。
2. **门面由原文字面量文本重建**，而不是按名字表重新生成。键顺序、简写属性、访问器对全部保持原样，这是"剥掉 `U.` 前缀后逐字节一致"这条证据的前提。
3. **`pendingLinkedSplit` 的跨模块写入**改写为 `U.pendingLinkedSplit = v`，由 `pending-state.js` 发布读写访问器。与原来共享闭包里的 `let` 可证明等价：读写仍落到同一个存储位置。
4. **外部 53 个键的调用点一行不改**，`window.MaweSplitCore` 的出口形状由 `tests/test_editor_assets.py` 新增的块顺序契约锁定：`namespace.js` 必须在块首、`compat-surface.js` 必须在块末、模块导出不允许重名、门面键集合必须与模块导出集合完全相等。

三层差分（`editor/split/core.js` → 12 模块，改动前后各加载一次）：

| 层次 | 做法 | 结果 |
| --- | --- | --- |
| 结构 | 两次上下文的顶层键、类型、可枚举性逐项比对 | 0 处差异 |
| 源码 | 每个模块剥掉 `U.` 前缀后与原文件对应区间逐字节比对 | 12 个文件，0 处不一致 |
| 行为 | 对可调用导出与可枚举属性发起 2499 次调用，比对返回值与抛错 | 0 处差异 |

仓库内落盘的 12 个文件与通过差分的 dryrun 产物 sha256 逐一相同，因此差分结论直接适用于提交内容。

## `editor/text/timed-edit.js`：839 行 → 7 个模块

"整轨文本编辑"面板的主闭包：834 行、顶层一条语句，对外出口 `window.MaweTimedTextEdit`（32 个键，同样 `Object.freeze`）。

| 模块 | 行 | 职责 |
| --- | ---: | --- |
| `namespace.js` | 13 | 独占创建 `window.MaweText` |
| `source-state.js` | 63 | 当前轨别、待改段落、来源选区 |
| `row-diff.js` | 191 | 逐行差异的构造与渲染 |
| `view.js` | 218 | 面板开关、轨道切换、整体重绘 |
| `draft.js` | 217 | 草稿行与 DOM 同步、差异报告调度 |
| `apply.js` | 199 | 把草稿应用回段落并与隐藏字幕合并 |
| `compat-surface.js` | 44 | 按原文逐字节重建冻结门面 |

与 `editor/split/*` 的区别只有一点：**这块没有跨模块写入的可变状态**（改写器报告 foreign-written 为空），因此门面的 32 个键全是数据属性，不含访问器对；契约测试也不检查访问器，改为断言"目录内脚本必须连续装配"。

工具链在这一块完成了通用化：`mawe_split_mod.mjs` 与它的差分脚本原来写死 `editor/split/core.js`，现在按 `<root> <config.json>` / `<dryrunRoot> <area> <exportTarget> <oldRelPath> <report>` 传参，第四块（`ui/elements.js`）起直接复用。通用化的同时用旧配置复跑了一次 `editor/split/` 差分（53 键、2499 次调用、0 差异），确认改动没有让已提交的结论失效。

三层差分：结构层 32 个键的键名键序、属性种类、frozen 状态全部一致；源码层 32 个顶层声明剥前缀后逐字节一致；行为层 1568 次调用零差异。落盘的 7 个文件与通过差分的 dryrun 产物 sha256 逐一相同。

## `editor/ui/elements.js`：1200 行 → 18 个按 UI 区域划分的模块

全编辑器的 `getElementById` 集中在一个 1195 行闭包里：295 个引用平铺，看不出某个界面需要哪些元素；对外是冻结门面 `window.MaweDom`（295 个键，其中 5 个是访问器）。这块和前几块性质不同——没有函数，只有加载期求值的引用与少量 `let`，所以按**使用者所在的 UI 区域**划分，而不是按抽象层次：

| 模块 | 行 | 区域 |
| --- | ---: | --- |
| `namespace.js` | 13 | 创建 `window.MaweElements` |
| `shell.js` | 60 | 顶部计数、搜索框、遮罩与其开关 |
| `subtitle-appearance.js` | 76 | 主/副字幕预览外观控件 |
| `player.js` | 72 | 播放器容器与进度、音量、倍速 |
| `behavior-settings.js` | 99 | 切分、合并、列表与编辑面板行为开关 |
| `ninja.js` | 64 | 忍者模式、剃刀工具、斜杠特效 |
| `help-panel.js` | 92 | 帮助面板（含主题开关与定位键） |
| `interaction-settings.js` | 53 | 点击行为、键盘参照、悬停预览、吸附 |
| `timed-edit-refs.js` | 125 | 整轨文本编辑面板与其草稿/报告状态 |
| `media-export-modals.js` | 120 | 贴纸、工程媒体与 FCP7/Lottie/Ograf 弹窗 |
| `cue-panel.js` | 72 | 右键菜单与字幕详情面板 |
| `project-actions.js` | 48 | 保存工程与导出下拉 |
| `multi-subtitle.js` | 165 | 多字幕轨道开关、设置与导入/拆分弹窗 |
| `settings-panels.js` | 132 | 设置分组面板、自动保存、最近工程 |
| `gap-remove-panel.js` | 112 | 去空隙面板 |
| `auto-merge-panel.js` | 57 | 自动合并面板 |
| `subtitle-extend-panel.js` | 44 | 字幕延展面板 |
| `compat-surface.js` | 312 | 按原文逐字节重建冻结门面 |

区域边界按声明所在行切，少数错位的声明（帮助面板的两个定位键、波形形状来源选择器）显式改判到语义所属模块；划分本身由 AST 生成（`mawe_elements_cfg.mjs`），295 个名字逐个断言"有且只有一个归属"，不手写清单。契约测试额外守住两条：区域模块任一文件不得超过 200 行（拆它的意义就是消灭千行文件），发布符号数不得少于 280（防止搬运中丢引用）。

### 途中挖出的不变量：门面 setter 必须让 owner 同时发布 setter

门面的 295 个键里有 5 个是 `get`/`set` 成对的可变状态（`hideDisabled`、`mediaSeekInputLastValue`、`timedTextEditDraft`、`timedTextEditReturnFocus`、`timedTextEditReportTimer`），块外有 11 处直接经门面赋值（`editor/boot/entry.js`、`appearance/display-settings.js`、`playback/step.js`、`server/save.js`，以及本轮刚拆出的 `text/timed-edit/view.js` 与 `draft.js`）。

改写器原来只在"块内其他模块写入该名字"时才让 owner 发布 `set`，而**块外经门面的写入它看不见**。于是 owner 只发布 getter，出口重建后 `set x(v) { U.x = v; }` 在严格模式下抛 `TypeError`——单元测试环境不加载这些脚本，只有真实浏览器点到的时候才炸。这是本轮唯一一个"差分与测试都可能放过、只有不变量分析能抓住"的坑。

修法是取更普遍也更好证明的条件：**原始门面里存在 setter 的键，owner 一律发布 get/set 对**。这与拆分前"整个闭包共享一个 `let`、外部经出口读写"逐字等价，不依赖"外部到底有没有人写"这种会漂移的事实。

### 差分工具为引用表加固

`MaweDom` 这种纯引用表让原三层差分的两层失效（没有函数可调、每个值的 `typeof` 都是 `object`），因此：

- 假 `getElementById` 返回**带 id 的假元素**，结构层逐键比对取值指纹（`el:<id>`）。此前只比 `typeof`，`nowEl` 错指到 `searchEl` 也是 `object === object`。
- 写探针从"只探第一个访问器键"改为**逐个全探**，5 个 setter 全部验证经出口写入后读回一致。只探一个会让其余键的 setter 缺失溜过去，正是上面那个坑的形态。

结果：295 个键的键名键序、属性种类、取值指纹全部一致；295 个顶层声明剥前缀后逐字节一致；行为层调用 0 次（门面里没有函数，这一层对本块无覆盖，不冒充覆盖）。落盘的 18 个文件与通过差分的 dryrun 产物 sha256 逐一相同。

工具加固后**复跑**已提交的 `editor/split/`（53 键、2499 次调用）与 `editor/text/timed-edit/`（32 键、1568 次调用）两块，仍为零差异；加固前的改写器复跑这两块，产物与仓库文件也逐字节相同——即新加的 `facade-setters` 条件不改变已完成块的输出。

## `editor/i18n/i18n.js`：1119 行 → 7 个文件

### 结构与切法

这个文件的"巨型"和前面几块不同：主体是两张词典。`EN_TEXT`（525 行，中文原文 → 英文文案，约 450 条）
与 `EN_ATTR`（197 行，中文 → 英文 `aria-label` / `title` / `placeholder`）。真正的逻辑只占约 160 行，
核心是 `translateText` —— 一条**按顺序命中的 70 分支链**，前面是精确匹配，后面是大量正则，顺序决定结果。

因此按"词典 / 语言状态 / 文本规则 / DOM 翻译"四类切，而不是按行数平均切：

- `namespace.js`（12）：`MaweI18n`，**不冻结**（`applyLanguage` 要写 `language`）。
- `dict-en-text.js`（540）/ `dict-en-attr.js`（210）：两张词典各自成文。**不再按首字继续二分** ——
  扁平词典没有自然分界，为了行数再切只会制造两本需要来回翻的半册词典。
- `language-state.js`（72）：`language` 本身及其读写（`normalizeLanguage`、`persistLanguage`、
  `languageFromLaunchUrl`、`readLanguage`）。
- `text-patterns.js`（229）：`translateText` 与 `validateTranslationKeys`，整条链不拆散。
- `dom-translate.js`（130）：`translateTextNode`、`translateAttributes`、`translateTree`、`refreshToggle`、
  `applyLanguage`、`installDialogTranslation`、`start`。
- `compat-surface.js`（26）：重建**未冻结**的 `MAWE_I18N`。

### 途中踩到的三个坑（都回写到工具，不是只改本次产物）

1. **导出之后的顶层语句被静默丢弃**。本块在 `global.MAWE_I18N = …` 之后还有三条语句
   （`global.MAWE?.register('i18n', …)`、`if (typeof document === 'undefined') return;`、
   按 `readyState` 挂 `DOMContentLoaded` 或直接 `start()` 的分支），落在"导出语句 → 文件末尾"
   这段此前被当作固定尾巴的区间里。改写器把这段解析出的声明按归属搬走，却把剩余语句标成丢弃，
   产物里再也看不到它们 —— 报告只多写一行"丢弃 3 条顶层语句"，不细看就会漏。
   修复：新增 `tail` 通道，把导出之后的语句原样重新发射进兼容出口的赋值之后，并强制要求这段不得包含声明。
   **为什么是原样保留顺序，而不是把它们搬进靠前的模块**：`start()` 必须在新语言真正生效之后运行，
   提前执行等于改变初始化语义。今天可复核的证据：`compat-surface.js` 头部注明这 3 条语句的行号
   （L1110、L1111、L1113）并把它们跟在出口赋值之后原样列出，改写报告对应一行 `tail 3`。
2. **差分脚本给块内部命名空间打了桩**。为别的块加的 `MaweI18n: { t: … }` 挡板会让新产物的
   `namespace.js` 直接抛出"必须在 `web/` 清单之前初始化且只初始化一次"。已删除，并在挡板表里写明：
   内部命名空间永远不能预置。
3. **简写属性的改写被源码层当成差异**。跨模块引用会把 `{ language }` 改写成 `{ language: U.language }`，
   只剥 `U.` 前缀的比对把这判成源码差异。剥前缀后再折叠一次 `x: x` → `x`（JS 里两者本是同一件事）；
   名字不同的 `{ x: U.y }` 不会被折叠，真接错仍会暴露。

另外给差分脚本补了两处能力，专门覆盖本块这种"访问器是唯一可变出口"的形态：结构层逐键比对**值指纹**
（`typeof` 之外再记录函数字面量源码、原始值、嵌套字典的键集合，否则 `language` 被接到另一张字典上照样能过）；
行为层在每个调用之后比较**共享状态**（`applyLanguage` 的返回值恒为 `undefined`，只比返回值等于没比）。

### 验证

- 差分：结构层 5 个键的键名键序、属性种类、是否冻结（两侧都是 `false`）、值指纹全部一致；
  写入语义探针按预期跳过 —— 兼容出口的 `language` 从来只有 getter，外部没有写入口，拆分前后一致；
  源码层旧 IIFE 的 24 个顶层声明逐个剥前缀比对，**逐字节一致**；行为层出口面调用 **196 次、差异 0**
  （覆盖 `translateText` 的词典原文、词典译文、各正则分支、`按钮 {n}` 插值、纯计数、HTML 标签、空白串、
  未命中长句、`#徽标`、`00:00:00,000 --> 00:00:01,000` 时间轴行，`validateTranslationKeys` 用新产物自身
  导出的键集合分别喂 A/B，并在两侧各执行一次未打补丁的 `applyLanguage('en')` / `applyLanguage('zh')`），
  每次调用后再比对访问器键 `language` 的状态视图。结果 `NO DIFFERENCE DETECTED`。
- 产物一致性：7 个文件与已通过差分的 dryrun **sha256 全部相同**（`HASH_MISMATCHES=0`）。改写回归脚本
  已把本块加进去，四块一起复跑（split 12 + timed-edit 7 + elements 18 + i18n 7 = 44 文件）全部与仓库文件
  逐字节相同；三个已完成块的差分也重跑为零差异（差分脚本的公共挡板与源码归一化在本轮被动过，
  不重跑就不能说它们仍然成立）。
- 契约测试：`test_i18n_block_keeps_unfrozen_language_accessor` 断言模块连续、兼容出口里没出现
  `Object.freeze`、出口的 5 个键恰好是那 5 个历史键且每个都取得到内部符号、`language` 由
  `language-state.js` 以 `get`/`set` 访问器发布而其余模块不得再持有 `let language`、
  导出赋值与后面的注册及启动调用顺序未被调换。
  注意这块与其余三块不同：出口是历史契约（5 个键），内部命名空间还要装词典与选择器等内部符号，
  两者本来就不相等，所以只能单向断言，不能套"门面键集合 == 发布集合"。
- `tests/test_editor_utils.mjs` 原本**按文件路径**读 `web/editor/i18n/i18n.js` 再 `vm` 执行来取
  `window.MAWE_I18N`，删掉单文件后它在模块加载期就 ENOENT，整份 Node 套件一起挂。改为按清单顺序
  加载 `editor/i18n/namespace.js … compat-surface.js` 整块（与 `editor/lib` 块早就采用的做法一致），
  断言对象变成装配结果；252 项 Node 测试数量不变，说明覆盖面没有缩水。
- `uv run python edit.py --blank` 已重跑，`blank-editor.html` 内联副本由契约测试逐字节比对通过；
  `git diff --check` 无输出；ruff 全部通过。清单 **173** 条（167 − 1 + 7）。

## `editor/boot/entry.js`：2813 行平铺接线 → 35 个连续段（已修复）

### 为什么这块不能套用前几块的做法

前面几块（`utils.js`、`waveform/runtime.js`、`split/core.js`、`ui/elements.js`、`i18n/i18n.js`）都是**一个闭包**：拆它的动机是把闭包内部的符号重新安置，所以必须建内部命名空间、逐条改写引用、重建兼容出口，正确性只能靠 vm 差分证明。

`entry.js` 没有闭包。423 条顶层语句（388 条表达式、33 个 `if`、2 个 `const`）直接摊在共享的脚本作用域里，彼此只经 `MaweXxx` 命名空间对象联系，不存在"内部符号要往哪安置"的问题——它唯一的毛病就是长。

对这种文件，装配链的性质本身就是一条证明：`edit.build_editor_scripts()` 把清单里每个文件 `rstrip()` 后用 `\n\n` 连成**同一个 `<script>`**。所以"按行连续切段 + 顺序不变 ⇒ 拼出来的脚本逐字节不变"。不建命名空间、不改写任何一处引用、不做差分，也**不给它补门面**：门面是新的风险面，而这里没有任何需要它解决的问题。

### 切法与落位

35 段，切点全部落在两条顶层语句之间，段间零重排。按搬运的原文行数计，最大一段 `export-buttons.js` 206 行，最小一段 `leave-prompt.js` 5 行。

- `editor/boot/`（20 段）：`entry.js`（L1-35，启动前置）、`settings-init.js`（L36-170）、`settings-popovers.js`（L171-273）、`help-and-theme.js`（L274-355）、`settings-bindings.js`（L356-494）、`playback-settings.js`（L495-553）、`appearance-settings.js`（L554-613）、`gap-remove-panel.js`（L614-693）、`cue-panel.js`（L694-762）、`cue-list-tools.js`（L763-784）、`media-controls.js`（L888-921）、`preview-overlays.js`（L1775-1858）、`export-buttons.js`（L1859-2064）、`project-media-modal.js`（L2065-2109）、`load-media.js`（L2110-2142）、`load-media-file-input.js`（L2274-2289）、`global-events.js`（L2669-2722）、`boot-sequence.js`（L2723-2772）、`cue-list-filters.js`（L2773-2808）、`leave-prompt.js`（L2809-2813）
- `editor/boot/shortcuts/`（8 段）：`pointer-and-inline-edit.js`（L785-887）、`seek-and-lane.js`（L922-1014）、`space-and-jkl.js`（L1015-1098）、`cue-nav-and-select.js`（L1099-1264）、`cue-edits.js`（L1265-1418）、`tools-and-create.js`（L1419-1508）、`binding-align.js`（L1509-1606）、`split-key.js`（L1607-1774）
- `editor/boot/modals/`（7 段）：`multi-subtitle-import.js`（L2143-2189）、`split-modal.js`（L2190-2273）、`sticker-root.js`（L2290-2375）、`find-replace.js`（L2376-2413）、`text-process.js`（L2414-2498）、`timed-edit-modal.js`（L2499-2646）、`sticker-picker.js`（L2647-2668）

### 唯一的硬约束：段间不许重排

同一目标上的监听器按注册先后分发，事件注册顺序没有"挪一下应该没事"的余地；启动序列（`MaweWaveformInit.initWaveformEditor()` 那一段）在原文件里也**不**是尾巴，它后面还排着字幕列表筛选与离开提示。所以两条看起来"更合理"的整理动作其实都会改变语义，必须挡住：

1. **把只有几行的段并进邻居**。`load-media-file-input.js`（16 行）是本地媒体文件输入的 `change`/`cancel`，原文件里它就排在拆分弹窗之后；搬到 `load-media.js` 旁边就是重排。同理 `leave-prompt.js`（5 行）不并进 `cue-list-filters.js`。
2. **把启动收尾挪到块尾**。`boot-sequence.js` 后面还有两段是原样事实，契约测试直接断言"块尾不是 `boot-sequence.js`"。

切段用的三个判据（临时脚本，不入库）本身也要能被反证：

- `mawe_cut_check.mjs`：AST 逐条断言 423 条顶层语句**无一被切断**，且 35 段无缝无重叠地覆盖 2813 行。
- `mawe_cut_block.mjs`：去掉每段新加的头部注释后按顺序拼回，必须与原文件**逐字节相同**（`REBUILD EXACT`），否则拒绝承认成功。
- `mawe_cut_astcheck.mjs`：从**真实清单**里取这一串条目（顺带核对清单顺序与方案完全一致），按 `\n\n` + `rstrip` 复刻装配拼回去，与 `git show HEAD:` 的原文件逐语句比对源码（`ASSEMBLY AST IDENTICAL`，423 条全等）。

第三条曾经自测反证过一次：故意把头部注释插到某条语句中间，脚本如实报出该处语句源码不一致并以 3 退出——判据不是摆设。

顺带修的两处工具缺陷：段文件此前不带结尾换行，仓库里每个 `.js` 都以 LF 收尾，缺了它以后每次 diff 都会多一行 `\ No newline at end of file`；`area` 原来整份方案共用一个值，现在允许逐段指定，才可能把段分到 `shortcuts/` 与 `modals/`。

### 验证

- 域划分不靠猜。先把 423 条语句逐条导出成"行区间 + 调用签名 + 紧邻注释"的清单（`MaweDom.x.addEventListener` 这类只暴露被绑的 DOM 元素名），再据此定域；委派出去的粗粒度域地图在这里被当场纠正了几处（`L615-651` 报成"波形同步"实为空隙移除把手与面板数值输入、`L681-744` 报成"同步偏移"实为空隙面板的 Esc 与跳过播放、`L695-744` 报成"跟随模式"实为右侧字幕详情面板的文本框与表情包槽位），按签名清单重新划定。
- 三层判据全部通过（见上）；`git show --stat` 38 个文件，`entry.js` 从 2813 行缩到 38 行。
- 契约测试 `test_boot_wiring_is_cut_into_ordered_contiguous_chunks`：块内各段在清单里连续、子目录归属恰为 `shortcuts/` 与 `modals/`、`entry.js` 仍声明后面各段直读的两个顶层 `const`、每段都带「自 `web/editor/boot/entry.js` …连续切段而来」来源标记、块尾是 `leave-prompt.js` 且不是 `boot-sequence.js`、装配结果里 7 个地标的相对顺序不变。
- 清单 **207** 条（173 − 1 + 35），`editor/boot/` 共 37 条。清单头部新增一段说明：这一块的段间顺序就是注册顺序，必须连续且保持现有次序。
- Node 252/252（数量与拆分前相同，覆盖面未缩水）；`tests.test_editor_assets` 27/27；Python 全量 **999** 项，仅 5 项既有环境错误；ruff 通过；`git diff --check` 干净；`uv run python edit.py --blank` 已重跑并由产物契约逐字节比对。
- 未验证边界照旧：Node/Python 都在无 DOM 环境里跑，事件注册顺序、快捷键互抢、弹窗键盘流这些只能由浏览器证明，并入待做的累积 Playwright 回归。

## `shared/gap-remove-core.js`：1409 行单 IIFE → 13 个模块（已修复）

### 这块与前几块的两点不同

1. **它有两个注入方，第二个不在清单里。** 编辑器侧经 `editor/lib/gap-remove-bridge.js` 读出口；`server-align`（对齐页）在 `serve.py` 里按**文件路径**把整个文件读进页面。拆块后若注入源仍写死单个路径，页面里就只会出现切出来的第一小截，而 Node/Python 都不加载对齐页，只有浏览器打开时才报 `AsrGapRemoveCore must load before the alignment UI`。所以注入方式必须跟着一起改，不能只动 `web/`。
2. **出口只是内部面的一小部分。** 历史出口 `window.AsrGapRemoveCore` 冻结后暴露 **44 个键**，块内顶层声明有 **82 个**。`editor/split/*` 那几块的契约是"门面键集合 == 模块发布集合"，在这里天然不成立，只能单向断言"出口键是发布集合的子集、且键名与键序逐项相等"，再额外断言发布集合**更大**（防止有人把内部符号整体倒进出口）。

### 模块划分

按空隙数据流的依赖方向排布（规范化 → 来源还原 → 投影与显示 → 区间/来源写回 → 只读查询），职责即各模块头部注释：

| 模块 | 行数 | 职责 |
| --- | ---: | --- |
| `namespace.js` | 12 | 内部命名空间 `window.MaweGapRemove` 的唯一所有者，重复初始化直接抛错 |
| `constants.js` | 50 | 空隙模式、来源枚举与各类取值上下限（含投影缓存 `GAP_DISPLAY_PROJECTION_CACHE` 这个 WeakMap） |
| `limits.js` | 61 | JSON 深拷贝、整数钳制、禁用阈值换算与空隙拖拽模式判定 |
| `normalize.js` | 290 | 空隙列表与来源记录的规范化，以及整个 `gap_remove` 数据的入口规范化 |
| `state-apply.js` | 194 | 把区间写进空隙投影：置为移除/恢复、清理某段、并查合并，以及移动与边界调整记录的落地 |
| `provenance-ranges.js` | 111 | 从来源记录还原可见空隙区间，以及来源整体替换与手工恢复项追加 |
| `display.js` | 114 | 空隙的显示分类：来源优先级、受保护判定与按端点切片后的投影（带 WeakMap 缓存） |
| `provenance-edit.js` | 177 | 从来源记录里挖掉/清掉区间，以及吸收区间（absorb）的减法 |
| `range-edit.js` | 180 | 空隙整体平移/复制与边界拖拽的取值、覆盖区间、落地记录 |
| `provenance-move.js` | 197 | 移动与边界调整写回来源记录：去重、目标区间拆分与吸收 |
| `audio-detect.js` | 70 | 按波形峰值做静音检测（带滞回与前/后端预留） |
| `gap-queries.js` | 115 | 只读查询与播放跳转：已移除区间、禁用匹配、命中查找、跳过区间与时间映射 |
| `compat-surface.js` | 55 | 块尾门面：按历史键名与键序重建冻结出口 `window.AsrGapRemoveCore` |

原文件 84 个顶层分块，搬运 82 个，丢弃 2 个：`'use strict'`（提升为各模块头部）与 L1361-1407 的出口字面量（改由 `compat-surface.js` 重建）。加载期跨模块引用 44 条，顺序违规 0 条。

### 装配与注入

- `web/editor-scripts.txt`：`shared/gap-remove-core.js` 一条换成 13 条，清单 **207 → 219** 条。头部补一段说明：整块必须排在 `editor/lib/gap-remove-bridge.js` 之前（它在加载期就取出口并判空抛错）。
- `server-align/serve.py`：删掉 `GAP_REMOVE_CORE_PATH` 单文件常量，改为 `read_editor_scripts_under(GAP_REMOVE_CORE_AREA)`——注入源变成"清单里 `shared/gap-remove/` 前缀那一段按清单顺序拼接"，与 `edit.py` 装配编辑器用的是同一个函数、同一条 `\n\n` + `rstrip` 规则。外加占位符唯一性校验：`PAGE_CORE_PLACEHOLDER` 在页面里不是恰好出现一次就直接抛错，宁可炸也不静默注入半截。
- `server-align/index.html` 的占位注释同步改成"由 `server-align/serve.py` 注入，来源是 `web/shared/gap-remove/` 整块，按 `web/editor-scripts.txt` 顺序拼接"。

### 验证

差异测试（临时脚本，不入库；dryrun 产物与入库文件 13 个 `git hash-object` 全相同，所以验的确实是入库内容）：

- **vm 结构层**：出口 44 个键，键名与键序完全一致；非函数导出值逐个 JSON 深度比对通过（证明常量确实跨模块可见，不是各模块各留一份）。
- **源码层（AST）**：旧 IIFE 的 82 个顶层声明在新块里各恰好出现一次，剥掉 `U.` 前缀后逐字节一致，声明种类不变。
- **行为层**：用真实空隙/来源记录/波形夹具在出口面上发起 **4658** 次调用（每次调用前深度复制入参，避免被测函数改动夹具造成假差异），返回值与抛错逐项比对，差异 **0**。另加 WeakMap 投影缓存探针：同一数组两次取投影必须返回同一对象——跨模块拆分会把缓存切成两份，这条专防它。
- 结论 `NO DIFFERENCE DETECTED`。

判据被反证过两次，证明它不是摆设：

- 把一处**跨模块**引用从 `U.clampGapRemoveDisableCoverage(` 改成 `U.clampGapRemoveDisableRemaining(`，源码层与行为层同时报差异。（第一次尝试时改的是模块内部调用，没有 `U.` 前缀，差分如实保持沉默——它只覆盖跨模块边，跨模块边的改写正是被证的那部分。）
- 从 `compat-surface.js` 删掉一个出口键 `mapGapRemovedTime`，契约测试立刻 `AssertionError: Lists differ ... mapGapRemovedTime` 失败；文件随后从备份还原。

入库契约：

- `test_gap_remove_block_builds_the_frozen_legacy_exit_after_every_module`：块在清单里连续、`namespace.js` 首位、`compat-surface.js` 末位、整块先于 `editor/lib/gap-remove-bridge.js`、发布符号不重名、门面键序列与历史 44 键逐项相等、门面的 setter 键 ⊆ 发布键、发布键数量大于门面键数量。
- `test_alignment_page_injects_the_whole_gap_remove_block_in_order`：断言 `serve.py` 用 `read_editor_scripts_under(GAP_REMOVE_CORE_AREA)`，再按真实注入渲染页面，检查 `global.MaweGapRemove = {};` 先于 `global.AsrGapRemoveCore = Object.freeze({` 出现——"命名空间先建、出口后建"这条顺序在对齐页里同样成立。
- `tests/test_editor_utils.mjs` 与 `tests/test_waveform_js.mjs` 原本按单文件路径读 `shared/gap-remove-core.js` 再 `vm` 执行，删掉单文件后在加载期 ENOENT、整份 Node 套件一起挂。改为按清单加载整块（与 `editor/lib` 块一致的做法），断言对象变成装配结果。

分层结果：Node **252/252**（数量不变，覆盖面未缩水）；`tests.test_editor_assets tests.test_waveform` **46/46**，加 `tests.test_server_align` **56/56**；`tests.test_editor_assets` 单项 **29/29**（27 + 本块新增 2）；Python 全量 **1001** 项，仍是 5 项既有环境错误（子进程 `stdout` 为 `None`，或其读取线程按 GBK 解码崩溃；单独运行同样失败）；ruff 通过；`git diff --check` 干净；`uv run python edit.py --blank` 已按 219 条清单重生成并由产物契约逐字节比对。

未验证边界：对齐页在真实浏览器里的渲染与交互没跑过（本轮只证明注入的内容与顺序正确）；MAWE 侧空隙面板的拖动、边界调整、预览播放跳过，仍属待做的累积 Playwright 回归。

## 顺手挖出的重复与既有缺陷（仅说明）

这些是 46 个共享名普查的结果，不属于本轮改动范围，记录以免丢失：

| 发现 | 现状 | 处理 |
| --- | --- | --- |
| `normalizeKeyboardOperationReferenceMode` 在原 `utils.js` 里**声明并导出两次** | 函数声明提升使后者覆盖前者；两个实现对任意输入结果相同，因此线上无差异。兼容出口只保留首次出现位置，并在 `compat-surface.js` 头部注明 | 已修复（消除重复声明，行为不变） |
| `cloneJsonValue`、`clampInteger` 与 `shared/gap-remove/limits.js` 中的同名实现逐字节相同 | 纯复制，两处会各自漂移 | 仅说明：合并会跨层引入依赖，等 Phase 3 再定（本轮拆块只将引用路径改到新位置，未合并） |
| `editor/lib/settings.js` 与本块 `settings-normalize.js` 的钳制函数族**并不相同** | 同名近似、边界不同 | 仅说明：这是需要维护者判断的真实分歧，**没有**擅自统一 |
| `gap-remove` 相关的几个别名 | 是有意的桥接垫片，不是重复 | 仅说明：保留 |

## 进度账本

| # | 事项 | 状态 | 验证 |
| --- | --- | --- | --- |
| 1 | 装配链允许 `web/` 子目录脚本路径 + 清单级全量语法检查 | 已修复 | `7a862f9`；`tests/test_editor_script_syntax.mjs` 当时 104 个条目全通过（清单现为 167 条） |
| 2 | 77 个平铺脚本按层与域归入子目录 | 已修复 | `7ce93a9`；77 个 rename 全 100% 相似度；Python 资产契约 + Node 套件通过 |
| 3 | `editor/lib/utils.js` 4965 行单 IIFE → 28 模块 | 已修复 | `0246ca5`；Node 252/252；`tests.test_editor_assets` 通过；差分测试无行为差异；`blank-editor.html` 已重生成并逐字节比对 |
| 4 | Playwright 全量回归 | 已修复 | 累积全量（`f26d153`）17 失败 / 272 通过，对照基线 `7ce93a9` 16 失败 / 273 通过；失败标题集合差 = 0 消失 + 1 新增（`click-behavior.spec.mjs:365`）。该差项不再靠"单独复跑通过"或"commit 未触碰该路径"下结论，已用交替 A/B（7/7 vs 2/7）、逐用例状态转储、预置 `_dirty` 的构造性复现、以及五条 `_dirty` 链路文件 `git diff` 为空，归为既有测试隔离缺陷撞上既有产品行为（见「Playwright 全量回归的做法与既有失败」起的三节）|
| 5 | `editor/waveform/runtime.js` 5371 行拆解 | 已修复 | `0a39d8b`；30 模块（最大 526 行）；Node 252/252；`tests.test_editor_assets tests.test_waveform` 39/39；三层差分零差异；`blank-editor.html` 已重生成并由契约测试逐字节比对 |
| 6 | `editor/split/core.js` 1852 行拆解 | 已修复 | `d874d73`；12 模块（最大 321 行）；Node 252/252；`tests.test_editor_assets tests.test_waveform` 40/40；三层差分零差异；仓库文件与 dryrun 产物 sha256 相同 |
| 7 | `editor/text/timed-edit.js` 839 行拆解 | 已修复 | `e3d45ed`；7 模块（最大 218 行）；Node 252/252；`tests.test_editor_assets tests.test_waveform` 41/41；Python 全量 996 项仅 5 项既有环境错误；三层差分零差异（1568 次调用）；仓库文件与 dryrun 产物 sha256 相同；`blank-editor.html` 已重生成 |
| 8 | `editor/ui/elements.js` 1200 行拆解 | 已修复 | `51f02ea`；18 模块（区域模块最大 165 行，门面 312 行）；Node 252/252；`tests.test_editor_assets tests.test_waveform` 42/42；Python 全量 997 项仅 5 项既有环境错误；结构层 295 键含逐键 id 指纹零差异、5 个 setter 全部写探针通过；仓库文件与 dryrun 产物 sha256 相同 |
| 9 | `editor/i18n/i18n.js` 1119 行拆解 | 已修复 | `d259a21`；7 个文件（词典 540/210 行，逻辑模块最大 229 行）；Node 252/252；`tests.test_editor_assets tests.test_waveform` 43/43；Python 全量 998 项仅 5 项既有环境错误；三层差分零差异（出口面 196 次调用 + 每次调用后比对 `language` 状态）；仓库文件与 dryrun 产物 sha256 相同；改写回归四块 44 文件逐字节相同；`blank-editor.html` 已重生成 |
| 10 | `editor/boot/entry.js` 423 条平铺接线语句按接线域分组 | 已修复 | `62e2c49`；35 个连续段（最大 206 行，`editor/boot/` 20 + `shortcuts/` 8 + `modals/` 7）；三层判据通过（无语句被切断、去头拼回逐字节相同、按真实清单拼接与 `HEAD` 逐语句相同）；Node 252/252；`tests.test_editor_assets` 27/27；Python 全量 999 项仅 5 项既有环境错误；`blank-editor.html` 已按 207 条清单重生成 |
| 11 | 文档同步（AGENTS.md 的 `web/` 树、`docs/DEVELOPMENT.md`、网站开发页、基线文档） | 已修复 | 目录树、`MaweLib` 规则、`MaweWaveform` 原型混入顺序规则、门面 setter 硬性不变量、i18n 块"出口未冻结 + 内部面比出口大 + 导出后语句留在出口"这条例外、启动接线块"只能连续切段且段间顺序即注册顺序"这条硬约束，均已写入 `AGENTS.md` 与 `docs/DEVELOPMENT.md`；网站开发页由 `npm --prefix website run sync:docs` 重生成（只保留 `development.md`，其余 4 篇的既有漂移已还原，不夹带） |
| 12 | `shared/gap-remove-core.js` 1409 行拆解 | 已修复 | 13 模块（最大 290 行，最小 12 行）；`server-align/serve.py` 的单文件注入同步改为 `read_editor_scripts_under("shared/gap-remove/")` 按清单拼接，并加占位符唯一性校验；清单 207→219；三层差分零差异（出口 44 键键序一致、82 个声明逐字节一致、4658 次调用差异 0、WeakMap 投影缓存探针通过），且判据本身被两次注入故障反证；Node 252/252；`tests.test_editor_assets tests.test_waveform` 46/46（含 `tests.test_server_align` 为 56/56）；Python 全量 1001 项仅 5 项既有环境错误；dryrun 产物与入库文件 `git hash-object` 全相同；`blank-editor.html` 已按 219 条清单重生成 |

## 验证记录（分层，不互相冒充）

| 层次 | 命令 | 结果 |
| --- | --- | --- |
| 语法 | `node --test tests\test_editor_script_syntax.mjs` | 通过（219 条目，逐个编译） |
| 装配顺序/重名 | `node --test tests\test_editor_script_order.mjs` | 通过（含 `namespace.js` 首位、`compat-surface.js` 末位、跨模块重名检测） |
| 波形块顺序契约 | `test_waveform_prototype_mixins_load_after_the_class_and_before_the_exit` | 通过（≥10 个混入模块全部落在 `core.js` 之后、出口之前） |
| split 块顺序契约 | `test_split_block_builds_the_frozen_facade_after_every_module` | 通过（模块导出不重名，冻结门面键集合与模块导出集合完全相等） |
| 整轨文本编辑块顺序契约 | `test_timed_edit_block_builds_the_frozen_facade_after_every_module` | 通过（目录内脚本连续装配、导出不重名、门面键集合相等） |
| DOM 引用块契约 | `test_dom_elements_block_is_split_by_ui_region_and_stays_contiguous` | 通过（连续装配、门面键集合相等、发布符号 ≥280、5 个访问器键成对存在、区域模块 ≤200 行） |
| i18n 块契约 | `test_i18n_block_keeps_unfrozen_language_accessor` | 通过（连续装配、兼容出口未冻结、出口 5 个键恰为历史键且都取得到内部符号、`language` 由 owner 以 get/set 发布且其余模块不再持有、导出后的注册与启动调用顺序未变） |
| 启动接线块契约 | `test_boot_wiring_is_cut_into_ordered_contiguous_chunks` | 通过（块内各段在清单里连续、子目录归属为 `shortcuts/` 与 `modals/`、`entry.js` 仍声明两个顶层 `const`、逐段带来源标记、块尾是 `leave-prompt.js` 且不是 `boot-sequence.js`、7 个地标的相对顺序不变） |
| 空隙核心块契约 | `test_gap_remove_block_builds_the_frozen_legacy_exit_after_every_module` | 通过（块连续、`namespace.js` 首位、`compat-surface.js` 末位、整块先于 `editor/lib/gap-remove-bridge.js`、发布符号不重名、门面 44 键逐项等序、setter 键 ⊆ 发布键、发布键多于门面键） |
| 对齐页注入契约 | `test_alignment_page_injects_the_whole_gap_remove_block_in_order` | 通过（`serve.py` 用 `read_editor_scripts_under(GAP_REMOVE_CORE_AREA)` 注入；按真实注入渲染后，`MaweGapRemove` 的创建先于 `AsrGapRemoveCore` 的冻结出口） |
| JS 单测 + lib/waveform 契约 | `node --test tests\test_editor_script_syntax.mjs tests\test_editor_script_order.mjs tests\test_editor_utils.mjs tests\test_waveform_js.mjs tests\test_editor_runtime.mjs` | 252/252 通过 |
| Python 资产契约 | `uv run python -m unittest tests.test_editor_assets tests.test_waveform` | 46/46 通过（加 `tests.test_server_align` 为 56/56；`tests.test_editor_assets` 单项 29/29） |
| Python 全量 | `uv run python -m unittest discover -s tests -p "test_*.py"` | 1001 项，5 错误全部为既有环境问题：子进程 `stdout` 为 `None`，或其读取线程按 GBK 解码崩溃（`test_gui_workflow` ×2、`test_local_editor_server` ×1、`test_local_runtime` ×2；单独运行同样失败，与本改造无关） |
| Lint | `uv run --frozen ruff check .` | 全部通过 |
| 空白 | `git diff --check` | 干净 |
| 产物一致性 | `test_committed_blank_editor_is_regenerated_from_web_sources` | 通过（提交内容与 `web/` 重新生成结果逐字节一致） |
| 浏览器交互 | `npx playwright test`（workers=1，必须串行） | 全量 289 项：累积 `f26d153` 17 失败 / 272 通过，对照基线 `7ce93a9` 16 失败 / 273 通过；标题集合差 = 0 消失 + 1 新增（`click-behavior.spec.mjs:365`），该差项已逐状态归因为既有测试隔离缺陷撞上既有产品行为，非本轮引入（见下两节）。`shared/gap-remove/` 拆块发生在这次回归之后，未被它覆盖，缺口记在该节「未验证边界」 |

`test_editor_script_payload_follows_manifest_order` 不再维护一张与清单 1:1 的"标记表"（拆细模块会让它错位），改为从每个脚本源码取第一行非注释行作为标记，在整包里顺序查找。

### Playwright 全量回归的做法与既有失败

浏览器回归不能只看"失败数一样"， timing 类失败会随机漂移。做法是在 `7ce93a9`（搬家完成、尚未拆任何闭包）另开一个对照 worktree，跑同一套 spec，然后**逐条比对失败标题集合**而不是比数字。两次运行必须串行：并发跑时资源竞争会凭空多出 timing 失败（实测出现过 `click-behavior.spec.mjs:365` 和多条 multi-subtitle 超时，串行后全部通过）。

- 累积全量（`f26d153`，`utils` / `waveform` / `split` / `timed-edit` / `elements` / `i18n` / `boot` 全部拆完）：17 失败 / 272 通过。
- 对照基线 `7ce93a9`（同机串行、全新一次全量）：16 失败 / 273 通过。
- 把两份报告的失败标题做成集合比对（脚本取标题、不靠眼看）：**0 项消失，唯一新增**是 `tests/e2e/click-behavior.spec.mjs:365 › Escape exits inline cue editing without saving the text`。
- `split/core.js` 及之后的拆分不逐次跑全量：并入上面这一次累积全量回归，每块的正确性由各自独立的三层差分证据承担。

基线既有的 16 项（拆分之前就存在，本轮不修；修 spec 或调超时属于另一件事，且会掩盖真实问题）：

```text
click-behavior.spec.mjs:56    media seek buttons and arrow keys use the configured seek duration
cue-color-filter.spec.mjs:65  clicking a row shows only that color; checkboxes multi-select; clear restores all
launcher-interactions.spec.mjs:109/162/217/273/301/328   运行时错误提示相关 6 条
multi-subtitle.spec.mjs:117/338/860/3638                multi-subtitle 长流程 4 条
waveform-history.spec.mjs:108/372/756/1800              波形历史/空隙 4 条
```


### 唯一差项 `:365`：撤回"加载抖动"这个判定

本节先前把它写成加载抖动，证据是"单独复跑该 spec 通过（1.2s，全量跑时它在 5.9s 超时）"和"`git show --name-only 0a39d8b` 没碰 inline cue 编辑与 Escape 路径"。**两条都不成立**，已撤回：

- 单独复跑通过，只能证明"干净工程下它通过"，恰恰不能区分"它抖动"与"它依赖工程文件状态"。后来在 HEAD 上按整个 spec 文件连跑 3/3 失败，当场反证。
- "这条 commit 没改相关路径"是范围论证。本轮改的正是脚本装配顺序与页面加载结构，时序本身就在改动范围内，不能用它排除因果。

正确的做法是同一 worktree 内交替 checkout 两个 rev、跑同一份 spec（避免机器差异），逐轮记录该用例结果：

| 批次 | 条件 | HEAD `f26d153` | 基线 `7ce93a9` |
| --- | --- | --- | --- |
| 交替 A/B 7 轮 | 同一份未加探针的 spec | 7/7 失败 | 2/7 失败（第 1、2 轮），单侧 Fisher p≈0.0105 |
| 追加 2 轮 | afterEach 带逐用例状态转储、`beforeEach` 多 2.5s 等待 | 2/2 失败 | 0/2 失败 |

HEAD 命中率高是事实，不需要否认。但它不是语义差异，下面逐状态实测到了根因。

### `:365` 的真实机制：用例间共享工程文件 + 400ms 防抖自动保存

同一个 spec 文件里所有用例共用一个 server 与一个 `project.json`。前一条用例 `:329 › Escape keeps cue-panel text edits by default` 在右侧详情面板留下的编辑会置 `segments[0]._dirty = true` 并调用 `MaweServerSave.scheduleAutoSaveFlush()`；`web/editor/lib/json-repair.js:31,59` 明确把 `_dirty` 序列化进工程 JSON（注释写着"便于二次打开时仍能识别脏行 / 离开提醒"）。于是 `:365` 可能加载到一个第 0 条已标脏的工程，行在渲染时就带 `dirty` class（`web/editor/ui/cue-elements.js:119,192`），而 `web/editor/cues/inline-edit.js:293-294` 的 `finishEdit(save)` 只在 `save` 分支 `classList.add('dirty')`，取消分支从不 `remove`。此时 `:365` 的 `await expect(cue).not.toHaveClass(/dirty/)` 在这个页面状态下**不可满足**。

逐用例转储（afterEach 打印内存标记数量与工程文件里的脏下标），同一条用例在两个 rev 上的差别：

```text
HEAD  轮  :329 结束 {"seg":0,"unsaved":false,"onDisk":[0]}   :365 结束 {"seg":1,"unsaved":true,"onDisk":[0]}
基线  轮  :329 结束 {"seg":0,"unsaved":false,"onDisk":[]}    :365 结束 {"seg":0,"unsaved":false,"onDisk":[]}
```

即全部差在"那条 400ms 防抖落盘有没有赶在下一条用例 `page.goto` 之前完成"。

构造性证明（临时 spec，跑完已入回收站）：把 `generateProjectJson` 产物的 `segments[0]._dirty` 直接置真再启服务，其余步骤与 `:365` 逐字一致（`goto` → `dblclick .cue[data-idx="0"] .text` → `fill` → `page.keyboard.press('Escape')`）：

```text
预置脏  进入 {"dirty":true,"cls":"cue dirty"}                 取消后 "cue dirty selected active"   → class 不掉
干净工程 进入 {"dirty":null,"cls":"cue"}                      取消后 "cue selected active"        → 无 dirty
```

各 1/1 确定性复现。唯一变量就是工程文件里的 `_dirty`，与抖动窗口之外的任何东西无关。

代码层面为何与本轮拆分无关（可复跑）：

```powershell
git diff 7ce93a9..HEAD -- web/editor/lib/json-repair.js web/editor/server/save.js web/editor/project/save.js web/editor/ui/cue-elements.js web/editor/cues/inline-edit.js web/editor/cues/panel.js
```

输出为空——`_dirty` 的置位、持久化、加载、未保存判定、行 class 这五条链路的文件，在基线与 HEAD 之间逐字节相同。

定性：**既有测试隔离缺陷**（用例间共享工程文件，防抖自动保存异步落盘）**撞上既有产品行为**（取消的行内编辑不清 `dirty` class）。HEAD 只是把这条竞态撞中的频率显著抬高。修 spec（每条用例独立工程文件或等 flush 收敛）与修产品行为都是另一件事，本轮未擅自改，等维护者定。

### 顺手挖出的两个既有产品行为（仅说明，未修改）

| 发现 | 实测证据 | 处理 |
| --- | --- | --- |
| 取消的行内编辑仍留着 `dirty` class | `finishEdit(save)` 只在 save 分支加 class，取消分支不 `remove`；行 class 只有在下一次顺带重渲染时才与模型对齐 | 仅说明：改法（取消时 `remove('dirty')` 还是按模型重算 class）需要维护者定 |
| 已取消的**面板**编辑仍会以 `_dirty` 落盘 | 面板 `input` 立即置 `_dirty` 并 `scheduleAutoSaveFlush()`（400ms），之后的 Escape 只回滚内存；实测 2s 后内存标记全假而文件仍写着 `[0]`，重开工程"人工改过"标记复活 | 仅说明：静默自动保存会把"用户已撤销的编辑"的脏标记持久化，是否可接受由维护者判断 |

上面 16 项里有一条值得单列：

`tests/e2e/cue-color-filter.spec.mjs:65` 在本轮改动之前的 `HEAD`（对照 worktree）上同样失败，**不是**本轮引入：`#color-filter-menu .color-filter-clear` 解析到 2 个元素——"全选过滤结果"按钮复用了 `.color-filter-clear` 类，spec 未随之更新。属陈旧 spec，未擅自修改（改 spec 会掩盖"这个类到底该不该复用"这个真实问题）。

## 未验证边界

- Node 与 Python 测试都在假 `window` / 无 DOM 环境里跑，覆盖不到拖动、播放、Seek、布局。
- Playwright 不覆盖便携单文件的真实双击打开路径；便携 HTML 目前只有生成一致性证据。
- Tauri 构建（`build.rs` 的 `editor_script_path`）未在本机跑 `cargo`，只有 Rust 侧语法与共享清单契约证据。
