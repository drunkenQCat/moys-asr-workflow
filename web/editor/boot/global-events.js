// document/window 级事件：右键菜单外部关闭、波形缩放边界提示、页面可见与网络恢复、拖放加载媒体。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。
// 使用捕获阶段的 pointerdown：波形空白区自己的 pointerdown 可能阻止后续
// click 事件，不能再依赖 mouseup 后才触发的 document.click 来关闭菜单。
document.addEventListener('pointerdown', MaweContextMenus.closeContextMenuOnOutsidePointerDown, true);
// 保留键盘触发 click 的关闭路径；真实鼠标/触控操作已经在 pointerdown 阶段关闭。
document.addEventListener('click', (e) => {
  if (e.detail === 0) MaweContextMenus.closeContextMenuOnOutsidePointerDown(e);
});
document.addEventListener('contextmenu', (e) => {
  // 非 cue 上的右键关闭菜单
  if (!e.target.closest('.cue') && !e.target.closest('.waveform-cue-block')) {
    MaweDom.ctxmenu.classList.remove('show');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && MaweDom.ctxmenu.classList.contains('show')) {
    MaweDom.ctxmenu.classList.remove('show');
  }
});
document.addEventListener('asr:waveform-scale-limit', (event) => {
  const { atMin, atMax } = event.detail || {};
  const msg = atMin ? '已经到达最小振幅' : atMax ? '已经达到最大振幅' : '';
  if (!msg) return;
  const now = Date.now();
  if (msg === MaweHint.lastScaleLimitMsg && now - MaweHint.lastScaleLimitAt < 1200) return;
  MaweHint.lastScaleLimitMsg = msg;
  MaweHint.lastScaleLimitAt = now;
  MaweHint.flashHint(msg);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) MaweServerConnection.scheduleServerConnectionCheck(0);
});
window.addEventListener('online', () => MaweServerConnection.scheduleServerConnectionCheck(0));  // dragenter/leave 计数，避免子元素进出导致遮罩闪烁
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  MaweDragDrop.dragCounter++;
  if (MaweDragDrop.dragCounter === 1) MaweDragDrop.dragOverlay.classList.add('show');
});
window.addEventListener('dragover', (e) => {
  if (e.dataTransfer && e.dataTransfer.types.includes('Files')) e.preventDefault();
});
window.addEventListener('dragleave', (e) => {
  if (!e.dataTransfer) return;
  MaweDragDrop.dragCounter--;
  if (MaweDragDrop.dragCounter <= 0) { MaweDragDrop.dragCounter = 0; MaweDragDrop.dragOverlay.classList.remove('show'); }
});
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  MaweDragDrop.dragCounter = 0;
  MaweDragDrop.dragOverlay.classList.remove('show');
  void MaweDragDrop.handleDroppedFiles(Array.from(e.dataTransfer.files));
});
