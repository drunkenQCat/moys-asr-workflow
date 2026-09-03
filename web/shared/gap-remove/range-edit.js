// 空隙整体平移/复制与边界拖拽的取值、覆盖区间、落地记录。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveRangeEdit(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function translateGapRemoveRange(gaps, index, deltaMs, durationMs, copy) {
    const source = U.coalesceGapRemoveGaps(gaps);
    const gapIndex = Math.round(Number(index));
    const delta = Math.round(Number(deltaMs));
    if (!Number.isFinite(gapIndex) || !Number.isFinite(delta)
        || gapIndex < 0 || gapIndex >= source.length) return source;
    const original = source[gapIndex];
    const durationValue = Number(durationMs);
    const hasDuration = Number.isFinite(durationValue) && durationValue > 0;
    const duration = hasDuration ? Math.round(durationValue) : Infinity;
    const length = Math.min(original.end - original.start, duration);
    if (!Number.isFinite(length) || length <= 0) return source;
    const maxStart = Math.max(0, duration - length);
    const start = Math.min(maxStart, Math.max(0, original.start + delta));
    const end = start + length;
    if (start === original.start && end === original.end) return source;
    const remaining = copy ? source : source.filter((_, sourceIndex) => sourceIndex !== gapIndex);
    return U.overlayGapRemoveRange(remaining, start, end, original.removed);
  }

  function moveGapRemoveRange(gaps, index, deltaMs, durationMs) {
    return translateGapRemoveRange(gaps, index, deltaMs, durationMs, false);
  }

  function copyGapRemoveRange(gaps, index, deltaMs, durationMs) {
    return translateGapRemoveRange(gaps, index, deltaMs, durationMs, true);
  }

  function gapBoundaryTarget(gap, edge, valueMs, minimumMs = 10) {
    if (!gap || !U.GAP_REMOVE_BOUNDARY_EDGES.includes(edge)) return null;
    const value = Math.round(Number(valueMs));
    const minimum = Math.max(1, Math.round(Number(minimumMs) || 10));
    if (!Number.isFinite(value)) return null;
    if (edge === 'start') {
      return {
        ...gap,
        start: Math.min(gap.end - minimum, Math.max(0, value)),
      };
    }
    return {
      ...gap,
      end: Math.max(gap.start + minimum, value),
    };
  }

  function gapBoundaryExpansionRange(original, target, edge) {
    if (!original || !target || !U.GAP_REMOVE_BOUNDARY_EDGES.includes(edge)) return null;
    if (edge === 'start' && target.start < original.start) {
      return {start: target.start, end: original.start};
    }
    if (edge === 'end' && target.end > original.end) {
      return {start: original.end, end: target.end};
    }
    return null;
  }

  // Full coverage clears that whole visible Gap. Partial coverage only clears
  // the intersecting part, so the untouched side keeps its original state.
  function gapBoundaryCoveredRanges(gaps, index, original, target, edge) {
    const expansion = gapBoundaryExpansionRange(original, target, edge);
    if (!expansion) return [];
    return U.normalizeGapRangeList(gaps.flatMap((gap, gapIndex) => {
      if (gapIndex === index || gap.end <= expansion.start || gap.start >= expansion.end) return [];
      if (expansion.start <= gap.start && expansion.end >= gap.end) {
        return [{start: gap.start, end: gap.end}];
      }
      return [{
        start: Math.max(gap.start, expansion.start),
        end: Math.min(gap.end, expansion.end),
      }];
    }));
  }

  function resizeGapRemoveBoundary(gaps, index, edge, valueMs, minimumMs = 10) {
    const source = U.coalesceGapRemoveGaps(gaps);
    const gapIndex = Math.round(Number(index));
    if (!Number.isFinite(gapIndex)
        || gapIndex < 0 || gapIndex >= source.length || !['start', 'end'].includes(edge)) {
      return source;
    }
    const original = source[gapIndex];
    const target = gapBoundaryTarget(original, edge, valueMs, minimumMs);
    if (!target || (target.start === original.start && target.end === original.end)) return source;
    // The dragged edge owns its target range. It must not turn a shared
    // boundary into a coupled resize of the neighboring Gap.
    return U.overlayGapRemoveRange(
      source.filter((_, sourceIndex) => sourceIndex !== gapIndex),
      target.start,
      target.end,
      target.removed,
    );
  }

  function resizedGapAtBoundary(gaps, index, edge, nextGaps) {
    const original = gaps[index];
    if (!original) return null;
    const anchor = edge === 'start' ? original.end - 1 : original.start + 1;
    return nextGaps.find((gap) => (
      gap.removed === original.removed && gap.start <= anchor && gap.end > anchor
    )) || null;
  }

  function boundaryResizeChange(original, target, edge) {
    if (!original || !target || !U.GAP_REMOVE_BOUNDARY_EDGES.includes(edge)) return null;
    const boundary = Math.round(Number(target[edge]));
    const current = Math.round(Number(original[edge]));
    if (!Number.isFinite(boundary) || boundary === current) return null;
    return { original, edge, boundary };
  }

  function findBoundaryResizeRecordIndex(provenance, original, edge, usedChanges = []) {
    const current = Math.round(Number(original?.[edge]));
    for (let index = provenance.manual_overrides.length - 1; index >= 0; index -= 1) {
      const record = provenance.manual_overrides[index];
      if (!U.isBoundaryResizeRecord(record) || record.edge !== edge
          || record.removed !== (original.removed !== false)
          || record.boundary !== current) continue;
      if (usedChanges.some((used) => used.recordId && used.recordId === record.id)) continue;
      return index;
    }
    return -1;
  }

  function upsertBoundaryResizeRecord(provenance, change, usedChanges = []) {
    const { original, edge, boundary, clearedRanges = [] } = change;
    const current = Math.round(Number(original[edge]));
    const candidateIndex = findBoundaryResizeRecordIndex(provenance, original, edge, usedChanges);
    const candidate = candidateIndex >= 0 ? provenance.manual_overrides[candidateIndex] : null;
    const base = candidate ? Math.round(Number(candidate.base)) : current;
    const nextClearedRanges = U.normalizeGapRangeList([
      ...U.gapBoundaryClearedRanges(candidate),
      ...clearedRanges,
    ]);
    const next = provenance.manual_overrides.filter((_, index) => index !== candidateIndex);
    if (boundary !== base || nextClearedRanges.length) {
      next.push({
        id: candidate?.id,
        source: 'manual',
        start: Math.min(base, boundary, ...nextClearedRanges.map((range) => range.start)),
        end: Math.max(base, boundary, ...nextClearedRanges.map((range) => range.end)),
        removed: original.removed !== false,
        operation: U.GAP_REMOVE_MANUAL_OPERATION_BOUNDARY_RESIZE,
        edge,
        base,
        boundary,
        ...(nextClearedRanges.length ? {cleared_ranges: nextClearedRanges} : {}),
      });
    }
    const normalized = U.normalizeGapRemoveProvenance({
      ...provenance,
      manual_overrides: next,
    });
    return {
      provenance: normalized,
      recordId: candidate?.id || normalized.manual_overrides[normalized.manual_overrides.length - 1]?.id,
    };
  }

  Object.assign(U, {
    translateGapRemoveRange,
    moveGapRemoveRange,
    copyGapRemoveRange,
    gapBoundaryTarget,
    gapBoundaryExpansionRange,
    gapBoundaryCoveredRanges,
    resizeGapRemoveBoundary,
    resizedGapAtBoundary,
    boundaryResizeChange,
    findBoundaryResizeRecordIndex,
    upsertBoundaryResizeRecord,
  });
})(typeof window !== 'undefined' ? window : globalThis);
