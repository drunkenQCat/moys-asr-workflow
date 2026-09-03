// 顶部计数、搜索框、遮罩文本与遮罩开关。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsShell(global) {
  'use strict';

  const U = global.MaweElements;


  const nowEl = document.getElementById('now');


  const searchEl = document.getElementById('search');


  const visibleCountEl = document.getElementById('visible-count');


  const totalCountEl = document.getElementById('total-count');


  const selCountEl = document.getElementById('sel-count');


  const overlayEl = document.getElementById('overlay');


  const overlayTextEl = document.getElementById('overlay-main-text');


  const overlayExtensionTextEl = document.getElementById('overlay-extension-text');


  const overlayToggle = document.getElementById('overlay-toggle');


  const extensionOverlayToggleWrap = document.getElementById('extension-overlay-toggle-wrap');


  const extensionOverlayToggle = document.getElementById('extension-overlay-toggle');


  const stickerOverlayToggle = document.getElementById('sticker-overlay-toggle');

  Object.assign(U, {
    nowEl,
    searchEl,
    visibleCountEl,
    totalCountEl,
    selCountEl,
    overlayEl,
    overlayTextEl,
    overlayExtensionTextEl,
    overlayToggle,
    extensionOverlayToggleWrap,
    extensionOverlayToggle,
    stickerOverlayToggle,
  });
})(typeof window !== 'undefined' ? window : globalThis);
