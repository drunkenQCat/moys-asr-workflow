// 新建字幕、占位拒绝、框选与播放头拖拽的起点。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformPointerCreate(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    // Ctrl(Cmd)+左键拖动空白波形：显示字幕块虚影，松开后交给编辑器
    // 创建字幕。时间映射固定使用按下时的行几何，避免虚拟行重建或拖出行边界
    // 后把终点错误地映射到另一行。
    beginCreateCueDrag(event, row, track = 'main') {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      this.focusWaveform();
      const geometry = this.captureRowGeometry(row);
      const startMs = this.timeFromPointer(event, row, geometry);
      if (this.isCueTimeOccupied(startMs, track)) {
        this.options.onCueCreateRejected?.('occupied');
        return;
      }
      const drag = {
        pointerId: event.pointerId,
        row,
        geometry,
        startMs,
        currentMs: startMs,
        startClientX: event.clientX,
        startClientY: event.clientY,
        lastEvent: event,
        preview: null,
        frame: 0,
        finish: null,
      };
      this.createCueDrag = drag;

      const updatePosition = (nextEvent) => {
        if (!nextEvent) return;
        drag.lastEvent = nextEvent;
        const requestedMs = this.timeFromPointer(nextEvent, row, geometry);
        // 起点在空白时，拖入已有字幕只把终点挡在字幕边界，
        // 保留之前的“边界阻挡后仍可创建”行为。
        drag.currentMs = this.clampCreateCueTime(drag.startMs, requestedMs, track);
      };
      const updatePreview = () => {
        drag.frame = 0;
        if (this.createCueDrag !== drag) return;
        const start = Math.min(drag.startMs, drag.currentMs);
        const end = Math.max(drag.startMs, drag.currentMs);
        if (!drag.preview) {
          drag.preview = document.createElement('div');
          drag.preview.className = 'waveform-cue-block waveform-create-preview';
          drag.preview.dataset.track = track;
          if (track === 'extension') drag.preview.style.setProperty('--cue-color', '#7a9fc5');
          const label = document.createElement('span');
          label.className = 'waveform-cue-label';
          drag.preview.appendChild(label);
          row.appendChild(drag.preview);
        }
        const duration = Math.max(1, geometry.endMs - geometry.startMs);
        drag.preview.style.left = `${U.clamp(((start - geometry.startMs) / duration) * 100, 0, 100)}%`;
        drag.preview.style.width = `${Math.max(0.25, U.clamp(((end - start) / duration) * 100, 0, 100))}%`;
        drag.preview.firstElementChild.textContent = `${U.formatCompact(U.roundMs(start))} → ${U.formatCompact(U.roundMs(end))} · ${U.formatCompact(U.roundMs(end - start))}`;
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        if (drag.frame) {
          cancelAnimationFrame(drag.frame);
          drag.frame = 0;
        }
        try { row.releasePointerCapture?.(drag.pointerId); } catch (_) {}
        drag.preview?.remove();
        drag.preview = null;
      };
      const finish = (commit, finalEvent = null) => {
        if (this.createCueDrag !== drag) return;
        if (finalEvent) updatePosition(finalEvent);
        const start = U.roundMs(Math.min(drag.startMs, drag.currentMs));
        const end = U.roundMs(Math.max(drag.startMs, drag.currentMs));
        cleanup();
        this.createCueDrag = null;
        if (!commit) return;
        if (end - start < U.MIN_CUE_MS) {
          this.options.onCueCreateRejected?.('too-short', start, end);
          return;
        }
        this.options.addCueRange?.(start, end, drag.startClientX, drag.startClientY, track);
      };
      drag.finish = finish;
      try { row.setPointerCapture?.(drag.pointerId); } catch (_) {}

      const onMove = (moveEvent) => {
        if (this.createCueDrag !== drag) return;
        if (!(moveEvent.buttons & 1)) {
          finish(true, moveEvent);
          return;
        }
        updatePosition(moveEvent);
        if (!drag.frame) drag.frame = requestAnimationFrame(updatePreview);
      };
      const onUp = (upEvent) => finish(true, upEvent);
      const onCancel = () => finish(false);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    },

    beginBlockedCueCreateDrag(event, index, track = 'main') {
      const target = event.currentTarget;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let finished = false;
      let moved = false;
      const cleanup = () => {
        if (finished) return;
        finished = true;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        try { target.releasePointerCapture?.(pointerId); } catch (_) {}
      };
      const onMove = (moveEvent) => {
        if (finished || moveEvent.pointerId !== pointerId) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (dx * dx + dy * dy < 16) return;
        moved = true;
        cleanup();
        this.options.onCueCreateRejected?.('occupied');
      };
      const onUp = () => {
        if (finished) return;
        cleanup();
        if (!moved) {
          if (track === 'extension') this.options.toggleExtensionSelection?.(index);
          else this.options.toggleCueSelection?.(index);
        }
      };
      const onCancel = () => cleanup();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      try { target.setPointerCapture?.(pointerId); } catch (_) {}
    },

    // 「允许拖动指针」：在波形空白区域按住左键拖动时，播放指针实时跟随鼠标
    // 所在位置。高回报率指针事件用 rAF 合并，并限制连续 seek 的频率，避免
    // 浏览器反复解码和编辑器刷新造成拖动卡顿；松开时以最终位置再 seek 一次
    // 保证落点精确。多行模式下允许拖出当前行边界，并把时间限制在整个媒体范围内。
    beginPlayheadDrag(event, row, geometry = null) {
      geometry = geometry || this.captureRowGeometry(row);
      try { row.setPointerCapture?.(event.pointerId); } catch (_) {}
      let frame = 0;
      let lastEvent = null;
      let lastSeekAt = -Infinity;
      let active = true;
      let dragging = false;
      let moved = false;
      const startX = event.clientX;
      const startY = event.clientY;
      const flush = () => {
        frame = 0;
        if (!lastEvent) return;
        const now = performance.now();
        if (now - lastSeekAt < U.PLAYHEAD_DRAG_SEEK_INTERVAL_MS) {
          frame = requestAnimationFrame(flush);
          return;
        }
        const eventToSeek = lastEvent;
        lastEvent = null;
        lastSeekAt = now;
        this.seekFromPointer(eventToSeek, row, false, geometry, true, true);
      };
      const cleanup = () => {
        if (!active) return;
        active = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        try { row.releasePointerCapture?.(event.pointerId); } catch (_) {}
        lastEvent = null;
        if (dragging) {
          this.playheadDragActive = false;
          this.cancelHoverSeekPreview();
          this.options.onPlayheadDragStateChange?.(false);
        }
      };
      const onMove = (moveEvent) => {
        if (!(moveEvent.buttons & 1)) { cleanup(); return; }
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) >= 3) {
          moved = true;
          if (!dragging) {
            dragging = true;
            this.playheadDragActive = true;
            this.cancelHoverSeekPreview();
            this.options.onPlayheadDragStateChange?.(true);
          }
        }
        lastEvent = moveEvent;
        if (!frame) frame = requestAnimationFrame(flush);
      };
      const onUp = (upEvent) => {
        cleanup();
        if (moved) this.seekFromPointer(upEvent, row, false, geometry, true, false);
      };
      const onCancel = () => cleanup();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
      window.addEventListener('pointercancel', onCancel, { once: true });
    },

    // Shift+左键框选：在波形空白处按下并拖动，画出选框，松开后把与选框相交的
    // 字幕块追加进当前多选（与 Shift 范围选同为追加语义）。选框挂在
    // #waveform-content 内、与行同坐标系，滚动时自动跟随；多行虚拟化重建
    // 会清掉覆盖层与块上的预览类，因此每帧重新挂载、重新命中。位移低于
    // 阈值的 Shift+点击视为空操作，不触发空白区既有的清除选中/seek。
    beginMarqueeDrag(event) {
      const content = this.content;
      const startRect = content.getBoundingClientRect();
      const start = { x: event.clientX - startRect.left, y: event.clientY - startRect.top };
      let lastEvent = event;
      let overlay = null;
      let frame = 0;
      let drawing = false;
      let hits = { main: new Set(), extension: new Set() };

      const clearPreview = () => {
        content.querySelectorAll('.waveform-cue-block.marquee-preview').forEach((block) => {
          block.classList.remove('marquee-preview');
        });
      };
      const removeOverlay = () => {
        if (overlay) overlay.remove();
        overlay = null;
      };
      const update = () => {
        frame = 0;
        const rect = content.getBoundingClientRect();
        const current = { x: lastEvent.clientX - rect.left, y: lastEvent.clientY - rect.top };
        if (!drawing) {
          if (Math.hypot(current.x - start.x, current.y - start.y) < 4) return;
          drawing = true;
        }
        if (!overlay || !overlay.isConnected) {
          overlay = document.createElement('div');
          overlay.className = 'waveform-marquee';
          content.appendChild(overlay);
        }
        const left = Math.min(start.x, current.x);
        const top = Math.min(start.y, current.y);
        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.width = `${Math.abs(current.x - start.x)}px`;
        overlay.style.height = `${Math.abs(current.y - start.y)}px`;
        const marqueeRect = overlay.getBoundingClientRect();
        const next = { main: new Set(), extension: new Set() };
        content.querySelectorAll('.waveform-cue-block[data-track="main"], .waveform-cue-block[data-track="extension"]').forEach((block) => {
          const blockRect = block.getBoundingClientRect();
          const hit =
            !block.hidden &&
            blockRect.right > marqueeRect.left &&
            blockRect.left < marqueeRect.right &&
            blockRect.bottom > marqueeRect.top &&
            blockRect.top < marqueeRect.bottom;
          block.classList.toggle('marquee-preview', hit);
          if (!hit) return;
          const track = block.dataset.track === 'extension' ? 'extension' : 'main';
          const rawIndex = track === 'extension' ? block.dataset.extIdx : block.dataset.idx;
          const index = Number(rawIndex);
          if (Number.isInteger(index)) next[track].add(index);
        });
        hits = next;
      };
      const finish = (commit) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
        // 以指针最终位置补一次命中计算，避免快速松开时结果落后一帧
        if (commit) update();
        clearPreview();
        removeOverlay();
        if (commit && drawing) {
          if (hits.main.size > 0) {
            this.options.addCueSelection?.([...hits.main].sort((a, b) => a - b));
          }
          if (hits.extension.size > 0) {
            this.options.addExtensionSelection?.([...hits.extension].sort((a, b) => a - b));
          }
        }
      };
      const onMove = (moveEvent) => {
        if (!(moveEvent.buttons & 1)) {
          finish(true);
          return;
        }
        lastEvent = moveEvent;
        if (!frame) frame = requestAnimationFrame(update);
      };
      const onUp = (upEvent) => {
        lastEvent = upEvent;
        finish(true);
      };
      const onCancel = () => finish(false);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
