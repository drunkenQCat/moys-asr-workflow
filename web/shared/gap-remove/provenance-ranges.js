// 从来源记录还原可见空隙区间，以及来源整体替换与手工恢复项追加。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveProvenanceRanges(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function gapRangesFromProvenance(value, fallbackGaps = []) {
    const provenance = U.normalizeGapRemoveProvenance(value, fallbackGaps);
    let result = [];
    provenance.sources.script_alignment.forEach((gap) => {
      result = U.applyGapStateRange(result, gap.start, gap.end, true);
    });
    provenance.sources.audio_gate.forEach((gap) => {
      result = U.applyGapStateRange(result, gap.start, gap.end, true);
    });
    provenance.legacy.forEach((gap) => {
      result = U.applyGapStateRange(result, gap.start, gap.end, gap.removed, gap.removed === false);
    });
    provenance.manual_overrides.forEach((gap) => {
      result = U.isBoundaryResizeRecord(gap)
        ? U.applyBoundaryResizeRecord(result, gap)
        : U.isGapMoveRecord(gap)
          ? U.applyGapMoveRecord(result, gap)
        : U.applyGapStateRange(result, gap.start, gap.end, gap.removed, gap.removed === false);
    });
    return U.coalesceGapRemoveGaps(result);
  }

  function decorateGapRemoveGaps(gaps, value) {
    const finalGaps = U.normalizeGapRemoveGaps(gaps);
    const provenance = U.normalizeGapRemoveProvenance(value, finalGaps);
    const records = [
      ...provenance.sources.script_alignment,
      ...provenance.sources.audio_gate,
      ...provenance.manual_overrides.filter((record) => (
        !U.isBoundaryResizeRecord(record) && !U.isGapMoveRecord(record)
      )),
      ...provenance.legacy,
    ];
    const boundaryRecords = provenance.manual_overrides.filter(U.isBoundaryResizeRecord);
    const moveRecords = provenance.manual_overrides.filter(U.isGapMoveRecord);
    return finalGaps.flatMap((gap) => {
      const boundaries = new Set([gap.start, gap.end]);
      records.forEach((record) => {
        if (record.end > gap.start && record.start < gap.end) {
          boundaries.add(Math.max(gap.start, record.start));
          boundaries.add(Math.min(gap.end, record.end));
        }
      });
      const points = [...boundaries].sort((left, right) => left - right);
      const slices = [];
      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        if (end <= start) continue;
        const origins = U.GAP_PROVENANCE_SOURCES.filter((source) => {
          if (source === 'manual' && boundaryRecords.some((record) => (
            record.boundary === start || record.boundary === end
          ))) return true;
          if (source === 'manual' && moveRecords.some((record) => (
            U.gapMoveTargetRanges(record).some((target) => (
              target.start < end && target.end > start
            ))
          ))) return true;
          return records.some((record) => (
            record.source === source && record.start < end && record.end > start
          ));
        });
        const baseOrigins = origins.filter((source) => source !== 'manual');
        slices.push({
          ...gap,
          start,
          end,
          source: baseOrigins.length === 1
            ? baseOrigins[0]
            : baseOrigins.length ? null : origins.includes('manual') ? 'manual' : null,
          origins,
        });
      }
      return slices;
    });
  }

  function replaceGapRemoveProvenanceSource(value, source, ranges, fallbackGaps = []) {
    const next = U.normalizeGapRemoveProvenance(value, fallbackGaps);
    if (source === 'script_alignment' || source === 'audio_gate') {
      next.sources[source] = U.normalizeProvenanceRangeList(ranges, source, {sort: true});
    }
    return next;
  }

  function appendGapRemoveManualOverrides(value, overrides, fallbackGaps = []) {
    const next = U.normalizeGapRemoveProvenance(value, fallbackGaps);
    const additions = Array.isArray(overrides) ? overrides : [overrides];
    const used = new Set(next.manual_overrides.map((item) => item.id));
    additions.forEach((item, index) => {
      const normalized = U.normalizeProvenanceRange(item, 'manual', next.manual_overrides.length + index, used);
      if (normalized) next.manual_overrides.push(normalized);
    });
    return next;
  }

  Object.assign(U, {
    gapRangesFromProvenance,
    decorateGapRemoveGaps,
    replaceGapRemoveProvenanceSource,
    appendGapRemoveManualOverrides,
  });
})(typeof window !== 'undefined' ? window : globalThis);
