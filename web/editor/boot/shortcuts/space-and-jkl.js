// 空格与 J/K/L：按钮焦点释放、空格拦截与播放切换、窗口失焦时复位被拦截的空格状态。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

// 鼠标点击按钮后不保留按钮焦点，否则下一次空格会触发按钮自身的 click。
// 键盘触发的 click detail 为 0，保留焦点以维持原生键盘可访问性。
document.addEventListener('click', (event) => {
  if (event.detail === 0) return;
  const target = event.target instanceof Element ? event.target : null;
  target?.closest('button')?.blur();
}, true);
document.addEventListener('keydown', (e) => {
  if (!MaweKeyboardTargets.isSpaceKey(e)) return;
  if (MaweInlineEdit.editingState || MaweKeyboardTargets.isTextEditingTarget(e)) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  // 拆分弹窗内空格用于确认/取消断点，交给弹窗自己的键盘处理。
  if (MaweDom.multiSubtitleSplitModal?.classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (!MaweKeyboardTargets.isPlaybackKeyboardTarget(e) && MaweKeyboardTargets.isNativeKeyboardControl(e)) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  MaweShortcuts.interceptedSpace = true;
  if (e.repeat) return;
  MaweMediaPlayback.togglePlayback();
}, true);

document.addEventListener('keyup', (e) => {
  if (!MaweKeyboardTargets.isSpaceKey(e) || !MaweShortcuts.interceptedSpace) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  MaweShortcuts.interceptedSpace = false;
}, true);
window.addEventListener('blur', () => { MaweShortcuts.interceptedSpace = false; });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'j' && e.key !== 'J' && e.key !== 'k' && e.key !== 'K' && e.key !== 'l' && e.key !== 'L') return;
  if (MaweInlineEdit.editingState) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
  // Ctrl/Alt/Meta 别误触发（让浏览器自己处理 Ctrl+L 等）
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  e.preventDefault();
  const k = e.key.toLowerCase();
  if (MaweJklPlayback.isDirectionMode()) {
    if (k === 'k') {
      const wasPlaying = MaweJklPlayback.isReversePlaying() || !MaweCoreState.player.paused;
      if (!wasPlaying) {
        MaweJklPlayback.resetRate();
        MaweCoreState.player.playbackRate = 1;
        if (MaweJklPlayback.playForward()) MaweHint.flashHint('正放: 1×');
        return;
      }
      MaweJklPlayback.stop({ render: false });
      MaweJklPlayback.resetRate();
      MaweCoreState.player.playbackRate = 1;
      MaweCoreState.player.pause();
      MawePlaybackLoop.update();
      MaweCoreState.waveformEditor?.updatePlayback();
      MaweMediaPlayback.syncMediaControls();
      MaweHint.flashHint('已停止');
      return;
    }
    if (!MaweMediaPlayback.hasLoadedMedia()) {
      MaweHint.flashHint('请先加载媒体，然后才能预览', 'invalid');
      return;
    }
    const rate = MaweJklPlayback.setRate(MaweJklPlayback.nextDirectionRate(MaweJklPlayback.getRate(), k === 'j' ? -1 : 1));
    if (rate < 0) MaweJklPlayback.startReverse();
    else MaweJklPlayback.playForward();
    MaweHint.flashHint(`${rate < 0 ? '倒放' : '正放'}: ${MaweShortcuts.fmtRate(rate)}`);
    return;
  }
  let r = MaweCoreState.player.playbackRate;
  if (k === 'k') r = 1;
  else if (k === 'j') r = Math.max(MaweShortcuts.PLAYBACK_RATE_MIN, r * 0.5);
  else if (k === 'l') r = Math.min(MaweShortcuts.PLAYBACK_RATE_MAX, r * 2);
  MaweCoreState.player.playbackRate = r;
  MaweMediaPlayback.syncMediaControls();
  MaweHint.flashHint(`倍速: ${MaweShortcuts.fmtRate(r)}`);
});
