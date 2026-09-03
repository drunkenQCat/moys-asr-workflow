// 媒体与波形数据接入：播放器绑定、payload、频谱、ReaPeaks 与解码入口。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformMedia(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    attachPlayer(player) {
      if (this.player) {
        this.player.removeEventListener('timeupdate', this._onPlayerTime);
        this.player.removeEventListener('seeked', this._onPlayerTime);
        this.player.removeEventListener('loadedmetadata', this._onPlayerTime);
      }
      this.player = player;
      if (this.player) {
        this.player.addEventListener('timeupdate', this._onPlayerTime);
        this.player.addEventListener('seeked', this._onPlayerTime);
        this.player.addEventListener('loadedmetadata', this._onPlayerTime);
      }
      this.updatePlayback();
    },

    setMediaAvailable(available) {
      const next = Boolean(available);
      if (next === this.mediaAvailable) return;
      this.mediaAvailable = next;
      this.pane.classList.toggle('waveform-media-unavailable', !next);
      if (!this.payload) return;
      this.setStatus(next
        ? `${U.formatCompact(this.payload.duration_ms)} · ${this.payload.peak_count.toLocaleString()} peaks`
        : `${U.formatCompact(this.payload.duration_ms)} · 缓存波形（未加载媒体）`);
      this.render();
    },

    setPayload(payload, { render = true } = {}) {
      const decoded = U.decodePayload(payload);
      if (!decoded) {
        this.payload = null;
        this.peaks = null;
        this.setStatus('等待波形数据');
        this.empty.textContent = '加载媒体后显示波形（大媒体需要先用 MAW 生成波形后拖入）';
        this.empty.classList.remove('hidden');
        if (render) this.render();
        return false;
      }
      this.payload = payload;
      this.peaks = decoded;
      this.empty.classList.add('hidden');
      this.setStatus(this.mediaAvailable
        ? `${U.formatCompact(payload.duration_ms)} · ${payload.peak_count.toLocaleString()} peaks`
        : `${U.formatCompact(payload.duration_ms)} · 缓存波形（未加载媒体）`);
      this.centerBasicOnCurrentTime();
      this.multiRange = [-1, -1];
      if (render) this.render();
      if (this.pendingNavigation) {
        const navigation = this.pendingNavigation;
        this.pendingNavigation = null;
        this.restoreNavigation(navigation);
      }
      return true;
    },

    getPayload() {
      return this.payload;
    },

    setSpectralPayload(payload, { render = true } = {}) {
      this.spectral = U.decodeSpectralPayload(payload);
      // Without spectral data the feature is visibly and functionally off.
      // Keep the stored preference intact so a deferred server payload can
      // restore the user's choice when it becomes available.
      U.syncSpectralColorToggle(
        this.spectralColorToggle,
        this.spectral != null,
        this.settings.spectralColor,
        this.spectralColorBusy,
      );
      if (render) this.render();
      return this.spectral != null;
    },

    setReapeaksWaveform(payload, { render = true } = {}) {
      this.reapeaksPeaks = U.decodePayload(payload);
      this.reapeaksPayload = this.reapeaksPeaks ? payload : null;
      if (this.reapeaksPayload && !this.payload) {
        this.setPayload(this.reapeaksPayload, { render: false });
      }
      if (render) this.render();
      return this.reapeaksPayload != null;
    },

    getGapRemoveDetectionData() {
      if (!this.payload || !this.peaks) return null;
      return {
        peaks: this.peaks,
        peaks_per_second: this.payload.peaks_per_second,
        duration_ms: this.payload.duration_ms,
      };
    },

    async processFile(file) {
      const signature = U.sourceForFile(file);
      if (this.payload && U.sameSource(this.payload.source, signature)) {
        this.setStatus(`使用缓存 · ${this.payload.peak_count.toLocaleString()} peaks`);
        return this.payload;
      }
      this.options.onPayload(null);
      this.setPayload(null);
      if (file.size > U.BROWSER_DECODE_LIMIT) {
        const message = U.localizedWaveformMessage(
          '媒体过大，浏览器不会整段解码；请使用 MAW GUI 预生成波形',
          'The media is too large for full browser decoding; use the MAW GUI to pre-generate the waveform',
        );
        this.setStatus(message, 'error');
        throw new Error(message);
      }
      const durationSeconds = await this.waitForPlayerDuration();
      const estimatedPcmBytes = durationSeconds * 48000 * 2 * 4;
      if (durationSeconds > 0 && estimatedPcmBytes > U.BROWSER_PCM_ESTIMATE_LIMIT) {
        const message = U.localizedWaveformMessage(
          '音轨较长，浏览器整段解码可能耗尽内存；请使用 MAW GUI 预生成波形',
          'The audio track is long and full browser decoding may exhaust memory; use the MAW GUI to pre-generate the waveform',
        );
        this.setStatus(message, 'error');
        throw new Error(message);
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        const message = U.localizedWaveformMessage(
          '当前浏览器不支持 Web Audio；请使用 MAW GUI 预生成波形',
          'This browser does not support Web Audio; use the MAW GUI to pre-generate the waveform',
        );
        this.setStatus(message, 'error');
        throw new Error(message);
      }

      this.setStatus(`正在分析波形：${file.name}`, 'busy');
      let context = null;
      try {
        context = new AudioContextClass();
        const bytes = await file.arrayBuffer();
        const buffer = await context.decodeAudioData(bytes);
        const peaksPerSecond = 100;
        const channels = Array.from(
          { length: buffer.numberOfChannels },
          (_, index) => buffer.getChannelData(index),
        );
        const bucketSamples = Math.max(1, Math.round(buffer.sampleRate / peaksPerSecond));
        const peakCount = Math.ceil(buffer.length / bucketSamples);
        const encoded = new Uint8Array(peakCount * 2);
        for (let peakIndex = 0; peakIndex < peakCount; peakIndex++) {
          const start = peakIndex * bucketSamples;
          const end = Math.min(buffer.length, start + bucketSamples);
          const stride = Math.max(1, Math.ceil((end - start) / 96));
          let low = 1;
          let high = -1;
          for (let sample = start; sample < end; sample += stride) {
            for (const channel of channels) {
              const value = channel[sample];
              if (value < low) low = value;
              if (value > high) high = value;
            }
          }
          const lowSigned = U.clamp(Math.round(low * 127), -127, 127);
          const highSigned = U.clamp(Math.round(high * 127), -127, 127);
          encoded[peakIndex * 2] = lowSigned & 0xFF;
          encoded[peakIndex * 2 + 1] = highSigned & 0xFF;
          if (peakIndex > 0 && peakIndex % 20000 === 0) {
            this.setStatus(`正在分析波形：${Math.round((peakIndex / peakCount) * 100)}%`, 'busy');
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
        }
        const payload = {
          schema: U.SCHEMA,
          encoding: U.ENCODING,
          peaks_per_second: peaksPerSecond,
          peak_count: peakCount,
          duration_ms: Math.round(buffer.duration * 1000),
          data: U.bytesToBase64(encoded),
          source: signature,
        };
        this.options.onPayload(payload);
        this.setPayload(payload);
        return payload;
      } catch (error) {
        const detail = error.message || error;
        const message = U.localizedWaveformMessage(
          `浏览器无法解析音轨：${detail}；请使用 MAW GUI 预生成波形`,
          `The browser could not decode the audio track: ${detail}; use the MAW GUI to pre-generate the waveform`,
        );
        this.setStatus(message, 'error');
        throw new Error(message);
      } finally {
        if (context) {
          try { await context.close(); } catch (_) {}
        }
      }
    },

    async waitForPlayerDuration() {
      const player = this.player;
      if (!player) return 0;
      if (Number.isFinite(player.duration) && player.duration > 0) {
        return player.duration;
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          player.removeEventListener('loadedmetadata', finish);
          resolve(Number.isFinite(player.duration) ? player.duration : 0);
        };
        const timer = setTimeout(finish, 3000);
        player.addEventListener('loadedmetadata', finish, { once: true });
      });
    },

    get durationMs() {
      if (this.payload) return this.payload.duration_ms;
      if (this.player && Number.isFinite(this.player.duration)) return Math.round(this.player.duration * 1000);
      return 0;
    },

    currentTimeMs() {
      return this.player && Number.isFinite(this.player.currentTime)
        ? Math.round(this.player.currentTime * 1000) : 0;
    },

    centerBasicOnCurrentTime() {
      const windowMs = this.settings.visibleSeconds * 1000;
      const maxStart = Math.max(0, this.durationMs - windowMs);
      this.basicWindowStartMs = U.clamp(this.currentTimeMs() - windowMs / 2, 0, maxStart);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
