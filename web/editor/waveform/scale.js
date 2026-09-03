// 波形缩放、振幅换算、峰值插值与包络生成。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformScale(global) {
  'use strict';

  const U = global.MaweWaveform;

  function clampWaveformScale(value) {
    const numeric = Number(value);
    return U.clamp(Number.isFinite(numeric) ? numeric : 1, U.MIN_WAVEFORM_SCALE, U.MAX_WAVEFORM_SCALE);
  }

  function wheelScrollDelta(event) {
    const deltaY = Number(event?.deltaY) || 0;
    const deltaX = Number(event?.deltaX) || 0;
    // macOS may remap Shift+wheel's vertical movement to deltaX.
    return deltaY || deltaX;
  }

  function waveformScaleAfterStep(value, direction) {
    const current = clampWaveformScale(value);
    // 低于 1 时用 0.25 细步（0.25 / 0.5 / 0.75），否则 0.5
    const step = current < 1 ? 0.25 : 0.5;
    return Number(clampWaveformScale(current + Number(direction) * step).toFixed(2));
  }

  function waveformAmplitude(height, scale) {
    return Math.max(0, Number(height) * 0.36 * clampWaveformScale(scale));
  }

  function sampleInterpolatedPeak(peaks, position, peakCount, target = [0, 0]) {
    if (!peaks || peakCount <= 0) {
      target[0] = 0;
      target[1] = 0;
      return target;
    }
    const clampedPosition = U.clamp(Number(position) || 0, 0, peakCount - 1);
    const left = Math.floor(clampedPosition);
    const right = Math.min(peakCount - 1, left + 1);
    const mix = clampedPosition - left;
    target[0] = peaks[left * 2] + (peaks[right * 2] - peaks[left * 2]) * mix;
    target[1] = peaks[left * 2 + 1] + (peaks[right * 2 + 1] - peaks[left * 2 + 1]) * mix;
    return target;
  }

  function buildWaveformEnvelope(
    peaks,
    peaksPerSecond,
    peakCount,
    startMs,
    endMs,
    width,
    useInterpolation = false,
  ) {
    const numericWidth = Number(width);
    const safeWidth = Number.isFinite(numericWidth)
      ? Math.max(1, Math.round(numericWidth)) : 1;
    const low = new Float32Array(safeWidth);
    const high = new Float32Array(safeWidth);
    if (!peaks || peakCount <= 0 || !Number.isFinite(peaksPerSecond) || peaksPerSecond <= 0) {
      return { low, high };
    }
    const rangeMs = Math.max(1, Number(endMs) - Number(startMs));
    const interpolatedPeak = [0, 0];
    for (let x = 0; x < safeWidth; x++) {
      const xStartMs = startMs + (x / safeWidth) * rangeMs;
      const xEndMs = startMs + ((x + 1) / safeWidth) * rangeMs;
      if (useInterpolation) {
        const centerMs = (xStartMs + xEndMs) / 2;
        const peakPosition = (centerMs / 1000) * peaksPerSecond - 0.5;
        sampleInterpolatedPeak(peaks, peakPosition, peakCount, interpolatedPeak);
        low[x] = interpolatedPeak[0];
        high[x] = interpolatedPeak[1];
        continue;
      }
      const firstPeak = U.clamp(Math.floor((xStartMs / 1000) * peaksPerSecond), 0, peakCount - 1);
      const lastPeak = U.clamp(Math.ceil((xEndMs / 1000) * peaksPerSecond), firstPeak + 1, peakCount);
      let min = 127;
      let max = -127;
      for (let peak = firstPeak; peak < lastPeak; peak++) {
        min = Math.min(min, peaks[peak * 2]);
        max = Math.max(max, peaks[peak * 2 + 1]);
      }
      low[x] = min;
      high[x] = max;
    }
    return { low, high };
  }

  function colorForSegment(segment) {
    if (segment.color?.name && U.PALETTE[segment.color.name]) return U.PALETTE[segment.color.name];
    if (segment.color_ref?.name && U.PALETTE[segment.color_ref.name]) return U.PALETTE[segment.color_ref.name];
    if (segment.color?.value) return segment.color.value;
    return '#66727d';
  }

  Object.assign(U, {
    clampWaveformScale,
    wheelScrollDelta,
    waveformScaleAfterStep,
    waveformAmplitude,
    sampleInterpolatedPeak,
    buildWaveformEnvelope,
    colorForSegment,
  });
})(typeof window !== 'undefined' ? window : globalThis);
