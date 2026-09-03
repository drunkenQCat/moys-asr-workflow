// 按时刻定位字幕：活动字幕、重叠区间与跨行延续边界。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformCueLookup(global) {
  'use strict';

  const U = global.MaweWaveform;

  // 与字幕列表保持一致：相邻字幕共用边界时，边界属于后一条；间隙和最后一条
  // 的结束时刻仍沿用当前字幕作为播放头对应项。
  function isActiveCueAtTime(segments, index, timeMs, skipDisabled = true) {
    const segment = segments[index];
    if (!segment || (skipDisabled && segment.disabled) || timeMs < Number(segment.start)) return false;
    let next = null;
    for (let nextIndex = index + 1; nextIndex < segments.length; nextIndex += 1) {
      if (!skipDisabled || !segments[nextIndex]?.disabled) {
        next = segments[nextIndex];
        break;
      }
    }
    return timeMs < Number(segment.end) || !next || Number(next.start) > timeMs;
  }

  function lastCueIndexAtOrBefore(segments, timeMs) {
    let low = 0;
    let high = segments.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      const start = Number(segments[middle]?.start);
      if (Number.isFinite(start) && start <= timeMs) low = middle + 1;
      else high = middle;
    }
    return low - 1;
  }

  // 波形块的 active 轮廓是纯视觉提示：只有播放头真正落在 [start, end) 内才点亮。
  // 空隙中沿用的“当前字幕”（导航 / 逻辑语义，见 isActiveCueAtTime）不点亮轮廓。
  function isActiveCueVisualHit(segments, index, timeMs) {
    const segment = segments[index];
    const time = Number(timeMs);
    return Boolean(segment) && Number(segment.start) <= time && time < Number(segment.end);
  }

  function firstCueIndexOverlapping(segments, startMs) {
    let low = 0;
    let high = segments.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      const start = Number(segments[middle]?.start);
      if (Number.isFinite(start) && start < startMs) low = middle + 1;
      else high = middle;
    }
    if (low > 0 && Number(segments[low - 1]?.end) > startMs) return low - 1;
    return low;
  }

  function cueBlockContinuationEdges(segment, startMs, endMs) {
    const segmentStart = Number(segment?.start);
    const segmentEnd = Number(segment?.end);
    const rowStart = Number(startMs);
    const rowEnd = Number(endMs);
    return {
      fromPreviousRow: Number.isFinite(segmentStart) && Number.isFinite(rowStart) && segmentStart < rowStart,
      toNextRow: Number.isFinite(segmentEnd) && Number.isFinite(rowEnd) && segmentEnd > rowEnd,
    };
  }

  function findActiveCueIndex(segments, timeMs, skipDisabled = true) {
    if (!Array.isArray(segments) || !segments.length || !Number.isFinite(Number(timeMs))) return -1;
    let index = lastCueIndexAtOrBefore(segments, Number(timeMs));
    if (skipDisabled) {
      while (index >= 0 && segments[index]?.disabled) index -= 1;
    }
    return index >= 0 && isActiveCueAtTime(segments, index, Number(timeMs), skipDisabled)
      ? index : -1;
  }

  Object.assign(U, {
    isActiveCueAtTime,
    lastCueIndexAtOrBefore,
    isActiveCueVisualHit,
    firstCueIndexOverlapping,
    cueBlockContinuationEdges,
    findActiveCueIndex,
  });
})(typeof window !== 'undefined' ? window : globalThis);
