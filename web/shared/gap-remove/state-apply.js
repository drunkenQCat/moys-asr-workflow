// 把区间写进空隙投影：置为移除/恢复、清理某段、并查合并，以及移动与边界调整记录的落地。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveStateApply(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function applyGapStateRange(gaps, startMs, endMs, removed, preserveUncovered = false) {
    const source = coalesceGapRemoveGaps(gaps);
    const start = Math.max(0, Math.round(Math.min(Number(startMs), Number(endMs))));
    const end = Math.max(0, Math.round(Math.max(Number(startMs), Number(endMs))));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return source;
    const next = [];
    source.forEach((gap) => {
      if (gap.end <= start || gap.start >= end) {
        next.push({ ...gap });
        return;
      }
      if (gap.start < start) next.push({ ...gap, end: start });
      if (!removed && !preserveUncovered) {
        next.push({
          start: Math.max(gap.start, start),
          end: Math.min(gap.end, end),
          removed: false,
        });
      }
      if (gap.end > end) next.push({ ...gap, start: end });
    });
    if (removed || preserveUncovered) next.push({ start, end, removed });
    return coalesceGapRemoveGaps(next);
  }

  // Remove a range from the current gap projection without adding a visible
  // `removed:false` restoration layer. Boundary resizing uses this operation
  // when an enabled gap is shortened, so the gap remains one whole object.
  function clearGapStateRange(gaps, startMs, endMs, state = null) {
    const source = coalesceGapRemoveGaps(gaps);
    const start = Math.max(0, Math.round(Math.min(Number(startMs), Number(endMs))));
    const end = Math.max(0, Math.round(Math.max(Number(startMs), Number(endMs))));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return source;
    const next = [];
    source.forEach((gap) => {
      if (gap.end <= start || gap.start >= end) {
        next.push({ ...gap });
        return;
      }
      if (state !== null && gap.removed !== state) {
        next.push({ ...gap });
        return;
      }
      if (gap.start < start) next.push({ ...gap, end: start });
      if (gap.end > end) next.push({ ...gap, start: end });
    });
    return coalesceGapRemoveGaps(next);
  }

  function applyGapMoveRecord(gaps, record) {
    if (!U.isGapMoveRecord(record)) return gaps;
    const removed = record.removed !== false;
    let result = clearGapStateRange(
      gaps,
      record.base_start,
      record.base_end,
      removed,
    );
    U.gapMoveTargetRanges(record).forEach((target) => {
      result = applyGapStateRange(
        result,
        target.start,
        target.end,
        removed,
        !removed,
      );
    });
    return result;
  }

  function applyBoundaryResizeRecord(gaps, record) {
    if (!U.isBoundaryResizeRecord(record)) return gaps;
    const base = Math.round(Number(record.base));
    const boundary = Math.round(Number(record.boundary));
    const removed = record.removed !== false;
    let result = gaps;
    U.gapBoundaryClearedRanges(record).forEach((range) => {
      result = clearGapStateRange(result, range.start, range.end);
    });
    if (record.edge === 'start') {
      if (boundary > base) {
        // A smaller restored Gap is not an instruction to activate the
        // vacated edge. Remove that visible range just as an enabled Gap
        // shrink does, so no new orange Gap appears beside it.
        return clearGapStateRange(result, base, boundary);
      }
      return removed
        ? applyGapStateRange(result, boundary, base, true)
        : applyGapStateRange(result, boundary, base, false, true);
    }
    if (boundary < base) {
      return clearGapStateRange(result, boundary, base);
    }
    return removed
      ? applyGapStateRange(result, base, boundary, true)
      : applyGapStateRange(result, base, boundary, false, true);
  }

  function coalesceGapRemoveGaps(gaps) {
    const result = [];
    U.normalizeGapRemoveGaps(gaps).forEach((gap) => {
      const previous = result[result.length - 1];
      if (!previous) {
        result.push({ ...gap });
        return;
      }
      if (gap.start <= previous.end && gap.removed === previous.removed) {
        previous.end = Math.max(previous.end, gap.end);
        return;
      }
      const start = Math.max(gap.start, previous.end);
      if (gap.end > start) result.push({ ...gap, start });
    });
    return result;
  }

  function applyGapRemoveRange(gaps, startMs, endMs, removed) {
    const source = coalesceGapRemoveGaps(gaps);
    const start = Math.max(0, Math.round(Math.min(Number(startMs), Number(endMs))));
    const end = Math.max(0, Math.round(Math.max(Number(startMs), Number(endMs))));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return source;

    const next = [];
    source.forEach((gap) => {
      if (gap.end <= start || gap.start >= end) {
        next.push({ ...gap });
        return;
      }
      if (gap.start < start) next.push({ ...gap, end: start });
      if (!removed) {
        next.push({
          start: Math.max(gap.start, start),
          end: Math.min(gap.end, end),
          removed: false,
        });
      }
      if (gap.end > end) next.push({ ...gap, start: end });
    });
    if (removed) next.push({ start, end, removed: true });
    return coalesceGapRemoveGaps(next);
  }

  function shrinkGapRemoveGaps(gaps, leadInMs, leadOutMs) {
    const source = coalesceGapRemoveGaps(gaps);
    const leadIn = U.clampInteger(leadInMs, 40, 0, 2000);
    const leadOut = U.clampInteger(leadOutMs, 80, 0, 2000);
    return coalesceGapRemoveGaps(source
      .map((gap) => ({
        ...gap,
        start: gap.start + leadIn,
        end: gap.end - leadOut,
      }))
      .filter((gap) => gap.end > gap.start));
  }

  // 将一个已有区段作为整体平移或复制到目标位置。与人工“范围移除”不同，
  // 这里保留区段的 removed 状态，因此恢复区段也可以被整体拖动/复制。
  function overlayGapRemoveRange(gaps, startMs, endMs, removed) {
    const source = coalesceGapRemoveGaps(gaps);
    const start = Math.max(0, Math.round(Math.min(Number(startMs), Number(endMs))));
    const end = Math.max(0, Math.round(Math.max(Number(startMs), Number(endMs))));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return source;
    const next = [];
    source.forEach((gap) => {
      if (gap.end <= start || gap.start >= end) {
        next.push({ ...gap });
        return;
      }
      if (gap.start < start) next.push({ ...gap, end: start });
      if (gap.end > end) next.push({ ...gap, start: end });
    });
    next.push({ start, end, removed: removed !== false });
    return coalesceGapRemoveGaps(next);
  }

  Object.assign(U, {
    applyGapStateRange,
    clearGapStateRange,
    applyGapMoveRecord,
    applyBoundaryResizeRecord,
    coalesceGapRemoveGaps,
    applyGapRemoveRange,
    shrinkGapRemoveGaps,
    overlayGapRemoveRange,
  });
})(typeof window !== 'undefined' ? window : globalThis);
