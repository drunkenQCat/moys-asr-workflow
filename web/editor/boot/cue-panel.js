// 右侧字幕详情面板：上一条/下一条、文本框输入与聚焦、起止时间、表情包槽位、拆分按钮。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

MaweDom.cuePanelPrev?.addEventListener('click', () => MaweCuePanel.navigateCuePanel(-1));
MaweDom.cuePanelNext?.addEventListener('click', () => MaweCuePanel.navigateCuePanel(1));
MaweDom.cuePanelText?.addEventListener('focus', MaweCuePanel.captureCuePanelTextEditSnapshot);
MaweDom.cuePanelText?.addEventListener('keydown', (event) => {
  // Esc：按当前字幕编辑区设置决定取消还是提交文本编辑。
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (MaweSettings.EDITOR_SETTINGS.cueEditorCancelOnEscape) MaweCuePanel.cancelCuePanelTextEdit();
    else MaweCuePanel.exitCuePanelEdit();
    return;
  }
  const action = MaweCueEvents.getConfiguredEnterAction(event);
  if (!action || action === 'newline') return;
  event.preventDefault();
  event.stopPropagation();
  if (action === 'split') MaweCuePanel.splitCuePanelAtCursor();
  else MaweCuePanel.exitCuePanelEdit();
});
MaweDom.cuePanelText?.addEventListener('input', () => {
  const target = MaweCuePanel.getCurrentCuePanelTarget();
  if (!target) return;
  MaweCuePanel.ensureCuePanelUndo(target.kind === 'extension' ? '编辑副字幕' : '编辑当前字幕');
  const seg = target.segment;
  seg.text = MaweDom.cuePanelText.value.replace(/\r\n?/g, '\n');
  seg._dirty = true;
  if (target.kind === 'extension') MaweMultiSubtitleCore.markMultiSubtitleDirty();
  MaweServerSave.scheduleAutoSaveFlush();
  const splitMode = target.kind === 'extension'
    ? MaweMultiSubtitleCore.getExtensionSubtitleSplitMode(target.track, seg)
    : MaweMultiSubtitleCore.getMainSubtitleSplitMode(seg);
  const metrics = window.AsrEditorUtils.cueMetrics(
    seg.text, seg.start, seg.end, splitMode,
  );
  MaweDom.cuePanelTotalLength.textContent = String(metrics.totalLength);
  MaweDom.cuePanelCharsPerSecond.textContent = metrics.charsPerSecond.toFixed(2);
  const textEl = MaweCuePanel.getCuePanelTextElement(target);
  if (textEl) {
    MaweCueElements.setTextHtml(textEl, seg.text, MaweDom.searchEl.value);
    MaweCueElements.applyCharCount(textEl.closest('.cue')?.querySelector('.charcount'), seg.text, splitMode);
  }
  if (target.kind === 'extension') MaweCoreState.waveformEditor?.refreshExtensionCueLabel(target.index, target.trackId);
  else MaweCoreState.waveformEditor?.refreshCueLabel(target.index);
  MawePlaybackLoop.refreshSubtitlePreview();
});
MaweDom.cuePanelText?.addEventListener('blur', () => {
  if (MaweCuePanelState.cuePanelCanceling) return;
  MaweCuePanel.commitCuePanelEdit();
});
MaweDom.cuePanelStart?.addEventListener('change', () => MaweCuePanel.commitCuePanelEdit());
MaweDom.cuePanelDuration?.addEventListener('change', () => MaweCuePanel.commitCuePanelEdit());
MaweDom.cuePanelAddSticker?.addEventListener('click', () => {
  const target = MaweCuePanel.getCurrentCuePanelTarget();
  if (target?.kind === 'main') MaweStickerPicker.openStickerPicker([target.index], false);
});
MaweDom.cuePanelSticker?.addEventListener('click', () => {
  const target = MaweCuePanel.getCurrentCuePanelTarget();
  if (target?.kind === 'main') MaweStickerPicker.openStickerPicker([target.index], false);
});
MaweDom.cuePanelSticker?.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const target = MaweCuePanel.getCurrentCuePanelTarget();
  if (target?.kind !== 'main') return;
  MaweStickerPicker.removeStickerCascade(target.index);
  MaweCuePanel.renderAll();
  MaweHint.flashHint('已删除当前表情包', 'success');
});
MaweDom.cuePanelSplit?.addEventListener('click', MaweCuePanel.splitCuePanelAtCursor);
