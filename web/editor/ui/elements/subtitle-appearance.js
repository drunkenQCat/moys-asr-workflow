// 主/副字幕预览的外观控件（字号、字体、颜色、底色与透明度）。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsSubtitleAppearance(global) {
  'use strict';

  const U = global.MaweElements;


  const subtitleFontSizeSelect = document.getElementById('subtitle-font-size');


  const subtitleFontFamilySelect = document.getElementById('subtitle-font-family');


  const subtitleFontFamilyScanButton = document.getElementById('subtitle-font-family-scan');


  const subtitleFontFamilyStatus = document.getElementById('subtitle-font-family-status');


  const subtitleBackgroundColorInput = document.getElementById('subtitle-background-color');


  const subtitleBackgroundAlphaInput = document.getElementById('subtitle-background-alpha');


  const subtitleBackgroundAlphaValue = document.getElementById('subtitle-background-alpha-value');


  const subtitleColorInput = document.getElementById('subtitle-color');


  const subtitleColorUnderlineInput = document.getElementById('subtitle-color-underline');


  const extensionSubtitlePreviewSettings = document.getElementById('extension-subtitle-preview-settings');


  const extensionSubtitleFontSizeSelect = document.getElementById('extension-subtitle-font-size');


  const extensionSubtitleFontFamilySelect = document.getElementById('extension-subtitle-font-family');


  const extensionSubtitleColorInput = document.getElementById('extension-subtitle-color');


  const extensionSubtitleBackgroundColorInput = document.getElementById('extension-subtitle-background-color');


  const extensionSubtitleBackgroundAlphaInput = document.getElementById('extension-subtitle-background-alpha');


  const extensionSubtitleBackgroundAlphaValue = document.getElementById('extension-subtitle-background-alpha-value');

  Object.assign(U, {
    subtitleFontSizeSelect,
    subtitleFontFamilySelect,
    subtitleFontFamilyScanButton,
    subtitleFontFamilyStatus,
    subtitleBackgroundColorInput,
    subtitleBackgroundAlphaInput,
    subtitleBackgroundAlphaValue,
    subtitleColorInput,
    subtitleColorUnderlineInput,
    extensionSubtitlePreviewSettings,
    extensionSubtitleFontSizeSelect,
    extensionSubtitleFontFamilySelect,
    extensionSubtitleColorInput,
    extensionSubtitleBackgroundColorInput,
    extensionSubtitleBackgroundAlphaInput,
    extensionSubtitleBackgroundAlphaValue,
  });
})(typeof window !== 'undefined' ? window : globalThis);
