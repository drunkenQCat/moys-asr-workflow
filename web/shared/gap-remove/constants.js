// 空隙模式、来源枚举与各类取值上下限。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveConstants(global) {
  'use strict';

  const U = global.MaweGapRemove;

  const GAP_REMOVE_SCHEMA = 'moy.asr.gap_remove.v1';
  const GAP_PROVENANCE_SCHEMA = 'moy.asr.gap_provenance.v1';
  const GAP_PROVENANCE_SOURCES = Object.freeze([
    'script_alignment',
    'audio_gate',
    'manual',
    'legacy',
  ]);
  const GAP_PROVENANCE_SOURCE_SET = new Set(GAP_PROVENANCE_SOURCES);
  const GAP_REMOVE_OPERATION_MODES = Object.freeze([
    'none',
    'boundary_drag',
    'middle_drag',
    'boundary_and_middle',
  ]);
  const GAP_REMOVE_OPERATION_MODE_SET = new Set(GAP_REMOVE_OPERATION_MODES);
  const DEFAULT_GAP_REMOVE_OPERATION_MODE = 'boundary_drag';
  const GAP_REMOVE_MANUAL_OPERATION_BOUNDARY_RESIZE = 'boundary_resize';
  const GAP_REMOVE_MANUAL_OPERATION_MOVE = 'move';
  const GAP_REMOVE_BOUNDARY_EDGES = Object.freeze(['start', 'end']);
  const GAP_REMOVE_DISABLE_COVERAGE_DEFAULT = 80;
  const GAP_REMOVE_DISABLE_REMAINING_DEFAULT_MS = 300;
  const GAP_REMOVE_DISABLE_REMAINING_MAX_MS = 60000;
  const GAP_DISPLAY_PROJECTION_CACHE = new WeakMap();

  Object.assign(U, {
    GAP_REMOVE_SCHEMA,
    GAP_PROVENANCE_SCHEMA,
    GAP_PROVENANCE_SOURCES,
    GAP_PROVENANCE_SOURCE_SET,
    GAP_REMOVE_OPERATION_MODES,
    GAP_REMOVE_OPERATION_MODE_SET,
    DEFAULT_GAP_REMOVE_OPERATION_MODE,
    GAP_REMOVE_MANUAL_OPERATION_BOUNDARY_RESIZE,
    GAP_REMOVE_MANUAL_OPERATION_MOVE,
    GAP_REMOVE_BOUNDARY_EDGES,
    GAP_REMOVE_DISABLE_COVERAGE_DEFAULT,
    GAP_REMOVE_DISABLE_REMAINING_DEFAULT_MS,
    GAP_REMOVE_DISABLE_REMAINING_MAX_MS,
    GAP_DISPLAY_PROJECTION_CACHE,
  });
})(typeof window !== 'undefined' ? window : globalThis);
