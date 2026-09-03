// 空隙的显示分类：来源优先级、受保护判定与按端点切片后的投影（带 WeakMap 缓存）。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveDisplay(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function gapRemoveDisplayOrigins(gap) {
    const normalizeOrigin = (source) => source === 'legacy' ? 'audio_gate' : source;
    const origins = Array.isArray(gap?.origins)
      ? gap.origins.map(normalizeOrigin).filter((source) => U.GAP_PROVENANCE_SOURCE_SET.has(source))
      : [];
    const source = normalizeOrigin(gap?.source);
    if (!origins.length && U.GAP_PROVENANCE_SOURCE_SET.has(source)) origins.push(source);
    return U.GAP_PROVENANCE_SOURCES.filter((item) => item !== 'legacy' && origins.includes(item));
  }

  function gapRemoveDisplaySource(origins) {
    const automaticOrigins = origins.filter((source) => source !== 'manual');
    if (automaticOrigins.length === 1) return automaticOrigins[0];
    if (!automaticOrigins.length && origins.includes('manual')) return 'manual';
    return null;
  }

  // This is a presentation category, not a persisted provenance source. It
  // lets both UIs give protected ranges a small visual cue without exposing
  // the internal source layers as separate gap blocks.
  function getGapRemoveDisplayType(gap) {
    const origins = gapRemoveDisplayOrigins(gap);
    const has = (source) => origins.includes(source);
    const hasAudio = has('audio_gate');
    const hasScript = has('script_alignment');
    const hasManual = has('manual');
    const automaticOriginCount = [hasAudio, hasScript].filter(Boolean).length;
    if (automaticOriginCount > 1) return hasManual ? 'multi_source_manual' : 'multi_source';
    if (hasScript) return hasManual ? 'script_alignment_manual' : 'script_alignment';
    if (hasAudio) return hasManual ? 'audio_gate_manual' : 'audio_gate';
    if (hasManual) return 'manual';
    return 'unknown';
  }

  function isGapRemoveDisplayProtected(gap) {
    const origins = gapRemoveDisplayOrigins(gap);
    return origins.length > 0 && origins.some((source) => source !== 'audio_gate');
  }

  // The display projection keeps both final states as one visible layer:
  // `removed:true` is an enabled gap, while `removed:false` is a visible but
  // ineffective manual restoration. Source records remain internal.
  function getGapRemoveDisplayGaps(gaps) {
    if (!Array.isArray(gaps)) return [];
    const cached = U.GAP_DISPLAY_PROJECTION_CACHE.get(gaps);
    if (cached) return cached;
    const normalized = gaps
      .map((gap) => {
        const start = Math.max(0, Math.round(Number(gap?.start)));
        const end = Math.max(0, Math.round(Number(gap?.end)));
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
        const result = {start, end, removed: gap?.removed !== false};
        const origins = gapRemoveDisplayOrigins(gap);
        if (origins.length) {
          result.source = gapRemoveDisplaySource(origins);
          result.origins = origins;
        }
        return result;
      })
      .filter(Boolean)
      .sort((left, right) => left.start - right.start || left.end - right.end);
    const boundaries = [...new Set(normalized.flatMap((gap) => [gap.start, gap.end]))]
      .sort((left, right) => left - right);
    const result = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const start = boundaries[index];
      const end = boundaries[index + 1];
      if (end <= start) continue;
      const covering = normalized.filter((gap) => gap.start < end && gap.end > start);
      if (!covering.length) continue;
      const removed = !covering.some((gap) => gap.removed === false);
      const origins = U.GAP_PROVENANCE_SOURCES.filter((source) => covering.some((gap) => (
        gapRemoveDisplayOrigins(gap).includes(source)
      )));
      const next = {start, end, removed};
      if (origins.length) {
        next.source = gapRemoveDisplaySource(origins);
        next.origins = origins;
      }
      const previous = result[result.length - 1];
      if (previous && previous.end === start && previous.removed === removed) {
        previous.end = end;
        const combinedOrigins = U.GAP_PROVENANCE_SOURCES.filter((source) => (
          gapRemoveDisplayOrigins(previous).includes(source)
          || origins.includes(source)
        ));
        if (combinedOrigins.length) {
          previous.source = gapRemoveDisplaySource(combinedOrigins);
          previous.origins = combinedOrigins;
        }
      } else {
        result.push(next);
      }
    }
    U.GAP_DISPLAY_PROJECTION_CACHE.set(gaps, result);
    return result;
  }

  Object.assign(U, {
    gapRemoveDisplayOrigins,
    gapRemoveDisplaySource,
    getGapRemoveDisplayType,
    isGapRemoveDisplayProtected,
    getGapRemoveDisplayGaps,
  });
})(typeof window !== 'undefined' ? window : globalThis);
