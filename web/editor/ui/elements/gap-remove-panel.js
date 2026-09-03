// 去空隙面板（含其定位存储键）。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsGapRemovePanel(global) {
  'use strict';

  const U = global.MaweElements;


  const GAP_REMOVE_PANEL_POSITION_KEY = 'moy.asr.gap_remove.panel.v1';


  const gapRemovePanel = document.getElementById('gap-remove-panel');


  const gapRemoveDragHandle = document.getElementById('gap-remove-drag-handle');


  const gapRemoveCloseButton = document.getElementById('gap-remove-close');


  const gapRemoveManageButton = document.getElementById('gap-remove-manage');


  const gapRemoveThreshold = document.getElementById('gap-remove-threshold');


  const gapRemoveVolumeThreshold = document.getElementById('gap-remove-volume-threshold');


  const gapRemoveHysteresis = document.getElementById('gap-remove-hysteresis');


  const gapRemoveHysteresisHint = document.getElementById('gap-remove-hysteresis-hint');


  const gapRemoveLeadIn = document.getElementById('gap-remove-lead-in');


  const gapRemoveLeadOut = document.getElementById('gap-remove-lead-out');


  const gapRemoveShrinkButton = document.getElementById('gap-remove-shrink');


  const gapRemoveAdvancedToggle = document.getElementById('gap-remove-advanced-toggle');


  const gapRemoveAdvancedBody = document.getElementById('gap-remove-advanced-body');


  const gapRemoveDisableToggle = document.getElementById('gap-remove-disable-toggle');


  const gapRemoveDisableBody = document.getElementById('gap-remove-disable-body');


  const gapRemoveDisableCoverage = document.getElementById('gap-remove-disable-coverage');


  const gapRemoveDisableRemaining = document.getElementById('gap-remove-disable-remaining');


  const gapRemoveDisableButton = document.getElementById('gap-remove-disable-button');


  const gapRemoveDisableHint = document.getElementById('gap-remove-disable-hint');


  const gapRemoveOperationMode = document.getElementById('gap-remove-operation-mode');


  const gapRemoveScanButton = document.getElementById('gap-remove-scan');


  const gapRemoveSkipPlayback = document.getElementById('gap-skip-playback');


  const gapRemoveList = document.getElementById('gap-remove-list');


  const gapRemoveClearAllButton = document.getElementById('gap-remove-clear-all');

  Object.assign(U, {
    GAP_REMOVE_PANEL_POSITION_KEY,
    gapRemovePanel,
    gapRemoveDragHandle,
    gapRemoveCloseButton,
    gapRemoveManageButton,
    gapRemoveThreshold,
    gapRemoveVolumeThreshold,
    gapRemoveHysteresis,
    gapRemoveHysteresisHint,
    gapRemoveLeadIn,
    gapRemoveLeadOut,
    gapRemoveShrinkButton,
    gapRemoveAdvancedToggle,
    gapRemoveAdvancedBody,
    gapRemoveDisableToggle,
    gapRemoveDisableBody,
    gapRemoveDisableCoverage,
    gapRemoveDisableRemaining,
    gapRemoveDisableButton,
    gapRemoveDisableHint,
    gapRemoveOperationMode,
    gapRemoveScanButton,
    gapRemoveSkipPlayback,
    gapRemoveList,
    gapRemoveClearAllButton,
  });
})(typeof window !== 'undefined' ? window : globalThis);
