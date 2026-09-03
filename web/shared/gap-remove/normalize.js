// 空隙列表与来源记录的规范化，以及整个 gap_remove 数据的入口规范化。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveNormalize(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function normalizeGapRemoveGaps(gaps) {
    if (!Array.isArray(gaps)) return [];
    const seen = new Set();
    return gaps
      .map((gap) => ({
        start: Math.max(0, Math.round(Number(gap?.start))),
        end: Math.max(0, Math.round(Number(gap?.end))),
        removed: gap?.removed !== false,
      }))
      .filter((gap) => Number.isFinite(gap.start) && Number.isFinite(gap.end) && gap.end > gap.start)
      .sort((left, right) => left.start - right.start || left.end - right.end)
      .filter((gap) => {
        const key = U.gapKey(gap);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function provenanceId(value, source, index, used) {
    const requested = typeof value === 'string' ? value.trim().slice(0, 160) : '';
    const base = requested || `${source}-${String(index + 1).padStart(3, '0')}`;
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id;
  }

  function normalizeGapRangeList(value) {
    return (Array.isArray(value) ? value : [value])
      .map((range) => ({
        start: Math.max(0, Math.round(Number(range?.start))),
        end: Math.max(0, Math.round(Number(range?.end))),
      }))
      .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end)
        && range.end > range.start)
      .sort((left, right) => left.start - right.start || left.end - right.end)
      .reduce((result, range) => {
        const previous = result[result.length - 1];
        if (previous && range.start <= previous.end) {
          previous.end = Math.max(previous.end, range.end);
        } else {
          result.push(range);
        }
        return result;
      }, []);
  }

  // A boundary adjustment can remember portions of other visible Gaps that it
  // covered. They are cleared before this adjustment reapplies the dragged
  // Gap, so moving the boundary back never reveals an old covered Gap.
  function gapBoundaryClearedRanges(item) {
    return normalizeGapRangeList(item?.cleared_ranges);
  }

  function isBoundaryResizeRecord(item) {
    return item?.source === 'manual'
      && item?.operation === U.GAP_REMOVE_MANUAL_OPERATION_BOUNDARY_RESIZE
      && U.GAP_REMOVE_BOUNDARY_EDGES.includes(item?.edge)
      && Number.isFinite(Number(item?.base))
      && Number.isFinite(Number(item?.boundary))
       && (
         Math.round(Number(item.base)) !== Math.round(Number(item.boundary))
         || gapBoundaryClearedRanges(item).length > 0
       );
  }

  // A move can retain more than one destination piece after another Gap covers
  // only part of it. Keeping those pieces with the original move is important:
  // its base must stay cleared even if its visible destination is fully covered.
  // Older projects store one `target_start` / `target_end` pair; new split
  // records use `target_ranges` only when one pair is no longer sufficient.
  function gapMoveTargetRanges(item) {
    const rawTargets = Array.isArray(item?.target_ranges)
      ? item.target_ranges
      : [{ start: item?.target_start, end: item?.target_end }];
    const ranges = rawTargets
      .map((range) => ({
        start: Math.max(0, Math.round(Number(range?.start))),
        end: Math.max(0, Math.round(Number(range?.end))),
      }))
      .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end)
        && range.end > range.start)
      .sort((left, right) => left.start - right.start || left.end - right.end);
    return ranges.reduce((result, range) => {
      const previous = result[result.length - 1];
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
      } else {
        result.push(range);
      }
      return result;
    }, []);
  }

  function hasGapMoveTargetRanges(item) {
    const ranges = gapMoveTargetRanges(item);
    if (Array.isArray(item?.target_ranges)) {
      return item.target_ranges.length === 0 || ranges.length > 0;
    }
    return ranges.length > 0;
  }

  function createGapMoveRecord({
    id,
    removed,
    baseStart,
    baseEnd,
    targetRanges,
  }) {
    const targets = gapMoveTargetRanges({ target_ranges: targetRanges });
    const bounds = [{ start: baseStart, end: baseEnd }, ...targets];
    const record = {
      id,
      source: 'manual',
      start: Math.min(...bounds.map((range) => range.start)),
      end: Math.max(...bounds.map((range) => range.end)),
      removed: removed !== false,
      operation: U.GAP_REMOVE_MANUAL_OPERATION_MOVE,
      base_start: baseStart,
      base_end: baseEnd,
    };
    if (targets.length === 1) {
      record.target_start = targets[0].start;
      record.target_end = targets[0].end;
    } else {
      record.target_ranges = targets;
    }
    return record;
  }

  function isGapMoveRecord(item) {
    return item?.source === 'manual'
      && item?.operation === U.GAP_REMOVE_MANUAL_OPERATION_MOVE
      && Number.isFinite(Number(item?.base_start))
      && Number.isFinite(Number(item?.base_end))
      && Number(item.base_end) > Number(item.base_start)
      && hasGapMoveTargetRanges(item);
  }

  function normalizeProvenanceRange(item, source, index, used) {
    if (!item || typeof item !== 'object' || !U.GAP_PROVENANCE_SOURCE_SET.has(source)) return null;
    const start = Math.max(0, Math.round(Number(item.start)));
    const end = Math.max(0, Math.round(Number(item.end)));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const result = {
      id: provenanceId(item.id, source, index, used),
      source,
      start,
      end,
    };
    if (source === 'manual' || source === 'legacy') result.removed = item.removed !== false;
    else result.removed = true;
    if (source === 'manual' && item.operation === U.GAP_REMOVE_MANUAL_OPERATION_BOUNDARY_RESIZE) {
      const edge = item.edge;
      const base = Math.max(0, Math.round(Number(item.base)));
      const boundary = Math.max(0, Math.round(Number(item.boundary)));
      const clearedRanges = gapBoundaryClearedRanges(item);
      if (U.GAP_REMOVE_BOUNDARY_EDGES.includes(edge)
          && Number.isFinite(base) && Number.isFinite(boundary)
          && (base !== boundary || clearedRanges.length)) {
        result.operation = U.GAP_REMOVE_MANUAL_OPERATION_BOUNDARY_RESIZE;
        result.edge = edge;
        result.base = base;
        result.boundary = boundary;
        if (clearedRanges.length) result.cleared_ranges = clearedRanges;
        result.start = Math.min(base, boundary, ...clearedRanges.map((range) => range.start));
        result.end = Math.max(base, boundary, ...clearedRanges.map((range) => range.end));
      }
    }
    if (source === 'manual' && item.operation === U.GAP_REMOVE_MANUAL_OPERATION_MOVE) {
      const baseStart = Math.max(0, Math.round(Number(item.base_start)));
      const baseEnd = Math.max(0, Math.round(Number(item.base_end)));
      const targets = gapMoveTargetRanges(item);
      const hasTargets = hasGapMoveTargetRanges(item);
      const returnedToBase = targets.length === 1
        && targets[0].start === baseStart && targets[0].end === baseEnd;
      if (Number.isFinite(baseStart) && Number.isFinite(baseEnd)
          && baseEnd > baseStart && hasTargets && !returnedToBase) {
        result.operation = U.GAP_REMOVE_MANUAL_OPERATION_MOVE;
        result.base_start = baseStart;
        result.base_end = baseEnd;
        result.start = Math.min(baseStart, ...targets.map((range) => range.start));
        result.end = Math.max(baseEnd, ...targets.map((range) => range.end));
        if (targets.length === 1) {
          result.target_start = targets[0].start;
          result.target_end = targets[0].end;
        } else {
          result.target_ranges = targets;
        }
      }
    }
    return result;
  }

  function normalizeProvenanceRangeList(value, source, {sort = false} = {}) {
    if (!Array.isArray(value)) return [];
    const used = new Set();
    const result = value
      .map((item, index) => normalizeProvenanceRange(item, source, index, used))
      .filter(Boolean);
    if (sort) result.sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
    return result;
  }

  function normalizeGapRemoveProvenance(value, fallbackGaps = []) {
    const hasValue = value && typeof value === 'object';
    const source = hasValue ? value : {};
    const rawSources = source.sources && typeof source.sources === 'object' ? source.sources : {};
    // Before provenance existed, the editor's gap list was produced by the
    // audio gate. Migrate those enabled ranges into that replaceable source.
    // A legacy `removed:false` range is the only state that cannot be an
    // audio-gate record, so retain it as a manual restoration instead.
    const legacy = normalizeProvenanceRangeList(
      hasValue ? source.legacy : normalizeGapRemoveGaps(fallbackGaps),
      'legacy',
    );
    const legacyAudioGaps = legacy.filter((item) => item.removed !== false);
    const legacyManualOverrides = legacy.filter((item) => item.removed === false);
    return {
      schema: U.GAP_PROVENANCE_SCHEMA,
      sources: {
        script_alignment: normalizeProvenanceRangeList(rawSources.script_alignment, 'script_alignment', {sort: true}),
        audio_gate: normalizeProvenanceRangeList(
          [...(Array.isArray(rawSources.audio_gate) ? rawSources.audio_gate : []), ...legacyAudioGaps],
          'audio_gate',
          {sort: true},
        ),
      },
      manual_overrides: normalizeProvenanceRangeList(
        [...legacyManualOverrides, ...(Array.isArray(source.manual_overrides) ? source.manual_overrides : [])],
        'manual',
      ),
      legacy: [],
    };
  }

  function normalizeGapRemoveData(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawGaps = normalizeGapRemoveGaps(source.gaps);
    const hasProvenance = Boolean(source.provenance && typeof source.provenance === 'object');
    const provenance = normalizeGapRemoveProvenance(source.provenance, rawGaps);
    const computedGaps = hasProvenance ? U.gapRangesFromProvenance(provenance) : rawGaps;
    const gaps = U.cloneJsonValue(U.decorateGapRemoveGaps(computedGaps, provenance)) || [];
    return {
      schema: U.GAP_REMOVE_SCHEMA,
      // Older gap lists came from the same audio-gate workflow but did not
      // carry a provenance layer. Normalize them into the current detector so
      // their display, shrinking, clearing, and rescanning stay consistent.
      detector: 'audio_gate',
      minimum_ms: U.clampInteger(source.minimum_ms, 400, 100, 60000),
      threshold_db: Math.min(0, Math.max(-96, Number.isFinite(Number(source.threshold_db)) ? Number(source.threshold_db) : -28)),
      hysteresis_db: Math.min(30, Math.max(0, Number.isFinite(Number(source.hysteresis_db)) ? Number(source.hysteresis_db) : 2)),
      lead_in_ms: U.clampInteger(source.lead_in_ms, 120, 0, 2000),
      lead_out_ms: U.clampInteger(source.lead_out_ms, 80, 0, 2000),
      skip_playback: source.skip_playback !== false,
      manual_corrections: source.manual_corrections === true || provenance.manual_overrides.length > 0,
      operation_mode: U.normalizeGapOperationMode(source.operation_mode),
      disable_coverage_percent: U.clampGapRemoveDisableCoverage(source.disable_coverage_percent),
      disable_remaining_ms: U.clampGapRemoveDisableRemaining(source.disable_remaining_ms),
      gaps,
      provenance,
    };
  }

  Object.assign(U, {
    normalizeGapRemoveGaps,
    provenanceId,
    normalizeGapRangeList,
    gapBoundaryClearedRanges,
    isBoundaryResizeRecord,
    gapMoveTargetRanges,
    hasGapMoveTargetRanges,
    createGapMoveRecord,
    isGapMoveRecord,
    normalizeProvenanceRange,
    normalizeProvenanceRangeList,
    normalizeGapRemoveProvenance,
    normalizeGapRemoveData,
  });
})(typeof window !== 'undefined' ? window : globalThis);
