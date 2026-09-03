// 峰值 payload 与 ReaPeaks 文件解码，以及媒体来源标识比较。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformDecode(global) {
  'use strict';

  const U = global.MaweWaveform;

  function decodePayload(payload) {
    if (!payload || payload.schema !== U.SCHEMA || payload.encoding !== U.ENCODING) return null;
    if (!Number.isInteger(payload.peak_count) || payload.peak_count <= 0) return null;
    if (!Number.isFinite(payload.peaks_per_second) || payload.peaks_per_second <= 0) return null;
    if (typeof payload.data !== 'string') return null;
    try {
      const binary = atob(payload.data);
      if (binary.length !== payload.peak_count * 2) return null;
      const unsigned = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) unsigned[i] = binary.charCodeAt(i);
      return new Int8Array(unsigned.buffer);
    } catch (_) {
      return null;
    }
  }

  // 浏览器端只读解析 REAPER 的 .ReaPeaks 文件。桌面/服务器版会在
  // 生成页面时预先内联同一份 payload；便携版拖入 sidecar 时则走这里，
  // 因此两种编辑器得到完全相同的 wave/spectral 缓存契约。
  function decodeReapeaksFile(arrayBuffer, source = null) {
    if (!(arrayBuffer instanceof ArrayBuffer)) return null;
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length < 18) return null;
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (!['RPKM', 'RPKN', 'RPKL'].includes(magic)) return null;
    const channels = bytes[4];
    const mipmapCount = bytes[5];
    if (!channels || !mipmapCount) return null;
    const view = new DataView(arrayBuffer);
    const sampleRate = view.getInt32(6, true);
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) return null;
    const headerEnd = 18 + mipmapCount * 8;
    if (headerEnd > bytes.length) return null;
    const mipmaps = [];
    let headerOffset = 18;
    for (let i = 0; i < mipmapCount; i++) {
      const division = view.getInt32(headerOffset, true);
      const peakCount = view.getInt32(headerOffset + 4, true);
      if (peakCount < 0) return null;
      const kind = division === -'s'.charCodeAt(0)
        ? 'spectral'
        : division === -'g'.charCodeAt(0)
          ? 'spectrogram'
          : division === -'r'.charCodeAt(0) || division === -'l'.charCodeAt(0)
            ? 'loudness' : 'wave';
      mipmaps.push({ division, peakCount, kind });
      headerOffset += 8;
    }

    const munge = (value) => {
      if (value >= -24576 && value <= 24576) return value / 24576;
      if (value > 24576) return 2 ** ((value - 24576) / 1024);
      return -(2 ** ((-value - 24576) / 1024));
    };
    const quantize = (value) => {
      const numeric = magic === 'RPKL' ? munge(value) : value / 32768;
      return U.clamp(Math.round(U.clamp(numeric, -1, 1) * 127), -127, 127);
    };
    const waveMips = [];
    const spectralMips = [];
    let offset = headerEnd;
    const need = (count) => {
      if (count < 0 || offset + count > bytes.length) throw new Error('短文件');
    };
    try {
      for (const mip of mipmaps) {
        if (mip.kind === 'wave') {
          const encoded = new Uint8Array(mip.peakCount * 2);
          for (let peak = 0; peak < mip.peakCount; peak++) {
            let low = 127;
            let high = -127;
            for (let channel = 0; channel < channels; channel++) {
              need(magic === 'RPKL' ? 4 : magic === 'RPKM' ? 2 : 4);
              const maxRaw = view.getInt16(offset, true);
              offset += 2;
              const minRaw = magic === 'RPKM' ? -maxRaw : view.getInt16(offset, true);
              if (magic !== 'RPKM') offset += 2;
              const maxValue = quantize(maxRaw);
              const minValue = quantize(minRaw);
              low = Math.min(low, minValue);
              high = Math.max(high, maxValue);
            }
            encoded[peak * 2] = low & 0xff;
            encoded[peak * 2 + 1] = high & 0xff;
          }
          waveMips.push({ mip, data: encoded });
          continue;
        }
        if (mip.kind === 'spectral') {
          const spectral = new Uint16Array(mip.peakCount * 2);
          for (let peak = 0; peak < mip.peakCount; peak++) {
            let freq = 0;
            let density = 0;
            for (let channel = 0; channel < channels; channel++) {
              need(4);
              const packed = view.getUint32(offset, true);
              offset += 4;
              if (channel === 0) {
                freq = packed & 0x7fff;
                density = (packed >>> 15) & 0x3fff;
              }
            }
            spectral[peak * 2] = freq;
            spectral[peak * 2 + 1] = density;
          }
          spectralMips.push({ mip, data: spectral });
          continue;
        }
        // 跳过当前编辑器不显示的 spectrogram/loudness 层，但仍准确推进
        // offset，避免后面的 wave/spectral 层被错误解释。
        const bytesPerValue = mip.kind === 'spectrogram' ? 192 : 4;
        need(mip.peakCount * channels * bytesPerValue);
        offset += mip.peakCount * channels * bytesPerValue;
      }
    } catch (_) {
      return null;
    }
    if (!waveMips.length) return null;
    const finest = waveMips[0];
    const division = Math.abs(finest.mip.division);
    if (!division) return null;
    const baseSource = source && typeof source === 'object' ? source : undefined;
    const waveform = {
      schema: U.SCHEMA,
      encoding: U.ENCODING,
      peaks_per_second: Math.round(sampleRate / division),
      peak_count: finest.mip.peakCount,
      duration_ms: Math.round(finest.mip.peakCount * division / sampleRate * 1000),
      ...(baseSource ? { source: baseSource } : {}),
      data: bytesToBase64(finest.data),
    };
    let spectral = null;
    if (spectralMips.length) {
      const targetDivision = Math.max(1, Math.round(sampleRate / 100));
      const paired = spectralMips.map((entry, index) => ({
        ...entry,
        division: Math.abs(waveMips[index]?.mip.division || division),
      }));
      const selected = paired.reduce((best, entry) => (
        Math.abs(entry.division - targetDivision) < Math.abs(best.division - targetDivision)
          ? entry : best
      ), paired[0]);
      const payloadBytes = new Uint8Array(selected.data.length * 2);
      selected.data.forEach((value, index) => {
        payloadBytes[index * 2] = value & 0xff;
        payloadBytes[index * 2 + 1] = value >>> 8;
      });
      spectral = {
        schema: U.SPECTRAL_SCHEMA,
        encoding: U.SPECTRAL_ENCODING,
        sample_rate: sampleRate,
        division: selected.division,
        peak_count: selected.mip.peakCount,
        duration_ms: Math.round(selected.mip.peakCount * selected.division / sampleRate * 1000),
        ...(baseSource ? { source: baseSource } : {}),
        data: bytesToBase64(payloadBytes),
      };
    }
    return { waveform, spectral };
  }

  function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    const parts = [];
    for (let i = 0; i < bytes.length; i += chunkSize) {
      parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
    }
    return btoa(parts.join(''));
  }

  function sourceForFile(file) {
    return {
      name: file.name,
      size: file.size,
      modified_ms: file.lastModified,
    };
  }

  function sameSource(a, b) {
    return !!a && !!b && a.name === b.name && a.size === b.size && a.modified_ms === b.modified_ms;
  }

  Object.assign(U, {
    decodePayload,
    decodeReapeaksFile,
    bytesToBase64,
    sourceForFile,
    sameSource,
  });
})(typeof window !== 'undefined' ? window : globalThis);
