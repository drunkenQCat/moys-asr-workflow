// 编辑器设置规范化与逐项钳制：把外部存储的脏值收敛到合法区间。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibSettingsNormalize(global) {
  'use strict';

  const U = global.MaweLib;

  const EDITOR_SETTING_ROW_HEIGHTS = [64, 80, 96, 120, 144, 168];
  const DEFAULT_EDITOR_SETTINGS = Object.freeze({
    splitKey: 'enter', splitUseWordTimestamps: true, splitAutoSubmit: true,
    mainSplitModeOverride: null,
    splitTrimSymbols: [...U.DEFAULT_SPLIT_TRIM_SYMBOLS],
    overlayEnabled: true, extensionOverlayEnabled: true, multiSubtitleRowHeight: 168,
    exportStartAtZero: false, cueListShowIndex: true, cueListShowTime: true,
    cueListShowSticker: true, cueListShowCharcount: true, cueListAutoScrollOnClick: true,
    cueListKeepSplitVisible: true, cueListHideDisabled: false, cueListCharcountThreshold: 16,
    cueEditorShowNavigation: false, cueEditorShowTimeActions: false, cueEditorShowSticker: false,
    cueEditorCancelOnEscape: false, selectGroupMembers: false,
    mergeJoinTextContinuous: '', mergeJoinTextWord: ' ',
    autoMergeGapMs: 200, autoMergeSnapDirection: 'backward', autoMergeShortCount: 3,
    autoMergeAbsorbShort: true, autoMergeAbsorbDirection: 'previous', exportColorUnified: true,
    autoSaveProject: true, autoSaveIntervalSeconds: 30, stickerOverlayEnabled: false,
    stickerOtioExportMode: 'original', clickBehavior: 'select-and-seek', clickTarget: 'pointer',
    keyboardOperationReference: 'pointer', jklPlaybackMode: 'direction', mediaSeekStepMs: 1000,
    cueMoveStepMs: 50, hoverSeekPreview: false, autoSnapAdjacentCues: true, ninjaMode: false,
    ninjaSound: true, ninjaSlashEffect: true, ninjaSlashLengthPercent: 80,
    ninjaSlashRotateAmplitude: 6, crossTrackSnap: true, selectBoundSubtitlePair: true,
    multiSubtitleAutoSyncDuration: true, multiSubtitleShowTrackBadges: false, theme: 'dark',
    waveShapeSource: 'reapeaks',
  });

  function clampInteger(value, fallback, minimum, maximum) {
    const rounded = Math.round(Number(value));
    return Math.min(maximum, Math.max(minimum, Number.isFinite(rounded) ? rounded : fallback));
  }

  function normalizeEditorSettings(saved = {}) {
    const savedSettings = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    const legacySeekStepSeconds = Number(savedSettings.mediaSeekStepSeconds);
    const mediaSeekStepMs = savedSettings.mediaSeekStepMs !== undefined
      ? savedSettings.mediaSeekStepMs
      : Number.isFinite(legacySeekStepSeconds) ? legacySeekStepSeconds * 1000 : undefined;
    return {
      ...DEFAULT_EDITOR_SETTINGS,
      splitKey: savedSettings.splitKey === 'ctrl-enter' ? 'ctrl-enter' : 'enter',
      splitUseWordTimestamps: savedSettings.splitUseWordTimestamps !== false,
      splitAutoSubmit: savedSettings.splitAutoSubmit !== false,
      // 主字幕拆分类型手动指定偏好：word / continuous / null（跟随工程与检测）。
      mainSplitModeOverride: ['word', 'continuous'].includes(savedSettings.mainSplitModeOverride)
        ? savedSettings.mainSplitModeOverride : null,
      // undefined → 默认集合；显式空数组表示用户关闭了全部符号（仅修剪空白）。
      splitTrimSymbols: Array.isArray(savedSettings.splitTrimSymbols)
        ? U.normalizeSplitTrimSymbols(savedSettings.splitTrimSymbols)
        : [...U.DEFAULT_SPLIT_TRIM_SYMBOLS],
      overlayEnabled: savedSettings.overlayEnabled !== false,
      extensionOverlayEnabled: savedSettings.extensionOverlayEnabled !== false,
      multiSubtitleRowHeight: EDITOR_SETTING_ROW_HEIGHTS.includes(Number(savedSettings.multiSubtitleRowHeight))
        ? Number(savedSettings.multiSubtitleRowHeight) : 168,
      exportStartAtZero: savedSettings.exportStartAtZero === true,
      cueListShowIndex: savedSettings.cueListShowIndex !== false,
      cueListShowTime: savedSettings.cueListShowTime !== false,
      cueListShowSticker: savedSettings.cueListShowSticker !== false,
      cueListShowCharcount: savedSettings.cueListShowCharcount !== false,
      cueListAutoScrollOnClick: savedSettings.cueListAutoScrollOnClick !== false,
      cueListKeepSplitVisible: savedSettings.cueListKeepSplitVisible !== false,
      cueListHideDisabled: savedSettings.cueListHideDisabled === true,
      cueListCharcountThreshold: clampInteger(savedSettings.cueListCharcountThreshold, 16, 1, 200),
      cueEditorShowNavigation: savedSettings.cueEditorShowNavigation === true,
      cueEditorShowTimeActions: savedSettings.cueEditorShowTimeActions === true,
      cueEditorShowSticker: savedSettings.cueEditorShowSticker === true,
      cueEditorCancelOnEscape: savedSettings.cueEditorCancelOnEscape === true,
      selectGroupMembers: savedSettings.selectGroupMembers === true,
      // 合并连接符按字幕拆分类型区分：连续型默认直接拼接，单词型默认空格。
      // 旧版只有 mergeJoinText 一个值；用户自定义过则两个类型都沿用旧值。
      mergeJoinTextContinuous: typeof savedSettings.mergeJoinTextContinuous === 'string'
        ? savedSettings.mergeJoinTextContinuous
        : typeof savedSettings.mergeJoinText === 'string' ? savedSettings.mergeJoinText : '',
      mergeJoinTextWord: typeof savedSettings.mergeJoinTextWord === 'string'
        ? savedSettings.mergeJoinTextWord
        : typeof savedSettings.mergeJoinText === 'string' ? savedSettings.mergeJoinText : ' ',
      autoMergeGapMs: clampInteger(savedSettings.autoMergeGapMs, 200, 0, 10000),
      autoMergeSnapDirection: savedSettings.autoMergeSnapDirection === 'forward' ? 'forward' : 'backward',
      autoMergeShortCount: clampInteger(savedSettings.autoMergeShortCount, 3, 1, 20),
      autoMergeAbsorbShort: savedSettings.autoMergeAbsorbShort !== false,
      autoMergeAbsorbDirection: savedSettings.autoMergeAbsorbDirection === 'next' ? 'next' : 'previous',
      exportColorUnified: savedSettings.exportColorUnified !== false,
      autoSaveProject: savedSettings.autoSaveProject !== false,
      autoSaveIntervalSeconds: clampInteger(savedSettings.autoSaveIntervalSeconds, 30, 5, 3600),
      stickerOverlayEnabled: savedSettings.stickerOverlayEnabled === true,
      stickerOtioExportMode: savedSettings.stickerOtioExportMode === 'portable' ? 'portable' : 'original',
      clickBehavior: ['select-only', 'select-and-seek', 'select-and-play'].includes(savedSettings.clickBehavior)
        ? savedSettings.clickBehavior : 'select-and-seek',
      clickTarget: ['cue-start', 'pointer'].includes(savedSettings.clickTarget) ? savedSettings.clickTarget : 'pointer',
      keyboardOperationReference: savedSettings.keyboardOperationReference === 'playhead' ? 'playhead' : 'pointer',
      jklPlaybackMode: ['speed', 'direction'].includes(savedSettings.jklPlaybackMode)
        ? savedSettings.jklPlaybackMode : 'direction',
      mediaSeekStepMs: clampInteger(mediaSeekStepMs, 1000, 10, 60000),
      cueMoveStepMs: clampInteger(savedSettings.cueMoveStepMs, 50, 10, 2000),
      hoverSeekPreview: savedSettings.hoverSeekPreview === true,
      autoSnapAdjacentCues: savedSettings.autoSnapAdjacentCues !== false,
      ninjaMode: savedSettings.ninjaMode === true,
      ninjaSound: savedSettings.ninjaSound !== false,
      ninjaSlashEffect: savedSettings.ninjaSlashEffect !== false,
      ninjaSlashLengthPercent: clampInteger(savedSettings.ninjaSlashLengthPercent, 80, 20, 400),
      ninjaSlashRotateAmplitude: clampInteger(savedSettings.ninjaSlashRotateAmplitude, 6, 0, 60),
      crossTrackSnap: savedSettings.crossTrackSnap !== false,
      selectBoundSubtitlePair: savedSettings.selectBoundSubtitlePair !== false,
      multiSubtitleAutoSyncDuration: savedSettings.multiSubtitleAutoSyncDuration !== false,
      multiSubtitleShowTrackBadges: savedSettings.multiSubtitleShowTrackBadges === true,
      theme: savedSettings.theme === 'light' ? 'light' : 'dark',
      waveShapeSource: savedSettings.waveShapeSource === 'self' ? 'self' : 'reapeaks',
    };
  }

  function normalizeMultiSubtitleRowHeight(value) {
    return EDITOR_SETTING_ROW_HEIGHTS.includes(Number(value)) ? Number(value) : 168;
  }
  function normalizeClickBehavior(value) {
    return ['select-only', 'select-and-seek', 'select-and-play'].includes(value)
      ? value : 'select-and-seek';
  }
  function normalizeClickTarget(value) {
    return ['cue-start', 'pointer'].includes(value) ? value : 'pointer';
  }
  function normalizeJklPlaybackMode(value) {
    return ['speed', 'direction'].includes(value) ? value : 'direction';
  }
  function clampMediaSeekStepMs(value) { return clampInteger(value, 1000, 10, 60000); }
  function clampCueMoveStepMs(value) { return clampInteger(value, 50, 10, 2000); }
  function clampAutoSaveInterval(value) { return clampInteger(value, 30, 5, 3600); }
  function clampCharcountThreshold(value) { return clampInteger(value, 16, 1, 200); }
  function clampNinjaSlashLength(value) { return clampInteger(value, 80, 20, 400); }
  function clampNinjaSlashRotateAmplitude(value) { return clampInteger(value, 6, 0, 60); }
  function clampAutoMergeGapMs(value) { return clampInteger(value, 200, 0, 10000); }
  function clampAutoMergeShortCount(value) { return clampInteger(value, 3, 1, 20); }

  Object.assign(U, {
    EDITOR_SETTING_ROW_HEIGHTS,
    DEFAULT_EDITOR_SETTINGS,
    clampInteger,
    normalizeEditorSettings,
    normalizeMultiSubtitleRowHeight,
    normalizeClickBehavior,
    normalizeClickTarget,
    normalizeJklPlaybackMode,
    clampMediaSeekStepMs,
    clampCueMoveStepMs,
    clampAutoSaveInterval,
    clampCharcountThreshold,
    clampNinjaSlashLength,
    clampNinjaSlashRotateAmplitude,
    clampAutoMergeGapMs,
    clampAutoMergeShortCount,
  });
})(typeof window !== 'undefined' ? window : globalThis);
