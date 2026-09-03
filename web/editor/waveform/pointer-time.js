// 指针坐标到时刻的换算、轨道命中与 Seek。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformPointerTime(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    seekFromPointer(
      event,
      row,
      playAfterSeek = false,
      geometry = null,
      allowCrossRow = false,
      dragPreview = false,
    ) {
      const requestedMs = allowCrossRow
        ? this.timeFromPointerUnbounded(event, row, geometry)
        : this.timeFromPointer(event, row, geometry);
      const timeMs = allowCrossRow
        ? U.clamp(requestedMs, 0, Math.max(0, this.durationMs))
        : requestedMs;
      this.options.seek(timeMs / 1000, { dragPreview });
      this.updatePlayback();
      if (playAfterSeek && this.player?.paused) this.options.togglePlayback?.();
    },

    seekFromCue(event, row, index, playAfterSeek = false, geometry = null, track = 'main') {
      const segment = this.options.getSegments(track)[index];
      const timeMs = this.options.getClickTarget?.() === 'pointer'
        ? this.timeFromPointer(event, row, geometry)
        : Number(segment?.start);
      if (!Number.isFinite(timeMs)) return;
      this.options.seek(timeMs / 1000);
      this.updatePlayback();
      if (playAfterSeek && this.player?.paused) this.options.togglePlayback?.();
    },

    captureRowGeometry(row) {
      const rect = row.getBoundingClientRect();
      return {
        left: rect.left,
        width: Math.max(1, rect.width),
        startMs: Number(row.dataset.startMs),
        endMs: Number(row.dataset.endMs),
      };
    },

    trackAtPoint(clientX, clientY, row = null) {
      const hit = document.elementFromPoint(clientX, clientY);
      const hitRow = row || hit?.closest?.('.waveform-row');
      if (!hitRow || !this.pane?.contains(hitRow)) return 'main';
      const block = hit?.closest?.('.waveform-cue-block');
      if (block?.dataset.track === 'extension') return 'extension';
      if (!hitRow.classList.contains('multi-subtitle-row')) return 'main';
      const rowRect = hitRow.getBoundingClientRect();
      const rowStyle = getComputedStyle(hitRow);
      const parsePx = (value, fallback) => {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const bottomInset = parsePx(rowStyle.getPropertyValue('--multi-subtitle-bottom-inset'), 7);
      const visibleCue = hitRow.querySelector(
        '.waveform-cue-block[data-track="main"], .waveform-cue-block[data-track="extension"]',
      );
      const visibleCueHeight = visibleCue?.getBoundingClientRect().height || 0;
      const markerStyle = getComputedStyle(hitRow, '::after');
      const markerHeight = parsePx(markerStyle.height, 15);
      const markerBottom = parsePx(markerStyle.bottom, NaN);
      const markerLaneHeight = Number.isFinite(markerBottom)
        ? 2 * (markerBottom - bottomInset) + markerHeight : 0;
      const laneHeight = visibleCueHeight > 0
        ? visibleCueHeight
        : markerLaneHeight > 0
          ? markerLaneHeight
          : Math.min(35, Math.max(0, (rowRect.height - bottomInset * 2) / 2));
      const extensionTop = rowRect.height - bottomInset - laneHeight;
      return clientY - rowRect.top >= extensionTop ? 'extension' : 'main';
    },

    isCueTimeOccupied(timeMs, track = 'main') {
      const time = Number(timeMs);
      if (!Number.isFinite(time)) return false;
      const segments = this.options.getSegments?.(track) || [];
      return segments.some((segment) => {
        const start = Number(segment?.start);
        const end = Number(segment?.end);
        return Number.isFinite(start) && Number.isFinite(end)
          && start < time && time < end;
      });
    },

    // 创建字幕的拖动不能跨过已有字幕；沿拖动方向把当前端点夹到遇到的
    // 第一个字幕边界。这样预览和最终提交使用同一组无重叠时间范围。
    clampCreateCueTime(anchorMs, requestedMs, track = 'main') {
      if (!Number.isFinite(anchorMs) || !Number.isFinite(requestedMs) || anchorMs === requestedMs) {
        return requestedMs;
      }
      const segments = this.options.getSegments?.(track) || [];
      if (segments.some((segment) => {
        const start = Number(segment?.start);
        const end = Number(segment?.end);
        return Number.isFinite(start) && Number.isFinite(end)
          && start < anchorMs && anchorMs < end;
      })) return anchorMs;
      const movingRight = requestedMs > anchorMs;
      let boundary = movingRight ? Infinity : -Infinity;
      for (const segment of segments) {
        const start = Number(segment?.start);
        const end = Number(segment?.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
        if (movingRight) {
          if (start >= anchorMs && start <= requestedMs) boundary = Math.min(boundary, start);
        } else if (end <= anchorMs && end >= requestedMs) {
          boundary = Math.max(boundary, end);
        }
      }
      return Number.isFinite(boundary) ? boundary : requestedMs;
    },

    timeFromPointer(event, row, geometry = null) {
      const rect = geometry || row.getBoundingClientRect();
      const ratio = U.clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      const startMs = geometry?.startMs ?? Number(row.dataset.startMs);
      const endMs = geometry?.endMs ?? Number(row.dataset.endMs);
      return startMs + ratio * (endMs - startMs);
    },

    // 边界/整体 Gap 拖动需要允许指针越过当前行的左右边缘；否则多行模式
    // 会把时间永远钳在本行，无法从一行延伸到前后行。
    timeFromPointerUnbounded(event, row, geometry = null) {
      const rect = geometry || row.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
      const startMs = geometry?.startMs ?? Number(row.dataset.startMs);
      const endMs = geometry?.endMs ?? Number(row.dataset.endMs);
      return startMs + ratio * (endMs - startMs);
    },

    // 在波形指针拆分成功后短暂显示黄色定位光条，帮助用户确认实际操作位置。
    // 光条只覆盖波形行，不参与鼠标命中，也不影响红色播放头。
    flashSplitAtTime(timeMs) {
      if (!Number.isFinite(timeMs)) return false;
      const rows = [...this.content.querySelectorAll('.waveform-row')];
      const row = rows.find((candidate) => {
        const startMs = Number(candidate.dataset.startMs);
        const endMs = Number(candidate.dataset.endMs);
        return timeMs >= startMs && timeMs <= endMs;
      });
      if (!row) return false;

      const startMs = Number(row.dataset.startMs);
      const endMs = Number(row.dataset.endMs);
      const marker = row.querySelector('.waveform-split-flash');
      if (!marker) return false;
      if (marker._hideTimer) window.clearTimeout(marker._hideTimer);
      marker.hidden = false;
      marker.style.left = `${((timeMs - startMs) / Math.max(1, endMs - startMs)) * 100}%`;
      marker.classList.remove('is-active');
      // 强制重新计算布局，让连续两次 B 也能重启动画。
      void marker.offsetWidth;
      marker.classList.add('is-active');
      marker._hideTimer = window.setTimeout(() => {
        marker.classList.remove('is-active');
        marker.hidden = true;
        marker._hideTimer = 0;
      }, U.SPLIT_FLASH_DURATION_MS);
      return true;
    },

    // 返回波形字幕切点的屏幕坐标，供全屏反馈动画把中心落在实际切分位置。
    getSplitPointAtTime(timeMs, track = 'main') {
      if (!Number.isFinite(timeMs)) return null;
      const rows = [...this.content.querySelectorAll('.waveform-row')];
      const row = rows.find((candidate) => {
        const startMs = Number(candidate.dataset.startMs);
        const endMs = Number(candidate.dataset.endMs);
        return timeMs >= startMs && timeMs <= endMs;
      });
      if (!row) return null;
      const rowStart = Number(row.dataset.startMs);
      const rowEnd = Number(row.dataset.endMs);
      const rowRect = row.getBoundingClientRect();
      const ratio = U.clamp((timeMs - rowStart) / Math.max(1, rowEnd - rowStart), 0, 1);
      const selector = `.waveform-cue-block[data-track="${track === 'extension' ? 'extension' : 'main'}"]`;
      const block = [...row.querySelectorAll(selector)].find((candidate) => {
        const startMs = Number(candidate.dataset.start);
        const endMs = Number(candidate.dataset.end);
        return timeMs >= startMs && timeMs <= endMs;
      });
      const blockRect = block?.getBoundingClientRect?.();
      return {
        clientX: rowRect.left + rowRect.width * ratio,
        clientY: blockRect ? blockRect.top + blockRect.height / 2 : rowRect.top + rowRect.height / 2,
      };
    },

    // 屏幕坐标 -> 波形时间：命中某个波形行时返回该行内的时间（毫秒），否则返回 null。
    // 供键盘快捷键（如 B 按指针音频位置拆分）在不构造指针事件的情况下复用行内映射。
    timeMsAtPoint(clientX, clientY) {
      const hit = document.elementFromPoint(clientX, clientY);
      const row = hit?.closest?.('.waveform-row');
      if (!row || !this.pane?.contains(row)) return null;
      const timeMs = this.timeFromPointer({ clientX }, row);
      return Number.isFinite(timeMs) ? timeMs : null;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
