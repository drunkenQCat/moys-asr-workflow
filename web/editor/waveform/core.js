// WaveformEditor 的构造器、模式/工具/行高与状态出口。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 类体其余成员按职责放在同目录的原型混入模块里，由它们自行装到
// WaveformEditor.prototype 上；构造器与本文件的成员保持类语法。

(function initMaweWaveformCore(global) {
  'use strict';

  const U = global.MaweWaveform;

  class WaveformEditor {
    constructor(options) {
      this.options = options;
      this.settings = U.readSettings();
      this.payload = null;
      this.peaks = null;
      this.spectral = null;
      this.reapeaksPayload = null;
      this.reapeaksPeaks = null;
      this.player = null;
      this.mediaAvailable = false;
      this.spectralColorBusy = false;
      this.spectralColorRenderToken = 0;
      this.basicWindowStartMs = 0;
      this.manualFollowUntil = 0;
      this.multiRange = [-1, -1];
    this.activeIndex = -1;
    this.activeExtensionIndex = -1;
    // active 轮廓的视觉命中状态：空隙中 activeIndex 不变，但轮廓需要熄灭，
    // 因此单独跟踪“上次是否严格命中”以触发 class 刷新。
    this.activeVisualHit = false;
    this.activeExtensionVisualHit = false;
      this.drag = null;
      this.createCueDrag = null;
      this.gapRangeDrag = null;
      this.gapBoundaryDrag = null;
      this.gapMoveDrag = null;
      this.gapMovePreviewFrame = 0;
      this.suppressGapClickUntil = 0;
      this.autoScrolling = false;
      this.autoScrollTarget = null;
      this.navigationRestoring = false;
      this.multiFollowRowIndex = -1;
      this.multiFollowCheckPending = true;
      this.resizeFrame = 0;
      // 字幕快捷键会在很短时间内连续请求定位；复用滚动事件已有的
      // rAF 合并，避免每个按键都强制重建可视行和 Canvas。
      this.multiVisibleFrame = 0;
      // 「鼠标位置自动预览」：高回报率 pointermove 用 rAF 合并，每帧最多按
      // 最新事件 seek 一次；pointerleave 时取消尚未执行的待办。
      this.hoverSeekPreviewFrame = 0;
      this.hoverSeekPreviewLastEvent = null;
      this.hoverSeekPreviewRow = null;
      this.playheadDragActive = false;
      // Shift+滚轮调振幅的 debounce：滚动期间只累计净步数，停止后一次性重绘
      this.pendingScaleDirection = 0;
      this.scaleDebounceTimer = 0;
      // 行高预设也可能由高回报率滚轮连续触发；等待滚动停止后一次性重排，
      // 避免每个 wheel 事件都重绘整组可视行。
      this.pendingRowHeightDirection = 0;
      this.rowHeightDebounceTimer = 0;
      this.renderedRows = [];
      // 波形交互工具：'select'（默认，保留 Ctrl/Shift/分组多选与拖动）或
      // 'razor'（左键点击字幕块即在指针位置安全拆分）。Alt 行为不随工具变化。
      this.tool = 'select';

      this.workspace = document.getElementById('editor-workspace');
      this.panel = document.getElementById('current-cue-panel');
      this.playerWrap = this.workspace.querySelector('.player-wrap');
      this.cues = document.getElementById('cues-container');
      this.pane = document.getElementById('waveform-pane');
      this.scroll = document.getElementById('waveform-scroll');
      this.content = document.getElementById('waveform-content');
      this.empty = document.getElementById('waveform-empty');
      this.status = document.getElementById('waveform-status');
      this.spectralColorStatus = document.getElementById('waveform-spectral-status');
      this.divider = document.getElementById('workspace-divider');
      this.secondaryDivider = document.getElementById('workspace-divider-secondary');
      this.windowLabel = document.getElementById('waveform-window-label');
      this.waveformScaleLabel = document.getElementById('waveform-scale-label');
      this.waveformScaleDownButton = document.getElementById('waveform-scale-down');
      this.waveformScaleUpButton = document.getElementById('waveform-scale-up');
      this.secondsPerRowSelect = document.getElementById('waveform-seconds-per-row');
      this.rowHeightSelect = document.getElementById('waveform-row-height');
      this.showGroupBadgesToggle = document.getElementById('waveform-show-group-badges');
      this.dragPlayheadToggle = document.getElementById('waveform-drag-playhead');
      this.spectralColorToggle = document.getElementById('waveform-spectral-color');
      this.sideSelect = document.getElementById('waveform-side');
      this.disabledDisplaySelect = document.getElementById('waveform-disabled-display');
      this.layoutEditToggle = document.getElementById('layout-edit-toggle');
      this.layoutResetButton = document.getElementById('layout-reset');
      this.layoutPreview = document.getElementById('layout-drop-preview');
      this.layoutResizers = {
        column: document.getElementById('layout-resizer-v'),
        rowTop: document.getElementById('layout-resizer-h1'),
        rowMiddle: document.getElementById('layout-resizer-h2'),
      };
      this._onPlayerTime = () => this.updatePlayback();
      this._onResize = () => this.scheduleRender();
      this.bindControls();
      this.bindDockHandles();
      this.applyLayout();

      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(this._onResize);
        this.resizeObserver.observe(this.pane);
      } else {
        window.addEventListener('resize', this._onResize);
      }
    }

    isAdjacentCueAdjustmentIndependent(altKey = false) {
      return U.shouldAdjustAdjacentCuesIndependently(
        altKey,
        this.options.getAutoSnapAdjacentCues?.() === true,
      );
    }

    // 共享边界拖动期间，在「共享边界」状态文本旁提示当前“相邻字幕自动吸附”
    // 模式；文案按用户设置显示默认模式，Alt 始终是临时反转修饰键。
    adjacentSnapModeStatusHint() {
      return this.options.getAutoSnapAdjacentCues?.() === true
        ? '当前为相邻字幕自动吸附模式，按住 Alt 可以临时解除吸附。'
        : '当前未启用相邻字幕自动吸附，按住 Alt 可以临时启用。';
    }

    hasCueDrag() {
      return Boolean(this.drag || this.createCueDrag);
    }

    setMode(mode) {
      if (!['basic', 'multi'].includes(mode) || mode === this.settings.mode) return;
      this.settings.mode = mode;
      this.multiFollowRowIndex = -1;
      this.multiFollowCheckPending = true;
      U.saveSettings(this.settings);
      this.applyLayout();
      if (mode === 'basic') this.centerBasicOnCurrentTime();
      if (this.isMultiMode()) this.multiRange = [-1, -1];
      this.render();
    }

    // 工具切换：'select' 为默认选择工具，保留全部 Ctrl/Shift/分组多选与
    // 拖动行为；'razor' 让左键点击字幕块在指针位置安全拆分。切回 select
    // 不会清除已有选中，便于拆分后立即继续操作。
    setTool(tool) {
      if (tool !== 'select' && tool !== 'razor') return;
      if (this.tool === tool) return;
      this.tool = tool;
      this.pane?.classList.toggle('tool-razor', tool === 'razor');
      this.pane?.classList.toggle('tool-select', tool === 'select');
      document.querySelectorAll('[data-waveform-tool]').forEach((button) => {
        button.classList.toggle('active', button.dataset.waveformTool === tool);
      });
      this.setStatus(tool === 'razor' ? '分割工具：点击字幕块在指针位置拆分' : '选择工具');
    }

    getTool() {
      return this.tool;
    }

    isMultiMode() {
      return this.settings.mode === 'multi';
    }

    getRowHeight() {
      return this.settings.rowHeight;
    }

    getMaxRowHeight() {
      return U.ROW_HEIGHT_PRESETS[U.ROW_HEIGHT_PRESETS.length - 1];
    }

    setRowHeight(value) {
      const next = Number(value);
      if (this.rowHeightDebounceTimer) {
        window.clearTimeout(this.rowHeightDebounceTimer);
        this.rowHeightDebounceTimer = 0;
        this.pendingRowHeightDirection = 0;
      }
      if (!U.ROW_HEIGHT_PRESETS.includes(next)) return false;
      if (this.settings.rowHeight === next) return true;
      this.settings.rowHeight = next;
      if (this.rowHeightSelect) this.rowHeightSelect.value = String(next);
      U.saveSettings(this.settings);
      if (this.isMultiMode() && this.payload) {
        this.updateMultiRowLayout();
      } else {
        this.render();
      }
      return true;
    }

    focusWaveform() {
      this.pane.focus({ preventScroll: true });
    }

    updateDisabledVisibility() {
      this.refreshCueOverlay();
    }

    setStatus(message, kind = '') {
      this.status.textContent = message;
      this.status.classList.toggle('error', kind === 'error');
      this.status.classList.toggle('busy', kind === 'busy');
    }

    setSpectralColorStatus(message = '') {
      if (!this.spectralColorStatus) return;
      const visible = Boolean(message);
      this.spectralColorStatus.hidden = !visible;
      this.spectralColorStatus.textContent = visible ? message : '';
    }
  }

  Object.assign(U, { WaveformEditor });
})(typeof window !== 'undefined' ? window : globalThis);
