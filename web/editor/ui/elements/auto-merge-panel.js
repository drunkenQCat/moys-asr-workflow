// 自动合并面板（含其定位存储键）。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsAutoMergePanel(global) {
  'use strict';

  const U = global.MaweElements;



  const AUTO_MERGE_PANEL_POSITION_KEY = 'moy.asr.auto_merge.panel.v2';


  const autoMergePanel = document.getElementById('auto-merge-panel');


  const autoMergeDragHandle = document.getElementById('auto-merge-drag-handle');


  const autoMergeCloseButton = document.getElementById('auto-merge-close');


  const autoMergeManageButton = document.getElementById('auto-merge-manage');


  const autoMergeRunButton = document.getElementById('auto-merge-run');


  const autoMergeGapMsInput = document.getElementById('auto-merge-gap-ms');


  const autoMergeSnapDirectionSelect = document.getElementById('auto-merge-snap-direction');


  const autoMergeAbsorbShortToggle = document.getElementById('auto-merge-absorb-short');


  const autoMergeShortCountInput = document.getElementById('auto-merge-short-count');


  const autoMergeAbsorbDirectionSelect = document.getElementById('auto-merge-absorb-direction');

  Object.assign(U, {
    AUTO_MERGE_PANEL_POSITION_KEY,
    autoMergePanel,
    autoMergeDragHandle,
    autoMergeCloseButton,
    autoMergeManageButton,
    autoMergeRunButton,
    autoMergeGapMsInput,
    autoMergeSnapDirectionSelect,
    autoMergeAbsorbShortToggle,
    autoMergeShortCountInput,
    autoMergeAbsorbDirectionSelect,
  });
})(typeof window !== 'undefined' ? window : globalThis);
