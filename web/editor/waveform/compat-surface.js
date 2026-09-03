// window.AsrWaveform 兼容出口：导出对象的结构、键名与键序与拆分前完全一致
// （契约测试逐项比对），取值来自 editor/waveform/ 各模块发布到 window.MaweWaveform 的内部符号。
// 必须在 editor/waveform/ 全部模块之后加载。
(function initMaweWaveformCompatSurface(global) {
  'use strict';

  const U = global.MaweWaveform;


  window.AsrWaveform = {
    create(options) {
      return new U.WaveformEditor(options);
    },
    builtinWorkspaceIds: U.BUILTIN_WORKSPACE_IDS,
    builtinWorkspaces: U.BUILTIN_WORKSPACES,
    testing: {
      decodePayload: U.decodePayload,
      decodeReapeaksFile: U.decodeReapeaksFile,
      decodeSpectralPayload: U.decodeSpectralPayload,
      syncSpectralColorToggle: U.syncSpectralColorToggle,
      freqColor: U.freqColor,
      remapItems: U.remapItems,
      roundMs: U.roundMs,
      sourceForFile: U.sourceForFile,
      shouldAdjustAdjacentCuesIndependently: U.shouldAdjustAdjacentCuesIndependently,
      findActiveCueIndex: U.findActiveCueIndex,
      firstCueIndexOverlapping: U.firstCueIndexOverlapping,
      applySharedBoundary: U.applySharedBoundary,
      applyIndependentEdge: U.applyIndependentEdge,
      applyMoveStep: U.applyMoveStep,
      applyBoundaryStep: U.applyBoundaryStep,
      splitSegmentAtTime: U.splitSegmentAtTime,
      normalizeNewCueRange: U.normalizeNewCueRange,
      clampWaveformScale: U.clampWaveformScale,
      wheelScrollDelta: U.wheelScrollDelta,
      waveformScaleAfterStep: U.waveformScaleAfterStep,
      waveformAmplitude: U.waveformAmplitude,
      buildWaveformEnvelope: U.buildWaveformEnvelope,
      sampleInterpolatedPeak: U.sampleInterpolatedPeak,
      normalizeLayoutData: U.normalizeLayoutData,
      swapLayoutModuleOrder: U.swapLayoutModuleOrder,
      normalizeLayoutTree: U.normalizeLayoutTree,
      collectLayoutModules: U.collectLayoutModules,
      swapLayoutTreeModules: U.swapLayoutTreeModules,
      insertLayoutModuleAtEdge: U.insertLayoutModuleAtEdge,
      insertLayoutModuleAtRootEdge: U.insertLayoutModuleAtRootEdge,
      layoutDropIntent: U.layoutDropIntent,
      layoutRootDropIntent: U.layoutRootDropIntent,
      layoutDropPreviewRect: U.layoutDropPreviewRect,
      isMultiRowInComfortZone: U.isMultiRowInComfortZone,
      waveformTopEdgeMs: U.waveformTopEdgeMs,
      restoreWaveformTopEdgeMs: U.restoreWaveformTopEdgeMs,
      computeGroupBadges: U.computeGroupBadges,
      cueBlockContinuationEdges: U.cueBlockContinuationEdges,
    },
  };
  if (window.MAWE?.register) {
    window.MAWE.register('waveform', () => window.AsrWaveform);
  }
})(typeof window !== 'undefined' ? window : globalThis);
