// JSON 深拷贝：跨模块共用的最小值语义克隆。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibJsonValue(global) {
  'use strict';

  const U = global.MaweLib;

  function cloneJsonValue(value) {
    return value == null ? null : JSON.parse(JSON.stringify(value));
  }

  Object.assign(U, {
    cloneJsonValue,
  });
})(typeof window !== 'undefined' ? window : globalThis);
