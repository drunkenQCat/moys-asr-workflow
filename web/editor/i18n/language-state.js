// 当前语言的判定与持久化：启动参数、注入语言、localStorage，不碰 DOM。
// 自 web/editor/i18n/i18n.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweI18n；
// 兼容出口 window.MAWE_I18N 仍由 editor/i18n/compat-surface.js 统一组装。
(function initMaweI18nLanguageState(global) {
  'use strict';

  const U = global.MaweI18n;

  const STORAGE_KEY = 'mawe.language';
  const ZH = 'zh';
  const EN = 'en';
  const GENERATED_LANGUAGE = typeof __UI_LANGUAGE_JSON__ === 'undefined' ? null : __UI_LANGUAGE_JSON__;

  function normalizeLanguage(value) {
    return String(value || '').toLowerCase().startsWith('en') ? EN : ZH;
  }

  function persistLanguage(nextLanguage) {
    try { global.localStorage?.setItem(STORAGE_KEY, nextLanguage); } catch (_) {}
  }

  function languageFromLaunchUrl() {
    try {
      const location = global.location;
      if (!location?.href) return null;
      const url = new URL(location.href);
      const requested = url.searchParams.get('lang');
      if (requested !== ZH && requested !== EN) return null;
      url.searchParams.delete('lang');
      if (global.history?.replaceState && /^https?:$/.test(url.protocol)) {
        global.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
      return requested;
    } catch (_) {
      return null;
    }
  }

  function readLanguage() {
    const launched = languageFromLaunchUrl();
    if (launched) {
      persistLanguage(launched);
      return launched;
    }
    if (GENERATED_LANGUAGE === ZH || GENERATED_LANGUAGE === EN) {
      persistLanguage(GENERATED_LANGUAGE);
      return GENERATED_LANGUAGE;
    }
    try {
      return normalizeLanguage(global.localStorage?.getItem(STORAGE_KEY) || ZH);
    } catch (_) {
      return ZH;
    }
  }

  let language = readLanguage();

  Object.assign(U, {
    STORAGE_KEY,
    ZH,
    EN,
    GENERATED_LANGUAGE,
    normalizeLanguage,
    persistLanguage,
    languageFromLaunchUrl,
    readLanguage,
  });
  // language 是本模块可变状态且会被其他模块写入：以 get/set 访问器发布，
  // 语义与拆分前整个闭包共享同一个 let 完全一致。
  Object.defineProperty(U, 'language', { enumerable: true, configurable: true,
    get: () => language, set: (value) => { language = value; } });
})(typeof window !== 'undefined' ? window : globalThis);
