// window.MAWE_I18N 兼容出口：结构、键名与键序与拆分前完全一致（契约测试逐项比对），
// 取值来自 editor/i18n/ 各模块发布到 window.MaweI18n 的内部符号。内部 helper 不要往这里加。
// 必须在 editor/i18n/ 全部模块之后加载。
// 出口之后的 3 条加载期语句（L1110、L1111、L1113）也原样跟在出口后面，
// 它们与出口之间的先后顺序决定启动时能不能读到出口，因此不搬去前置模块。
(function initMaweI18nCompatSurface(global) {
  'use strict';

  const U = global.MaweI18n;

  global.MAWE_I18N = {
    get language() { return U.language; },
    applyLanguage: U.applyLanguage,
    start: U.start,
    translateText: U.translateText,
    validateTranslationKeys: U.validateTranslationKeys,
  };
  global.MAWE?.register('i18n', () => global.MAWE_I18N);

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', U.start, { once: true });
  } else {
    U.start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
