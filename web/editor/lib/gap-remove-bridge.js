// 空隙移除核心的桥接层：真正的算法在 web/shared/gap-remove-core.js，这里只做兼容别名与派生段重建。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibGapRemoveBridge(global) {
  'use strict';

  const U = global.MaweLib;

  const GAP_REMOVE_CORE = window.AsrGapRemoveCore;
  if (!GAP_REMOVE_CORE) throw new Error('AsrGapRemoveCore must load before AsrEditorUtils');
  const GAP_REMOVE_SCHEMA = GAP_REMOVE_CORE.GAP_REMOVE_SCHEMA;
  const GAP_REMOVE_DISABLE_COVERAGE_DEFAULT = GAP_REMOVE_CORE.GAP_REMOVE_DISABLE_COVERAGE_DEFAULT;
  const GAP_REMOVE_DISABLE_REMAINING_DEFAULT_MS = GAP_REMOVE_CORE.GAP_REMOVE_DISABLE_REMAINING_DEFAULT_MS;
  const GAP_REMOVE_DISABLE_REMAINING_MAX_MS = GAP_REMOVE_CORE.GAP_REMOVE_DISABLE_REMAINING_MAX_MS;
  const clampGapRemoveDisableCoverage = GAP_REMOVE_CORE.clampGapRemoveDisableCoverage;
  const clampGapRemoveDisableRemaining = GAP_REMOVE_CORE.clampGapRemoveDisableRemaining;
  const normalizeGapRemoveData = GAP_REMOVE_CORE.normalizeGapRemoveData;
  const normalizeGapRemoveGaps = GAP_REMOVE_CORE.normalizeGapRemoveGaps;
  const normalizeGapRemoveProvenance = GAP_REMOVE_CORE.normalizeGapRemoveProvenance;
  const gapRangesFromProvenance = GAP_REMOVE_CORE.gapRangesFromProvenance;
  const decorateGapRemoveGaps = GAP_REMOVE_CORE.decorateGapRemoveGaps;
  const getGapRemoveDisplayType = GAP_REMOVE_CORE.getGapRemoveDisplayType;
  const isGapRemoveDisplayProtected = GAP_REMOVE_CORE.isGapRemoveDisplayProtected;
  const removeGapRemoveProvenanceRange = GAP_REMOVE_CORE.removeGapRemoveProvenanceRange;
  const getGapRemoveDisplayGaps = GAP_REMOVE_CORE.getGapRemoveDisplayGaps;
  const replaceGapRemoveProvenanceSource = GAP_REMOVE_CORE.replaceGapRemoveProvenanceSource;
  const appendGapRemoveManualOverrides = GAP_REMOVE_CORE.appendGapRemoveManualOverrides;
  const applyGapRemoveRange = GAP_REMOVE_CORE.applyGapRemoveRange;
  const shrinkGapRemoveGaps = GAP_REMOVE_CORE.shrinkGapRemoveGaps;
  const moveGapRemoveRange = GAP_REMOVE_CORE.moveGapRemoveRange;
  const copyGapRemoveRange = GAP_REMOVE_CORE.copyGapRemoveRange;
  const moveGapRemoveProvenance = GAP_REMOVE_CORE.moveGapRemoveProvenance;
  const resizeGapRemoveBoundary = GAP_REMOVE_CORE.resizeGapRemoveBoundary;
  const detectAudioGapRemoveGaps = GAP_REMOVE_CORE.detectAudioGapRemoveGaps;
  const getRemovedGapRanges = GAP_REMOVE_CORE.getRemovedGapRanges;
  const findGapRemoveDisableMatches = GAP_REMOVE_CORE.findGapRemoveDisableMatches;
  const mapGapRemovedTime = GAP_REMOVE_CORE.mapGapRemovedTime;
  const buildGapRemovedIntervals = GAP_REMOVE_CORE.buildGapRemovedIntervals;

  // Dynamic-caption exporters need the same compressed timeline as SRT/OTIO,
  // while preserving the source segment objects for the editor. Items that are
  // wholly inside a removed gap remain as zero-width mapped ranges so their
  // text-to-item correspondence is not lost; the builders already ignore
  // zero-duration highlight ranges when appropriate.
  function buildGapRemovedDynamicSegments(segments, gaps) {
    const source = Array.isArray(segments) ? segments : [];
    return source.flatMap((segment) => {
      if (!segment || typeof segment !== 'object') return [];
      const start = Number(segment.start);
      const end = Number(segment.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
      const mappedStart = mapGapRemovedTime(start, gaps);
      const mappedEnd = mapGapRemovedTime(end, gaps);
      if (mappedEnd <= mappedStart) return [];
      const mapped = { ...segment, start: mappedStart, end: mappedEnd };
      if (Array.isArray(segment.items)) {
        mapped.items = segment.items.map((item) => {
          if (!item || typeof item !== 'object') return item;
          const itemStart = Number(item.start);
          const itemEnd = Number(item.end);
          if (!Number.isFinite(itemStart) || !Number.isFinite(itemEnd)) return { ...item };
          return {
            ...item,
            start: mapGapRemovedTime(itemStart, gaps),
            end: mapGapRemovedTime(itemEnd, gaps),
          };
        });
      }
      return [mapped];
    });
  }

  Object.assign(U, {
    GAP_REMOVE_CORE,
    GAP_REMOVE_SCHEMA,
    GAP_REMOVE_DISABLE_COVERAGE_DEFAULT,
    GAP_REMOVE_DISABLE_REMAINING_DEFAULT_MS,
    GAP_REMOVE_DISABLE_REMAINING_MAX_MS,
    clampGapRemoveDisableCoverage,
    clampGapRemoveDisableRemaining,
    normalizeGapRemoveData,
    normalizeGapRemoveGaps,
    normalizeGapRemoveProvenance,
    gapRangesFromProvenance,
    decorateGapRemoveGaps,
    getGapRemoveDisplayType,
    isGapRemoveDisplayProtected,
    removeGapRemoveProvenanceRange,
    getGapRemoveDisplayGaps,
    replaceGapRemoveProvenanceSource,
    appendGapRemoveManualOverrides,
    applyGapRemoveRange,
    shrinkGapRemoveGaps,
    moveGapRemoveRange,
    copyGapRemoveRange,
    moveGapRemoveProvenance,
    resizeGapRemoveBoundary,
    detectAudioGapRemoveGaps,
    getRemovedGapRanges,
    findGapRemoveDisableMatches,
    mapGapRemovedTime,
    buildGapRemovedIntervals,
    buildGapRemovedDynamicSegments,
  });
})(typeof window !== 'undefined' ? window : globalThis);
