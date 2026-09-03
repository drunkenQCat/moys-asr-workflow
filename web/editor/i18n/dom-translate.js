// 在 DOM 边界上应用语言：遍历文本节点与属性、跳过项目内容、切换按钮与启动接线。
// 自 web/editor/i18n/i18n.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweI18n；
// 兼容出口 window.MAWE_I18N 仍由 editor/i18n/compat-surface.js 统一组装。
(function initMaweI18nDomTranslate(global) {
  'use strict';

  const U = global.MaweI18n;

  const textOriginals = new WeakMap();
  const attributeOriginals = new WeakMap();
  const SKIP_SELECTOR = [
    '#cue-list', '#cue-panel-text', '#overlay', '#sticker-overlay-layer',
    '#media-name', '#json-name', '#sticker-grid', '.hint-project-preview-value', 'script', 'style'
  ].join(',');
  const ATTRIBUTE_SKIP_SELECTOR = [
    // .waveform-cue-block 的 title 是用户字幕原文，不能参与翻译
    '#cue-list', '#overlay', '#sticker-overlay-layer', '.waveform-cue-block',
    '#media-name', '#json-name', '#sticker-grid', 'script', 'style'
  ].join(',');

  function translateTextNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_SELECTOR)) return;
    if (!textOriginals.has(node)) textOriginals.set(node, node.nodeValue);
    const original = textOriginals.get(node);
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    const core = original.trim();
    if (core) node.nodeValue = leading + U.translateText(core) + trailing;
  }

  function translateAttributes(element) {
    if (element.closest?.(ATTRIBUTE_SKIP_SELECTOR)) return;
    if (!attributeOriginals.has(element)) attributeOriginals.set(element, {});
    const originals = attributeOriginals.get(element);
    ['title', 'placeholder', 'aria-label'].forEach((name) => {
      if (!element.hasAttribute?.(name)) return;
      const current = element.getAttribute(name);
      if (!(name in originals)) {
        originals[name] = current;
      } else {
        const original = originals[name];
        const translated = U.translateText(original, U.EN);
        if (current !== original && current !== translated) originals[name] = current;
      }
      const original = originals[name];
      const next = U.language === U.EN ? U.translateText(original, U.EN) : original;
      if (current !== next) element.setAttribute(name, next);
    });
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else translateAttributes(node);
    }
  }

  function refreshToggle() {
    const button = document.getElementById('language-toggle');
    if (!button) return;
    button.textContent = U.language === U.ZH ? '🌐English' : '🌐中文';
    button.title = U.language === U.ZH ? 'Switch to English' : '切换为中文';
    button.setAttribute('aria-label', button.title);
  }

  function applyLanguage(nextLanguage, persist = true) {
    U.language = U.normalizeLanguage(nextLanguage);
    if (persist) {
      U.persistLanguage(U.language);
    }
    document.documentElement.lang = U.language === U.EN ? 'en' : 'zh-CN';
    translateTree(document.body);
    refreshToggle();
    document.dispatchEvent(new CustomEvent('mawe:languagechange', { detail: { language: U.language } }));
  }

  function installDialogTranslation() {
    ['alert', 'confirm', 'prompt'].forEach((name) => {
      const original = global[name];
      if (typeof original !== 'function' || original.__maweLocalized) return;
      const wrapped = function localizedDialog(message, ...args) {
        return original.call(global, U.translateText(message), ...args);
      };
      wrapped.__maweLocalized = true;
      global[name] = wrapped;
    });
  }

  function start() {
    installDialogTranslation();
    applyLanguage(U.language, false);
    document.getElementById('language-toggle')?.addEventListener('click', () => {
      applyLanguage(U.language === U.ZH ? U.EN : U.ZH);
    });
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach(translateTree);
        if (record.type === 'attributes') translateAttributes(record.target);
      });
    });
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['title', 'placeholder', 'aria-label'],
    });
  }

  Object.assign(U, {
    textOriginals,
    attributeOriginals,
    SKIP_SELECTOR,
    ATTRIBUTE_SKIP_SELECTOR,
    translateTextNode,
    translateAttributes,
    translateTree,
    refreshToggle,
    applyLanguage,
    installDialogTranslation,
    start,
  });
})(typeof window !== 'undefined' ? window : globalThis);
