// 从来源记录里挖掉/清掉区间，以及吸收区间（absorb）的减法。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveProvenanceEdit(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function removeGapRemoveProvenanceRange(value, startMs, endMs, fallbackGaps = []) {
    const provenance = U.normalizeGapRemoveProvenance(value, fallbackGaps);
    const start = Math.max(0, Math.round(Math.min(Number(startMs), Number(endMs))));
    const end = Math.max(0, Math.round(Math.max(Number(startMs), Number(endMs))));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return provenance;

    const baseRangesToClear = provenance.manual_overrides.flatMap((record) => (
      U.isGapMoveRecord(record) && U.gapMoveTargetRanges(record).some((target) => (
        target.start < end && target.end > start
      ))
        ? [{start: record.base_start, end: record.base_end}]
        : []
    ));
    const clearRanges = [{start, end}, ...baseRangesToClear];
    const removeFrom = (ranges, source, sort) => U.normalizeProvenanceRangeList(
      ranges.flatMap((range) => {
        if (U.isGapMoveRecord(range) && U.gapMoveTargetRanges(range).some((target) => (
          target.start < end && target.end > start
        ))) return [];
        return clearRanges.reduce((remaining, clearRange) => remaining.flatMap((piece) => {
          if (piece.end <= clearRange.start || piece.start >= clearRange.end) return [{...piece}];
          const pieces = [];
          if (piece.start < clearRange.start) pieces.push({...piece, end: clearRange.start});
          if (piece.end > clearRange.end) pieces.push({...piece, start: clearRange.end});
          return pieces;
        }), [{...range}]);
      }),
      source,
      {sort},
    );

    return {
      schema: U.GAP_PROVENANCE_SCHEMA,
      sources: {
        script_alignment: removeFrom(provenance.sources.script_alignment, 'script_alignment', true),
        audio_gate: removeFrom(provenance.sources.audio_gate, 'audio_gate', true),
      },
      manual_overrides: removeFrom(provenance.manual_overrides, 'manual', false),
      legacy: removeFrom(provenance.legacy, 'legacy', false),
    };
  }

  // Boundary expansion is destructive only to the Gap portions it reaches.
  // Static source records can be cut immediately. Stateful manual controls
  // (move/boundary records) stay intact here; the boundary record's own
  // cleared_ranges is replayed last and prevents their old visual result from
  // resurfacing when the user later drags back.
  function clearStaticGapRemoveProvenanceRanges(value, ranges, fallbackGaps = []) {
    const provenance = U.normalizeGapRemoveProvenance(value, fallbackGaps);
    const clearedRanges = U.normalizeGapRangeList(ranges);
    if (!clearedRanges.length) return provenance;
    const removeFrom = (items, source, sort) => U.normalizeProvenanceRangeList(
      items.flatMap((item) => subtractGapAbsorbRanges(item, clearedRanges)),
      source,
      {sort},
    );
    return {
      schema: U.GAP_PROVENANCE_SCHEMA,
      sources: {
        script_alignment: removeFrom(provenance.sources.script_alignment, 'script_alignment', true),
        audio_gate: removeFrom(provenance.sources.audio_gate, 'audio_gate', true),
      },
      manual_overrides: U.normalizeProvenanceRangeList(
        provenance.manual_overrides.flatMap((item) => (
          U.isGapMoveRecord(item) || U.isBoundaryResizeRecord(item)
            ? [{ ...item }]
            : subtractGapAbsorbRanges(item, clearedRanges)
        )),
        'manual',
      ),
      legacy: removeFrom(provenance.legacy, 'legacy', false),
    };
  }

  function normalizeGapAbsorbRanges(ranges) {
    return U.normalizeGapRangeList(ranges);
  }

  function subtractGapAbsorbRanges(item, ranges) {
    return ranges.reduce((pieces, range) => pieces.flatMap((piece) => {
      if (piece.end <= range.start || piece.start >= range.end) return [piece];
      const remaining = [];
      if (piece.start < range.start) remaining.push({ ...piece, end: range.start });
      if (piece.end > range.end) remaining.push({ ...piece, start: range.end });
      return remaining;
    }), [{ ...item }]);
  }

  // A moved visible Gap owns any other Gap it covers at the destination. Do
  // not consume the current visible range itself: that is the move record's
  // base object, and it must remain available when the user drags back.
  // A previously moved Gap is different from an ordinary source record: only
  // its current target pieces are covered. Deleting the whole move record
  // would resurrect its cleared base elsewhere on the timeline.
  function absorbGapRemoveProvenanceRanges(
    value,
    ranges,
    preserveIds = [],
    fallbackGaps = [],
    targetRemoved = true,
  ) {
    const provenance = U.normalizeGapRemoveProvenance(value, fallbackGaps);
    const absorbRanges = normalizeGapAbsorbRanges(ranges);
    if (!absorbRanges.length) return provenance;
    const preserved = new Set(preserveIds);
    const targetState = targetRemoved !== false;
    const overlapsAbsorbedRange = (item) => absorbRanges.some((range) => (
      item.end > range.start && item.start < range.end
    ));
    const cropOrAbsorb = (item) => {
      if (!overlapsAbsorbedRange(item)) return [{ ...item }];
      // Equal-state gaps would otherwise coalesce with the moved target and
      // make it visibly longer. Treat those as fully absorbed; for an
      // inactive/restored Gap the differing-state overlap is only clipped.
      if ((item.removed !== false) === targetState) return [];
      return subtractGapAbsorbRanges(item, absorbRanges);
    };
    const removeFrom = (items, source, sort) => U.normalizeProvenanceRangeList(
      items.flatMap(cropOrAbsorb),
      source,
      {sort},
    );
    const manual = provenance.manual_overrides.flatMap((item) => {
      if (preserved.has(item.id)) {
        return [{ ...item }];
      }
      if (U.isGapMoveRecord(item)) {
        const targets = U.gapMoveTargetRanges(item);
        if (!targets.some(overlapsAbsorbedRange)) {
          return [{ ...item }];
        }
        const remainingTargets = (item.removed !== false) === targetState
          ? targets.filter((target) => !overlapsAbsorbedRange(target))
          : targets.flatMap((target) => subtractGapAbsorbRanges(target, absorbRanges));
        return [U.createGapMoveRecord({
          id: item.id,
          removed: item.removed,
          baseStart: item.base_start,
          baseEnd: item.base_end,
          targetRanges: remainingTargets,
        })];
      }
      if (!overlapsAbsorbedRange(item)) {
        return [{ ...item }];
      }
      // A boundary operation has no independent destination range to crop.
      // Keep it in place; the later move record wins within the target range.
      if (U.isBoundaryResizeRecord(item)) return [{ ...item }];
      return cropOrAbsorb(item);
    });
    return {
      schema: U.GAP_PROVENANCE_SCHEMA,
      sources: {
        script_alignment: removeFrom(provenance.sources.script_alignment, 'script_alignment', true),
        audio_gate: removeFrom(provenance.sources.audio_gate, 'audio_gate', true),
      },
      manual_overrides: U.normalizeProvenanceRangeList(manual, 'manual'),
      legacy: removeFrom(provenance.legacy, 'legacy', false),
    };
  }

  Object.assign(U, {
    removeGapRemoveProvenanceRange,
    clearStaticGapRemoveProvenanceRanges,
    normalizeGapAbsorbRanges,
    subtractGapAbsorbRanges,
    absorbGapRemoveProvenanceRanges,
  });
})(typeof window !== 'undefined' ? window : globalThis);
