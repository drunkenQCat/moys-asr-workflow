// 设置浮层：各分区折叠开关、点击外部与 Esc 关闭、resize/scroll 时重新定位。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。
MaweDom.editorSettingsToggle?.addEventListener('click', () => MaweSettingsPanels.setEditorSettingsPanelOpen(MaweDom.editorSettingsPanel?.hidden));
MaweDom.mergeJoinSettingsToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  MaweSettingsPanels.setMergeJoinSettingsPanelOpen(MaweDom.mergeJoinSettingsPanel?.hidden);
});
MaweDom.splitTrimSettingsToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  MaweSettingsPanels.setSplitTrimSettingsPanelOpen(MaweDom.splitTrimSettingsPanel?.hidden);
});
MaweDom.subtitlePreviewSettingsToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  MaweSettingsPanels.setSubtitlePreviewSettingsPanelOpen(MaweDom.subtitlePreviewSettingsPanel?.hidden);
});
MaweDom.cueListSettingsToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  MaweSettingsPanels.setCueListSettingsPanelOpen(MaweDom.cueListSettingsPanel?.hidden);
});
MaweDom.waveformSettingsToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  MaweSettingsPanels.setWaveformSettingsPanelOpen(MaweDom.waveformSettingsPanel?.hidden);
});
MaweDom.cueEditorSettingsToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  MaweSettingsPanels.setCueEditorSettingsPanelOpen(MaweDom.cueEditorSettingsPanel?.hidden);
});
document.addEventListener('pointerdown', (event) => {
  if (MaweSelection.temporaryVisibleSplitCueKeys.size) {
    const targetCue = event.target instanceof Element ? event.target.closest('.cue') : null;
    if (!MaweCueElements.cueElementHasTemporarySplitVisibility(targetCue)) {
      MaweCueElements.clearTemporaryVisibleSplitCues();
      MaweSearch.applySearch(MaweDom.searchEl.value);
    }
  }
  if (!MaweDom.subtitlePreviewSettingsPanel?.hidden && !MaweDom.subtitlePreviewSettings?.contains(event.target)) {
    MaweSettingsPanels.setSubtitlePreviewSettingsPanelOpen(false);
  }
  if (!MaweDom.cueListSettingsPanel?.hidden && !MaweDom.cueListSettings?.contains(event.target)) {
    MaweSettingsPanels.setCueListSettingsPanelOpen(false);
  }
  if (!MaweDom.waveformSettingsPanel?.hidden && !MaweDom.waveformSettings?.contains(event.target)) {
    MaweSettingsPanels.setWaveformSettingsPanelOpen(false);
  }
  if (!MaweDom.cueEditorSettingsPanel?.hidden && !MaweDom.cueEditorSettings?.contains(event.target)) {
    MaweSettingsPanels.setCueEditorSettingsPanelOpen(false);
  }
  if (!MaweDom.mergeJoinSettingsPanel?.hidden && !MaweDom.mergeJoinSettings?.contains(event.target)) {
    MaweSettingsPanels.setMergeJoinSettingsPanelOpen(false);
  }
  if (!MaweDom.splitTrimSettingsPanel?.hidden && !MaweDom.splitTrimSettings?.contains(event.target)) {
    MaweSettingsPanels.setSplitTrimSettingsPanelOpen(false);
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!MaweDom.subtitlePreviewSettingsPanel?.hidden) {
    MaweSettingsPanels.setSubtitlePreviewSettingsPanelOpen(false);
    MaweDom.subtitlePreviewSettingsToggle?.focus();
  }
  if (!MaweDom.cueListSettingsPanel?.hidden) {
    MaweSettingsPanels.setCueListSettingsPanelOpen(false);
    MaweDom.cueListSettingsToggle?.focus();
  }
  if (!MaweDom.waveformSettingsPanel?.hidden) {
    MaweSettingsPanels.setWaveformSettingsPanelOpen(false);
    MaweDom.waveformSettingsToggle?.focus();
  }
  if (!MaweDom.cueEditorSettingsPanel?.hidden) {
    MaweSettingsPanels.setCueEditorSettingsPanelOpen(false);
    MaweDom.cueEditorSettingsToggle?.focus();
  }
  if (!MaweDom.mergeJoinSettingsPanel?.hidden) {
    MaweSettingsPanels.setMergeJoinSettingsPanelOpen(false);
    MaweDom.mergeJoinSettingsToggle?.focus();
  }
  if (!MaweDom.splitTrimSettingsPanel?.hidden) {
    MaweSettingsPanels.setSplitTrimSettingsPanelOpen(false);
    MaweDom.splitTrimSettingsToggle?.focus();
  }
});
window.addEventListener('resize', MaweSettingsPanels.positionMergeJoinSettingsPanel);
window.addEventListener('scroll', MaweSettingsPanels.positionMergeJoinSettingsPanel, true);
window.addEventListener('resize', MaweSettingsPanels.positionSplitTrimSettingsPanel);
window.addEventListener('scroll', MaweSettingsPanels.positionSplitTrimSettingsPanel, true);
window.addEventListener('resize', MaweSettingsPanels.positionSubtitlePreviewSettingsPanel);
window.addEventListener('scroll', MaweSettingsPanels.positionSubtitlePreviewSettingsPanel, true);
window.addEventListener('resize', MaweSettingsPanels.positionCueListSettingsPanel);
window.addEventListener('scroll', MaweSettingsPanels.positionCueListSettingsPanel, true);
window.addEventListener('resize', MaweSettingsPanels.positionWaveformSettingsPanel);
window.addEventListener('scroll', MaweSettingsPanels.positionWaveformSettingsPanel, true);
window.addEventListener('resize', MaweSettingsPanels.positionCueEditorSettingsPanel);
window.addEventListener('scroll', MaweSettingsPanels.positionCueEditorSettingsPanel, true);
MaweDom.subtitlePreviewSettings?.closest('.player-toolbar')?.addEventListener(
  'scroll', MaweSettingsPanels.positionSubtitlePreviewSettingsPanel,
);
MaweDom.cueListSettings?.closest('.cue-list-toolbar')?.addEventListener(
  'scroll', MaweSettingsPanels.positionCueListSettingsPanel,
);
MaweDom.waveformSettings?.closest('.waveform-toolbar')?.addEventListener(
  'scroll', MaweSettingsPanels.positionWaveformSettingsPanel,
);
MaweDom.cueEditorSettings?.closest('.cue-editor-toolbar')?.addEventListener(
  'scroll', MaweSettingsPanels.positionCueEditorSettingsPanel,
);
