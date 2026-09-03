// editor/text/timed-edit/ 的内部命名空间：各模块把自己的符号发布到这里，
// 可变状态用 get/set 访问器发布，因此跨模块读到、写到的都是同一份最新值。
// 对外的兼容出口是 window.MaweTimedTextEdit，由 editor/text/timed-edit/compat-surface.js 最后组装；
// 新增内部 helper 只进 MaweText，不要加进兼容出口。
(function initMaweTextNamespace(global) {
  'use strict';

  if (global.MaweText) {
    throw new Error('MaweText 必须在 editor/text/timed-edit/ 所有模块之前初始化且只初始化一次');
  }
  global.MaweText = {};
})(typeof window !== 'undefined' ? window : globalThis);
