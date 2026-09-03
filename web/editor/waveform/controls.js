// 外部控件、分栏条与滚轮的事件接线。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformControls(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    bindControls() {
      document.querySelectorAll('[data-waveform-mode]').forEach((button) => {
        button.addEventListener('click', () => this.setMode(button.dataset.waveformMode));
      });
      document.querySelectorAll('[data-waveform-tool]').forEach((button) => {
        button.addEventListener('click', () => this.setTool(button.dataset.waveformTool));
      });
      // 初始工具按钮高亮（默认 select）
      document.querySelectorAll('[data-waveform-tool]').forEach((button) => {
        button.classList.toggle('active', button.dataset.waveformTool === this.tool);
      });
      this.pane?.classList.toggle('tool-select', this.tool === 'select');
      this.pane?.classList.toggle('tool-razor', this.tool === 'razor');
      document.getElementById('waveform-zoom-in')?.addEventListener('click', () => this.changeZoom(-1));
      document.getElementById('waveform-zoom-out')?.addEventListener('click', () => this.changeZoom(1));
      this.waveformScaleDownButton?.addEventListener('click', () => this.changeWaveformScale(-1));
      this.waveformScaleUpButton?.addEventListener('click', () => this.changeWaveformScale(1));
      this.pane.addEventListener('pointerdown', () => {
        this.autoScrolling = false;
        this.autoScrollTarget = null;
        this.multiFollowCheckPending = true;
        this.focusWaveform();
      });
      this.secondsPerRowSelect?.addEventListener('change', () => {
        this.settings.secondsPerRow = Number(this.secondsPerRowSelect.value);
        U.saveSettings(this.settings);
        this.multiRange = [-1, -1];
        this.render();
      });
      this.rowHeightSelect?.addEventListener('change', () => {
        this.setRowHeight(Number(this.rowHeightSelect.value));
      });
      this.showGroupBadgesToggle?.addEventListener('change', () => {
        this.settings.showGroupBadges = this.showGroupBadgesToggle.checked;
        U.saveSettings(this.settings);
        this.render();
      });
      if (this.dragPlayheadToggle) this.dragPlayheadToggle.checked = this.settings.dragPlayhead === true;
      this.dragPlayheadToggle?.addEventListener('change', () => {
        this.settings.dragPlayhead = this.dragPlayheadToggle.checked;
        U.saveSettings(this.settings);
      });
      if (this.spectralColorToggle) {
        U.syncSpectralColorToggle(this.spectralColorToggle, false, this.settings.spectralColor);
      }
      this.spectralColorToggle?.addEventListener('change', () => {
        this.scheduleSpectralColorRender();
      });
      this.sideSelect?.addEventListener('change', () => {
        this.settings.side = this.sideSelect.value === 'right' ? 'right' : 'left';
        U.saveSettings(this.settings);
        this.applyLayout();
        this.scheduleRender();
      });
      this.disabledDisplaySelect?.addEventListener('change', () => {
        this.settings.disabledDisplay = this.disabledDisplaySelect.value === 'hidden' ? 'hidden' : 'dim';
        U.saveSettings(this.settings);
        this.refreshCueOverlay();
      });
      this.layoutEditToggle?.addEventListener('click', () => this.toggleLayoutEditMode());
      this.layoutResetButton?.addEventListener('click', () => this.resetLayout());
      this.scroll.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
      this.scroll.addEventListener('pointerdown', () => {
        this.autoScrolling = false;
        this.autoScrollTarget = null;
        this.multiFollowCheckPending = true;
      });
      this.scroll.addEventListener('scroll', (event) => {
        if (!this.isMultiMode()) return;
        const wasAutoScroll = this.autoScrolling || this.autoScrollTarget !== null;
        if (this.autoScrollTarget !== null
            && Math.abs(this.scroll.scrollTop - this.autoScrollTarget) <= 0.5) {
          this.autoScrolling = false;
          this.autoScrollTarget = null;
        }
        if (event.isTrusted && !wasAutoScroll) {
          this.manualFollowUntil = Date.now() + 3000;
          this.multiFollowCheckPending = true;
        }
        this.scheduleMultiVisible();
      });
      this.bindDivider();
      this.bindLayoutResizers();
    },

    bindDivider() {
      const bind = (divider, axis) => {
        if (!divider) return;
        let dividerDrag = null;
        divider.addEventListener('pointerdown', (event) => {
          if (!this.isMultiMode() || this.settings.layout !== 'classic') return;
          event.preventDefault();
          dividerDrag = { pointerId: event.pointerId, snapshot: this.getLayoutHistorySnapshot(), changed: false };
          divider.classList.add('dragging');
          divider.setPointerCapture(event.pointerId);
          this.layoutDragging = true;
        });
        divider.addEventListener('pointermove', (event) => {
          if (!dividerDrag || dividerDrag.pointerId !== event.pointerId) return;
          const rect = this.workspace.getBoundingClientRect();
          const percent = axis === 'x'
            ? ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100
            : ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
          const nextSplitPercent = U.clamp(
            this.settings.side === 'right' ? 100 - percent : percent,
            35,
            75,
          );
          if (nextSplitPercent === this.settings.splitPercent) return;
          if (!dividerDrag.changed) {
            this.recordLayoutUndo('调整波形与字幕区域尺寸', dividerDrag.snapshot);
            dividerDrag.changed = true;
          }
          this.settings.splitPercent = nextSplitPercent;
          this.workspace.style.setProperty('--waveform-split', `${this.settings.splitPercent}%`);
          this.scheduleRender();
        });
        const finish = (event) => {
          if (!dividerDrag || dividerDrag.pointerId !== event.pointerId) return;
          const changed = dividerDrag.changed;
          dividerDrag = null;
          divider.classList.remove('dragging');
          try { divider.releasePointerCapture(event.pointerId); } catch (_) {}
          this.layoutDragging = false;
          // 松手后按最终尺寸做一次清晰重绘
          if (changed) this.scheduleRender();
          U.saveSettings(this.settings);
        };
        divider.addEventListener('pointerup', finish);
        divider.addEventListener('pointercancel', finish);
      };
      bind(this.divider, 'x');
    },

    bindLayoutResizers() {
      Object.entries(this.layoutResizers).forEach(([kind, resizer]) => {
        if (!resizer) return;
        let drag = null;
        resizer.addEventListener('pointerdown', (event) => {
          if (!this.isPresetResizableLayout()) return;
          event.preventDefault();
          drag = { pointerId: event.pointerId, snapshot: this.getLayoutHistorySnapshot(), changed: false };
          resizer.classList.add('dragging');
          resizer.setPointerCapture?.(event.pointerId);
          this.layoutDragging = true;
        });
        resizer.addEventListener('pointermove', (event) => {
          if (!drag || drag.pointerId !== event.pointerId) return;
          const rect = this.workspace.getBoundingClientRect();
          const previousColumn = this.settings.layoutColumnPercent;
          const previousRows = [...this.settings.layoutRows];
          if (kind === 'column') {
            this.settings.layoutColumnPercent = U.clamp(
              ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100,
              30,
              75,
            );
          } else {
            const percent = ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
            const rows = [...this.settings.layoutRows];
            if (kind === 'rowTop') {
              rows[0] = U.clamp(percent, 12, 76);
              rows[1] = Math.min(rows[1], 88 - rows[0]);
            } else {
              rows[1] = U.clamp(percent - rows[0], 6, 82);
            }
            this.settings.layoutRows = U.normalizeLayoutRows(rows);
          }
          const hasChanged = previousColumn !== this.settings.layoutColumnPercent
            || previousRows.some((value, index) => value !== this.settings.layoutRows[index]);
          if (!hasChanged) return;
          if (!drag.changed) {
            this.recordLayoutUndo('调整布局区域尺寸', drag.snapshot);
            drag.changed = true;
          }
          this.applyLayoutVariables();
          this.scheduleRender();
        });
        const finish = (event) => {
          if (!drag || drag.pointerId !== event.pointerId) return;
          const changed = drag.changed;
          drag = null;
          resizer.classList.remove('dragging');
          try { resizer.releasePointerCapture?.(event.pointerId); } catch (_) {}
          this.layoutDragging = false;
          // 松手后按最终尺寸做一次清晰重绘
          if (changed) this.scheduleRender();
          U.saveSettings(this.settings);
        };
        resizer.addEventListener('pointerup', finish);
        resizer.addEventListener('pointercancel', finish);
      });
    },

    handleWheel(event) {
      const scrollDelta = U.wheelScrollDelta(event);
      if (!scrollDelta) return;
      this.autoScrolling = false;
      this.autoScrollTarget = null;
      this.multiFollowCheckPending = true;
      if (this.isMultiMode() && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        // Ctrl(Cmd)+Shift+滚轮：仅多行模式下循环调整行高预设，向上滚放大，不改变时间映射
        event.preventDefault();
        const current = U.ROW_HEIGHT_PRESETS.indexOf(this.settings.rowHeight);
        const next = U.clamp(current + (scrollDelta > 0 ? -1 : 1), 0, U.ROW_HEIGHT_PRESETS.length - 1);
        if (next !== current) {
          this.scheduleRowHeightChange(scrollDelta > 0 ? -1 : 1);
        }
        return;
      }
      if (event.shiftKey) {
        event.preventDefault();
        // 用 rAF 合并高频滚轮：一帧内累加方向，避免每次 wheel 都重渲染导致卡顿
        this.pendingScaleDirection += scrollDelta > 0 ? -1 : 1;
        this.scheduleWheelScaleChange();
        return;
      }
      if (this.settings.mode === 'basic') {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          this.changeZoom(scrollDelta > 0 ? 1 : -1);
          return;
        }
        const windowMs = this.settings.visibleSeconds * 1000;
        const maxStart = Math.max(0, this.durationMs - windowMs);
        const delta = Math.sign(scrollDelta) * windowMs * 0.12;
        this.basicWindowStartMs = U.clamp(this.basicWindowStartMs + delta, 0, maxStart);
        this.manualFollowUntil = Date.now() + 3000;
        this.scheduleBasicRender();
        return;
      }
      if (this.isMultiMode() && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const current = U.ROW_PRESETS.indexOf(this.settings.secondsPerRow);
        const next = U.clamp(current + (scrollDelta > 0 ? 1 : -1), 0, U.ROW_PRESETS.length - 1);
        if (next !== current) {
          this.settings.secondsPerRow = U.ROW_PRESETS[next];
          this.secondsPerRowSelect.value = String(this.settings.secondsPerRow);
          U.saveSettings(this.settings);
          this.renderMulti();
        }
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
