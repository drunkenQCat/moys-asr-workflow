// 键盘与指针的前置处理：等待绑定时点击空白取消、导航区域归属、指针边界快捷键、内联编辑的 Enter/Esc 守卫、Esc 清除选择。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

// 等待绑定时，点击主/副字幕本身交给各自的选择事件处理；其它空白或
// 非字幕区域视为取消，避免用户进入等待状态后无从退出。
document.addEventListener('pointerdown', (event) => {
  if (!MaweSelection.pendingExtensionBinding) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('.cue, .waveform-cue-block, #ctxmenu')) return;
  MaweSelection.cancelPendingExtensionBinding();
}, true);

document.addEventListener('pointerdown', (e) => {
  if (e.target instanceof Element && e.target.closest('.cue')) MaweNavPreview.lastEditRegion = 'cue-list';
  else if (e.target instanceof Element && e.target.closest('#waveform-pane')) MaweNavPreview.lastEditRegion = 'waveform';
}, true);
document.addEventListener('pointerdown', MaweNavPreview.updateNavigationOwner, true);
document.addEventListener('focusin', MaweNavPreview.updateNavigationOwner, true);
document.addEventListener('pointermove', (e) => {
  MaweNavPreview.lastPointerPos = { x: e.clientX, y: e.clientY };
}, true);

document.addEventListener('keydown', (event) => MaweNavPreview.handlePointerBoundaryShortcut(event, 'start'));
document.addEventListener('keydown', (event) => MaweNavPreview.handlePointerBoundaryShortcut(event, 'end'));

document.addEventListener('keydown', (e) => {
  if (e.target === MaweDom.cuePanelText) return;
  if (!MaweInlineEdit.editingState) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); MaweInlineEdit.finishEdit(false); return; }
  const action = MaweCueEvents.getConfiguredEnterAction(e);
  if (!action || action === 'newline') return;
  e.preventDefault();
  // 拆分会在当前 keydown 事件内打开弹窗；阻止同一 document 上后注册的
  // 弹窗快捷键监听器继续处理这次 Enter，否则它会立刻把新弹窗再次提交。
  e.stopImmediatePropagation();
  if (action === 'split') MaweSplitCore.splitAtCursor();
  else MaweInlineEdit.finishEdit(true);
}, true);

document.addEventListener('keydown', (event) => {
  if (!MaweInlineEdit.extensionEditingState) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    MaweInlineEdit.finishExtensionEdit(false);
    return;
  }
  const action = MaweCueEvents.getConfiguredEnterAction(event);
  if (!action || action === 'newline') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (action === 'save') {
    MaweInlineEdit.finishExtensionEdit(true);
    return;
  }
  const state = MaweInlineEdit.extensionEditingState;
  const offset = MaweInlineEdit.caretOffsetInText(state.textEl);
  const track = MaweMultiSubtitleCore.getExtensionTrack(state.trackId);
  if (!Number.isFinite(offset) || !track?.segments?.[state.index]) {
    MaweHint.flashHint('无法定位副字幕的文字光标', 'warning');
    return;
  }
  MaweInlineEdit.finishExtensionEdit(true);
  MaweSplitCore.openExtensionSplitModal(state.index, null, track, { extensionOffset: offset });
}, true);

// Esc：非字幕文本编辑状态下清除当前字幕选择；输入框和内联编辑继续保留原生/编辑行为。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (MaweDom.timedTextEditModal.classList.contains('show')) {
    e.preventDefault();
    e.stopPropagation();
    MaweTimedTextEdit.requestCloseTimedTextEdit();
    return;
  }
  if (MaweSelection.pendingExtensionBinding) {
    e.preventDefault();
    e.stopPropagation();
    MaweSelection.cancelPendingExtensionBinding();
    return;
  }
  if (MaweInlineEdit.editingState || (MaweSelection.selectedIdxs.size === 0 && MaweSelection.selectedExtensionIdxs.size === 0)) return;
  const a = document.activeElement;
  if (a && (
    a.tagName === 'INPUT'
    || a.tagName === 'TEXTAREA'
    || a.tagName === 'SELECT'
    || a.isContentEditable
  )) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (MaweCoreState.waveformEditor?.hasCueDrag?.()) {
    // 拖动中的 Esc 不取消拖动，也不清空选区；拖动仍由 pointerup 正常完成。
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  MaweSelection.clearSelection();
});
