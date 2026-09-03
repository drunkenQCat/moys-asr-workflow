// 文本偏移与时间的互相换算，以及按时间反查可拆位置。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitOffsetTiming(global) {
  'use strict';

  const U = global.MaweSplit;



  function splitTimeForTextOffset(segment, offset) {
    const timing = U.splitItemsAtChar(segment, offset);
    if (Number.isFinite(timing.splitMs)) return timing.splitMs;
    const text = String(segment?.text || '');
    const safeOffset = Math.max(0, Math.min(text.length, Number(offset) || 0));
    return Number(segment?.start)
      + ((Number(segment?.end) - Number(segment?.start)) * safeOffset) / Math.max(1, text.length);
  }



  function shouldUseMainSplitTimestamps(segment) {
    return MaweSettings.EDITOR_SETTINGS.splitUseWordTimestamps
      && window.AsrEditorUtils.hasUsableSplitTimestamps(segment);
  }



  function notifyMainSplitTimestampFallback(segment) {
    if (!MaweSettings.EDITOR_SETTINGS.splitUseWordTimestamps
        || window.AsrEditorUtils.hasUsableSplitTimestamps(segment)) return;
    const message = '已勾选“主字幕自动使用时间码拆分”，但当前主字幕没有可用的字词时间码，本次设置不生效，已改用拆分面板。';
    MaweHint.flashHint(window.MAWE_I18N?.translateText?.(message) || message, 'warning');
  }



  function splitOffsetNearTime(segment, timeMs, splitMode) {
    const legalOffsets = window.AsrEditorUtils.subtitleSplitOffsets(segment?.text || '', splitMode);
    if (!legalOffsets.length) return null;
    const timestampOffset = window.AsrEditorUtils.hasUsableSplitTimestamps(segment)
      ? window.AsrEditorUtils.splitCharOffsetAtTime(segment, timeMs)
      : null;
    if (Number.isInteger(timestampOffset)) {
      return legalOffsets.reduce((best, candidate) => (
        Math.abs(candidate - timestampOffset) < Math.abs(best - timestampOffset) ? candidate : best
      ), legalOffsets[0]);
    }
    return window.AsrEditorUtils.nearestSubtitleSplitOffset(
      segment.text, timeMs, segment.start, segment.end, splitMode,
    );
  }



  function splitOffsetNearTextPosition(text, offset, splitMode) {
    const legalOffsets = window.AsrEditorUtils.subtitleSplitOffsets(text || '', splitMode);
    if (!legalOffsets.length) return null;
    const requested = Math.max(0, Math.min(String(text || '').length, Math.round(Number(offset) || 0)));
    return legalOffsets.reduce((best, candidate) => (
      Math.abs(candidate - requested) < Math.abs(best - requested) ? candidate : best
    ), legalOffsets[0]);
  }

  Object.assign(U, {
    splitTimeForTextOffset,
    shouldUseMainSplitTimestamps,
    notifyMainSplitTimestampFallback,
    splitOffsetNearTime,
    splitOffsetNearTextPosition,
  });
})(typeof window !== 'undefined' ? window : globalThis);
