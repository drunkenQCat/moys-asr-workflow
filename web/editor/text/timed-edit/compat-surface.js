// window.MaweTimedTextEdit 兼容出口：结构、键名与键序与拆分前完全一致（契约测试逐项比对），
// 取值来自 editor/text/timed-edit/ 各模块发布到 window.MaweText 的内部符号。内部 helper 不要往这里加。
// 必须在 editor/text/timed-edit/ 全部模块之后加载。
(function initMaweTextCompatSurface(global) {
  'use strict';

  const U = global.MaweText;

  global.MaweTimedTextEdit = Object.freeze({
    timedTextEditSegments: U.timedTextEditSegments,
    timedTextEditSourceSelection: U.timedTextEditSourceSelection,
    currentTimedTextEditKind: U.currentTimedTextEditKind,
    timedTextEditTrackLabel: U.timedTextEditTrackLabel,
    appendTimedTextEditStat: U.appendTimedTextEditStat,
    appendTimedTextEditDivider: U.appendTimedTextEditDivider,
    appendTimedTextEditDiffLine: U.appendTimedTextEditDiffLine,
    renderTimedTextEditRowDiff: U.renderTimedTextEditRowDiff,
    timedTextEditMappingLabel: U.timedTextEditMappingLabel,
    timedTextEditCoverageClass: U.timedTextEditCoverageClass,
    renderTimedTextEditMetric: U.renderTimedTextEditMetric,
    renderTimedTextEditChangeList: U.renderTimedTextEditChangeList,
    renderTimedTextEditRows: U.renderTimedTextEditRows,
    timedTextEditCanUseSingleView: U.timedTextEditCanUseSingleView,
    renderTimedTextEditView: U.renderTimedTextEditView,
    timedTextEditRowFilterKey: U.timedTextEditRowFilterKey,
    timedTextEditDraftRowReports: U.timedTextEditDraftRowReports,
    normalizeTimedTextEditDraftLines: U.normalizeTimedTextEditDraftLines,
    syncTimedTextEditDraftFromDom: U.syncTimedTextEditDraftFromDom,
    cancelTimedTextEditReport: U.cancelTimedTextEditReport,
    flushTimedTextEditReport: U.flushTimedTextEditReport,
    scheduleTimedTextEditReport: U.scheduleTimedTextEditReport,
    updateTimedTextEditReport: U.updateTimedTextEditReport,
    refreshTimedTextEditTrackOptions: U.refreshTimedTextEditTrackOptions,
    loadTimedTextEditTrack: U.loadTimedTextEditTrack,
    refreshTimedTextEditButton: U.refreshTimedTextEditButton,
    closeTimedTextEdit: U.closeTimedTextEdit,
    timedTextEditHasUnappliedChanges: U.timedTextEditHasUnappliedChanges,
    mergeTimedTextEditSegmentsWithHidden: U.mergeTimedTextEditSegmentsWithHidden,
    applyTimedTextEditSegments: U.applyTimedTextEditSegments,
    requestCloseTimedTextEdit: U.requestCloseTimedTextEdit,
    openTimedTextEdit: U.openTimedTextEdit
  });
})(typeof window !== 'undefined' ? window : globalThis);
