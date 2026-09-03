// 自定义布局树编辑：节点创建、分隔条、快照与回退。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformLayoutEdit(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    ensureCustomLayoutRoot() {
      if (this.customLayoutRoot?.isConnected) return this.customLayoutRoot;
      this.customLayoutRoot = document.createElement('div');
      this.customLayoutRoot.className = 'free-layout-root';
      this.workspace.insertBefore(this.customLayoutRoot, this.layoutPreview || null);
      return this.customLayoutRoot;
    },

    restoreDirectLayoutModules() {
      const elements = {
        player: this.playerWrap,
        panel: this.panel,
        cues: this.cues,
        wave: this.pane,
      };
      if (!this.customLayoutRoot?.isConnected) return;
      Object.values(elements).forEach((element) => {
        if (element) {
          element.style.gridArea = '';
          this.workspace.insertBefore(element, this.customLayoutRoot);
        }
      });
      this.customLayoutRoot.remove();
      this.customLayoutRoot = null;
      this.renderedCustomLayoutTree = null;
    },

    createCustomLayoutNode(node) {
      const elements = {
        player: this.playerWrap,
        panel: this.panel,
        cues: this.cues,
        wave: this.pane,
      };
      if (node.type === 'module') {
        const slot = document.createElement('div');
        slot.className = 'layout-child layout-module-slot';
        slot.dataset.layoutModule = node.id;
        if (elements[node.id]) slot.appendChild(elements[node.id]);
        return slot;
      }
      const split = document.createElement('div');
      split.className = `layout-split layout-split-${node.direction}`;
      split.dataset.layoutDirection = node.direction;
      const first = document.createElement('div');
      first.className = 'layout-child';
      const second = document.createElement('div');
      second.className = 'layout-child';
      const divider = document.createElement('div');
      divider.className = `layout-split-divider layout-split-divider-${node.direction}`;
      divider.title = node.direction === 'row' ? '拖动调整左右区域比例' : '拖动调整上下区域比例';
      first.appendChild(this.createCustomLayoutNode(node.children[0]));
      second.appendChild(this.createCustomLayoutNode(node.children[1]));
      split.append(first, divider, second);
      this.applyCustomSplitRatio(first, node.ratio);
      this.bindCustomLayoutDivider(divider, split, first, node);
      return split;
    },

    applyCustomSplitRatio(first, ratio) {
      first.style.flex = `0 0 calc(${U.clamp(Number(ratio) || 50, 20, 80)}% - 3.5px)`;
    },

    bindCustomLayoutDivider(divider, split, first, node) {
      let drag = null;
      divider.addEventListener('pointerdown', (event) => {
        if (this.settings.layout !== 'custom') return;
        event.preventDefault();
        drag = { pointerId: event.pointerId, snapshot: this.getLayoutHistorySnapshot(), changed: false };
        divider.classList.add('dragging');
        divider.setPointerCapture?.(event.pointerId);
      });
      divider.addEventListener('pointermove', (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const rect = split.getBoundingClientRect();
        const position = node.direction === 'row'
          ? ((event.clientX - rect.left) / Math.max(1, rect.width)) * 100
          : ((event.clientY - rect.top) / Math.max(1, rect.height)) * 100;
        const nextRatio = U.clamp(position, 20, 80);
        if (nextRatio === node.ratio) return;
        if (!drag.changed) {
          this.recordLayoutUndo('调整自定义布局尺寸', drag.snapshot);
          drag.changed = true;
        }
        node.ratio = nextRatio;
        this.applyCustomSplitRatio(first, node.ratio);
      });
      const finish = (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag = null;
        divider.classList.remove('dragging');
        try { divider.releasePointerCapture?.(event.pointerId); } catch (_) {}
        U.saveSettings(this.settings);
      };
      divider.addEventListener('pointerup', finish);
      divider.addEventListener('pointercancel', finish);
    },

    applyCustomLayoutTree() {
      if (this.settings.layout !== 'custom') {
        this.restoreDirectLayoutModules();
        return;
      }
      const root = this.ensureCustomLayoutRoot();
      const tree = U.isCompleteLayoutTree(this.settings.layoutTree)
        ? this.settings.layoutTree
        : U.cloneLayoutTree(U.DEFAULT_RIGHT_LAYOUT_TREE);
      this.settings.layoutTree = tree;
      if (this.renderedCustomLayoutTree === tree && root.childElementCount) return;
      root.replaceChildren();
      root.appendChild(this.createCustomLayoutNode(tree));
      this.renderedCustomLayoutTree = tree;
    },

    getLayoutData() {
      return {
        schema: U.WORKSPACE_SCHEMA,
        preset: this.settings.layout,
        waveformMode: this.settings.mode,
        waveformSettings: {
          visibleSeconds: this.settings.visibleSeconds,
          secondsPerRow: this.settings.secondsPerRow,
          rowHeight: this.settings.rowHeight,
          waveformScale: this.settings.waveformScale,
          side: this.settings.side,
          disabledDisplay: this.settings.disabledDisplay,
          showGroupBadges: this.settings.showGroupBadges !== false,
          dragPlayhead: this.settings.dragPlayhead === true,
        },
        splitPercent: this.settings.splitPercent,
        columnPercent: this.settings.layoutColumnPercent,
        rows: [...this.settings.layoutRows],
        tree: U.cloneLayoutTree(this.settings.layoutTree),
      };
    },

    getLayoutHistorySnapshot() {
      return {
        layout: this.getLayoutData(),
        layoutEditing: !!this.settings.layoutEditing,
      };
    },

    recordLayoutUndo(label, snapshot = this.getLayoutHistorySnapshot()) {
      this.options.onLayoutUndo?.(label, snapshot);
    },

    restoreLayoutHistorySnapshot(snapshot) {
      if (!snapshot || !snapshot.layout) return false;
      const layout = U.normalizeLayoutData(snapshot.layout);
      this.settings.layout = layout.preset;
      if (layout.waveformMode) this.settings.mode = layout.waveformMode;
      if (layout.waveformSettings) Object.assign(this.settings, layout.waveformSettings);
      this.settings.splitPercent = layout.splitPercent;
      this.settings.layoutColumnPercent = layout.columnPercent;
      this.settings.layoutRows = layout.rows;
      this.settings.layoutTree = layout.tree;
      this.settings.layoutEditing = layout.preset === 'custom' && !!snapshot.layoutEditing;
      U.saveSettings(this.settings);
      this.applyLayout();
      this.render();
      return true;
    },

    resetLayout() {
      this.recordLayoutUndo('重置工作区');
      this.setLayout(U.DEFAULT_SETTINGS.layout);
      this.setStatus('已恢复默认工作区');
    },

    setLayoutData(value, { render = true } = {}) {
      const layout = U.normalizeLayoutData(value);
      this.settings.layout = layout.preset;
      if (layout.waveformMode) this.settings.mode = layout.waveformMode;
      if (layout.waveformSettings) Object.assign(this.settings, layout.waveformSettings);
      this.settings.splitPercent = layout.splitPercent;
      this.settings.layoutColumnPercent = layout.columnPercent;
      this.settings.layoutRows = layout.rows;
      this.settings.layoutTree = layout.tree;
      this.settings.layoutEditing = false;
      U.saveSettings(this.settings);
      this.applyLayout();
      if (render) this.render();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
