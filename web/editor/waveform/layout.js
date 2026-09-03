// 工作区布局的应用、停靠与拖放落点。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformLayout(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    applyLayoutVariables() {
      const [top, middle, bottom] = U.normalizeLayoutRows(this.settings.layoutRows);
      this.settings.layoutRows = [top, middle, bottom];
      this.workspace.style.setProperty('--waveform-split', `${this.settings.splitPercent}%`);
      this.workspace.style.setProperty('--layout-column', `${this.settings.layoutColumnPercent}%`);
      this.workspace.style.setProperty('--layout-row-top', `${top}%`);
      this.workspace.style.setProperty('--layout-row-middle', `${middle}%`);
      this.workspace.style.setProperty('--layout-row-bottom', `${bottom}%`);
    },

    applyLayout() {
      this.workspace.classList.remove(
        'waveform-basic', 'waveform-multi',
        'layout-classic', 'layout-wave-right', 'layout-custom',
        'waveform-right', 'layout-editing',
      );
      this.workspace.classList.add(`waveform-${this.settings.mode}`);
      this.workspace.classList.add(`layout-${this.settings.layout}`);
      if (this.settings.layout === 'classic' && this.settings.side === 'right') {
        this.workspace.classList.add('waveform-right');
      }
      if (this.settings.layoutEditing) this.workspace.classList.add('layout-editing');
      this.applyLayoutVariables();
      this.applyCustomLayoutTree();
      document.querySelectorAll('[data-waveform-mode]').forEach((button) => {
        button.classList.toggle('active', button.dataset.waveformMode === this.settings.mode);
      });
      this.windowLabel.textContent = `${this.settings.visibleSeconds} 秒`;
      if (this.waveformScaleLabel) this.waveformScaleLabel.textContent = `×${parseFloat(this.settings.waveformScale.toFixed(2))}`;
      this.secondsPerRowSelect.value = String(this.settings.secondsPerRow);
      if (this.rowHeightSelect) this.rowHeightSelect.value = String(this.settings.rowHeight);
      if (this.sideSelect) this.sideSelect.value = this.settings.side;
      if (this.disabledDisplaySelect) this.disabledDisplaySelect.value = this.settings.disabledDisplay;
      if (this.showGroupBadgesToggle) this.showGroupBadgesToggle.checked = this.settings.showGroupBadges !== false;
      if (this.dragPlayheadToggle) this.dragPlayheadToggle.checked = this.settings.dragPlayhead === true;
      if (this.layoutEditToggle) {
        this.layoutEditToggle.textContent = this.settings.layoutEditing ? '完成布局' : '编辑布局';
        this.layoutEditToggle.classList.toggle('active', !!this.settings.layoutEditing);
      }
      if (this.layoutResetButton) this.layoutResetButton.hidden = !this.settings.layoutEditing;
      this.updateAdvancedSettingsAvailability();
    },

    updateAdvancedSettingsAvailability() {
      const basicMode = this.settings.mode === 'basic';
      const multiMode = this.settings.mode === 'multi';
      document.getElementById('waveform-zoom-in').disabled = !basicMode;
      document.getElementById('waveform-zoom-out').disabled = !basicMode;
      this.secondsPerRowSelect.disabled = !multiMode;
      if (this.rowHeightSelect) this.rowHeightSelect.disabled = !multiMode;
      // 「显示窗口」仅基础模式有意义；「每行长度」「每行高度」仅多行模式有意义。
      const windowSetting = document.getElementById('waveform-window-setting');
      const secondsPerRowSetting = document.getElementById('waveform-seconds-per-row-setting');
      const rowHeightSetting = document.getElementById('waveform-row-height-setting');
      if (windowSetting) windowSetting.hidden = !basicMode;
      if (secondsPerRowSetting) secondsPerRowSetting.hidden = !multiMode;
      if (rowHeightSetting) rowHeightSetting.hidden = !multiMode;
    },

    // 切换到内置工作区：应用其渲染器、波形模式与完整布局树。
    setLayout(workspaceId) {
      const builtin = U.BUILTIN_WORKSPACES[workspaceId];
      if (!builtin) return;
      const normalized = U.normalizeLayoutData(builtin);
      this.settings.layout = normalized.preset;
      if (normalized.waveformMode) this.settings.mode = normalized.waveformMode;
      if (normalized.waveformSettings) Object.assign(this.settings, normalized.waveformSettings);
      this.settings.splitPercent = normalized.splitPercent;
      this.settings.layoutColumnPercent = normalized.columnPercent;
      this.settings.layoutRows = normalized.rows;
      this.settings.layoutTree = normalized.tree;
      this.settings.layoutEditing = false;
      U.saveSettings(this.settings);
      this.applyLayout();
      this.render();
    },

    toggleLayoutEditMode() {
      if (this.settings.layout !== 'custom') {
        this.settings.layout = 'custom';
        this.settings.layoutEditing = true;
      } else {
        this.settings.layoutEditing = !this.settings.layoutEditing;
      }
      U.saveSettings(this.settings);
      this.applyLayout();
      this.render();
    },

    isCustomLayout() {
      return this.settings.layout === 'custom' && this.settings.layoutEditing;
    },

    isPresetResizableLayout() {
      return this.settings.layout === 'wave-right';
    },

    bindDockHandles() {
      const modules = [
        ['player', this.playerWrap],
        ['panel', this.panel],
        ['cues', this.cues],
        ['wave', this.pane],
      ];
      modules.forEach(([id, element]) => {
        if (!element) return;
        element.dataset.dockModule = id;
        let handle = element.querySelector(':scope > .dock-handle');
        if (!handle) {
          handle = document.createElement('div');
          handle.className = 'dock-handle';
          handle.textContent = `⋮⋮ ${U.MODULE_LABELS[id]}`;
          element.prepend(handle);
        }
        handle.draggable = true;
        handle.addEventListener('dragstart', (event) => {
          if (!this.isCustomLayout()) {
            event.preventDefault();
            this.setStatus('请先进入「编辑布局」模式', 'busy');
            return;
          }
          event.dataTransfer?.setData('text/plain', id);
          event.dataTransfer?.setDragImage(handle, 16, 10);
          this.layoutDragSource = id;
          this.workspace.classList.add('layout-dragging');
          element.classList.add('layout-drag-source');
        });
        handle.addEventListener('dragend', () => {
          this.layoutDragSource = null;
          element.classList.remove('layout-drag-source');
          this.clearLayoutDropPreview();
          this.workspace.classList.remove('layout-dragging');
        });
        element.addEventListener('dragover', (event) => {
          if (!this.isCustomLayout() || !this.layoutDragSource) return;
          if (U.layoutRootDropIntent(this.workspace.getBoundingClientRect(), event.clientX, event.clientY)) return;
          if (this.layoutDragSource === id) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          const intent = U.layoutDropIntent(element.getBoundingClientRect(), event.clientX, event.clientY);
          this.layoutDropIntent = { ...intent, targetId: id, sourceId: this.layoutDragSource };
          this.showLayoutDropPreview(element, id, this.layoutDragSource, intent);
        });
        element.addEventListener('drop', (event) => {
          if (!this.isCustomLayout()) return;
          const source = this.layoutDragSource || event.dataTransfer?.getData('text/plain');
          if (U.layoutRootDropIntent(this.workspace.getBoundingClientRect(), event.clientX, event.clientY)) return;
          event.preventDefault();
          if (!source || source === id) return;
          const intent = this.layoutDropIntent?.targetId === id
            ? this.layoutDropIntent
            : { ...U.layoutDropIntent(element.getBoundingClientRect(), event.clientX, event.clientY), targetId: id, sourceId: source };
          this.applyLayoutDrop(source, id, intent);
          this.clearLayoutDropPreview();
        });
      });
      this.bindWorkspaceDockTarget();
    },

    bindWorkspaceDockTarget() {
      this.workspace.addEventListener('dragover', (event) => {
        if (!this.isCustomLayout() || !this.layoutDragSource || event.defaultPrevented) return;
        const intent = U.layoutRootDropIntent(this.workspace.getBoundingClientRect(), event.clientX, event.clientY);
        if (!intent) {
          this.clearLayoutDropPreview();
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        this.layoutDropIntent = { ...intent, sourceId: this.layoutDragSource };
        this.showLayoutDropPreview(this.workspace, null, this.layoutDragSource, intent);
      });
      this.workspace.addEventListener('drop', (event) => {
        if (!this.isCustomLayout() || event.defaultPrevented) return;
        const source = this.layoutDragSource || event.dataTransfer?.getData('text/plain');
        if (!source) return;
        const storedIntent = this.layoutDropIntent?.mode === 'root-insert'
          && this.layoutDropIntent.sourceId === source
          ? this.layoutDropIntent : null;
        const intent = storedIntent
          || U.layoutRootDropIntent(this.workspace.getBoundingClientRect(), event.clientX, event.clientY);
        if (!intent) return;
        event.preventDefault();
        this.applyLayoutDrop(source, null, intent);
        this.clearLayoutDropPreview();
      });
    },

    applyLayoutDrop(sourceId, targetId, intent) {
      const tree = U.isCompleteLayoutTree(this.settings.layoutTree)
        ? this.settings.layoutTree
        : U.cloneLayoutTree(U.DEFAULT_RIGHT_LAYOUT_TREE);
      const nextTree = intent.mode === 'root-insert'
        ? U.insertLayoutModuleAtRootEdge(tree, sourceId, intent.direction)
        : intent.mode === 'insert'
          ? U.insertLayoutModuleAtEdge(tree, sourceId, targetId, intent.direction)
          : U.swapLayoutTreeModules(tree, sourceId, targetId);
      if (!U.isCompleteLayoutTree(nextTree)) return;
      this.recordLayoutUndo(
        intent.mode === 'root-insert'
          ? '停靠到窗口边缘'
          : intent.mode === 'insert' ? '插入布局模块' : '交换布局模块',
        this.getLayoutHistorySnapshot(),
      );
      this.settings.layoutTree = nextTree;
      U.saveSettings(this.settings);
      this.applyLayout();
      if (intent.mode === 'root-insert') {
        this.setStatus(`已将「${U.MODULE_LABELS[sourceId]}」停靠到窗口${U.directionLabel(intent.direction)}`);
      } else if (intent.mode === 'insert') {
        this.setStatus(`已将「${U.MODULE_LABELS[sourceId]}」插入到「${U.MODULE_LABELS[targetId]}」${U.directionLabel(intent.direction)}`);
      } else {
        this.setStatus(`已交换「${U.MODULE_LABELS[sourceId]}」与「${U.MODULE_LABELS[targetId]}」`);
      }
    },

    showLayoutDropPreview(element, id, sourceId, intent) {
      if (!this.layoutPreview || !element) return;
      const workspaceRect = this.workspace.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const previewRect = U.layoutDropPreviewRect(rect, intent);
      this.layoutPreview.style.left = `${previewRect.left - workspaceRect.left}px`;
      this.layoutPreview.style.top = `${previewRect.top - workspaceRect.top}px`;
      this.layoutPreview.style.width = `${previewRect.width}px`;
      this.layoutPreview.style.height = `${previewRect.height}px`;
      this.layoutPreview.classList.toggle(
        'layout-insert-preview',
        intent.mode === 'insert' || intent.mode === 'root-insert',
      );
      this.layoutPreview.classList.toggle('layout-root-insert-preview', intent.mode === 'root-insert');
      this.layoutPreview.textContent = intent.mode === 'root-insert'
        ? `窗口${U.directionLabel(intent.direction)}：${U.MODULE_LABELS[sourceId]}`
        : intent.mode === 'insert'
          ? `新位置：${U.MODULE_LABELS[sourceId]} ${U.directionLabel(intent.direction)}`
          : `新位置：与${U.MODULE_LABELS[id]}对换`;
      this.layoutPreview.classList.add('show');
      this.workspace.querySelectorAll('.layout-drop-target').forEach((target) => {
        target.classList.remove('layout-drop-target');
      });
      if (intent.mode !== 'root-insert') element.classList.add('layout-drop-target');
    },

    clearLayoutDropPreview() {
      this.layoutPreview?.classList.remove('show');
      this.layoutPreview?.classList.remove('layout-insert-preview');
      this.layoutPreview?.classList.remove('layout-root-insert-preview');
      this.layoutDropIntent = null;
      this.workspace?.querySelectorAll('.layout-drop-target').forEach((target) => {
        target.classList.remove('layout-drop-target');
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
