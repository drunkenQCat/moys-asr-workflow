// 取整、钳制与紧凑时间格式化的最小数值工具。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformNumeric(global) {
  'use strict';

  const U = global.MaweWaveform;

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function roundMs(value) {
    return Math.round(value / U.ROUND_MS) * U.ROUND_MS;
  }

  function formatCompact(ms) {
    const safe = Math.max(0, Math.round(ms));
    const hours = Math.floor(safe / 3600000);
    const minutes = Math.floor((safe % 3600000) / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const millis = safe % 1000;
    const hh = hours ? `${String(hours).padStart(2, '0')}:` : '';
    return `${hh}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  Object.assign(U, {
    clamp,
    roundMs,
    formatCompact,
  });
})(typeof window !== 'undefined' ? window : globalThis);
