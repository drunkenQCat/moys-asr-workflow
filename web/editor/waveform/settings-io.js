// 波形设置的 localStorage 读写边界。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformSettingsIo(global) {
  'use strict';

  const U = global.MaweWaveform;

  function readSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(U.SETTINGS_KEY) || '{}');
      const layoutData = U.normalizeLayoutData({
        preset: parsed.layout,
        splitPercent: parsed.splitPercent,
        columnPercent: parsed.layoutColumnPercent,
        rows: parsed.layoutRows,
        tree: parsed.layoutTree,
      });
      return {
        ...U.DEFAULT_SETTINGS,
        mode: ['basic', 'multi'].includes(parsed.mode) ? parsed.mode : U.DEFAULT_SETTINGS.mode,
        layout: layoutData.preset,
        visibleSeconds: U.ZOOM_PRESETS.includes(Number(parsed.visibleSeconds))
          ? Number(parsed.visibleSeconds) : U.DEFAULT_SETTINGS.visibleSeconds,
        secondsPerRow: U.ROW_PRESETS.includes(Number(parsed.secondsPerRow))
          ? Number(parsed.secondsPerRow) : U.DEFAULT_SETTINGS.secondsPerRow,
        rowHeight: U.ROW_HEIGHT_PRESETS.includes(Number(parsed.rowHeight))
          ? Number(parsed.rowHeight) : U.DEFAULT_SETTINGS.rowHeight,
        side: parsed.side === 'right' ? 'right' : 'left',
        splitPercent: layoutData.splitPercent,
        layoutColumnPercent: layoutData.columnPercent,
        layoutRows: layoutData.rows,
        layoutTree: layoutData.tree,
        layoutEditing: false,
        waveformScale: U.clampWaveformScale(Number(parsed.waveformScale) || U.DEFAULT_SETTINGS.waveformScale),
        disabledDisplay: parsed.disabledDisplay === 'hidden' ? 'hidden' : 'dim',
        showGroupBadges: parsed.showGroupBadges !== false,
        dragPlayhead: parsed.dragPlayhead !== false,
        spectralColor: parsed.spectralColor === true,
      };
    } catch (_) {
      return {
        ...U.DEFAULT_SETTINGS,
        layoutTree: U.cloneLayoutTree(U.DEFAULT_RIGHT_LAYOUT_TREE),
      };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(U.SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {
      // file:// privacy modes may reject localStorage; the editor still works.
    }
  }

  Object.assign(U, {
    readSettings,
    saveSettings,
  });
})(typeof window !== 'undefined' ? window : globalThis);
