// JSON 深拷贝、整数钳制、禁用阈值换算与空隙拖拽模式判定。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveLimits(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function cloneJsonValue(value) {
    return value == null ? null : JSON.parse(JSON.stringify(value));
  }

  function clampInteger(value, fallback, minimum, maximum) {
    const rounded = Math.round(Number(value));
    return Math.min(maximum, Math.max(minimum, Number.isFinite(rounded) ? rounded : fallback));
  }

  function clampGapRemoveDisableCoverage(value) {
    const numeric = typeof value === 'string' && !value.trim() ? NaN : Number(value);
    return Math.min(100, Math.max(0, Number.isFinite(numeric)
      ? numeric : U.GAP_REMOVE_DISABLE_COVERAGE_DEFAULT));
  }

  function clampGapRemoveDisableRemaining(value) {
    const numeric = typeof value === 'string' && !value.trim() ? NaN : value;
    return clampInteger(
      numeric,
      U.GAP_REMOVE_DISABLE_REMAINING_DEFAULT_MS,
      0,
      U.GAP_REMOVE_DISABLE_REMAINING_MAX_MS,
    );
  }

  function normalizeGapOperationMode(value) {
    return typeof value === 'string' && U.GAP_REMOVE_OPERATION_MODE_SET.has(value)
      ? value : U.DEFAULT_GAP_REMOVE_OPERATION_MODE;
  }

  function gapOperationAllowsBoundary(mode) {
    return mode === 'boundary_drag' || mode === 'boundary_and_middle';
  }

  function gapOperationAllowsMiddle(mode) {
    return mode === 'middle_drag' || mode === 'boundary_and_middle';
  }

  function gapKey(gap) {
    return `${Math.round(Number(gap.start))}:${Math.round(Number(gap.end))}`;
  }

  Object.assign(U, {
    cloneJsonValue,
    clampInteger,
    clampGapRemoveDisableCoverage,
    clampGapRemoveDisableRemaining,
    normalizeGapOperationMode,
    gapOperationAllowsBoundary,
    gapOperationAllowsMiddle,
    gapKey,
  });
})(typeof window !== 'undefined' ? window : globalThis);
