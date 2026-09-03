// 整轨文本编辑的当前轨别、待改段落与来源选区。
// 自 web/editor/text/timed-edit.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweText；
// 兼容出口 window.MaweTimedTextEdit 仍由 editor/text/timed-edit/compat-surface.js 统一组装。
(function initMaweTimedEditSourceState(global) {
  'use strict';

  const U = global.MaweText;



  // === 纯文本编辑（支持调整字幕行结构的 MVP） ===
  function timedTextEditSegments(kind) {
    return kind === 'extension' ? MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments || [] : MaweBoot.DATA.segments;
  }



  function timedTextEditSourceSelection(kind, showDisabled = false) {
    const allSegments = timedTextEditSegments(kind);
    const sourceSegmentIndexes = allSegments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => showDisabled || segment?.disabled !== true)
      .map(({ index }) => index);
    return {
      allSegments,
      sourceSegmentIndexes,
      sourceSegments: sourceSegmentIndexes.map((index) => allSegments[index]),
    };
  }



  function currentTimedTextEditKind() {
    const panelTarget = MaweCuePanel.getCurrentCuePanelTarget?.();
    if (panelTarget?.kind === 'extension' && panelTarget.track?.segments?.length) return 'extension';
    if (MaweSelection.selectedIdxs.size === 0 && MaweSelection.selectedExtensionIdxs.size > 0
        && MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments?.length) return 'extension';
    return 'main';
  }



  function timedTextEditTrackLabel(kind) {
    if (kind !== 'extension') return '主字幕';
    const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
    return track?.name ? `副字幕（${track.name}）` : '副字幕';
  }



  function timedTextEditHasUnappliedChanges() {
    return Boolean(MaweDom.timedTextEditDraft?.report?.stats.changedSegments || MaweDom.timedTextEditDraft?.singleLineError);
  }

  Object.assign(U, {
    timedTextEditSegments,
    timedTextEditSourceSelection,
    currentTimedTextEditKind,
    timedTextEditTrackLabel,
    timedTextEditHasUnappliedChanges,
  });
})(typeof window !== 'undefined' ? window : globalThis);
