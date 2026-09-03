// window.AsrGapRemoveCore 兼容出口：结构、键名与键序与拆分前完全一致（契约测试逐项比对），
// 取值来自 shared/gap-remove/ 各模块发布到 window.MaweGapRemove 的内部符号。内部 helper 不要往这里加。
// 必须在 shared/gap-remove/ 全部模块之后加载。
(function initMaweGapRemoveCompatSurface(global) {
  'use strict';

  const U = global.MaweGapRemove;

  global.AsrGapRemoveCore = Object.freeze({
    GAP_REMOVE_SCHEMA: U.GAP_REMOVE_SCHEMA,
    GAP_PROVENANCE_SCHEMA: U.GAP_PROVENANCE_SCHEMA,
    GAP_PROVENANCE_SOURCES: U.GAP_PROVENANCE_SOURCES,
    GAP_REMOVE_OPERATION_MODES: U.GAP_REMOVE_OPERATION_MODES,
    DEFAULT_GAP_REMOVE_OPERATION_MODE: U.DEFAULT_GAP_REMOVE_OPERATION_MODE,
    GAP_REMOVE_MANUAL_OPERATION_BOUNDARY_RESIZE: U.GAP_REMOVE_MANUAL_OPERATION_BOUNDARY_RESIZE,
    GAP_REMOVE_MANUAL_OPERATION_MOVE: U.GAP_REMOVE_MANUAL_OPERATION_MOVE,
    GAP_REMOVE_DISABLE_COVERAGE_DEFAULT: U.GAP_REMOVE_DISABLE_COVERAGE_DEFAULT,
    GAP_REMOVE_DISABLE_REMAINING_DEFAULT_MS: U.GAP_REMOVE_DISABLE_REMAINING_DEFAULT_MS,
    GAP_REMOVE_DISABLE_REMAINING_MAX_MS: U.GAP_REMOVE_DISABLE_REMAINING_MAX_MS,
    clampGapRemoveDisableCoverage: U.clampGapRemoveDisableCoverage,
    clampGapRemoveDisableRemaining: U.clampGapRemoveDisableRemaining,
    normalizeGapOperationMode: U.normalizeGapOperationMode,
    gapOperationAllowsBoundary: U.gapOperationAllowsBoundary,
    gapOperationAllowsMiddle: U.gapOperationAllowsMiddle,
    normalizeGapRemoveData: U.normalizeGapRemoveData,
    normalizeGapRemoveGaps: U.normalizeGapRemoveGaps,
    normalizeGapRemoveProvenance: U.normalizeGapRemoveProvenance,
    gapRangesFromProvenance: U.gapRangesFromProvenance,
    decorateGapRemoveGaps: U.decorateGapRemoveGaps,
    replaceGapRemoveProvenanceSource: U.replaceGapRemoveProvenanceSource,
    appendGapRemoveManualOverrides: U.appendGapRemoveManualOverrides,
    coalesceGapRemoveGaps: U.coalesceGapRemoveGaps,
    getGapRemoveDisplayType: U.getGapRemoveDisplayType,
    isGapRemoveDisplayProtected: U.isGapRemoveDisplayProtected,
    removeGapRemoveProvenanceRange: U.removeGapRemoveProvenanceRange,
    getGapRemoveDisplayGaps: U.getGapRemoveDisplayGaps,
    applyGapRemoveRange: U.applyGapRemoveRange,
    shrinkGapRemoveGaps: U.shrinkGapRemoveGaps,
    overlayGapRemoveRange: U.overlayGapRemoveRange,
    translateGapRemoveRange: U.translateGapRemoveRange,
    moveGapRemoveRange: U.moveGapRemoveRange,
    copyGapRemoveRange: U.copyGapRemoveRange,
    moveGapRemoveProvenance: U.moveGapRemoveProvenance,
    resizeGapRemoveBoundary: U.resizeGapRemoveBoundary,
    resizeGapRemoveProvenanceBoundary: U.resizeGapRemoveProvenanceBoundary,
    detectAudioGapRemoveGaps: U.detectAudioGapRemoveGaps,
    getRemovedGapRanges: U.getRemovedGapRanges,
    findGapRemoveDisableMatches: U.findGapRemoveDisableMatches,
    findGapRemoveAtTime: U.findGapRemoveAtTime,
    isGapPreviewActive: U.isGapPreviewActive,
    getGapPlaybackSkip: U.getGapPlaybackSkip,
    mapGapRemovedTime: U.mapGapRemovedTime,
    buildGapRemovedIntervals: U.buildGapRemovedIntervals,
  });
})(typeof window !== 'undefined' ? window : globalThis);
