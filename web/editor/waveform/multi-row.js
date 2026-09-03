// 多行视口的舒适区判定、顶边时刻恢复与分组徽标。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformMultiRow(global) {
  'use strict';

  const U = global.MaweWaveform;

  function isMultiRowInComfortZone(rowIndex, scrollTop, viewportHeight, rowHeight) {
    const safeRowHeight = Math.max(1, Number(rowHeight) || 0);
    const safeViewportHeight = Math.max(1, Number(viewportHeight) || 0);
    const safeScrollTop = Number.isFinite(Number(scrollTop)) ? Number(scrollTop) : 0;
    const rowTop = Number(rowIndex) * (safeRowHeight + U.ROW_GAP) - safeScrollTop;
    const comfortInset = Math.min(120, Math.max(48, safeViewportHeight * 0.2));
    return rowTop >= comfortInset
      && rowTop + safeRowHeight <= safeViewportHeight - comfortInset;
  }

  function waveformTopEdgeMs(state) {
    if (state?.mode === 'basic') return Math.max(0, Math.round(Number(state.basicWindowStartMs) || 0));
    const scrollTop = Math.max(0, Number(state?.scrollTop) || 0);
    const stride = Math.max(1, Number(state?.rowHeight) + Number(state?.rowGap));
    const rowDurationMs = Math.max(1, Number(state?.secondsPerRow) * 1000 || 1);
    return Math.max(0, Math.floor(scrollTop / stride) * rowDurationMs);
  }

  function restoreWaveformTopEdgeMs(state, value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return null;
    const durationMs = Math.max(0, Math.round(Number(state?.durationMs) || 0));
    if (state?.mode === 'basic') {
      const windowMs = Math.max(1, Number(state.visibleSeconds) * 1000 || 1);
      return U.clamp(value, 0, Math.max(0, durationMs - windowMs));
    }
    const rowDurationMs = Math.max(1, Number(state?.secondsPerRow) * 1000 || 1);
    return Math.floor(Math.min(value, durationMs) / rowDurationMs) * rowDurationMs;
  }

  // 组序号徽章：颜色与表情包分组彼此独立，因此同一条字幕可同时拥有两枚徽章。
  // 颜色组大小 <2 时不显示；表情包即使只有单条也显示 🦊 作为非视觉化标记。
  function computeGroupBadges(segments) {
    const badges = new Map();
    const apply = (type, headField, refField) => {
      // 每个波形行都会使用同一份徽章数据；按 head 建索引，避免每个 head
      // 再扫描整个字幕数组，长工程或多行缓存下可从 O(N²) 降到 O(N)。
      const membersByHead = new Map();
      segments.forEach((seg, headIdx) => {
        if (seg[headField]) membersByHead.set(headIdx, [headIdx]);
      });
      segments.forEach((seg, idx) => {
        const headIdx = seg[refField]?.headIdx;
        const members = membersByHead.get(headIdx);
        if (members && headIdx !== idx) members.push(idx);
      });
      membersByHead.forEach((members) => {
        if (type === 'color' && members.length < 2) return;
        members.forEach((idx, i) => {
          const cueBadges = badges.get(idx) || [];
          cueBadges.push({ type, ordinal: i + 1, total: members.length });
          badges.set(idx, cueBadges);
        });
      });
    };
    apply('color', 'color', 'color_ref');
    apply('sticker', 'sticker', 'sticker_ref');
    return badges;
  }

  Object.assign(U, {
    isMultiRowInComfortZone,
    waveformTopEdgeMs,
    restoreWaveformTopEdgeMs,
    computeGroupBadges,
  });
})(typeof window !== 'undefined' ? window : globalThis);
