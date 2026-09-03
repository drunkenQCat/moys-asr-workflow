// 频谱 payload 解码、频谱配色与配色开关。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformSpectral(global) {
  'use strict';

  const U = global.MaweWaveform;

  // Decode a moy.asr.spectral.v1 payload into {freq, density, sample_rate,
  // division, densityMax}, or null when the payload is absent / unknown.
  // Each spectral sample is 4 bytes: freq u16 LE, density u16 LE.
  function decodeSpectralPayload(payload) {
    if (!payload || payload.schema !== U.SPECTRAL_SCHEMA || payload.encoding !== U.SPECTRAL_ENCODING) {
      return null;
    }
    if (!Number.isInteger(payload.peak_count) || payload.peak_count <= 0) return null;
    if (!Number.isInteger(payload.sample_rate) || payload.sample_rate <= 0) return null;
    if (!Number.isInteger(payload.division) || payload.division <= 0) return null;
    if (typeof payload.data !== 'string') return null;
    let binary;
    try {
      binary = atob(payload.data);
    } catch (_) {
      return null;
    }
    if (binary.length !== payload.peak_count * 4) return null;
    const freq = new Uint16Array(payload.peak_count);
    const density = new Uint16Array(payload.peak_count);
    let densityMax = 1;
    for (let i = 0; i < payload.peak_count; i++) {
      const offset = i * 4;
      freq[i] = binary.charCodeAt(offset) | (binary.charCodeAt(offset + 1) << 8);
      const d = binary.charCodeAt(offset + 2) | (binary.charCodeAt(offset + 3) << 8);
      density[i] = d;
      if (d > densityMax) densityMax = d;
    }
    return {
      freq,
      density,
      densityMax,
      sample_rate: payload.sample_rate,
      division: payload.division,
    };
  }

  // REAPER spectral coloring from the raw 15-bit freq_field (0-32767) and the
  // 14-bit density (0=noise, 16383=perfect tone). Low→high frequency sweeps
  // red→pink/green→orange/yellow; saturation & lightness rise with tonality.
  function freqColor(freq, density, densityMax) {
    let hue;
    if (freq < 300) {
      hue = (freq / 300) * 30; // red (0°) to brown (30°)
    } else if (freq < 1000) {
      hue = 300 + ((freq - 300) / 700) * 180; // pink (300°) to green (120°)
      if (hue >= 360) hue -= 360;
    } else if (freq < 3000) {
      hue = 120 - ((freq - 1000) / 2000) * 90; // green (120°) to orange (30°)
    } else {
      hue = 30 + Math.min((freq - 3000) / 5000, 1) * 30; // orange (30°) to yellow (60°)
    }
    const d = U.clamp(density / Math.max(1, densityMax), 0, 1);
    const sat = 0.3 + 0.7 * d;
    const light = 0.4 + 0.4 * d;
    return `hsl(${hue.toFixed(1)}, ${(sat * 100).toFixed(1)}%, ${(light * 100).toFixed(1)}%)`;
  }

  function syncSpectralColorToggle(toggle, available, preferred, busy = false) {
    if (!toggle) return;
    const hasSpectral = Boolean(available);
    const isBusy = Boolean(busy);
    toggle.disabled = !hasSpectral || isBusy;
    toggle.checked = hasSpectral && preferred === true;
    if (typeof toggle.setAttribute === 'function') {
      toggle.setAttribute('aria-disabled', String(!hasSpectral || isBusy));
      toggle.setAttribute('aria-busy', String(isBusy));
    }
  }

  Object.assign(U, {
    decodeSpectralPayload,
    freqColor,
    syncSpectralColorToggle,
  });
})(typeof window !== 'undefined' ? window : globalThis);
