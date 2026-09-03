// 按波形峰值做静音检测（带滞回与前/后端预留）。
// 自 web/shared/gap-remove-core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweGapRemove；
// 兼容出口 window.AsrGapRemoveCore 仍由 shared/gap-remove/compat-surface.js 统一组装。
(function initMaweGapRemoveAudioDetect(global) {
  'use strict';

  const U = global.MaweGapRemove;

  function waveformPeakDb(peaks, index) {
    const low = Number(peaks[index * 2]);
    const high = Number(peaks[index * 2 + 1]);
    const magnitude = Math.min(127, Math.max(Math.abs(low), Math.abs(high)));
    return magnitude > 0 ? 20 * Math.log10(magnitude / 127) : -Infinity;
  }

  function detectAudioGapRemoveGaps(waveform, options = {}) {
    const peaks = waveform?.peaks;
    const peaksPerSecond = Number(waveform?.peaks_per_second);
    const durationMs = Math.max(0, Math.round(Number(waveform?.duration_ms) || 0));
    if (!peaks || !Number.isFinite(peaksPerSecond) || peaksPerSecond <= 0 || !durationMs) return [];

    const minimumMs = Math.max(0, Math.round(Number(options.minimumMs) || 0));
    const thresholdDb = Math.min(0, Math.max(-96, Number(options.thresholdDb)));
    const openThresholdDb = Number.isFinite(thresholdDb) ? thresholdDb : -24;
    const hysteresisDb = Math.min(30, Math.max(0, Number(options.hysteresisDb) || 0));
    const closeThresholdDb = openThresholdDb - hysteresisDb;
    // 前/后端预留：在每段空隙两侧各保留若干毫秒静音不纳入移除，避免剪掉空隙后两句贴得太急。
    const leadInMs = Math.max(0, Math.round(Number(options.leadInMs) || 0));
    const leadOutMs = Math.max(0, Math.round(Number(options.leadOutMs) || 0));
    const sampleCount = Math.min(
      Math.floor(peaks.length / 2),
      Math.max(0, Math.ceil((durationMs / 1000) * peaksPerSecond)),
    );
    const timeAt = (index) => Math.min(durationMs, Math.round((index * 1000) / peaksPerSecond));
    const rawGaps = [];
    let gateOpen = false;
    let foundAudio = false;
    let silenceStart = null;

    for (let index = 0; index < sampleCount; index++) {
      const levelDb = waveformPeakDb(peaks, index);
      if (gateOpen) {
        if (levelDb < closeThresholdDb) {
          gateOpen = false;
          silenceStart = timeAt(index);
        }
        continue;
      }
      if (levelDb < openThresholdDb) continue;
      if (foundAudio && silenceStart != null) {
        const end = timeAt(index);
        if (end > silenceStart) {
          // 应用前/后端预留后再决定是否纳入移除区间
          const gapStart = Math.min(durationMs, silenceStart + leadInMs);
          const gapEnd = end - leadOutMs;
          if (gapEnd > gapStart) rawGaps.push({ start: gapStart, end: gapEnd, removed: true });
        }
      }
      foundAudio = true;
      gateOpen = true;
      silenceStart = null;
    }
    return rawGaps.filter((gap) => gap.end - gap.start >= minimumMs);
  }

  Object.assign(U, {
    waveformPeakDb,
    detectAudioGapRemoveGaps,
  });
})(typeof window !== 'undefined' ? window : globalThis);
