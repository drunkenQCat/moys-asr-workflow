// 移动与边界调整写回来源记录：去重、目标区间拆分与吸收。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveProvenanceMove(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function gapRemoveRangesEqual(left, right) {
    const a = U.normalizeGapRemoveGaps(left);
    const b = U.normalizeGapRemoveGaps(right);
    return a.length === b.length && a.every((gap, index) => {
      const other = b[index];
      return other && gap.start === other.start && gap.end === other.end
        && gap.removed === other.removed;
    });
  }

  function movedGapAtTarget(gaps, original, start, end) {
    const sameState = (gap) => gap && gap.removed === original.removed;
    return gaps.find((gap) => sameState(gap) && gap.start <= start && gap.end >= end)
      || gaps.find((gap) => {
        const anchor = start + Math.max(1, end - start) / 2;
        return sameState(gap) && gap.start <= anchor && gap.end > anchor;
      })
      || null;
  }

  function upsertGapMoveRecord(provenance, change, absorbRanges = []) {
    const { original, target } = change;
    const removed = original.removed !== false;
    let candidateIndex = -1;
    let candidateTargetIndex = -1;
    for (let index = provenance.manual_overrides.length - 1; index >= 0; index -= 1) {
      const record = provenance.manual_overrides[index];
      if (!U.isGapMoveRecord(record) || record.removed !== removed) continue;
      const targetIndex = U.gapMoveTargetRanges(record).findIndex((range) => (
        range.start === original.start && range.end === original.end
      ));
      if (targetIndex < 0) continue;
      candidateIndex = index;
      candidateTargetIndex = targetIndex;
      break;
    }
    const candidate = candidateIndex >= 0 ? provenance.manual_overrides[candidateIndex] : null;
    const baseStart = candidate ? Math.round(Number(candidate.base_start)) : original.start;
    const baseEnd = candidate ? Math.round(Number(candidate.base_end)) : original.end;
    const candidateTargets = candidate ? U.gapMoveTargetRanges(candidate) : [];
    const nextTargets = candidate
      ? candidateTargets.map((range, index) => (
        index === candidateTargetIndex ? { start: target.start, end: target.end } : range
      ))
      : [{ start: target.start, end: target.end }];
    const targetReturnsToBase = target.start === baseStart && target.end === baseEnd;
    const removeRecord = targetReturnsToBase && (!candidate || candidateTargets.length === 1);
    const absorbed = removeRecord
      ? provenance
      : U.absorbGapRemoveProvenanceRanges(
        provenance,
        absorbRanges,
        candidate ? [candidate.id] : [],
        [],
        removed,
      );
    const next = absorbed.manual_overrides.filter((item) => (
      !candidate || item.id !== candidate.id
    ));
    if (!removeRecord) {
      next.push(U.createGapMoveRecord({
        id: candidate?.id,
        removed,
        baseStart,
        baseEnd,
        targetRanges: nextTargets,
      }));
    }
    const normalized = U.normalizeGapRemoveProvenance({
      ...absorbed,
      manual_overrides: next,
    });
    return {
      provenance: normalized,
      recordId: candidate?.id || normalized.manual_overrides[normalized.manual_overrides.length - 1]?.id,
    };
  }

  // Move one final visible Gap as a whole. The move is a single internal
  // operation: remove only the selected state from its base range and apply
  // that same state at the target. Repeating the move updates the operation,
  // so it never grows a chain of restoration masks.
  function moveGapRemoveProvenance(
    value,
    gaps,
    index,
    deltaMs,
    durationMs,
    fallbackGaps = [],
  ) {
    const visible = U.getGapRemoveDisplayGaps(gaps);
    const gapIndex = Math.round(Number(index));
    const provenance = U.normalizeGapRemoveProvenance(value, fallbackGaps);
    if (!Number.isFinite(gapIndex) || gapIndex < 0 || gapIndex >= visible.length) {
      return { changed: false, provenance, gaps: U.gapRangesFromProvenance(provenance) };
    }
    const original = visible[gapIndex];
    const delta = Math.round(Number(deltaMs));
    const durationValue = Number(durationMs);
    if (!Number.isFinite(delta)) {
      return { changed: false, provenance, gaps: U.gapRangesFromProvenance(provenance) };
    }
    const length = original.end - original.start;
    const duration = Number.isFinite(durationValue) && durationValue > 0
      ? Math.round(durationValue) : Infinity;
    const maxStart = Math.max(0, duration - length);
    const targetStart = Math.min(
      maxStart,
      Math.max(0, original.start + delta),
    );
    const targetEnd = targetStart + length;
    if (targetStart === original.start && targetEnd === original.end) {
      return { changed: false, provenance, gaps: U.gapRangesFromProvenance(provenance) };
    }
    // Keep the dragged block's geometry exact. `moveGapRemoveRange()` is a
    // useful visual overlay helper, but it coalesces adjacent ranges; using
    // that merged result as the persisted target makes an active Gap pull an
    // adjacent inactive Gap along with it.
    const target = { ...original, start: targetStart, end: targetEnd };
    const absorbRanges = U.subtractGapAbsorbRanges(
      target,
      [{ start: original.start, end: original.end }],
    ).map((range) => ({ start: range.start, end: range.end }));
    const recordResult = upsertGapMoveRecord(
      provenance,
      { original, target },
      absorbRanges,
    );
    return {
      changed: true,
      provenance: recordResult.provenance,
      gaps: U.gapRangesFromProvenance(recordResult.provenance),
      original,
      target,
    };
  }

  // Resize the final visible Gap as one object. The persisted boundary
  // operation is updated in place (and moved to the end of the manual action
  // order), so repeated drags never append a stack of restoration masks.
  function resizeGapRemoveProvenanceBoundary(
    value,
    gaps,
    index,
    edge,
    valueMs,
    fallbackGaps = [],
  ) {
    const visible = U.getGapRemoveDisplayGaps(gaps);
    const gapIndex = Math.round(Number(index));
    const provenance = U.normalizeGapRemoveProvenance(value, fallbackGaps);
    if (!Number.isFinite(gapIndex) || gapIndex < 0 || gapIndex >= visible.length
        || !U.GAP_REMOVE_BOUNDARY_EDGES.includes(edge)) {
      return { changed: false, provenance, gaps: U.gapRangesFromProvenance(provenance) };
    }
    const original = visible[gapIndex];
    const target = U.gapBoundaryTarget(original, edge, valueMs);
    if (!target || (target.start === original.start && target.end === original.end)) {
      return { changed: false, provenance, gaps: U.gapRangesFromProvenance(provenance) };
    }
    const clearedRanges = U.gapBoundaryCoveredRanges(visible, gapIndex, original, target, edge);
    const cleanedProvenance = U.clearStaticGapRemoveProvenanceRanges(
      provenance,
      clearedRanges,
      fallbackGaps,
    );
    const recordResult = U.upsertBoundaryResizeRecord(cleanedProvenance, {
      original,
      edge,
      boundary: target[edge],
      clearedRanges,
    });
    return {
      changed: true,
      provenance: recordResult.provenance,
      gaps: U.gapRangesFromProvenance(recordResult.provenance),
      original,
      target,
    };
  }

  Object.assign(U, {
    gapRemoveRangesEqual,
    movedGapAtTarget,
    upsertGapMoveRecord,
    moveGapRemoveProvenance,
    resizeGapRemoveProvenanceBoundary,
  });
})(typeof window !== 'undefined' ? window : globalThis);
