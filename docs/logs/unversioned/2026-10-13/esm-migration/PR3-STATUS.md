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
