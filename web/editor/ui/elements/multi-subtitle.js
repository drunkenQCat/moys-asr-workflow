// 多字幕轨道开关、设置与导入/拆分弹窗。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsMultiSubtitle(global) {
  'use strict';

  const U = global.MaweElements;


  const multiSubtitleToggleLabel = document.getElementById('multi-subtitle-toggle-label');


  const multiSubtitleSettingsDropdown = document.getElementById('multi-subtitle-settings-dropdown');


  // 已开启多重字幕但尚未加载第二条字幕时的开关右侧提示。
  const multiSubtitleEmptyHint = document.getElementById('multi-subtitle-empty-hint');


  const multiSubtitleSwapButton = document.getElementById('multi-subtitle-swap');


  const multiSubtitleCrossTrackSnapToggle = document.getElementById('multi-subtitle-cross-track-snap');


  const multiSubtitleSelectBoundPairToggle = document.getElementById('multi-subtitle-select-bound-pair');


  const multiSubtitleAutoSyncDurationToggle = document.getElementById('multi-subtitle-auto-sync-duration');


  const multiSubtitleShowTrackBadgesToggle = document.getElementById('multi-subtitle-show-track-badges');


  const multiSubtitleWaveformControls = document.getElementById('multi-subtitle-waveform-controls');


  const multiSubtitleToggle = document.getElementById('multi-subtitle-toggle');


  const multiSubtitleDisplayMode = document.getElementById('multi-subtitle-display-mode');


  const multiSubtitleMainLanguageMode = document.getElementById('multi-subtitle-main-language-mode');


  const multiSubtitleExtensionLanguageMode = document.getElementById('multi-subtitle-extension-language-mode');


  const multiSubtitleExtensionRowHeightSetting = document.getElementById('multi-subtitle-extension-row-height-setting');


  const multiSubtitleExtensionRowHeight = document.getElementById('multi-subtitle-extension-row-height');


  const multiSubtitleAlignButton = document.getElementById('multi-subtitle-align');


  const multiSubtitleImportModal = document.getElementById('multi-subtitle-import-modal');


  const multiSubtitleImportDescription = document.getElementById('multi-subtitle-import-description');


  const multiSubtitleImportPreview = document.getElementById('multi-subtitle-import-preview');


  const multiSubtitleImportChoiceActions = document.getElementById('multi-subtitle-import-choice-actions');


  const multiSubtitleImportResultActions = document.getElementById('multi-subtitle-import-result-actions');


  const multiSubtitleImportReplace = document.getElementById('multi-subtitle-import-replace');


  const multiSubtitleImportExtension = document.getElementById('multi-subtitle-import-extension');


  const multiSubtitleImportResultCancel = document.getElementById('multi-subtitle-import-result-cancel');


  const multiSubtitleImportResultConfirm = document.getElementById('multi-subtitle-import-result-confirm');


  const multiSubtitleSplitModal = document.getElementById('multi-subtitle-split-modal');


  const multiSubtitleSplitTitle = document.getElementById('multi-subtitle-split-title');


  const multiSubtitleSplitMeta = document.getElementById('multi-subtitle-split-meta');


  const multiSubtitleSplitMainLane = document.getElementById('multi-subtitle-split-main-lane');


  const multiSubtitleSplitMainText = document.getElementById('multi-subtitle-split-main-text');


  const multiSubtitleSplitExtensionLane = document.getElementById('multi-subtitle-split-extension-lane');


  const multiSubtitleSplitText = document.getElementById('multi-subtitle-split-text');


  const multiSubtitleSplitTimestampHint = document.getElementById('multi-subtitle-split-timestamp-hint');


  const multiSubtitleSplitPreview = document.getElementById('multi-subtitle-split-preview');


  const multiSubtitleSplitError = document.getElementById('multi-subtitle-split-error');


  const multiSubtitleSplitCancel = document.getElementById('multi-subtitle-split-cancel');


  const multiSubtitleSplitConfirm = document.getElementById('multi-subtitle-split-confirm');


  const multiSubtitleSplitAutoSubmit = document.getElementById('multi-subtitle-split-auto-submit');

  Object.assign(U, {
    multiSubtitleToggleLabel,
    multiSubtitleSettingsDropdown,
    multiSubtitleEmptyHint,
    multiSubtitleSwapButton,
    multiSubtitleCrossTrackSnapToggle,
    multiSubtitleSelectBoundPairToggle,
    multiSubtitleAutoSyncDurationToggle,
    multiSubtitleShowTrackBadgesToggle,
    multiSubtitleWaveformControls,
    multiSubtitleToggle,
    multiSubtitleDisplayMode,
    multiSubtitleMainLanguageMode,
    multiSubtitleExtensionLanguageMode,
    multiSubtitleExtensionRowHeightSetting,
    multiSubtitleExtensionRowHeight,
    multiSubtitleAlignButton,
    multiSubtitleImportModal,
    multiSubtitleImportDescription,
    multiSubtitleImportPreview,
    multiSubtitleImportChoiceActions,
    multiSubtitleImportResultActions,
    multiSubtitleImportReplace,
    multiSubtitleImportExtension,
    multiSubtitleImportResultCancel,
    multiSubtitleImportResultConfirm,
    multiSubtitleSplitModal,
    multiSubtitleSplitTitle,
    multiSubtitleSplitMeta,
    multiSubtitleSplitMainLane,
    multiSubtitleSplitMainText,
    multiSubtitleSplitExtensionLane,
    multiSubtitleSplitText,
    multiSubtitleSplitTimestampHint,
    multiSubtitleSplitPreview,
    multiSubtitleSplitError,
    multiSubtitleSplitCancel,
    multiSubtitleSplitConfirm,
    multiSubtitleSplitAutoSubmit,
  });
})(typeof window !== 'undefined' ? window : globalThis);
