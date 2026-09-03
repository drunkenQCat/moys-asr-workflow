// 视野控制：缩放步进、行高、滚动定位与播放头摆放。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformView(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    changeWaveformScale(direction) {
      if (this.scaleDebounceTimer) {
        window.clearTimeout(this.scaleDebounceTimer);
        this.scaleDebounceTimer = 0;
        this.pendingScaleDirection = 0;
      }
      this.applyWaveformScaleSteps(Math.sign(direction));
    },

    applyWaveformScaleSteps(steps) {
      const current = this.settings.waveformScale;
      const numericSteps = Math.trunc(Number(steps));
      if (!numericSteps) return;
      const stepDirection = numericSteps > 0 ? 1 : -1;
      let next = current;
      for (let index = 0; index < Math.abs(numericSteps); index += 1) {
        const candidate = U.waveformScaleAfterStep(next, stepDirection);
        if (candidate === next) break;
        next = candidate;
      }
      if (next === current) {
        // 已到边界：减不下去/加不上去，通知编辑器给出提示
        document.dispatchEvent(new CustomEvent('asr:waveform-scale-limit', {
          detail: { atMin: stepDirection < 0, atMax: stepDirection > 0 },
        }));
        return;
      }
      this.settings.waveformScale = next;
      U.saveSettings(this.settings);
      if (this.waveformScaleLabel) {
        this.waveformScaleLabel.textContent = `×${parseFloat(next.toFixed(2))}`;
      }
      // peak 包络按行缓存；连续滚轮由上层 debounce 合并后，这里只清晰重绘一次。
      this.redrawWaveformCanvases();
    },

    scheduleWheelScaleChange() {
      if (this.scaleDebounceTimer) window.clearTimeout(this.scaleDebounceTimer);
      this.scaleDebounceTimer = window.setTimeout(() => {
        this.scaleDebounceTimer = 0;
        const steps = this.pendingScaleDirection;
        this.pendingScaleDirection = 0;
        this.applyWaveformScaleSteps(steps);
      }, U.WAVEFORM_ADJUST_DEBOUNCE_MS);
    },

    scheduleRowHeightChange(direction) {
      this.pendingRowHeightDirection += direction > 0 ? 1 : -1;
      if (this.rowHeightDebounceTimer) window.clearTimeout(this.rowHeightDebounceTimer);
      this.rowHeightDebounceTimer = window.setTimeout(() => {
        this.rowHeightDebounceTimer = 0;
        const steps = this.pendingRowHeightDirection;
        this.pendingRowHeightDirection = 0;
        const current = U.ROW_HEIGHT_PRESETS.indexOf(this.settings.rowHeight);
        const next = U.clamp(current + steps, 0, U.ROW_HEIGHT_PRESETS.length - 1);
        if (next !== current) this.setRowHeight(U.ROW_HEIGHT_PRESETS[next]);
      }, U.WAVEFORM_ADJUST_DEBOUNCE_MS);
    },

    revealTime(timeMs, center = true) {
      if (!this.payload) return;
      this.autoScrolling = false;
      this.autoScrollTarget = null;
      this.multiFollowCheckPending = true;
      if (this.settings.mode === 'basic') {
        const windowMs = this.settings.visibleSeconds * 1000;
        const maxStart = Math.max(0, this.durationMs - windowMs);
        const currentStart = U.clamp(this.basicWindowStartMs, 0, maxStart);
        const relative = (timeMs - currentStart) / Math.max(1, windowMs);
        const needsScroll = relative < 0.2 || relative > 0.8;
        this.basicWindowStartMs = center && needsScroll
          ? U.clamp(timeMs - windowMs / 2, 0, maxStart)
          : currentStart;
        this.manualFollowUntil = Date.now() + 3000;
        this.renderBasic();
        return;
      }
      const rowDurationMs = this.settings.secondsPerRow * 1000;
      const rowIndex = U.clamp(Math.floor(timeMs / rowDurationMs), 0, Math.max(0, Math.ceil(this.durationMs / rowDurationMs) - 1));
      const stride = this.settings.rowHeight + U.ROW_GAP;
      const currentScrollTop = this.scroll.scrollTop;
      const rowInComfortZone = U.isMultiRowInComfortZone(
        rowIndex, currentScrollTop, this.scroll.clientHeight, this.settings.rowHeight,
      );
      const scrollTop = center && rowInComfortZone
        ? currentScrollTop
        : (center
          ? rowIndex * stride - Math.max(0, (this.scroll.clientHeight - this.settings.rowHeight) * 0.45)
          : rowIndex * stride);
      const nextScrollTop = Math.max(0, scrollTop);
      this.autoScrolling = Math.abs(nextScrollTop - currentScrollTop) > 0.5;
      if (this.autoScrolling) {
        this.scroll.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
      }
      this.manualFollowUntil = Date.now() + 3000;
      // 目标仍在当前可视行内时，字幕跳转只需要移动播放头；不要因为
      // revealTime() 被调用就重建整组波形 DOM/Canvas。跨行时由滚动事件
      // 或这里的合并任务增量补齐可视行。
      if (rowIndex < this.multiRange[0] || rowIndex > this.multiRange[1] || this.autoScrolling) {
        this.scheduleMultiVisible();
      }
      if (this.autoScrolling) requestAnimationFrame(() => { this.autoScrolling = false; });
    },

    changeZoom(direction) {
      const current = U.ZOOM_PRESETS.indexOf(this.settings.visibleSeconds);
      const next = U.clamp(current + direction, 0, U.ZOOM_PRESETS.length - 1);
      if (next === current) return;
      this.settings.visibleSeconds = U.ZOOM_PRESETS[next];
      U.saveSettings(this.settings);
      this.windowLabel.textContent = `${this.settings.visibleSeconds} 秒`;
      this.centerBasicOnCurrentTime();
      if (this.settings.mode === 'basic') this.renderBasic();
    },

    stretchWaveformCanvases() {
      // 字幕块/空隙块/播放头均为百分比定位，会随行宽自动跟随；
      // 只有 canvas 位图需要按新尺寸临时拉伸
      this.renderedRows.forEach((row) => {
        const canvas = row.querySelector('canvas');
        if (!canvas) return;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      });
    },

    updateMultiRowLayout() {
      if (!this.isMultiMode() || !this.payload) {
        this.render();
        return;
      }
      this.multiFollowCheckPending = true;
      const rowDurationMs = this.settings.secondsPerRow * 1000;
      const rowCount = Math.max(1, Math.ceil(this.durationMs / rowDurationMs));
      const stride = this.settings.rowHeight + U.ROW_GAP;
      this.content.style.height = `${rowCount * stride - U.ROW_GAP}px`;

      // 先改已有行的几何，再根据新的 stride 增量补齐视口；已有行保留其
      // Canvas、字幕块和事件监听器，只在后面重画受到高度影响的 Canvas。
      const retainedRows = new Set(this.renderedRows);
      this.renderedRows.forEach((row) => {
        const index = Number(row.dataset.rowIndex);
        if (!Number.isInteger(index) || index < 0) return;
        const startMs = index * rowDurationMs;
        const endMs = Math.min(this.durationMs, startMs + rowDurationMs);
        row.style.top = `${index * stride}px`;
        row.style.height = `${this.settings.rowHeight}px`;
        row.style.width = `${Math.max(0.01, Math.min(1, (endMs - startMs) / rowDurationMs) * 100)}%`;
      });
      this.multiRange = [-1, -1];
      this.renderMultiVisible(false);
      retainedRows.forEach((row) => {
        if (row.isConnected) this.drawRow(row);
      });
      this.positionPlayheads();
    },

    positionPlayheads() {
      const now = this.currentTimeMs();
      this.renderedRows.forEach((row) => {
        const startMs = Number(row.dataset.startMs);
        const endMs = Number(row.dataset.endMs);
        const playhead = row._waveformPlayhead || row.querySelector('.waveform-playhead');
        if (!playhead) return;
        const visible = now >= startMs && now <= endMs;
        playhead.hidden = !visible;
        if (visible) playhead.style.left = `${((now - startMs) / Math.max(1, endMs - startMs)) * 100}%`;
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
