// 只读查询与播放跳转：已移除区间、禁用匹配、命中查找、跳过区间与时间映射。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveGapQueries(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function getRemovedGapRanges(gaps) {
    const merged = [];
    U.normalizeGapRemoveGaps(gaps).filter((gap) => gap.removed).forEach((gap) => {
      const previous = merged[merged.length - 1];
      if (previous && gap.start <= previous.end) {
        previous.end = Math.max(previous.end, gap.end);
      } else {
        merged.push({ start: gap.start, end: gap.end });
      }
    });
    return merged;
  }

  function findGapRemoveDisableMatches(segments, gaps, options = {}) {
    const coverageThreshold = U.clampGapRemoveDisableCoverage(options.coveragePercent);
    const remainingThreshold = U.clampGapRemoveDisableRemaining(options.remainingMs);
    const removedRanges = getRemovedGapRanges(gaps);
    const source = Array.isArray(segments) ? segments : [];
    const matches = [];
    source.forEach((segment, index) => {
      const start = Number(segment?.start);
      const end = Number(segment?.end);
      const durationMs = end - start;
      if (!Number.isFinite(start) || !Number.isFinite(end) || durationMs <= 0) return;
      const coveredMs = removedRanges.reduce((total, range) => {
        const overlap = Math.min(end, range.end) - Math.max(start, range.start);
        return total + Math.max(0, overlap);
      }, 0);
      const remainingMs = Math.max(0, durationMs - coveredMs);
      const coveragePercent = (coveredMs / durationMs) * 100;
      if (coveragePercent + Number.EPSILON < coverageThreshold || remainingMs > remainingThreshold) return;
      matches.push({ index, durationMs, coveredMs, remainingMs, coveragePercent });
    });
    return matches;
  }

  // Callers keep gap arrays canonical between renders, so this lookup stays a
  // cheap linear scan on the small number of manually visible ranges.
  function findGapRemoveAtTime(gaps, timeMs, removedOnly = false) {
    const time = Number(timeMs);
    if (!Number.isFinite(time) || !Array.isArray(gaps)) return null;
    return gaps.find((gap) => (
      (!removedOnly || gap?.removed !== false)
      && time >= Number(gap?.start)
      && time < Number(gap?.end)
    )) || null;
  }

  function isGapPreviewActive(gap, timeMs, previewRange) {
    if (!gap || !previewRange) return false;
    const time = Number(timeMs);
    return Number.isFinite(time)
      && time >= Number(previewRange.start)
      && time < Number(previewRange.end)
      && Number(gap.start) === Number(previewRange.start)
      && Number(gap.end) === Number(previewRange.end);
  }

  // Return the removed range that playback should skip, or null when playback
  // is paused, when the user explicitly previewed this range, or when skipping
  // is disabled. Keeping the paused check here prevents a seek from being
  // immediately undone before the user has a chance to audition the gap.
  function getGapPlaybackSkip(gaps, timeMs, {
    skipPlayback = false,
    isPlaying = false,
    previewRange = null,
  } = {}) {
    if (skipPlayback !== true || isPlaying !== true) return null;
    const gap = findGapRemoveAtTime(gaps, timeMs, true);
    return gap && !isGapPreviewActive(gap, timeMs, previewRange) ? gap : null;
  }

  function mapGapRemovedTime(sourceMs, gaps) {
    const source = Math.max(0, Math.round(Number(sourceMs) || 0));
    let removedBefore = 0;
    for (const gap of getRemovedGapRanges(gaps)) {
      if (source <= gap.start) break;
      if (source < gap.end) return Math.max(0, gap.start - removedBefore);
      removedBefore += gap.end - gap.start;
    }
    return Math.max(0, source - removedBefore);
  }

  function buildGapRemovedIntervals(durationMs, gaps) {
    const duration = Math.max(0, Math.round(Number(durationMs) || 0));
    const intervals = [];
    let cursor = 0;
    getRemovedGapRanges(gaps).forEach((gap) => {
      const start = Math.min(duration, Math.max(cursor, gap.start));
      const end = Math.min(duration, Math.max(start, gap.end));
      if (start > cursor) intervals.push({ start: cursor, end: start });
      cursor = Math.max(cursor, end);
    });
    if (cursor < duration) intervals.push({ start: cursor, end: duration });
    return intervals;
  }

  Object.assign(U, {
    getRemovedGapRanges,
    findGapRemoveDisableMatches,
    findGapRemoveAtTime,
    isGapPreviewActive,
    getGapPlaybackSkip,
    mapGapRemovedTime,
    buildGapRemovedIntervals,
  });
})(typeof window !== 'undefined' ? window : globalThis);
