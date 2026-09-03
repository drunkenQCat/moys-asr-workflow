// 时长展示文本：秒表式与人因化两种口径。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibDurationFormat(global) {
  'use strict';

  const U = global.MaweLib;

  function formatHumanDuration(durationMs) {
    const totalSeconds = Math.max(0, Math.floor(Number(durationMs) / 1000) || 0);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 1) return `${totalSeconds}秒`;
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    if (hours < 1) return `${minutes}分${seconds ? `${seconds}秒` : ''}`;
    return `${hours}小时${minutes ? `${minutes}分` : ''}${seconds ? `${seconds}秒` : ''}`;
  }

  function formatGapRemoveDuration(removedMs, mediaDurationMs) {
    const durationLabel = formatHumanDuration(removedMs);
    const mediaDuration = Number(mediaDurationMs);
    if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) return durationLabel;
    const percentage = Math.min(100, Math.max(0, (Number(removedMs) / mediaDuration) * 100));
    const percentageLabel = Number(percentage.toFixed(1)).toString();
    return `${durationLabel}（占比 ${percentageLabel}%）`;
  }

  Object.assign(U, {
    formatHumanDuration,
    formatGapRemoveDuration,
  });
})(typeof window !== 'undefined' ? window : globalThis);
