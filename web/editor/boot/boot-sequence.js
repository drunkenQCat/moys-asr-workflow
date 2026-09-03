// 启动序列与新手引导桥：调试埋点、标点清理、服务端保存与工程设置、波形初始化、工作区库、首次渲染。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。
MaweBoot.maweDebug('boot:begin', {
  server: Boolean(MaweBoot.SERVER_CONFIG),
  segments: Array.isArray(MaweBoot.DATA.segments) ? MaweBoot.DATA.segments.length : null,
  media: MaweBoot.DATA.media || '',
  recentProjects: MaweBoot.SERVER_CONFIG?.recentProjects?.length || 0,
});
MaweTextCleanup.cleanPunctuation();
MaweServerSave.configureServerSaveControls();
MaweServerSave.configureServerAutoSave();
MaweServerSave.configureRecentProjects();
MaweServerSave.configureServerProjectSettings();
MaweWaveformInit.initWaveformEditor();
MaweWorkspaces.configureServerWorkspaceLibrary();
MaweWorkspaces.configureWorkspaceTransfer();
MaweDom.totalCountEl.textContent = MaweBoot.DATA.segments.length;
// 新手引导通过这个窄桥接访问编辑器核心状态；引导本身在 editor-onboarding.js 中按需初始化。
window.MAWE_EDITOR_BRIDGE = Object.freeze({
  get data() { return MaweBoot.DATA; },
  get selectedIdxs() { return MaweSelection.selectedIdxs; },
  get currentCuePanelIdx() { return MaweCuePanelState.currentCuePanelIdx; },
  get container() { return MaweCoreState.container; },
  get projectMediaModal() { return MaweDom.projectMediaModal; },
  selectOnly: MaweSelection.selectOnly,
  performUndo: MaweHistory.performUndo,
  flashHint: MaweHint.flashHint,
  scrollCueToCenter: MaweCueListAnchor.scrollCueToCenter,
  setEditorSettingsPanelOpen: MaweSettingsPanels.setEditorSettingsPanelOpen,
  modKeyLabel: MaweDisplaySettings.modKeyLabel,
  splitKeyLabel: MaweDisplaySettings.splitKeyLabel,
  openHelp: () => MaweHelpPanel.helpFloatingPanel.open(),
  openHelpAtTab: MaweHelpPanel.openHelpAtTab,
  closeHelp: () => MaweHelpPanel.helpFloatingPanel.close(),
});
window.MAWE?.register('editor-bridge', () => window.MAWE_EDITOR_BRIDGE);
MaweCuePanel.renderAll({ waveform: 'full' });
MaweBoot.maweDebug('boot:complete', {
  renderedSegments: MaweCoreState.container?.querySelectorAll?.('.cue-row')?.length || 0,
  recentProjectsVisible: MaweDom.recentProjectsEl ? !MaweDom.recentProjectsEl.hidden : false,
  mediaName: MaweProjectSave.mediaNameEl?.textContent || '',
  placeholderVisible: MaweDom.playerEmpty ? !MaweDom.playerEmpty.hidden : null,
});
MaweGapRemoveUi.updateGapRemoveUi();
if (MaweProjectLoad.repairedTimingCount > 0) {
  MaweHint.flashHint(`已自动修复 ${MaweProjectLoad.repairedTimingCount} 处异常时间码（保底 100ms）`, 'warning');
} else if (MaweProjectLoad.repairedGroupReferenceCount > 0) {
  MaweHint.flashHint(`已自动修复 ${MaweProjectLoad.repairedGroupReferenceCount} 处分组引用`, 'warning');
}
void MaweServerConnection.loadServerStartup();
MaweServerConnection.startServerConnectionMonitor();
if (MaweBoot.SERVER_CONFIG?.startupStatus !== 'loading') void MaweWaveformInit.loadDeferredReapeaks();
