// 悬停指针线与 Seek 预览的调度。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformHoverPreview(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    showPointerLine(event, row, marker) {
      if (!row || !marker) return;
      const rect = row.getBoundingClientRect();
      const left = U.clamp(event.clientX - rect.left, 0, rect.width);
      marker.style.left = `${left}px`;
      marker.hidden = false;
    },

    hidePointerLine(marker) {
      if (marker) marker.hidden = true;
    },

    // 暂停时指针在波形上移动即把画面预览到指针时间。与拖动播放头一样按
    // 最新事件合并到每帧最多一次；真正 seek 前重新检查开关与播放状态，
    // 避免调度之后状态已变化（开始播放、关闭开关、行被虚拟化重建）仍执行。
    scheduleHoverSeekPreview(event, row) {
      if (this.playheadDragActive || this.options.getHoverSeekPreview?.() !== true) return;
      this.hoverSeekPreviewLastEvent = event;
      this.hoverSeekPreviewRow = row;
      if (this.hoverSeekPreviewFrame) return;
      this.hoverSeekPreviewFrame = requestAnimationFrame(() => this.flushHoverSeekPreview());
    },

    cancelHoverSeekPreview() {
      if (this.hoverSeekPreviewFrame) {
        cancelAnimationFrame(this.hoverSeekPreviewFrame);
        this.hoverSeekPreviewFrame = 0;
      }
      this.hoverSeekPreviewLastEvent = null;
      this.hoverSeekPreviewRow = null;
    },

    flushHoverSeekPreview() {
      this.hoverSeekPreviewFrame = 0;
      const event = this.hoverSeekPreviewLastEvent;
      const row = this.hoverSeekPreviewRow;
      this.hoverSeekPreviewLastEvent = null;
      this.hoverSeekPreviewRow = null;
      if (!event || !row) return;
      if (this.options.getHoverSeekPreview?.() !== true) return;
      if (!this.player || !this.mediaAvailable) return;
      if (!this.player.paused) return;
      if (event.buttons !== 0) return;
      if (!row.isConnected) return;
      this.seekFromPointer(event, row, false);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
