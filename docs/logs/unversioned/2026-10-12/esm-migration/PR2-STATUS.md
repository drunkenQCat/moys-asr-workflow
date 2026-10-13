# PR-2（全量 ESM 真化）执行状态账本

基线：feat/editor-esm-pr1-foundation（PR-1 = cherry-pick 5ba2baa1+ddb36b7a，已验证）。
分支：feat/editor-esm-pr2-full-esm。隔离副本：.worktrees/esm-full/{baseline,naive,full}（不入库）。

## 已完成（有证据）

- 转换器工厂时代适配：full-convert（61 工厂透传、consumers 幂等）、research.mjs
  （inventory/逐文件解析 ESM 感知）、full-build→生产构建器垫片、
  build-editor.mjs 终态装配 compileEsmSources（两阶段入口：全量提升→清单序
  交错执行/注册；externalBridges 经 legacyBindings 挂载）。
- 契约门禁 E1–E10：9/9 全绿（E6 = 真实 file 页 + localhost 行为探针：
  工程注入/共享状态写/导出 SRT 全过）。教训钉子：①eslint-scope 与生成器
  两轮 .next() 驱动缺一不可（漏第二轮=语句不执行，静默）；②每改
  build-editor.mjs 必须 --write 重建再跑 E4/E6；③语义夹具无
  editor-modules.json → readModules/configText 必须可选化。
- 副本 node 全量：616 项 580 pass / 36 fail（自 55 收敛）。

## 剩余 36 失败（~10 文件，类别与修法已证）

1. 直读 vm 模式（已证修法：readFileSync(web 模块)→compileEditorFixture(file)）：
   test_ai_cleanup_local_export（slice 切片段型，需手工改为整模块 bundle+断言内联）、
   test_shared_tooltip_browser、test_asr_presets_browser。
2. window.MAWE 上下文垫片：test_editor_history_gestures（12 例，MAWE 需挂
   context.window 内；补后仍有注册点需逐个对位）。
3. bundle 契约迁移（预期项）：test_editor_bundle×2（compileSources 旧装配
   断言→compileEsmSources 契约）、test_launcher_bundle×2（launcher 仍走
   旧装配，失败原因待查——疑 meta/builderHash 联动）。
4. 退役项：test_editor_script_order（import 图取代顺序断言）。
5. adapt-production-types.mjs 为上游 PR 投影钉死工具，与本线无关，跳过。

## 未跑

副本 python 全量、typecheck（含扩全图）、e2e 子集、移植回 git 树后的三线
复跑。移植清单：web/（127 转换文件+web/package.json type:module）、
scripts/esm-mechanical 四文件适配、scripts/build-editor.mjs 终态装配、
tests/（适配+-loader 修复）。bundle 不入库（PR-1 已退）。

## 第二轮进展（同日续，上下文中断前快照）

- 契约门禁 E1–E10 稳定 9/9；E5 金丝雀换为依赖闭合（/No matching export|Could not resolve|Cannot find module/）。
- copy 内 node 收敛：616 项 597 pass / 18 fail。已修复文件：
  test_editor_history_gestures(12/0，真 ESM 导入工厂 + globalThis.window 垫片 + MAWE 桩)、
  test_waveform_display_presets(7/0)、test_editor_marker_preferences(4/0)、
  test_ai_cleanup_review_fallback(2/0)、test_ai_cleanup_local_export(9/1→进行中)、
  test_editor_bundle(5/0，金丝雀换依赖闭合契约)、test_launcher_bundle(2/0)。
- 关键基建沉淀（在 tests/helpers/editor-module-loader.mjs）：
  ①工厂感知装配；②compileEditorFixture 依赖闭包（读 full-conversion.json
  connections + import 语句，递归）；③esbuild define 注入模板占位符中性值；
  ④compileEditorBundle（全清单）。
- 已知未竟（copy 内 18 失败的分布）：
  - test_ai_cleanup_local_export 9 例：单文件 fixture 的依赖闭包不可行
    （启动链 DOM 依赖横跨全清单），已试全清单 bundle 路线（vm 需补
    document/Node/NodeFilter/CustomEvent/MutationObserver/Option/…中性面，
    已补到 i18n 遍历层，差 createTreeWalker 深链），两条路线都需收尾。
    建议：该文件改为用 E6 同款真浏览器断言替代 vm 夹具。
  - test_launcher_bundle 1 例、test_editor_script_order（退役项）等同前账。
- 集成树（本分支）web/ 未移植——移植前适配测试必然红（editor-sources.txt /
  full-conversion.json 仅存在于 copy）。移植即：copy 的 web/ + tests/ + 
  scripts/esm-mechanical 四文件 → git 树，随后三线复跑。

## 下一步（新会话接手清单）

1. copy 内收尾 test_ai_cleanup_local_export（二选一路线）与 launcher_bundle 余项。
2. copy 内跑 python 全量（MAW_ESM_PYTHON 同 venv）与 typecheck（扩 include 到
   全部 ESM 文件；预期 235 类诊断，按研究报告处置）。
3. 移植：cp -r copy 的 web/（排除 bundle 产物）与 tests/ 覆盖本分支，三线复跑。
4. 全绿后提交推送，PR 描述按本账本展开。
