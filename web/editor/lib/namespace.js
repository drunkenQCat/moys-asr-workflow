// editor/lib 层的内部命名空间：各模块把自己的符号 Object.assign 到这里，
// 可变状态用访问器发布，因此跨模块读到的一定是最新值。
// 对外的兼容出口是 window.AsrEditorUtils，由 editor/lib/compat-surface.js 最后一并组装；
// 新增内部 helper 只进 MaweLib，不要加进兼容出口。
(function initMaweLibNamespace(global) {
  'use strict';

  if (global.MaweLib) {
    throw new Error('MaweLib 必须在 editor/lib 所有模块之前初始化且只初始化一次');
  }
  global.MaweLib = {};
})(typeof window !== 'undefined' ? window : globalThis);
