// 渲染调度与波形绘制：基本视图、多行视图与包络描边。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformRender(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    scheduleSpectralColorRender() {
      const toggle = this.spectralColorToggle;
      if (!toggle || !this.spectral) {
        U.syncSpectralColorToggle(toggle, this.spectral != null, this.settings.spectralColor, this.spectralColorBusy);
        return;
      }
      // Native disabled controls already block normal repeated clicks. Keep a
      // guard as well for synthetic change events and automation code.
      if (this.spectralColorBusy) {
        toggle.checked = this.settings.spectralColor === true;
        return;
      }

      const enabled = toggle.checked === true;
      this.settings.spectralColor = enabled;
      U.saveSettings(this.settings);
      this.spectralColorBusy = true;
      this.setSpectralColorStatus(U.localizedWaveformMessage(
        enabled ? '正在应用频谱颜色…' : '正在关闭频谱颜色…',
        enabled ? 'Applying spectral colors…' : 'Removing spectral colors…',
      ));
      U.syncSpectralColorToggle(toggle, true, enabled, true);

      const token = ++this.spectralColorRenderToken;
      const renderAfterPaint = () => {
        // Let the browser paint the disabled control and live status before
        // the synchronous Canvas redraw occupies the main thread.
        window.setTimeout(() => {
          if (token !== this.spectralColorRenderToken) return;
          try {
            this.render();
          } finally {
            this.spectralColorBusy = false;
            U.syncSpectralColorToggle(
              toggle,
              this.spectral != null,
              this.settings.spectralColor,
              false,
            );
            this.setSpectralColorStatus();
          }
        }, 0);
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(renderAfterPaint);
      } else {
        window.setTimeout(renderAfterPaint, 0);
      }
    },

    scheduleRender() {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.render());
    },

    scheduleMultiVisible() {
      // 滚动事件一帧内可能触发多次；合并到每帧最多一次可视区渲染
      if (this.multiVisibleFrame) return;
      this.multiVisibleFrame = requestAnimationFrame(() => {
        this.multiVisibleFrame = 0;
        this.renderMultiVisible();
      });
    },

    scheduleBasicRender() {
      // 高频滚轮逐事件全绘单行波形会卡顿；合并到每帧最多一次
      if (this.basicRenderFrame) return;
      this.basicRenderFrame = requestAnimationFrame(() => {
        this.basicRenderFrame = 0;
        this.renderBasic();
      });
    },

    scheduleRefreshCueBlocks() {
      // 高回报率指针设备一帧内触发多次 pointermove；合并到每帧最多一次块重排
      if (this.cueRefreshFrame) return;
      this.cueRefreshFrame = requestAnimationFrame(() => {
        this.cueRefreshFrame = 0;
        this.refreshCueBlocks();
      });
    },

    // 画布颜色取自 CSS 令牌，以便跟随暗/亮主题。每次 render() 前刷新缓存。
    _readWaveColors() {
      const styles = getComputedStyle(document.documentElement);
      const get = (name, fallback) => {
        const value = styles.getPropertyValue(name).trim();
        return value || fallback;
      };
      this._waveColors = {
        rowBg: get('--wave-row-bg', '#1d252d'),
        rowBorder: get('--wave-row-border', '#2d3944'),
        rowTick: get('--wave-row-tick', '#3b4b59'),
        peak: get('--wave-peak', '#65b89a'),
        peakDim: get('--wave-peak-dim', '#83909a'),
      };
    },

    _getWaveColors() {
      if (!this._waveColors) this._readWaveColors();
      return this._waveColors;
    },

    render() {
      // 主题切换后令牌值变化：每次全量渲染前刷新画布颜色缓存，供 drawRow 读取。
      this._readWaveColors();
      this.applyLayout();
      if (!this.payload || !this.peaks) {
        this.content.replaceChildren();
        this.renderedRows = [];
        this.empty.classList.remove('hidden');
        return;
      }
      this.empty.classList.add('hidden');
      if (this.layoutDragging) {
        // 布局拖拽中：不做全量重建（每帧 14 个 canvas 重绘会卡顿），
        // 只把已有位图按新尺寸拉伸；松手后由 finish 里的 scheduleRender 恢复清晰
        this.stretchWaveformCanvases();
        return;
      }
      if (this.settings.mode === 'basic') this.renderBasic();
      else this.renderMulti();
    },

    redrawWaveformCanvases({ measure = true } = {}) {
      if (!this.payload || !this.peaks) return;
      if (!this.renderedRows.length) {
        this.renderSegments();
        return;
      }
      this.renderedRows.forEach((row) => this.drawRow(row, { measure }));
      this.updatePlayback(false);
    },

    renderSegments() {
      if (!this.payload) {
        this.render();
        return;
      }
      if (this.settings.mode === 'basic') this.renderBasic();
      else this.renderMultiVisible(true);
    },

    renderBasic() {
      if (!this.payload) return;
      const windowMs = this.settings.visibleSeconds * 1000;
      const maxStart = Math.max(0, this.durationMs - windowMs);
      this.basicWindowStartMs = U.clamp(this.basicWindowStartMs, 0, maxStart);
      const endMs = Math.min(this.durationMs, this.basicWindowStartMs + windowMs);
      this.content.replaceChildren();
      this.content.style.height = '100%';
      const groupBadges = U.computeGroupBadges(this.options.getSegments('main'));
      const row = this.createRow(this.basicWindowStartMs, endMs, -1, true, groupBadges);
      this.content.appendChild(row);
      this.renderedRows = [row];
      this.drawRow(row);
      this.updatePlayback(false);
    },

    renderMulti() {
      const rowDurationMs = this.settings.secondsPerRow * 1000;
      const rowCount = Math.max(1, Math.ceil(this.durationMs / rowDurationMs));
      this.content.style.height = `${rowCount * (this.settings.rowHeight + U.ROW_GAP) - U.ROW_GAP}px`;
      this.multiRange = [-1, -1];
      this.multiFollowCheckPending = true;
      this.renderMultiVisible(true);
    },

    renderMultiVisible(force = false) {
      if (!this.isMultiMode() || !this.payload) return;
      const rowDurationMs = this.settings.secondsPerRow * 1000;
      const rowCount = Math.max(1, Math.ceil(this.durationMs / rowDurationMs));
      const stride = this.settings.rowHeight + U.ROW_GAP;
      const first = U.clamp(Math.floor(this.scroll.scrollTop / stride) - U.MULTI_ROW_BUFFER, 0, rowCount - 1);
      const last = U.clamp(Math.ceil((this.scroll.scrollTop + this.scroll.clientHeight) / stride) + U.MULTI_ROW_BUFFER, 0, rowCount - 1);
      if (!force && first === this.multiRange[0] && last === this.multiRange[1]) {
        this.updatePlayback(false);
        return;
      }
      this.multiRange = [first, last];
      this.content.style.height = `${rowCount * stride - U.ROW_GAP}px`;
      const groupBadges = U.computeGroupBadges(this.options.getSegments('main'));
      if (force) {
        // 全量重建：先完成所有 DOM 变更再统一绘制，避免逐行强制同步布局
        this.content.replaceChildren();
        const rows = [];
        for (let index = first; index <= last; index++) {
          rows.push(this.content.appendChild(this.createMultiRow(index, rowDurationMs, groupBadges)));
        }
        this.renderedRows = rows;
        for (const row of rows) this.drawRow(row);
        this.updatePlayback(false);
        return;
      }
      // 增量更新：只移除滚出可视范围的行、只绘制新进入的行；
      // 仍在范围内的行保留原 canvas 不重绘，消除滚动时的整体重建卡顿
      const wanted = new Set();
      for (let index = first; index <= last; index++) wanted.add(String(index));
      const existing = new Set();
      this.content.querySelectorAll('.waveform-row').forEach((row) => {
        if (wanted.has(row.dataset.rowIndex)) existing.add(row.dataset.rowIndex);
        else row.remove();
      });
      const created = [];
      for (let index = first; index <= last; index++) {
        if (existing.has(String(index))) continue;
        created.push(this.content.appendChild(this.createMultiRow(index, rowDurationMs, groupBadges)));
      }
      this.renderedRows = [...this.content.querySelectorAll('.waveform-row')];
      for (const row of created) this.drawRow(row);
      this.updatePlayback(false);
    },

    getWaveformEnvelope(row, width, startMs, endMs, activePeaks, peaksPerSecond, activeCount, useInterpolation) {
      const key = row._waveformEnvelopeKey;
      if (row._waveformEnvelope && key
          && key.width === width
          && key.startMs === startMs
          && key.endMs === endMs
          && key.source === activePeaks
          && key.peaksPerSecond === peaksPerSecond
          && key.peakCount === activeCount
          && key.useInterpolation === useInterpolation) {
        return row._waveformEnvelope;
      }
      const envelope = U.buildWaveformEnvelope(
        activePeaks,
        peaksPerSecond,
        activeCount,
        startMs,
        endMs,
        width,
        useInterpolation,
      );
      row._waveformEnvelopeKey = {
        width,
        startMs,
        endMs,
        source: activePeaks,
        peaksPerSecond,
        peakCount: activeCount,
        useInterpolation,
      };
      row._waveformEnvelope = envelope;
      return envelope;
    },

    drawRow(row, { measure = true } = {}) {
      const canvas = row.querySelector('canvas');
      if (!canvas || !this.peaks) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let width = Number(row._waveformCanvasWidth);
      let height = Number(row._waveformCanvasHeight);
      if (measure || !Number.isFinite(width) || !Number.isFinite(height)) {
        const rect = row.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
      }
      if (width <= 0 || height <= 0) return;
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      const cssWidth = `${width}px`;
      const cssHeight = `${height}px`;
      if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
      if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;
      row._waveformCanvasWidth = width;
      row._waveformCanvasHeight = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = this._getWaveColors();
      ctx.fillStyle = colors.rowBg;
      ctx.fillRect(0, 0, width, height);

      const startMs = Number(row.dataset.startMs);
      const endMs = Number(row.dataset.endMs);
      const rangeMs = Math.max(1, endMs - startMs);
      const tickSeconds = rangeMs <= 10000 ? 1 : rangeMs <= 30000 ? 2 : 5;
      const firstTick = Math.ceil(startMs / (tickSeconds * 1000)) * tickSeconds * 1000;
      ctx.strokeStyle = colors.rowBorder;
      ctx.lineWidth = 1;
      for (let tick = firstTick; tick < endMs; tick += tickSeconds * 1000) {
        const x = ((tick - startMs) / rangeMs) * width;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
        ctx.stroke();
      }
      ctx.strokeStyle = colors.rowTick;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.46);
      ctx.lineTo(width, height * 0.46);
      ctx.stroke();

      // 波形形状来源：默认使用 .ReaPeaks 的最细 wave 层（缺数据时自动回退自研缓存）；用户可切回自研。
      const shapeSource = this.options.getWaveShapeSource?.() || 'reapeaks';
      const useReapeaksShape = shapeSource === 'reapeaks' && this.reapeaksPayload && this.reapeaksPeaks;
      const activePeaks = useReapeaksShape ? this.reapeaksPeaks : this.peaks;
      const activePps = useReapeaksShape ? this.reapeaksPayload.peaks_per_second : this.payload.peaks_per_second;
      const activeCount = useReapeaksShape ? this.reapeaksPayload.peak_count : this.payload.peak_count;
      const peaksPerSecond = activePps;
      const useInterpolation = this.settings.mode === 'basic'
        && this.settings.visibleSeconds === U.ZOOM_PRESETS[0]
        && (rangeMs / 1000) * peaksPerSecond < width;
      const envelope = this.getWaveformEnvelope(
        row,
        width,
        startMs,
        endMs,
        activePeaks,
        peaksPerSecond,
        activeCount,
        useInterpolation,
      );
      const center = height * 0.46;
      const amplitude = U.waveformAmplitude(height, this.settings.waveformScale);
      const minWaveY = 2;
      const maxWaveY = Math.max(minWaveY, height - 2);
      const spectral = this.settings.spectralColor === true ? this.spectral : null;
      const defaultColor = this.mediaAvailable ? colors.peak : colors.peakDim;
      const spectralRate = spectral ? spectral.sample_rate / spectral.division : 0;
      ctx.lineWidth = 1;
      // 有频谱缓存时逐像素按主频染色（颜色只填充在波形包络内）；
      // 否则沿用单次批量描边，避免无频谱时的逐像素绘制开销。
      let pathOpen = false;
      for (let x = 0; x < width; x++) {
        const xStartMs = startMs + (x / width) * rangeMs;
        const low = envelope.low[x];
        const high = envelope.high[x];
        const yTop = U.clamp(center - (high / 127) * amplitude, minWaveY, maxWaveY);
        const yBot = U.clamp(center - (low / 127) * amplitude, minWaveY, maxWaveY);
        if (spectral) {
          const centerMs = xStartMs + rangeMs / width / 2;
          const specIndex = Math.floor((centerMs / 1000) * spectralRate);
          let color = defaultColor;
          if (specIndex >= 0 && specIndex < spectral.freq.length) {
            const freq = spectral.freq[specIndex];
            if (freq > 0) {
              color = U.freqColor(freq, spectral.density[specIndex], spectral.densityMax);
            }
          }
          ctx.fillStyle = color;
          ctx.fillRect(x + 0.5, yTop, 1, Math.max(1, yBot - yTop));
        } else {
          if (!pathOpen) {
            ctx.beginPath();
            ctx.strokeStyle = defaultColor;
            pathOpen = true;
          }
          ctx.moveTo(x + 0.5, yTop);
          ctx.lineTo(x + 0.5, yBot);
        }
      }
      if (!spectral && pathOpen) ctx.stroke();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
