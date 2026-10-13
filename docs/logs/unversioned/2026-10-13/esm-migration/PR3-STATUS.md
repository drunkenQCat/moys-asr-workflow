# PR-3（显式装配，消除人工维护的装配信息）执行账本

分支：feat/editor-esm-pr3-explicit-assembly（基线 PR-2 = 5ddf45b5）。
目标：清单顺序被显式依赖/启动流程取代前不删 `editor-scripts.txt`；
最终构建、源码运行、测试加载器、新鲜度检查全部不再读取清单。

## 现场清点（证据）

- 终态装配 compileEsmEntry：两阶段生成器（全量 phase-1 提升 → 清单序
  phase-2 交错 register），188 输入 / 61 工厂 / 8 桥。
- import 图 110 条 manifest 内边中 72 条前向边——两phase 才能承载；
  图本身有环（wiring 文件互相引用），拓扑序不存在。
- 38 个文件的 phase-2 含直接 DOM 接线；editor-startup 的 phase-2 是
  真正的启动序列（时间码修复/渲染/桥接/服务器监视）。
- 打乱实测（.worktrees/replay/shuffle-probe，不入库）：全清单反转
  与「首 10 固定+其余反转」都启动崩溃（Cannot destructure /
  reading 'DATA'）——清单位次被真实消费，红灯事实成立。

## 批 1：红灯测试（已完成）

- tests/test_assembly_contracts.mjs（node，行为面）：
  - C1 桥：活访问器——getter 读到实现、mutable 桥写回源绑定、
    const 桥 TypeError；真实登记表 8 桥名称/文件存在性。
  - C2 顺序：boot 置于消费者之后 → vm 启动崩溃；正常序 → 数据可见。
  - 注册表契约原计划 vm 断言 61 注册名，实测真实 bundle phase-2 在
    vm 里 DOM 面持续加深（documentElement.lang、URLSearchParams、
    …），假桩不可信（PR-2 教训重演）→ 移到 e2e。
- tests/e2e/assembly-order.spec.mjs（真页面，5 条）：
  - O1 启动行为全链（渲染/波形/导出/合并撤销）；
  - O2 初始化 trace 与清单全等、首 editor-boot、末 onboarding；
  - O3 注册名覆盖登记表 61 项且无重复（运行时另有 6 个代码内注册
    门面：editor-host/waveform/editor-commands/editor-state/
    editor-view-updates/editor-utils——登记表收缩时要一并处置）；
  - O4 8 桥真页面活访问器；写语义实测：ASS_STYLE_LIBRARY（let）
    写回，7 个函数名桥只读（转换器 getter-only）——登记表
    mutable 标记对函数名是假的，批 3 修；
  - O5 顺序红灯：PR1 classic 树打乱（boot 后置）→ 真页面启动崩溃
    （bridge=false、trace 停在 1、pageerror reading 'DATA'）。
- 验证：node 2/2、e2e 5/5、check:editor 新鲜。

## 批 2a：入口显式化（已完成）

入口不再按清单位次消费初始化：`compileEsmEntry` 重构为
注册表创建 → 61 工厂统一注册 → 桥 → **显式 bootstrap 序** →
其余 classic phase-2 清单序。登记表新增 `bootstrap` 数组（14 文件，
注册表创建者 editor-runtime 固定头部先行）。

### 顺序敏感面实测（分析工具见 .worktrees/replay/analyze-order*.mjs，不入库）

- 直接跨文件门面边 112 条（IIFE 立即执行体计为顶层）；
- 发布者子图内部仅 1 条边（editor-state 读 MaweBoot）；
- utils/waveform phase-2 在顶层 resolve 工厂 → 注册先行的前提；
- utils-ass-canvas-layout 等 7 个 phase-2 自注册门面不在 61 工厂表内；
- editor-dom 等 40+ 发布者由消费者延迟读取（存储型函数体）。

### 契约（O2 更新为显式序）

trace = [runtime] + 61 工厂（登记表序）+ bootstrap（登记表序）+
其余清单序；`buildEditor` 返回 `initializationOrder` 作为权威，
E6（full-verify）与 e2e O2 都与它比对；E6 bootShape 的注册名
比较改为集合语义（次序归 initializationOrder 管）。

### 红灯与绿灯

- O5a（红）：bootstrap 序内把 editor-boot 挪到消费者之后 →
  真页面启动崩溃（bridge=false、trace 停 62、pageerror reading DATA）。
- O5b（绿）：bootstrap 内无耦合相邻对（i18n↔tooltip）互换次序 →
  行为完全一致。
- 全量打乱在当前代码下必然红（wiring 层 109 条跨文件边仍依赖
  位次，接线的读写大多在事件回调里延迟执行，静态分析无法证明
  「叶」），故全量打乱绿灯是批 4 终态目标，不提前伪造。

### 验证

| 层 | 结果 |
| --- | --- |
| node 全量 | 608/608（+2 契约） |
| 装配契约 E1-E10 | 9/9 |
| e2e assembly-order | 6/6（O1-O4、O5a 红、O5b 绿） |
| e2e waveform-history | 53/2*（*两失败与 PR-2 账本记录的 main 既有失败同名同数） |
| e2e click-behavior | 36/36 |
| typecheck | 110 基线 / 新增 0 |
| check:editor / check:launcher | 新鲜（launcher bundle 因构建器哈希联动重建） |

## 批 2b：全量 classic 显式序（已完成）

- 尝试 1：用静态分析（IIFE 感知的顶层执行扫描）算 146 条直接边的
  Kahn 拓扑序替换 bootstrap——真页面验证崩溃（MaweCueElements
  undefined）：存储型函数体内的延迟读取无法静态判别执行时点，
  保守口径下切片为 0。结论：静态重排不可靠，放弃。
- 尝试 2（采纳）：**bootstrap = 当前清单的 classic 全序**。生产
  清单序已被证明满足全部直接约束，把它整体搬进登记表 bootstrap
  数组后，入口不再消费清单位次——清单只剩「打包文件集」职责。
- O5b 升级为**整份清单反转**绿灯：phase-2 执行序完全由显式
  bootstrap 序决定，打乱清单后 188 文件初始化、注册、波形、
  桥接全部一致。
- 试错教训（静态启发式三连败：遗漏 IIFE 体、漏 IIFE 内嵌声明的
  函数调用、Map.values().flat() 对 Set 无效）记入账本防复发。

### 验证

| 层 | 结果 |
| --- | --- |
| node 全量 | 608/608（2 个 process-lifecycle 用例首轮超时、复跑 22/0，并行负载抖动，与本批无关） |
| 装配契约 E1-E10 | 9/9 |
| e2e assembly-order | 6/6（O5b=全量清单反转绿灯） |
| e2e 全量复跑 | waveform-history 53/2*（*与 main 既有同名同数）、click-behavior 36/36、ai-cleanup+multi-subtitle 90/90、i18n/drop/new-project/keyboard/ass-export 88/88 |
| typecheck | 110 基线 / 新增 0 |

## 批 3：登记表收缩（已完成）

- 构建期校验 `validateRegistry`：①工厂注册名必须有消费来源
  （某源码存在 `MAWE.resolve('<name>')` 字面量，61/61 全命中）；
  ②注册名查重；③externalBridges 的 mutable 标记与 owner 绑定
  种类强校验——函数名声明（转换器 getter-only）与 const 绑定
  不得声明 mutable。
- mutable 假标记修正：6 个函数名桥（loadAssStyleLibrary 等）
  mutable true→false；ASS_STYLE_LIBRARY（let）保持 true。
  O4 桥写语义契约与登记表现已一致。
- modules 列表保留为显式登记（注册名↔文件配对无可靠推导信号，
  「单 export create*」约定仅覆盖导出名推导）；来源存在性+查重
  由构建期强制，人工维护面收缩为「新增工厂时同步 resolve 消费」。
- 代码内自注册门面（editor-host/waveform/editor-commands/
  editor-state/editor-view-updates/editor-utils/utils-ass-canvas-layout）
  清点入账本，O3 契约按「登记表工厂必须全部在列」断言。

### 验证：node 契约 2/2、装配契约 9/9（复跑）、e2e assembly-order 6/6、check:editor 新鲜。
