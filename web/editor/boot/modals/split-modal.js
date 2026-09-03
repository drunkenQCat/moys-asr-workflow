// 拆分弹窗：主/副 lane 聚焦同步、Esc 关闭，以及 Tab/WASD/方向键/空格组成的键盘流。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。
MaweDom.multiSubtitleSplitCancel?.addEventListener('click', MaweSplitCore.closeLinkedSplitModal);
MaweDom.multiSubtitleSplitConfirm?.addEventListener('click', MaweSplitCore.confirmLinkedSplit);
MaweDom.multiSubtitleSplitModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.multiSubtitleSplitModal) MaweSplitCore.closeLinkedSplitModal();
});
// 鼠标点击 lane 会自然聚焦；这里同步 keyboardLane，供失焦后的 WASD 回退使用。
MaweDom.multiSubtitleSplitMainText?.addEventListener('focus', () => {
  if (MaweSplitCore.pendingLinkedSplit) MaweSplitCore.pendingLinkedSplit.keyboardLane = 'main';
});
MaweDom.multiSubtitleSplitText?.addEventListener('focus', () => {
  if (MaweSplitCore.pendingLinkedSplit) MaweSplitCore.pendingLinkedSplit.keyboardLane = 'extension';
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweDom.multiSubtitleImportModal?.classList.contains('show')) return;
  event.preventDefault();
  event.stopPropagation();
  MaweMultiImport.closeMultiSubtitleImportModal();
}, true);
// 拆分弹窗的键盘流：Tab 切换主/副 lane，WASD 或方向键移动 ✂️，
// Space 确认/取消确认断点；捕获阶段拦截，避免触发全局的选字幕与播放快捷键。
document.addEventListener('keydown', (event) => {
  if (!MaweDom.multiSubtitleSplitModal?.classList.contains('show')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    MaweSplitCore.closeLinkedSplitModal();
    return;
  }
  const state = MaweSplitCore.pendingLinkedSplit;
  if (!state) return;
  // 焦点在弹窗内原生控件（复选框/按钮）上时保留其自身键盘行为。
  const target = event.target instanceof Element ? event.target : null;
  const onNativeControl = Boolean(
    target?.closest('button, input, select, textarea, a, [contenteditable]'),
  );
  if (event.key === 'Tab' && !onNativeControl) {
    const current = MaweSplitCore.splitKeyboardActiveLane(state);
    const nextLane = MaweSplitCore.splitKeyboardSwitchLane(state, current);
    if (!nextLane || nextLane === current) return;
    event.preventDefault();
    event.stopPropagation();
    MaweSplitCore.focusSplitLane(state, nextLane);
    return;
  }
  if (!event.repeat
      && (event.key === 'Enter' || event.key === 'b' || event.key === 'B')
      && !(event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)) {
    event.preventDefault();
    event.stopPropagation();
    MaweSplitCore.confirmLinkedSplit();
    return;
  }
  if (MaweKeyboardTargets.isSpaceKey(event)) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (onNativeControl || event.repeat) return;
    const lane = MaweSplitCore.splitKeyboardActiveLane(state);
    if (!lane || !MaweSplitCore.splitLaneVisible(lane)) return;
    event.preventDefault();
    event.stopPropagation();
    MaweSplitCore.toggleSplitLaneKeyboardLock(state, lane);
    return;
  }
  const key = event.key.toLowerCase();
  const horizontal = key === 'a' || event.key === 'ArrowLeft' ? -1
    : key === 'd' || event.key === 'ArrowRight' ? 1 : 0;
  const vertical = key === 'w' || event.key === 'ArrowUp' ? -1
    : key === 's' || event.key === 'ArrowDown' ? 1 : 0;
  if (!horizontal && !vertical) return;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  const lane = MaweSplitCore.splitKeyboardActiveLane(state);
  if (!lane) return;
  if (!MaweSplitCore.splitLaneKeyboardInteractive(state, lane)) {
    // ⌚️ 时间码锚定的主轨静默忽略；Space/点击锁定的 lane 闪烁边缘并提示先解锁。
    if (!event.repeat && MaweSplitCore.splitLaneLocked(state, lane)) MaweSplitCore.flashSplitLaneBlockedFeedback(lane);
    return;
  }
  const nextOffset = vertical
    ? MaweSplitCore.verticalSplitLaneOffset(state, lane, vertical)
    : MaweSplitCore.stepSplitLaneOffset(state, lane, horizontal);
  if (!Number.isFinite(nextOffset)) return;
  event.preventDefault();
  event.stopPropagation();
  MaweSplitCore.updateLinkedSplitPreview(nextOffset, lane);
}, true);
