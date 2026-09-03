// 右键菜单与字幕详情面板。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsCuePanel(global) {
  'use strict';

  const U = global.MaweElements;


  const ctxmenu = document.getElementById('ctxmenu');


  const cuePanel = document.getElementById('current-cue-panel');


  const cuePanelPrev = document.getElementById('cue-panel-prev');


  const cuePanelNext = document.getElementById('cue-panel-next');


  const cuePanelStart = document.getElementById('cue-panel-start');


  const cuePanelDuration = document.getElementById('cue-panel-duration');


  const cuePanelText = document.getElementById('cue-panel-text');


  const cuePanelTarget = document.getElementById('cue-panel-target');


  const cuePanelTotalLength = document.getElementById('cue-panel-total-length');


  const cuePanelCharsPerSecond = document.getElementById('cue-panel-chars-per-second');


  const cuePanelSticker = document.getElementById('cue-panel-sticker');


  const cuePanelAddSticker = document.getElementById('cue-panel-add-sticker');


  const cuePanelSplit = document.getElementById('cue-panel-split');


  const cuePanelSplitKey = document.getElementById('cue-panel-split-key');


  const cuesEmpty = document.getElementById('cues-empty');

  Object.assign(U, {
    ctxmenu,
    cuePanel,
    cuePanelPrev,
    cuePanelNext,
    cuePanelStart,
    cuePanelDuration,
    cuePanelText,
    cuePanelTarget,
    cuePanelTotalLength,
    cuePanelCharsPerSecond,
    cuePanelSticker,
    cuePanelAddSticker,
    cuePanelSplit,
    cuePanelSplitKey,
    cuesEmpty,
  });
})(typeof window !== 'undefined' ? window : globalThis);
