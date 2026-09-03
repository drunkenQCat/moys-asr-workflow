// 媒体控制条：播放/暂停、前后跳转、进度条、音量、倍速、全屏。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

MaweDom.mediaPlayToggle?.addEventListener('click', MaweMediaPlayback.togglePlayback);
MaweDom.mediaStepBack?.addEventListener('click', () => MaweMediaPlayback.seekMediaBy(-MaweSettings.EDITOR_SETTINGS.mediaSeekStepMs / 1000));
MaweDom.mediaStepForward?.addEventListener('click', () => MaweMediaPlayback.seekMediaBy(MaweSettings.EDITOR_SETTINGS.mediaSeekStepMs / 1000));
MaweDom.mediaSeek?.addEventListener('input', () => {
  if (!MaweMediaPlayback.hasLoadedMedia()) return;
  MaweCoreState.player.currentTime = Number(MaweDom.mediaSeek.value) || 0;
  MawePlaybackLoop.update();
  MaweMediaPlayback.syncMediaControls();
});
MaweDom.mediaVolume?.addEventListener('input', () => {
  MaweCoreState.player.volume = Math.min(1, Math.max(0, Number(MaweDom.mediaVolume.value) || 0));
  MaweMediaPlayback.syncMediaControls();
});
MaweDom.mediaPlaybackRate?.addEventListener('change', () => {
  const selectedRate = Number(MaweDom.mediaPlaybackRate.value) || 1;
  const rate = Math.max(0.0625, Math.abs(selectedRate));
  MaweCoreState.player.playbackRate = rate;
  if (MaweJklPlayback.isDirectionMode()) {
    const direction = selectedRate < 0 || MaweJklPlayback.getRate() < 0 ? -1 : 1;
    MaweJklPlayback.setRate(direction * rate);
  }
  MaweMediaPlayback.syncMediaControls();
});
MaweDom.mediaFullscreen?.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await MaweDom.playerWrap?.requestFullscreen?.();
  } catch (error) {
    MaweHint.flashHint(`无法切换全屏：${error.message || error}`, 'warning');
  }
  MaweMediaPlayback.syncMediaControls();
});
document.addEventListener('fullscreenchange', MaweMediaPlayback.syncMediaControls);
