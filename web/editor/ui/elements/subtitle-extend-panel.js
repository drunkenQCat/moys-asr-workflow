// 字幕延展面板（含其定位存储键）。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsSubtitleExtendPanel(global) {
  'use strict';

  const U = global.MaweElements;


  const SUBTITLE_EXTEND_PANEL_POSITION_KEY = 'moy.asr.subtitle_extend.panel.v1';


  const subtitleExtendPanel = document.getElementById('subtitle-extend-panel');


  const subtitleExtendDragHandle = document.getElementById('subtitle-extend-drag-handle');


  const subtitleExtendCloseButton = document.getElementById('subtitle-extend-close');


  const subtitleExtendManageButton = document.getElementById('subtitle-extend-manage');


  const subtitleExtendRunButton = document.getElementById('subtitle-extend-run');


  const subtitleExtendForwardInput = document.getElementById('subtitle-extend-forward-ms');


  const subtitleExtendBackwardInput = document.getElementById('subtitle-extend-backward-ms');

  Object.assign(U, {
    SUBTITLE_EXTEND_PANEL_POSITION_KEY,
    subtitleExtendPanel,
    subtitleExtendDragHandle,
    subtitleExtendCloseButton,
    subtitleExtendManageButton,
    subtitleExtendRunButton,
    subtitleExtendForwardInput,
    subtitleExtendBackwardInput,
  });
})(typeof window !== 'undefined' ? window : globalThis);
