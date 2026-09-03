// 在给定时刻切分字幕、规范化新字幕范围并重映射词项。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformSegmentSplit(global) {
  'use strict';

  const U = global.MaweWaveform;

  // Safe split point selection for the razor tool. Given a segment and a
  // pointer time, prefer the nearest item boundary (midpoint between adjacent
  // items' end/start); otherwise fall back to the integer millisecond nearest
  // the pointer. Refuse any split within minEdge of either segment edge so a
  // razor click never produces a sub-100ms sliver. Returns { left, right,
  // splitMs } with cloned items allocated by time, or null when refused.
  function splitSegmentAtTime(segment, timeMs, minEdge = U.MIN_CUE_MS) {
    if (!segment) return null;
    const start = Math.round(Number(segment.start));
    const end = Math.round(Number(segment.end));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < minEdge * 2) return null;
    const target = Number.isFinite(Number(timeMs)) ? Number(timeMs) : (start + end) / 2;

    const items = Array.isArray(segment.items) ? segment.items : [];
    // Collect candidate item-boundary times (midpoint between adjacent items).
    const boundaries = [];
    for (let i = 1; i < items.length; i++) {
      const prevEnd = Number(items[i - 1].end);
      const nextStart = Number(items[i].start);
      if (Number.isFinite(prevEnd) && Number.isFinite(nextStart)) {
        boundaries.push(Math.round((prevEnd + nextStart) / 2));
      }
    }
    let splitMs;
    if (boundaries.length) {
      splitMs = boundaries.reduce((best, value) => (
        Math.abs(value - target) <= Math.abs(best - target) ? value : best
      ), boundaries[0]);
    } else {
      splitMs = Math.round(target);
    }
    splitMs = U.clamp(splitMs, start + minEdge, end - minEdge);
    if (splitMs <= start + minEdge - 1 || splitMs >= end - minEdge + 1) return null;

    const leftItems = [];
    const rightItems = [];
    for (const item of items) {
      const itemStart = Number(item.start);
      const itemEnd = Number(item.end);
      // An item straddling the split snaps to the side whose start is closer.
      if (Number.isFinite(itemEnd) && itemEnd <= splitMs) {
        leftItems.push({ ...item });
      } else if (Number.isFinite(itemStart) && itemStart >= splitMs) {
        rightItems.push({ ...item });
      } else if (Number.isFinite(itemStart) && Number.isFinite(itemEnd)) {
        // 跨越切点的 item 归入更近的一侧，并把时间钳到该侧边界内，
        // 避免 item 越出所属段导致保存校验失败。
        if (splitMs - itemStart <= itemEnd - splitMs) {
          leftItems.push({ ...item, end: Math.min(itemEnd, splitMs) });
        } else {
          rightItems.push({ ...item, start: Math.max(itemStart, splitMs) });
        }
      } else {
        leftItems.push({ ...item });
      }
    }

    const clone = (base) => ({ ...base });
    const left = clone(segment);
    const right = clone(segment);
    left.start = start;
    left.end = splitMs;
    right.start = splitMs;
    right.end = end;
    left.items = leftItems.length ? leftItems : null;
    right.items = rightItems.length ? rightItems : null;
    left._dirty = true;
    right._dirty = true;
    return { left, right, splitMs };
  }

  function normalizeNewCueRange(start, end, duration, previousEnd = 0, nextStart = duration, minDuration = U.MIN_CUE_MS) {
    const lower = U.clamp(U.roundMs(previousEnd), 0, Math.max(0, duration));
    const upper = U.clamp(U.roundMs(nextStart), lower, Math.max(lower, duration));
    const nextStartMs = U.clamp(U.roundMs(start), lower, upper);
    const nextEndMs = U.clamp(U.roundMs(end), lower, upper);
    if (nextEndMs - nextStartMs < minDuration) return null;
    return { start: nextStartMs, end: nextEndMs };
  }

  function remapItems(items, oldStart, oldEnd, newStart, newEnd) {
    if (!Array.isArray(items) || !items.length) return items;
    const oldDuration = Math.max(1, oldEnd - oldStart);
    const newDuration = Math.max(1, newEnd - newStart);
    return items.map((item) => {
      // 等比缩放后钳回段内，并保证 end > start（防止取整后出现 0 长词块）。
      const mappedStart = U.roundMs(newStart + ((item.start - oldStart) / oldDuration) * newDuration);
      const mappedEnd = U.roundMs(newStart + ((item.end - oldStart) / oldDuration) * newDuration);
      let start = Math.min(Math.max(mappedStart, newStart), newEnd);
      const end = Math.min(Math.max(mappedEnd, start + 1), newEnd);
      if (end <= start) start = Math.max(newStart, end - 1);
      return { ...item, start, end };
    });
  }

  Object.assign(U, {
    splitSegmentAtTime,
    normalizeNewCueRange,
    remapItems,
  });
})(typeof window !== 'undefined' ? window : globalThis);
