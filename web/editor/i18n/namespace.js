// editor/i18n/ 的内部命名空间：各模块把自己的符号发布到这里，
// 可变状态用 get/set 访问器发布，因此跨模块读到、写到的都是同一份最新值。
// 对外的兼容出口是 window.MAWE_I18N，由 editor/i18n/compat-surface.js 最后组装；
// 新增内部 helper 只进 MaweI18n，不要加进兼容出口。
(function initMaweI18nNamespace(global) {
  'use strict';

  if (global.MaweI18n) {
    throw new Error('MaweI18n 必须在 editor/i18n/ 所有模块之前初始化且只初始化一次');
  }
  global.MaweI18n = {};
})(typeof window !== 'undefined' ? window : globalThis);
