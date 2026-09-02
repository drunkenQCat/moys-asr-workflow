const DATA = __DATA_JSON__;
let FILENAME_BASE = __FILENAME_BASE_JSON__;
const STICKERS = __STICKERS_JSON__;
let STICKER_ROOT = __STICKER_ROOT_JSON__;  // 表情包根目录的绝对路径（无尾斜杠）
let STICKER_URL_PREFIX = __STICKER_URL_PREFIX_JSON__;
const SERVER_CONFIG = __SERVER_CONFIG_JSON__;
const NINJA_SFX_BASE_URL = __NINJA_SFX_BASE_URL_JSON__;

const MAWE_DEBUG_ENABLED = Boolean(
  SERVER_CONFIG?.debug || new URLSearchParams(window.location.search).has('mawe-debug'),
);
function maweDebug(stage, details = {}) {
  if (MAWE_DEBUG_ENABLED) console.debug(`[MAWE][${stage}]`, details);
}
function maweDomContractCheck() {
  const requiredIds = [
    'player', 'player-empty', 'cues-container', 'cues-empty', 'filter-over',
    'hide-disabled-toggle', 'waveform-scroll', 'waveform-content',
  ];
  const missing = requiredIds.filter((id) => !document.getElementById(id));
  if (missing.length) {
    console.error('[MAWE][boot] editor DOM contract is incomplete', { missing });
  }
  maweDebug('boot:dom-contract', { checked: requiredIds.length, missing });
  return missing;
}
window.addEventListener('error', (event) => {
  const details = {
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack || null,
  };
  window.MAWE_DEBUG_ERRORS = [...(window.MAWE_DEBUG_ERRORS || []), details];
  console.error('[MAWE][runtime] uncaught error', details);
});
window.addEventListener('unhandledrejection', (event) => {
  window.MAWE_DEBUG_ERRORS = [...(window.MAWE_DEBUG_ERRORS || []), {
    message: String(event.reason), stack: event.reason?.stack || null,
  }];
  console.error('[MAWE][runtime] unhandled rejection', event.reason);
});
if (!window.AsrEditorUtils) {
  console.error('[MAWE][boot] AsrEditorUtils is unavailable; editor scripts are incomplete or out of order');
}

const MULTI_SUBTITLE_UTILS = window.AsrEditorUtils;
const EDITOR_SETTINGS_UTILS = window.AsrEditorUtils;
const MULTI_SUBTITLE_TOLERANCE_MS = MULTI_SUBTITLE_UTILS.MULTI_SUBTITLE_TOLERANCE_MS || 300;
const MULTI_SUBTITLE_MERGE_OVERLAP_TOLERANCE_MS = 500;
const SUBTITLE_MIN_DURATION_MS = 100;
const PROJECT_SEGMENT_OVERLAP_AUTO_FIX_MAX_MS = 2;
const MULTI_SUBTITLE_IMPORT_PROMPT = '是否导入第二条字幕？（后续也可以将字幕或工程拖入编辑器加载）';
const MULTI_SUBTITLE_TOGGLE_TITLE = '当前工程如果有大于1条字幕，可以开启多重字幕模式，用于双语字幕编辑等。';
maweDomContractCheck();

function constrainBoundExtensionPanelEdit(extension, track, oldStart, oldEnd) {
  if (!extension || !track || !MaweMultiSubtitleCore.multiSubtitleVisible()) return false;
  const binding = MULTI_SUBTITLE_UTILS.bindingForSegment(
    MaweMultiSubtitleCore.getMultiSubtitleState(), extension.id, 'extension', track.id,
  );
  const main = binding ? MaweMultiSubtitleCore.mainSegmentById(binding.main_segment_ids?.[0]) : null;
  if (!main) return false;
  const desiredMainStart = main.start + (extension.start - oldStart);
  const desiredMainEnd = main.end + (extension.end - oldEnd);
  const constrained = MaweMultiSubtitleCore.constrainCueRangeToTrack(
    main,
    desiredMainStart,
    desiredMainEnd,
    DATA.segments,
  );
  const blocked = constrained.blocked
    || constrained.start !== desiredMainStart
    || constrained.end !== desiredMainEnd;
  const nextStart = oldStart + (constrained.start - main.start);
  const nextEnd = oldEnd + (constrained.end - main.end);
  extension.items = MaweCuePanel.remapPanelItems(extension.items, oldStart, oldEnd, nextStart, nextEnd);
  extension.start = nextStart;
  extension.end = nextEnd;
  main.start = constrained.start;
  main.end = constrained.end;
  main._dirty = true;
  extension._dirty = true;
  return blocked;
}

MaweMultiSubtitleCore.normalizeMultiSubtitleState();
// 把用户配置的拆分移除符号同步给共享工具层；设置面板修改时也会同步。
MULTI_SUBTITLE_UTILS.setSplitTrimSymbols(MaweSettings.EDITOR_SETTINGS.splitTrimSymbols);
if (!Array.isArray(window.ASR_EDITOR_PALETTE) || !window.ASR_EDITOR_PALETTE.length) {
  throw new Error('调色板未注入：缺少 window.ASR_EDITOR_PALETTE（检查 edit.py / serve.py 渲染管线）');
}
if (MaweHistory.undoBtn) MaweHistory.undoBtn.addEventListener('click', () => MaweHistory.performUndo());
if (MaweHistory.redoBtn) MaweHistory.redoBtn.addEventListener('click', () => MaweHistory.performRedo());
MaweHistory.updateUndoRedoButtons();

function updateEditorSettings(patch) {
  Object.assign(MaweSettings.EDITOR_SETTINGS, patch);
  MaweSettings.saveEditorSettings(MaweSettings.EDITOR_SETTINGS);
}

function refreshSplitKeyHelp() {
  const label = MaweDisplaySettings.splitKeyLabel();
  if (MaweDom.helpSplitKey) MaweDom.helpSplitKey.textContent = label;
  if (MaweDom.cuePanelSplitKey) MaweDom.cuePanelSplitKey.textContent = label;
  if (MaweDom.cueEditorSplitKey) MaweDom.cueEditorSplitKey.textContent = label;
  if (MaweDom.cueEditorConfirmKey) MaweDom.cueEditorConfirmKey.textContent = MaweDisplaySettings.confirmKeyLabel();
}

// 切换语言时 i18n 会重置动态文本节点，需重新套用当前拆分按键提示和目标轨道标签。
document.addEventListener('mawe:languagechange', () => {
  refreshSplitKeyHelp();
  MaweCuePanel.renderCurrentCuePanel();
  MaweMediaPlayback.refreshMediaSeekStepHelp();
  MaweMediaPlayback.refreshMediaSeekControlLabels();
});

MaweDom.splitKeySel.value = MaweSettings.EDITOR_SETTINGS.splitKey;
if (MaweDom.splitUseWordTimestampsToggle) MaweDom.splitUseWordTimestampsToggle.checked = MaweSettings.EDITOR_SETTINGS.splitUseWordTimestamps;
if (MaweDom.multiSubtitleSplitAutoSubmit) MaweDom.multiSubtitleSplitAutoSubmit.checked = MaweSettings.EDITOR_SETTINGS.splitAutoSubmit;
MaweDisplaySettings.applyPlatformKeyLabels();
refreshSplitKeyHelp();
if (MaweDom.mergeJoinTextContinuousInput) MaweDom.mergeJoinTextContinuousInput.value = MaweSettings.EDITOR_SETTINGS.mergeJoinTextContinuous;
if (MaweDom.mergeJoinTextWordInput) MaweDom.mergeJoinTextWordInput.value = MaweSettings.EDITOR_SETTINGS.mergeJoinTextWord;
MaweSplitMode.mergeJoinModeSwitch?.addEventListener('click', () => {
  MaweSplitMode.setMainSubtitleSplitModeBinding(MaweSplitMode.mergeJoinModeSwitch.dataset.targetMode);
});
MaweSegmentOps.syncAutoMergePanelInputs();
MaweDom.overlayToggle.checked = MaweSettings.EDITOR_SETTINGS.overlayEnabled;
if (MaweDom.extensionOverlayToggle) MaweDom.extensionOverlayToggle.checked = false;
MaweDom.exportStartAtZeroToggle.checked = MaweSettings.EDITOR_SETTINGS.exportStartAtZero;
if (MaweDom.selectGroupMembersToggle) MaweDom.selectGroupMembersToggle.checked = MaweSettings.EDITOR_SETTINGS.selectGroupMembers;
if (MaweDom.exportColorUnifiedToggle) MaweDom.exportColorUnifiedToggle.checked = MaweSettings.EDITOR_SETTINGS.exportColorUnified;
if (MaweDom.autoSaveProjectToggle) MaweDom.autoSaveProjectToggle.checked = MaweSettings.EDITOR_SETTINGS.autoSaveProject;
if (MaweDom.autoSaveIntervalInput) MaweDom.autoSaveIntervalInput.value = String(MaweSettings.EDITOR_SETTINGS.autoSaveIntervalSeconds);
if (MaweDom.stickerOverlayToggle) MaweDom.stickerOverlayToggle.checked = MaweSettings.EDITOR_SETTINGS.stickerOverlayEnabled;
if (MaweDom.clickBehaviorSelect) MaweDom.clickBehaviorSelect.value = MaweSettings.EDITOR_SETTINGS.clickBehavior;
if (MaweDom.clickTargetSelect) MaweDom.clickTargetSelect.value = MaweSettings.EDITOR_SETTINGS.clickTarget;
if (MaweDom.keyboardOperationReferenceSelect) {
  MaweDom.keyboardOperationReferenceSelect.value = MaweSettings.EDITOR_SETTINGS.keyboardOperationReference;
}
MaweJklPlayback.refreshModeUi();
if (MaweDom.hoverSeekPreviewToggle) MaweDom.hoverSeekPreviewToggle.checked = MaweSettings.EDITOR_SETTINGS.hoverSeekPreview;
if (MaweDom.mediaSeekStepInput) MaweDom.mediaSeekStepInput.value = String(MaweSettings.EDITOR_SETTINGS.mediaSeekStepMs);
if (MaweDom.cueMoveStepInput) MaweDom.cueMoveStepInput.value = String(MaweSettings.EDITOR_SETTINGS.cueMoveStepMs);
if (MaweDom.autoSnapAdjacentCuesToggle) {
  MaweDom.autoSnapAdjacentCuesToggle.checked = MaweSettings.EDITOR_SETTINGS.autoSnapAdjacentCues;
}
if (MaweDom.cueEditorCancelOnEscapeToggle) {
  MaweDom.cueEditorCancelOnEscapeToggle.checked = MaweSettings.EDITOR_SETTINGS.cueEditorCancelOnEscape;
}
MaweMediaPlayback.refreshMediaSeekStepHelp();
refreshMediaSeekInputStep();
MaweMediaPlayback.refreshMediaSeekControlLabels();
MaweNinja.applyNinjaSettings();
const waveformShapeSourceSelect = document.getElementById('waveform-shape-source');
if (waveformShapeSourceSelect) {
  waveformShapeSourceSelect.value = MaweSettings.EDITOR_SETTINGS.waveShapeSource;
  waveformShapeSourceSelect.addEventListener('change', () => {
    MaweSettings.EDITOR_SETTINGS.waveShapeSource = waveformShapeSourceSelect.value === 'reapeaks' ? 'reapeaks' : 'self';
    MaweSettings.saveEditorSettings(MaweSettings.EDITOR_SETTINGS);
    if (MaweCoreState.waveformEditor) MaweCoreState.waveformEditor.render();
  });
}
MaweDisplaySettings.applyCueListDisplaySettings({ preserveCueListScroll: false });
MaweDisplaySettings.applyCueEditorDisplaySettings();
MaweDom.multiSubtitleToggle?.addEventListener('change', () => {
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  const next = MaweDom.multiSubtitleToggle.checked;
  const promptImportSecondSrt = next && !MaweMultiSubtitleCore.getActiveExtensionTrack();
  multi.enabled = !next;
  MaweHistory.pushUndo(next ? '开启多重字幕' : '关闭多重字幕');
  multi.enabled = next;
  multi._dirty = true;
  // 开关会改变波形是否需要副字幕 lane，因此这里才执行完整波形重建。
  MaweCuePanel.renderAll({ waveform: 'full' });
  if (!promptImportSecondSrt) return;
  // 多重字幕模式已开启；提示只决定是否现在导入第二条字幕，
  // 用户取消导入也保持开启，之后仍可拖入 SRT 或重新走导入流程。
  if (!confirm(MULTI_SUBTITLE_IMPORT_PROMPT)) return;
  MaweMultiSubtitleCore.pendingSrtImportAsExtension = true;
  loadSrtFileInput.value = '';
  loadSrtFileInput.click();
});
MaweDom.multiSubtitleDisplayMode?.addEventListener('change', () => {
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  const next = MaweDom.multiSubtitleDisplayMode.value;
  const previous = multi.display_mode;
  multi.display_mode = previous;
  MaweHistory.pushUndo('切换多重字幕列表');
  multi.display_mode = MULTI_SUBTITLE_UTILS.MULTI_SUBTITLE_DISPLAY_MODES.has(next) ? next : 'both';
  multi._dirty = true;
  MaweCuePanel.renderAll({ waveform: 'none' });
});
MaweDom.multiSubtitleMainLanguageMode?.addEventListener('change', () => {
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  const next = MaweMultiSubtitleCore.isConfiguredSubtitleSplitMode(MaweDom.multiSubtitleMainLanguageMode.value)
    ? MaweDom.multiSubtitleMainLanguageMode.value : 'word';
  if (multi.main_split_mode === next
      && MaweSettings.EDITOR_SETTINGS.mainSplitModeOverride === next) return;
  MaweHistory.pushUndo('切换主字幕语言类型');
  multi.main_split_mode = next;
  // 与设置面板的类型提示共用同一个手动指定偏好，两个入口互为镜像。
  updateEditorSettings({ mainSplitModeOverride: next });
  MaweMultiSubtitleCore.markMultiSubtitleDirty();
  MaweCuePanel.renderAll({ waveform: 'none' });
});
MaweDom.multiSubtitleExtensionLanguageMode?.addEventListener('change', () => {
  const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
  if (!track) return;
  const next = MaweMultiSubtitleCore.isConfiguredSubtitleSplitMode(MaweDom.multiSubtitleExtensionLanguageMode.value)
    ? MaweDom.multiSubtitleExtensionLanguageMode.value : 'word';
  if (track.split_mode === next) return;
  MaweHistory.pushUndo('切换副字幕语言类型');
  track.split_mode = next;
  MaweMultiSubtitleCore.markMultiSubtitleDirty();
  MaweCuePanel.renderAll({ waveform: 'none' });
});
MaweDom.multiSubtitleExtensionRowHeight?.addEventListener('change', () => {
  const next = MaweSettings.normalizeMultiSubtitleRowHeight(MaweDom.multiSubtitleExtensionRowHeight.value);
  updateEditorSettings({ multiSubtitleRowHeight: next });
  if (MaweMultiSubtitleCore.multiSubtitleVisible()) MaweCoreState.waveformEditor?.setRowHeight(next);
});
MaweDom.multiSubtitleCrossTrackSnapToggle?.addEventListener('change', () => {
  updateEditorSettings({ crossTrackSnap: MaweDom.multiSubtitleCrossTrackSnapToggle.checked });
});
MaweDom.multiSubtitleSelectBoundPairToggle?.addEventListener('change', () => {
  updateEditorSettings({ selectBoundSubtitlePair: MaweDom.multiSubtitleSelectBoundPairToggle.checked });
});
MaweDom.multiSubtitleAutoSyncDurationToggle?.addEventListener('change', () => {
  updateEditorSettings({ multiSubtitleAutoSyncDuration: MaweDom.multiSubtitleAutoSyncDurationToggle.checked });
});
MaweDom.multiSubtitleShowTrackBadgesToggle?.addEventListener('change', () => {
  updateEditorSettings({ multiSubtitleShowTrackBadges: MaweDom.multiSubtitleShowTrackBadgesToggle.checked });
  MaweCoreState.waveformEditor?.render?.();
});
MaweDom.multiSubtitleSwapButton?.addEventListener('click', () => {
  swapMainAndExtensionSubtitles();
});
MaweDom.multiSubtitleAlignButton?.addEventListener('click', () => {
  MaweBindingAlign.alignSelectedExtensionSubtitleRanges();
});
MaweAppearance.applySubtitleAppearance();
MaweAppearance.applyExtensionSubtitleAppearance();
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
// 帮助浮窗：与拼合字幕共用 createFloatingPanel（拖动、位置持久化、Esc 关闭）
const helpFloatingPanel = MaweFloatingPanel.createFloatingPanel({
  panel: MaweDom.helpPanel,
  dragHandle: MaweDom.helpDragHandle,
  manageButton: MaweDom.helpToggle,
  anchorButton: MaweDom.helpToggle,
  positionKey: MaweDom.HELP_PANEL_POSITION_KEY,
  onOpen: restoreHelpPanelSize,
});
// 帮助是非模态浮窗；鼠标点击后的按钮焦点由统一的快捷键焦点处理释放。
MaweDom.helpCloseButton?.addEventListener('click', () => helpFloatingPanel.close());
MaweDom.helpOpenWaveformSettingsButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    MaweSettingsPanels.setWaveformSettingsPanelOpen(true);
    MaweDom.waveformSettingsToggle?.focus();
  });
});
MaweDom.helpOpenMediaSettingsButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    MaweSettingsPanels.setSubtitlePreviewSettingsPanelOpen(true);
    MaweDom.subtitlePreviewSettingsToggle?.focus();
  });
});
MaweDom.helpOpenGapRemovePanelButton?.addEventListener('click', (event) => {
  event.preventDefault();
  MaweGapRemoveUi.openGapRemovePanel();
  MaweDom.gapRemoveManageButton?.focus();
});
function visibleHelpTabButtons() {
  return MaweDom.helpTabButtons.filter((button) => !button.closest('[hidden]'));
}

function setHelpAdvancedTabsOpen(open, { focus = false } = {}) {
  if (!MaweDom.helpAdvancedTabs || !MaweDom.helpAdvancedToggle) return;
  const nextOpen = Boolean(open);
  if (!nextOpen && MaweDom.helpAdvancedTabButtons.some((button) => button.getAttribute('aria-selected') === 'true')) {
    selectHelpTab('basic');
  }
  MaweDom.helpAdvancedTabs.hidden = !nextOpen;
  MaweDom.helpAdvancedToggle.setAttribute('aria-expanded', String(nextOpen));
  MaweDom.helpAdvancedToggle.classList.toggle('is-active', nextOpen);
  if (focus) {
    const activeButton = MaweDom.helpAdvancedTabButtons.find((button) => button.getAttribute('aria-selected') === 'true');
    (activeButton || MaweDom.helpAdvancedTabButtons[0])?.focus();
  }
}

function selectHelpTab(tabName, { focus = false } = {}) {
  const activeButton = MaweDom.helpTabButtons.find((button) => button.dataset.helpTab === tabName);
  if (!activeButton) return;
  if (MaweDom.helpAdvancedTabButtons.includes(activeButton) && MaweDom.helpAdvancedTabs?.hidden) {
    setHelpAdvancedTabsOpen(true);
  }
  MaweDom.helpTabButtons.forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  MaweDom.helpTabPanels.forEach((panel) => {
    const active = panel.dataset.helpTabPanel === tabName;
    panel.hidden = !active;
    panel.setAttribute('aria-hidden', String(!active));
  });
  if (focus) activeButton.focus();
}

MaweDom.helpAdvancedToggle?.addEventListener('click', () => {
  setHelpAdvancedTabsOpen(MaweDom.helpAdvancedTabs?.hidden === true);
});

MaweDom.helpTabButtons.forEach((button) => {
  button.addEventListener('click', () => selectHelpTab(button.dataset.helpTab));
  button.addEventListener('keydown', (event) => {
    const availableButtons = visibleHelpTabButtons();
    const index = availableButtons.indexOf(button);
    if (index < 0) return;
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % availableButtons.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + availableButtons.length) % availableButtons.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = availableButtons.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selectHelpTab(availableButtons[nextIndex].dataset.helpTab, { focus: true });
  });
});
if (MaweDom.helpTabButtons.length && MaweDom.helpTabPanels.length) {
  selectHelpTab(MaweDom.helpTabButtons.find((button) => button.getAttribute('aria-selected') === 'true')?.dataset.helpTab || MaweDom.helpTabButtons[0].dataset.helpTab);
}
function openHelpAtTab(tabName) {
  if (!MaweDom.helpTabButtons.some((button) => button.dataset.helpTab === tabName)) return;
  selectHelpTab(tabName);
  helpFloatingPanel.open();
}
MaweDom.contextualHelpButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.closest('#gap-remove-panel')) MaweGapRemoveUi.closeGapRemovePanel();
    if (button.closest('#waveform-settings-panel')) MaweSettingsPanels.setWaveformSettingsPanelOpen(false);
    openHelpAtTab(button.dataset.helpTabTarget);
  });
});
// 浮窗尺寸：仅在用户拖过右下角缩放手柄后持久化；未缩放时保持 CSS 默认宽度/自动高度
function restoreHelpPanelSize() {
  if (!MaweDom.helpPanel) return;
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(MaweDom.HELP_PANEL_SIZE_KEY) || 'null');
  } catch (_) {
    saved = null;
  }
  if (!Number.isFinite(saved?.width) || !Number.isFinite(saved?.height)) return;
  MaweDom.helpPanel.style.width = `${Math.min(Math.max(320, saved.width), window.innerWidth - 12)}px`;
  MaweDom.helpPanel.style.height = `${Math.min(Math.max(240, saved.height), window.innerHeight - 12)}px`;
}
let helpPanelSizeSaveTimer = 0;
if (MaweDom.helpPanel) {
  new ResizeObserver(() => {
    if (!MaweDom.helpPanel.classList.contains('show')) return;
    if (!MaweDom.helpPanel.style.width && !MaweDom.helpPanel.style.height) return;
    clearTimeout(helpPanelSizeSaveTimer);
    helpPanelSizeSaveTimer = setTimeout(() => {
      const rect = MaweDom.helpPanel.getBoundingClientRect();
      try {
        localStorage.setItem(MaweDom.HELP_PANEL_SIZE_KEY, JSON.stringify({
          width: Math.round(rect.width), height: Math.round(rect.height),
        }));
      } catch (_) {
        // file:// 隐私模式下 localStorage 可能被拒；缩放本身仍可用。
      }
    }, 250);
  }).observe(MaweDom.helpPanel);
}

// 明暗主题：令牌全部定义在 CSS（:root 暗色 / [data-theme="light"] 亮色），
// 这里只负责写 <html data-theme>、持久化、同步按钮，以及通知波形重绘画布。
// 按钮显示的是「目标主题」（与相邻 🌐 语言按钮同一约定）：暗色时显示 🌖（点击转亮）。
// title 用中文源串，英文界面由 i18n 的属性 MutationObserver 自动翻译。
function refreshThemeToggle(theme) {
  if (!MaweDom.themeToggle) return;
  const toLight = theme !== 'light';
  MaweDom.themeToggle.textContent = toLight ? '🌖' : '🌘';
  const title = toLight ? '切换到亮色主题' : '切换到暗色主题';
  MaweDom.themeToggle.title = title;
  MaweDom.themeToggle.setAttribute('aria-label', title);
}
function applyTheme(theme, { rerenderWaveform = true } = {}) {
  const next = theme === 'light' ? 'light' : 'dark';
  if (next === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  refreshThemeToggle(next);
  // 画布颜色是 JS 读取的令牌快照，必须全量重绘才能跟随主题
  if (rerenderWaveform && MaweCoreState.waveformEditor) MaweCoreState.waveformEditor.render();
}
applyTheme(MaweSettings.EDITOR_SETTINGS.theme, { rerenderWaveform: false });
MaweDom.themeToggle?.addEventListener('click', () => {
  const next = MaweSettings.EDITOR_SETTINGS.theme === 'light' ? 'dark' : 'light';
  updateEditorSettings({ theme: next });
  applyTheme(next);
});
MaweDom.splitKeySel.addEventListener('change', () => {
  updateEditorSettings({ splitKey: MaweDom.splitKeySel.value });
  refreshSplitKeyHelp();
});
MaweDom.splitUseWordTimestampsToggle?.addEventListener('change', () => {
  updateEditorSettings({ splitUseWordTimestamps: MaweDom.splitUseWordTimestampsToggle.checked });
});
MaweDom.multiSubtitleSplitAutoSubmit?.addEventListener('change', () => {
  updateEditorSettings({ splitAutoSubmit: MaweDom.multiSubtitleSplitAutoSubmit.checked });
});
if (MaweDom.mergeJoinTextContinuousInput) MaweDom.mergeJoinTextContinuousInput.addEventListener('input', () => {
  updateEditorSettings({ mergeJoinTextContinuous: MaweDom.mergeJoinTextContinuousInput.value });
});
if (MaweDom.mergeJoinTextWordInput) MaweDom.mergeJoinTextWordInput.addEventListener('input', () => {
  updateEditorSettings({ mergeJoinTextWord: MaweDom.mergeJoinTextWordInput.value });
});
// 拆分移除符号：前 5 个高频符号用勾选 chip，其余走「其他符号」自由文本框
// （空格分隔）；两者合并后即时持久化并同步给共享工具层。
const splitTrimSymbolGrid = document.getElementById('split-trim-symbol-grid');
const splitTrimSymbolsReset = document.getElementById('split-trim-symbols-reset');
const splitTrimExtraInput = document.getElementById('split-trim-extra-symbols');
MaweSplitTrim.renderSplitTrimSymbolGrid();
MaweSplitTrim.refreshSplitTrimExtraInput();
splitTrimExtraInput?.addEventListener('change', () => {
  const extras = MULTI_SUBTITLE_UTILS.parseSplitTrimSymbolInput(splitTrimExtraInput.value);
  MaweSplitTrim.persistSplitTrimSymbols([...MaweSplitTrim.splitTrimPrimaryCheckedSet(), ...extras]);
  MaweSplitTrim.refreshSplitTrimExtraInput();
});
splitTrimSymbolsReset?.addEventListener('click', () => {
  const defaults = MULTI_SUBTITLE_UTILS.setSplitTrimSymbols(
    [...MULTI_SUBTITLE_UTILS.DEFAULT_SPLIT_TRIM_SYMBOLS],
  );
  updateEditorSettings({ splitTrimSymbols: defaults });
  MaweSplitTrim.renderSplitTrimSymbolGrid();
  MaweSplitTrim.refreshSplitTrimExtraInput();
});
// 拼合字幕工具窗：参数即时持久化；number 输入 change 时把显示值回钳到合法区间。
const autoMergeFloatingPanel = MaweFloatingPanel.createFloatingPanel({
  panel: MaweDom.autoMergePanel,
  dragHandle: MaweDom.autoMergeDragHandle,
  manageButton: MaweDom.autoMergeManageButton,
  anchorButton: MaweDom.autoMergeManageButton,
  positionKey: MaweDom.AUTO_MERGE_PANEL_POSITION_KEY,
  onOpen: MaweSegmentOps.syncAutoMergePanelInputs,
});
MaweDom.autoMergeCloseButton?.addEventListener('click', () => autoMergeFloatingPanel.close());
MaweDom.autoMergeRunButton?.addEventListener('click', MaweSegmentOps.autoMergeSegments);
MaweDom.autoMergeGapMsInput?.addEventListener('input', () => {
  updateEditorSettings({ autoMergeGapMs: MaweSettings.clampAutoMergeGapMs(MaweDom.autoMergeGapMsInput.value) });
});
MaweDom.autoMergeGapMsInput?.addEventListener('change', () => {
  MaweDom.autoMergeGapMsInput.value = String(MaweSettings.EDITOR_SETTINGS.autoMergeGapMs);
});
MaweDom.autoMergeSnapDirectionSelect?.addEventListener('change', () => {
  updateEditorSettings({
    autoMergeSnapDirection: MaweDom.autoMergeSnapDirectionSelect.value === 'forward' ? 'forward' : 'backward',
  });
});
MaweDom.autoMergeAbsorbShortToggle?.addEventListener('change', () => {
  updateEditorSettings({ autoMergeAbsorbShort: MaweDom.autoMergeAbsorbShortToggle.checked });
  MaweSegmentOps.syncAutoMergeAbsorbFields();
});
MaweDom.autoMergeShortCountInput?.addEventListener('input', () => {
  updateEditorSettings({ autoMergeShortCount: MaweSettings.clampAutoMergeShortCount(MaweDom.autoMergeShortCountInput.value) });
});
MaweDom.autoMergeShortCountInput?.addEventListener('change', () => {
  MaweDom.autoMergeShortCountInput.value = String(MaweSettings.EDITOR_SETTINGS.autoMergeShortCount);
});
MaweDom.autoMergeAbsorbDirectionSelect?.addEventListener('change', () => {
  updateEditorSettings({
    autoMergeAbsorbDirection: MaweDom.autoMergeAbsorbDirectionSelect.value === 'next' ? 'next' : 'previous',
  });
});
MaweDom.autoMergePanel?.querySelectorAll('input[type="number"]').forEach((input) => {
  input.addEventListener('wheel', (event) => {
    if (!event.deltaY) return;
    event.preventDefault();
    input.focus({ preventScroll: true });
    try {
      if (event.deltaY < 0) input.stepUp();
      else input.stepDown();
    } catch (_) {
      return;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: false });
});
const subtitleExtendFloatingPanel = MaweFloatingPanel.createFloatingPanel({
  panel: MaweDom.subtitleExtendPanel,
  dragHandle: MaweDom.subtitleExtendDragHandle,
  manageButton: MaweDom.subtitleExtendManageButton,
  anchorButton: MaweDom.subtitleExtendManageButton,
  positionKey: MaweDom.SUBTITLE_EXTEND_PANEL_POSITION_KEY,
});
MaweDom.subtitleExtendCloseButton?.addEventListener('click', () => subtitleExtendFloatingPanel.close());
MaweDom.subtitleExtendRunButton?.addEventListener('click', MaweSegmentOps.extendSubtitleRanges);
MaweDom.subtitleExtendPanel?.querySelectorAll('input[type="number"]').forEach((input) => {
  input.addEventListener('wheel', (event) => {
    if (!event.deltaY) return;
    event.preventDefault();
    input.focus({ preventScroll: true });
    try {
      if (event.deltaY < 0) input.stepUp();
      else input.stepDown();
    } catch (_) {
      return;
    }
  }, { passive: false });
});
MaweDisplaySettings.bindCueListDisplayToggle(MaweDom.cueListShowIndexToggle, 'cueListShowIndex');
MaweDisplaySettings.bindCueListDisplayToggle(MaweDom.cueListShowTimeToggle, 'cueListShowTime');
MaweDisplaySettings.bindCueListDisplayToggle(MaweDom.cueListShowStickerToggle, 'cueListShowSticker');
MaweDisplaySettings.bindCueListDisplayToggle(MaweDom.cueListShowCharcountToggle, 'cueListShowCharcount');
MaweDisplaySettings.bindCueListDisplayToggle(MaweDom.cueListAutoScrollOnClickToggle, 'cueListAutoScrollOnClick');
MaweDom.cueListKeepSplitVisibleToggle?.addEventListener('change', () => {
  updateEditorSettings({ cueListKeepSplitVisible: MaweDom.cueListKeepSplitVisibleToggle.checked });
  if (!MaweDom.cueListKeepSplitVisibleToggle.checked) MaweCueElements.clearTemporaryVisibleSplitCues();
  MaweSearch.applySearch(MaweDom.searchEl.value);
});
MaweDom.cueListCharcountThresholdInput?.addEventListener('input', () => {
  MaweCueElements.handleCharCountThresholdInput(MaweDom.cueListCharcountThresholdInput);
});
MaweDom.cueListCharcountThresholdInput?.addEventListener('change', () => {
  MaweCueElements.syncCharCountThresholdInputs();
  MaweCueElements.updateTimedTextEditSingleGuide();
});
MaweDom.timedTextEditCharcountThresholdInput?.addEventListener('input', () => {
  MaweCueElements.handleCharCountThresholdInput(MaweDom.timedTextEditCharcountThresholdInput);
});
MaweDom.timedTextEditCharcountThresholdInput?.addEventListener('change', () => {
  MaweCueElements.syncCharCountThresholdInputs();
  MaweCueElements.updateTimedTextEditSingleGuide();
});
MaweDisplaySettings.bindCueEditorDisplayToggle(MaweDom.cueEditorShowNavigationToggle, 'cueEditorShowNavigation');
MaweDisplaySettings.bindCueEditorDisplayToggle(MaweDom.cueEditorShowTimeActionsToggle, 'cueEditorShowTimeActions');
MaweDisplaySettings.bindCueEditorDisplayToggle(MaweDom.cueEditorShowStickerToggle, 'cueEditorShowSticker');
MaweDom.exportStartAtZeroToggle?.addEventListener('change', () => {
  updateEditorSettings({ exportStartAtZero: MaweDom.exportStartAtZeroToggle.checked });
});
MaweDom.selectGroupMembersToggle?.addEventListener('change', () => {
  updateEditorSettings({ selectGroupMembers: MaweDom.selectGroupMembersToggle.checked });
});
MaweDom.exportColorUnifiedToggle?.addEventListener('change', () => {
  updateEditorSettings({ exportColorUnified: MaweDom.exportColorUnifiedToggle.checked });
});
MaweDom.clickBehaviorSelect?.addEventListener('change', () => {
  updateEditorSettings({ clickBehavior: MaweSettings.normalizeClickBehavior(MaweDom.clickBehaviorSelect.value) });
  refreshClickBehaviorHint();
});
MaweDom.clickTargetSelect?.addEventListener('change', () => {
  updateEditorSettings({ clickTarget: MaweSettings.normalizeClickTarget(MaweDom.clickTargetSelect.value) });
});
MaweDom.keyboardOperationReferenceSelect?.addEventListener('change', () => {
  const mode = MaweSettings.normalizeKeyboardOperationReferenceMode(MaweDom.keyboardOperationReferenceSelect.value);
  updateEditorSettings({ keyboardOperationReference: mode });
  refreshKeyboardOperationReferenceHint();
});
MaweDom.hoverSeekPreviewToggle?.addEventListener('change', () => {
  updateEditorSettings({ hoverSeekPreview: MaweDom.hoverSeekPreviewToggle.checked });
});
function refreshMediaSeekInputStep(value = MaweSettings.EDITOR_SETTINGS.mediaSeekStepMs) {
  if (MaweDom.mediaSeekStepInput) MaweDom.mediaSeekStepInput.step = String(MaweSettings.mediaSeekStepForValue(value));
}

function commitMediaSeekStepInput(value, { rewriteInput = true } = {}) {
  const normalized = MaweSettings.clampMediaSeekStepMs(value);
  if (rewriteInput && MaweDom.mediaSeekStepInput) MaweDom.mediaSeekStepInput.value = String(normalized);
  MaweDom.mediaSeekInputLastValue = normalized;
  updateEditorSettings({ mediaSeekStepMs: normalized });
  refreshMediaSeekInputStep(normalized);
  MaweMediaPlayback.refreshMediaSeekStepHelp();
  MaweMediaPlayback.refreshMediaSeekControlLabels();
}

function adjustMediaSeekStepInput(direction) {
  if (!MaweDom.mediaSeekStepInput) return;
  const current = MaweSettings.clampMediaSeekStepMs(MaweDom.mediaSeekStepInput.value);
  commitMediaSeekStepInput(MaweSettings.nextMediaSeekStepValue(current, direction));
}

MaweDom.mediaSeekStepInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  event.stopPropagation();
  adjustMediaSeekStepInput(event.key === 'ArrowUp' ? 1 : -1);
});
MaweDom.mediaSeekStepInput?.addEventListener('wheel', (event) => {
  if (!event.deltaY) return;
  event.preventDefault();
  event.stopPropagation();
  MaweDom.mediaSeekStepInput.focus({ preventScroll: true });
  adjustMediaSeekStepInput(event.deltaY < 0 ? 1 : -1);
}, { passive: false });
MaweDom.mediaSeekStepInput?.addEventListener('input', () => {
  const raw = MaweDom.mediaSeekStepInput.value.trim();
  if (!raw) return;
  const value = MaweSettings.normalizeNativeMediaSeekStepValue(raw, MaweDom.mediaSeekInputLastValue);
  if (value === null) return;
  commitMediaSeekStepInput(value, { rewriteInput: value !== Number(raw) });
});
MaweDom.mediaSeekStepInput?.addEventListener('change', () => {
  commitMediaSeekStepInput(MaweDom.mediaSeekStepInput.value);
});
MaweDom.cueMoveStepInput?.addEventListener('change', () => {
  const value = MaweSettings.clampCueMoveStepMs(MaweDom.cueMoveStepInput.value);
  MaweDom.cueMoveStepInput.value = String(value);
  updateEditorSettings({ cueMoveStepMs: value });
});
MaweDom.autoSnapAdjacentCuesToggle?.addEventListener('change', () => {
  updateEditorSettings({ autoSnapAdjacentCues: MaweDom.autoSnapAdjacentCuesToggle.checked });
});
MaweDom.cueEditorCancelOnEscapeToggle?.addEventListener('change', () => {
  updateEditorSettings({ cueEditorCancelOnEscape: MaweDom.cueEditorCancelOnEscapeToggle.checked });
});
MaweDom.ninjaModeToggle?.addEventListener('change', () => {
  updateEditorSettings({ ninjaMode: MaweDom.ninjaModeToggle.checked });
  MaweNinja.applyNinjaSettings();
});
MaweDom.ninjaSoundToggle?.addEventListener('change', () => {
  updateEditorSettings({ ninjaSound: MaweDom.ninjaSoundToggle.checked });
});
MaweDom.ninjaSlashEffectToggle?.addEventListener('change', () => {
  updateEditorSettings({ ninjaSlashEffect: MaweDom.ninjaSlashEffectToggle.checked });
  MaweNinja.applyNinjaSettings();
});
MaweDom.ninjaSlashLengthInput?.addEventListener('change', () => {
  updateEditorSettings({ ninjaSlashLengthPercent: MaweSettings.clampNinjaSlashLength(MaweDom.ninjaSlashLengthInput.value) });
  MaweDom.ninjaSlashLengthInput.value = String(MaweSettings.EDITOR_SETTINGS.ninjaSlashLengthPercent);
});
MaweDom.ninjaSlashRotateInput?.addEventListener('change', () => {
  updateEditorSettings({ ninjaSlashRotateAmplitude: MaweSettings.clampNinjaSlashRotateAmplitude(MaweDom.ninjaSlashRotateInput.value) });
  MaweDom.ninjaSlashRotateInput.value = String(MaweSettings.EDITOR_SETTINGS.ninjaSlashRotateAmplitude);
});
MaweDom.subtitleFontSizeSelect?.addEventListener('change', () => {
  const value = MaweDom.subtitleFontSizeSelect.value;
  MaweHistory.pushPreviewUndo('调整字幕字号', MaweHistory.snapshotPreviewState());
  MaweAppearance.setSubtitleAppearance({ font_size: value === 'auto' ? null : Number(value) });
});
MaweDom.subtitleFontFamilySelect?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('调整字幕字体', MaweHistory.snapshotPreviewState());
  MaweAppearance.setSubtitleAppearance({ font_family: MaweDom.subtitleFontFamilySelect.value });
});
let subtitleBackgroundColorUndoPushed = false;
function applySubtitleBackgroundColorInput({ finalize = false } = {}) {
  if (!MaweDom.subtitleBackgroundColorInput) return;
  if (!subtitleBackgroundColorUndoPushed) {
    MaweHistory.pushPreviewUndo('调整字幕背景色', MaweHistory.snapshotPreviewState());
    subtitleBackgroundColorUndoPushed = true;
  }
  MaweAppearance.setSubtitleAppearance({ background_color: MaweDom.subtitleBackgroundColorInput.value });
  if (finalize) subtitleBackgroundColorUndoPushed = false;
}
MaweDom.subtitleBackgroundColorInput?.addEventListener('input', () => applySubtitleBackgroundColorInput());
MaweDom.subtitleBackgroundColorInput?.addEventListener('change', () => applySubtitleBackgroundColorInput({ finalize: true }));
let subtitleBackgroundAlphaUndoPushed = false;
function applySubtitleBackgroundAlphaInput({ finalize = false } = {}) {
  if (!MaweDom.subtitleBackgroundAlphaInput) return;
  if (!subtitleBackgroundAlphaUndoPushed) {
    MaweHistory.pushPreviewUndo('调整字幕背景不透明度', MaweHistory.snapshotPreviewState());
    subtitleBackgroundAlphaUndoPushed = true;
  }
  const alpha = Number(MaweDom.subtitleBackgroundAlphaInput.value);
  if (MaweDom.subtitleBackgroundAlphaValue && Number.isFinite(alpha)) {
    MaweDom.subtitleBackgroundAlphaValue.textContent = `${Math.round(alpha * 100)}%`;
  }
  MaweAppearance.setSubtitleAppearance({ background_alpha: alpha });
  if (finalize) subtitleBackgroundAlphaUndoPushed = false;
}
MaweDom.subtitleBackgroundAlphaInput?.addEventListener('input', () => applySubtitleBackgroundAlphaInput());
MaweDom.subtitleBackgroundAlphaInput?.addEventListener('change', () => applySubtitleBackgroundAlphaInput({ finalize: true }));
MaweDom.subtitleFontFamilyScanButton?.addEventListener('click', () => {
  void MaweAppearance.scanSubtitleLocalFonts();
});
document.addEventListener('mawe:languagechange', () => {
  MaweAppearance.renderSubtitleFontFamilyStatus();
  MaweAppearance.relabelSubtitleFontFamilyOptions();
});
MaweDom.subtitleColorInput?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('调整主字幕颜色', MaweHistory.snapshotPreviewState());
  MaweAppearance.setSubtitleAppearance({ color: MaweDom.subtitleColorInput.value });
  MawePlaybackLoop.update();
});
MaweDom.subtitleColorUnderlineInput?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('切换预览字幕颜色下划线', MaweHistory.snapshotPreviewState());
  MaweAppearance.setSubtitleAppearance({ color_underline: MaweDom.subtitleColorUnderlineInput.checked });
  MawePlaybackLoop.update();
});
MaweDom.extensionSubtitleFontSizeSelect?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('调整副字幕字号', MaweHistory.snapshotPreviewState());
  const value = MaweDom.extensionSubtitleFontSizeSelect.value;
  MaweAppearance.setExtensionSubtitleAppearance({ font_size: value === 'auto' ? null : Number(value) });
  MawePlaybackLoop.update();
});
MaweDom.extensionSubtitleFontFamilySelect?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('调整副字幕字体', MaweHistory.snapshotPreviewState());
  MaweAppearance.setExtensionSubtitleAppearance({ font_family: MaweDom.extensionSubtitleFontFamilySelect.value });
  MawePlaybackLoop.update();
});
MaweDom.extensionSubtitleColorInput?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('调整副字幕颜色', MaweHistory.snapshotPreviewState());
  MaweAppearance.setExtensionSubtitleAppearance({ color: MaweDom.extensionSubtitleColorInput.value });
  MawePlaybackLoop.update();
});
MaweDom.extensionSubtitleBackgroundColorInput?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('调整副字幕背景色', MaweHistory.snapshotPreviewState());
  MaweAppearance.setExtensionSubtitleAppearance({ background_color: MaweDom.extensionSubtitleBackgroundColorInput.value });
  MawePlaybackLoop.update();
});
let extensionSubtitleBackgroundAlphaUndoPushed = false;
function applyExtensionSubtitleBackgroundAlphaInput({ finalize = false } = {}) {
  if (!MaweDom.extensionSubtitleBackgroundAlphaInput) return;
  if (!extensionSubtitleBackgroundAlphaUndoPushed) {
    MaweHistory.pushPreviewUndo('调整副字幕背景不透明度', MaweHistory.snapshotPreviewState());
    extensionSubtitleBackgroundAlphaUndoPushed = true;
  }
  const alpha = Number(MaweDom.extensionSubtitleBackgroundAlphaInput.value);
  if (MaweDom.extensionSubtitleBackgroundAlphaValue && Number.isFinite(alpha)) {
    MaweDom.extensionSubtitleBackgroundAlphaValue.textContent = `${Math.round(alpha * 100)}%`;
  }
  MaweAppearance.setExtensionSubtitleAppearance({ background_alpha: alpha });
  if (finalize) extensionSubtitleBackgroundAlphaUndoPushed = false;
}
MaweDom.extensionSubtitleBackgroundAlphaInput?.addEventListener('input', () => applyExtensionSubtitleBackgroundAlphaInput());
MaweDom.extensionSubtitleBackgroundAlphaInput?.addEventListener('change', () => applyExtensionSubtitleBackgroundAlphaInput({ finalize: true }));
MaweDom.extensionOverlayToggle?.addEventListener('change', () => {
  const previous = MaweHistory.snapshotPreviewState();
  previous.extensionOverlay = !MaweDom.extensionOverlayToggle.checked;
  MaweHistory.pushPreviewUndo('切换副字幕预览', previous);
  updateEditorSettings({ extensionOverlayEnabled: MaweDom.extensionOverlayToggle.checked });
  MawePreviewGeometry.refreshPreviewGeometryEditable();
  MawePlaybackLoop.update();
});
const CLICK_BEHAVIOR_HINTS = {
  zh: {
    'select-and-seek': '暂停时只跳转，不自动播放；播放中跳转后继续播放。',
    'select-only': '只选中，不改变播放位置；可用 F 或右键菜单跳转并播放。',
    'select-and-play': '跳转到字幕起点，并在暂停时自动开始播放。',
  },
  en: {
    'select-and-seek': 'When paused, seek without starting playback; while playing, keep playing after seeking.',
    'select-only': 'Select only without changing the playhead; use F or the context menu to seek and play.',
    'select-and-play': 'Seek to the subtitle start and start playback when paused.',
  },
};
function refreshClickBehaviorHint() {
  const hint = document.getElementById('click-behavior-hint');
  const language = window.MAWE_I18N?.language === 'en' ? 'en' : 'zh';
  if (hint) {
    hint.textContent = CLICK_BEHAVIOR_HINTS[language][MaweSettings.EDITOR_SETTINGS.clickBehavior];
    hint.hidden = false;
  }
  if (MaweDom.clickTargetField) {
    MaweDom.clickTargetField.hidden = MaweSettings.EDITOR_SETTINGS.clickBehavior === 'select-only';
  }
}
refreshClickBehaviorHint();
document.addEventListener('mawe:languagechange', refreshClickBehaviorHint);

const KEYBOARD_OPERATION_REFERENCE_HINTS = {
  zh: {
    pointer: 'B/Z/X/N 使用鼠标所在波形位置；波形外不执行时间操作。',
    playhead: 'B/Z/X/N 使用当前播放头位置；无当前字幕目标时使用主轨。',
  },
  en: {
    pointer: 'B/Z/X/N use the mouse position in the waveform; outside it, timing actions do nothing.',
    playhead: 'B/Z/X/N use the current playhead; when no cue target is active, they use the main track.',
  },
};
function refreshKeyboardOperationReferenceHint() {
  const language = window.MAWE_I18N?.language === 'en' ? 'en' : 'zh';
  const mode = MaweSettings.normalizeKeyboardOperationReferenceMode(MaweSettings.EDITOR_SETTINGS.keyboardOperationReference);
  if (MaweDom.keyboardOperationReferenceSelect) MaweDom.keyboardOperationReferenceSelect.value = mode;
  if (MaweDom.keyboardOperationReferenceHint) {
    MaweDom.keyboardOperationReferenceHint.textContent = KEYBOARD_OPERATION_REFERENCE_HINTS[language][mode];
  }
}
refreshKeyboardOperationReferenceHint();
document.addEventListener('mawe:languagechange', refreshKeyboardOperationReferenceHint);

function finishGapRemovePanelDrag(event) {
  if (!MaweCuePanelState.gapRemovePanelDrag || event.pointerId !== MaweCuePanelState.gapRemovePanelDrag.pointerId) return;
  try {
    MaweDom.gapRemoveDragHandle?.releasePointerCapture?.(event.pointerId);
  } catch (_) {
    // 指针在浏览器窗口外释放时，capture 可能已由浏览器自动清理。
  }
  MaweCuePanelState.gapRemovePanelDrag = null;
  MaweDom.gapRemovePanel?.classList.remove('dragging');
  const rect = MaweDom.gapRemovePanel?.getBoundingClientRect();
  if (rect) MaweGapRemoveUi.setGapRemovePanelPosition(rect.left, rect.top, { persist: true });
}

MaweDom.gapRemoveDragHandle?.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('button')) return;
  const rect = MaweDom.gapRemovePanel.getBoundingClientRect();
  MaweCuePanelState.gapRemovePanelDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  MaweDom.gapRemovePanel.classList.add('dragging');
  MaweDom.gapRemoveDragHandle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});
MaweDom.gapRemoveDragHandle?.addEventListener('pointermove', (event) => {
  if (!MaweCuePanelState.gapRemovePanelDrag || event.pointerId !== MaweCuePanelState.gapRemovePanelDrag.pointerId) return;
  event.preventDefault();
  MaweGapRemoveUi.setGapRemovePanelPosition(
    event.clientX - MaweCuePanelState.gapRemovePanelDrag.offsetX,
    event.clientY - MaweCuePanelState.gapRemovePanelDrag.offsetY,
  );
});
MaweDom.gapRemoveDragHandle?.addEventListener('pointerup', finishGapRemovePanelDrag);
MaweDom.gapRemoveDragHandle?.addEventListener('pointercancel', finishGapRemovePanelDrag);

MaweDom.gapRemovePanel?.querySelectorAll('input[type="number"]').forEach((input) => {
  input.addEventListener('wheel', (event) => {
    if (!event.deltaY) return;
    event.preventDefault();
    input.focus({ preventScroll: true });
    try {
      if (event.deltaY < 0) input.stepUp();
      else input.stepDown();
    } catch (_) {
      return;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, { passive: false });
});

MaweDom.gapRemoveManageButton?.addEventListener('click', MaweGapRemoveUi.toggleGapRemovePanel);
MaweDom.gapRemoveScanButton?.addEventListener('click', MaweGapRemoveUi.scanAndRemoveGaps);
MaweDom.gapRemoveShrinkButton?.addEventListener('click', MaweGapRemoveUi.shrinkExistingGaps);
MaweDom.gapRemoveClearAllButton?.addEventListener('click', MaweGapRemoveUi.clearAllGaps);
MaweDom.gapRemoveCloseButton?.addEventListener('click', MaweGapRemoveUi.closeGapRemovePanel);
MaweDom.gapRemoveOperationMode?.addEventListener('change', () => {
  const state = MaweGapRemoveData.getGapRemoveData(true);
  const nextMode = window.AsrGapRemoveCore.normalizeGapOperationMode(MaweDom.gapRemoveOperationMode.value);
  if (state.operation_mode === nextMode) return;
  MaweHistory.pushGapRemoveUndo('切换空隙操作方式');
  state.operation_mode = nextMode;
  MaweGapRemoveUi.setGapRemoveData(state);
});
MaweDom.gapRemoveAdvancedToggle?.addEventListener('click', () => {
  MaweGapRemoveUi.setGapRemoveAdvancedOpen(!MaweGapRemoveUi.gapRemoveAdvancedIsOpen());
});
MaweDom.gapRemoveDisableToggle?.addEventListener('click', () => {
  MaweGapRemoveUi.setGapRemoveDisableOpen(!MaweGapRemoveUi.gapRemoveDisableIsOpen());
});
MaweDom.gapRemoveDisableCoverage?.addEventListener('change', MaweGapRemoveUi.commitGapRemoveDisableSettings);
MaweDom.gapRemoveDisableRemaining?.addEventListener('change', MaweGapRemoveUi.commitGapRemoveDisableSettings);
MaweDom.gapRemoveDisableButton?.addEventListener('click', MaweGapRemoveUi.disableSubtitlesInRemovedGaps);
MaweDom.gapRemoveHysteresis?.addEventListener('input', MaweGapRemoveUi.updateGapRemoveHysteresisHint);
window.addEventListener('resize', () => {
  if (!MaweGapRemoveUi.gapRemovePanelIsOpen()) return;
  const rect = MaweDom.gapRemovePanel.getBoundingClientRect();
  MaweGapRemoveUi.setGapRemovePanelPosition(rect.left, rect.top, { persist: true });
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweGapRemoveUi.gapRemovePanelIsOpen() || MaweInlineEdit.editingState) return;
  event.preventDefault();
  MaweGapRemoveUi.closeGapRemovePanel();
});
MaweDom.gapRemoveSkipPlayback?.addEventListener('change', () => {
  const state = MaweGapRemoveData.getGapRemoveData(true) || { gaps: [] };
  if (state.skip_playback === MaweDom.gapRemoveSkipPlayback.checked) return;
  MaweHistory.pushGapRemoveUndo('切换空隙跳过播放');
  state.skip_playback = MaweDom.gapRemoveSkipPlayback.checked;
  MaweGapRemoveUi.setGapRemoveData(state);
  if (!state.skip_playback) MaweCuePanelState.gapPreviewRange = null;
});

function syncPlayerPlaceholder() {
  if (!MaweDom.playerEmpty) return;
  const source = MaweCoreState.player?.currentSrc
    || MaweCoreState.player?.getAttribute('src')
    || MaweCoreState.player?.querySelector('source')?.getAttribute('src')
    || '';
  const hasMedia = Boolean(String(source).trim());
  MaweDom.playerEmpty.classList.toggle('hidden', hasMedia);
  MaweDom.playerWrap?.classList.toggle('empty-state', !hasMedia);
  MaweCoreState.waveformEditor?.setMediaAvailable(hasMedia);
}

// 合成表情包文件的 URL（用于 <img src>）
// 优先级:
let stickerAssetRevision = 0;

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
  scheduleAutoSaveFlush();
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
  if (target?.kind === 'main') openStickerPicker([target.index], false);
});
MaweDom.cuePanelSticker?.addEventListener('click', () => {
  const target = MaweCuePanel.getCurrentCuePanelTarget();
  if (target?.kind === 'main') openStickerPicker([target.index], false);
});
MaweDom.cuePanelSticker?.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const target = MaweCuePanel.getCurrentCuePanelTarget();
  if (target?.kind !== 'main') return;
  removeStickerCascade(target.index);
  MaweCuePanel.renderAll();
  MaweHint.flashHint('已删除当前表情包', 'success');
});
MaweDom.cuePanelSplit?.addEventListener('click', MaweCuePanel.splitCuePanelAtCursor);

MaweColorFilter.renderColorFilterMenu();
bindToolbarExportDropdown(
  'color-filter-dropdown', 'color-filter-btn', 'color-filter-menu',
  MaweColorFilter.positionColorFilterMenu,
);
MaweDom.searchEl.addEventListener('input', () => {
  MaweSearch.refreshSearchClearVisibility();
  clearTimeout(MaweSearch.searchDebounce);
  MaweSearch.searchDebounce = setTimeout(() => MaweSearch.applySearch(MaweDom.searchEl.value), 100);
});
document.getElementById('search-clear')?.addEventListener('click', () => {
  MaweDom.searchEl.value = '';
  MaweSearch.refreshSearchClearVisibility();
  MaweSearch.applySearch('');
  MaweDom.searchEl.focus({ preventScroll: true });
});

document.addEventListener('pointerdown', MaweCueListAnchor.invalidateCueListVisualAnchorRestore, true);
MaweCoreState.container.addEventListener('wheel', MaweCueListAnchor.invalidateCueListVisualAnchorRestore, { passive: true });
MaweCoreState.container.addEventListener('touchstart', MaweCueListAnchor.invalidateCueListVisualAnchorRestore, { passive: true });
document.addEventListener('keydown', MaweCueListAnchor.invalidateCueListVisualAnchorRestore, true);

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
    requestCloseTimedTextEdit();
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

// ←/→：无选中字幕时复用媒体控制条的跳转时长；选中字幕时改为按设置的
// 微调幅度调整时间。Shift+方向键贴合前后边界；Ctrl(Cmd)+方向键调整左边界，
// Ctrl(Cmd)+Shift+方向键调整右边界。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (MaweInlineEdit.editingState || MaweKeyboardTargets.isTextEditingTarget(e)) return;
  // 拆分弹窗内方向键用于移动 ✂️ 断点，不再 seek 媒体或微调字幕时间。
  if (MaweDom.multiSubtitleSplitModal?.classList.contains('show')) return;
  const target = e.target instanceof Element ? e.target : document.activeElement;
  if (target?.closest?.('.geo-box, input, select, textarea')) return;
  if (target?.closest?.('[role="menu"]')) return;
  if (!MaweKeyboardTargets.isPlaybackKeyboardTarget(e) && MaweKeyboardTargets.isNativeKeyboardControl(e)) return;
  if (MaweKeyboardTargets.isPlayerKeyboardTarget(e)) return;
  const commandKey = e.ctrlKey || e.metaKey;
  const direction = e.key === 'ArrowLeft' ? -1 : 1;
  const panelTarget = MaweCuePanel.getCurrentCuePanelTarget();
  const extensionTarget = panelTarget?.kind === 'extension';
  const activeTrack = extensionTarget ? 'extension' : 'main';
  const selected = extensionTarget ? MaweSelection.selectedExtensionIdxs : MaweSelection.selectedIdxs;
  if (e.shiftKey && !commandKey) {
    // Shift 是显式的边界贴合命令，不受自动吸附默认值影响；Alt 只反转
    // 普通移动/边界微调的自动联动模式。
    if (selected.size > 0
        && MaweCoreState.waveformEditor?.snapSelectedCueBoundaryByKeyboard?.(direction, activeTrack)) {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }
  if (selected.size > 0 && MaweCoreState.waveformEditor) {
    const deltaMs = direction * MaweSettings.EDITOR_SETTINGS.cueMoveStepMs;
    if (commandKey) {
      if (e.shiftKey) {
        MaweCoreState.waveformEditor.adjustSelectedBoundaryByKeyboard(deltaMs, 'end', e.altKey, activeTrack);
      } else {
        MaweCoreState.waveformEditor.adjustSelectedBoundaryByKeyboard(deltaMs, 'start', e.altKey, activeTrack);
      }
    } else {
      MaweCoreState.waveformEditor.adjustSelectedByKeyboard(deltaMs, e.altKey, activeTrack);
    }
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (commandKey || e.altKey) return;
  if (!MaweMediaPlayback.hasLoadedMedia()) return;
  e.preventDefault();
  e.stopPropagation();
  MaweMediaPlayback.seekMediaBy(direction * MaweSettings.EDITOR_SETTINGS.mediaSeekStepMs / 1000);
}, true);

// Home/End：字幕列表最近拥有导航时选择当前轨道首尾；波形、播放器或尚未
// 确定区域时跳转媒体首尾。文本输入、普通按钮和模态窗口保留原生行为。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Home' && e.key !== 'End') return;
  if (MaweInlineEdit.editingState || MaweInlineEdit.extensionEditingState || MaweKeyboardTargets.isTextEditingTarget(e)) return;
  if (!MaweKeyboardTargets.isPlaybackKeyboardTarget(e) && MaweKeyboardTargets.isNativeKeyboardControl(e)) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  if (MaweDom.replaceModal.classList.contains('show') || MaweDom.stickerModal.classList.contains('show')
      || MaweDom.stickerPreviewModal.classList.contains('show') || MaweDom.projectMediaModal.classList.contains('show')
      || MaweDom.multiSubtitleSplitModal?.classList.contains('show')
      || MaweDom.multiSubtitleImportModal?.classList.contains('show')
      || document.getElementById('sticker-root-modal').classList.contains('show')
      || MaweDom.ctxmenu.classList.contains('show')) return;
  if (MaweNavPreview.navigationOwner === 'cue-list' && MaweKeyboardTargets.navigateCueListBoundary(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  const duration = Number(MaweCoreState.player?.duration);
  if (!MaweMediaPlayback.hasLoadedMedia() || !Number.isFinite(duration) || duration <= 0) return;
  e.preventDefault();
  e.stopPropagation();
  MaweMediaPlayback.seekMediaTo(e.key === 'Home' ? 0 : duration);
}, true);

// 多重字幕下，上/下只切换当前操作轨道；优先使用绑定关系，没有绑定时
// 选择时间范围重叠最多、否则距离最近的另一轨字幕，不改变播放头位置。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  if (MaweInlineEdit.editingState || MaweInlineEdit.extensionEditingState || MaweKeyboardTargets.isTextEditingTarget(e)) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (MaweKeyboardTargets.isNativeKeyboardControl(e) || MaweKeyboardTargets.isPlayerKeyboardTarget(e)) return;
  if (MaweDom.replaceModal.classList.contains('show') || MaweDom.stickerModal.classList.contains('show')
      || MaweDom.stickerPreviewModal.classList.contains('show') || MaweDom.projectMediaModal.classList.contains('show')
      || MaweDom.multiSubtitleSplitModal?.classList.contains('show')
      || document.getElementById('sticker-root-modal').classList.contains('show')
      || MaweDom.ctxmenu.classList.contains('show')) return;
  if (!MaweKeyboardTargets.switchMultiSubtitleTrack(e.key === 'ArrowUp' ? -1 : 1)) return;
  e.preventDefault();
  e.stopPropagation();
}, true);

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

// A/D（或 W/S）：跳转到上一条/下一条字幕的句首并单选。W/S 与 A/D 等价，对应上下方向。
// Shift+A/D（或 Shift+W/S）：保留当前选择，并向前/后追加选择一条字幕。
// 播放中以播放头所在字幕为基准；播放头处于空隙时，按方向选择其前方/后方字幕。
// 暂停时仍以当前选中字幕为基准。跳转本身不改变播放状态。
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key !== 'a' && key !== 'd' && key !== 'w' && key !== 's') return;
  if (MaweInlineEdit.editingState) return;
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
  if (MaweDom.multiSubtitleSplitModal?.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (e.ctrlKey || e.metaKey) return;
  const direction = (key === 'a' || key === 'w') ? -1 : 1;
  const panelTarget = MaweCuePanel.getCurrentCuePanelTarget();
  const extensionTarget = panelTarget?.kind === 'extension';
  const extensionTrack = extensionTarget ? panelTarget.track : null;
  const segments = extensionTarget ? extensionTrack.segments : DATA.segments;
  const wasPlaying = !MaweCoreState.player.paused;
  const heldCueKey = (!e.shiftKey || key === 'a' || key === 'd')
    && MaweCoreState.waveformEditor?.handleHeldCueKey?.(
      direction,
      direction * MaweSettings.EDITOR_SETTINGS.cueMoveStepMs,
      { shiftKey: e.shiftKey, altKey: e.altKey, snap: key === 'a' || key === 'd' },
    );
  if (heldCueKey) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  if (e.altKey) return;
  const navigationIndex = wasPlaying
    ? -1
    : (extensionTarget ? panelTarget?.index ?? -1 : MaweCuePanelState.currentCuePanelIdx);
  let next = e.shiftKey
    ? window.AsrEditorUtils.findCueSelectionExtensionTarget(
      segments,
      extensionTarget ? MaweSelection.selectedExtensionIdxs : MaweSelection.selectedIdxs,
      navigationIndex,
      Math.round(MaweCoreState.player.currentTime * 1000),
      direction,
      MaweDom.hideDisabled,
    )
    : window.AsrEditorUtils.findCueNavigationTarget(
      segments,
      navigationIndex,
      Math.round(MaweCoreState.player.currentTime * 1000),
      direction,
      MaweDom.hideDisabled,
    );
  if (next < 0) {
    const eligible = segments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => segment && (!MaweDom.hideDisabled || !segment.disabled));
    next = direction < 0
      ? (eligible[0]?.index ?? -1)
      : (eligible[eligible.length - 1]?.index ?? -1);
  }
  if (next < 0) return;

  e.preventDefault();
  e.stopPropagation();
  if (extensionTarget) {
    if (e.shiftKey) MaweSelection.addExtensionToSelection(next, extensionTrack);
    else MaweSelection.selectOnlyExtension(next);
    MaweSelection.lastClickedExtensionIdx = next;
  } else {
    if (e.shiftKey) MaweSelection.addToSelection(next);
    else MaweSelection.selectOnly(next);
    MaweSelection.lastClickedIdx = next;
  }
  const cue = MaweCoreState.container.querySelector(
    extensionTarget
      ? `.multi-dual-cue[data-ext-idx="${next}"], .multi-extension-cue[data-ext-idx="${next}"]`
      : `.cue[data-idx="${next}"], .multi-dual-cue[data-main-idx="${next}"]`,
  );
  if (cue) MaweCueListAnchor.scrollCueToCenter(cue);
  MaweCoreState.waveformEditor?.revealTime(segments[next].start, true);
  seekFromWaveform(segments[next].start / 1000);
  if (wasPlaying && MaweCoreState.player.paused) {
    const promise = MaweCoreState.player.play();
    if (promise && promise.catch) promise.catch(() => {});
  }
});

// Ctrl(Cmd)+Shift+A/D：把当前主/副字幕与前一条/后一条直接粘合。
// 不改变 Ctrl(Cmd)+A/D 的全选与清除选择语义。
document.addEventListener('keydown', (e) => {
  if (!['a', 'A', 'd', 'D'].includes(e.key)) return;
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey || e.repeat) return;
  if (MaweInlineEdit.editingState || e.target === MaweDom.cuePanelText) return;
  const active = document.activeElement;
  if (active && (
    active.tagName === 'INPUT' || active.tagName === 'TEXTAREA'
      || active.tagName === 'SELECT' || active.isContentEditable
  )) return;
  if (MaweDom.replaceModal.classList.contains('show') || MaweDom.stickerModal.classList.contains('show')
      || MaweDom.stickerPreviewModal.classList.contains('show') || MaweDom.projectMediaModal.classList.contains('show')
      || document.getElementById('sticker-root-modal').classList.contains('show')
      || MaweDom.ctxmenu.classList.contains('show')) return;
  e.preventDefault();
  e.stopPropagation();
  MaweMergeAdjacent.mergeAdjacentSubtitle(e.key.toLowerCase() === 'a' ? -1 : 1);
});

// Ctrl(Cmd)+A：选中所有字幕。仅在「非编辑字幕」状态下生效；
// 焦点在输入框/文本域/可编辑元素或内联编辑态时，保留浏览器原生的「全选文本」行为。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'a' && e.key !== 'A') return;
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.altKey || e.shiftKey) return;
  if (MaweInlineEdit.editingState) return;
  if (e.target === MaweDom.cuePanelText) return;
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
  e.preventDefault();
  MaweSelection.selectAll();
});

// Ctrl(Cmd)+D：取消选中（清空当前字幕选择）。浏览器默认是「添加书签」，这里接管；
// 与 Ctrl(Cmd)+A 同样仅在非编辑字幕状态下生效。ESC 清除选中的行为保持不变。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'd' && e.key !== 'D') return;
  if (!e.ctrlKey && !e.metaKey) return;
  if (e.altKey || e.shiftKey) return;
  if (MaweInlineEdit.editingState) return;
  if (e.target === MaweDom.cuePanelText) return;
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
  if (MaweSelection.selectedIdxs.size === 0 && MaweSelection.selectedExtensionIdxs.size === 0) return;
  e.preventDefault();
  MaweSelection.clearSelection();
});

// T：给选中字幕分配表情包。单选直接分配本条，多选统一分配（与右键菜单一致）。
document.addEventListener('keydown', (e) => {
  if (e.key !== 't' && e.key !== 'T') return;
  if (MaweInlineEdit.editingState || e.repeat) return;
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
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  if (MaweSelection.selectedIdxs.size === 0) return;
  e.preventDefault();
  const idxs = [...MaweSelection.selectedIdxs].sort((x, y) => x - y);
  openStickerPicker(idxs, idxs.length > 1);
});

// 数字键 1~5：给选中字幕标记对应颜色（红黄蓝绿紫）；0：清除颜色。
document.addEventListener('keydown', (e) => {
  if (!/^[0-5]$/.test(e.key)) return;
  if (MaweInlineEdit.editingState || e.repeat) return;
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
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  if (MaweSelection.selectedIdxs.size === 0) return;
  e.preventDefault();
  const idxs = [...MaweSelection.selectedIdxs].sort((x, y) => x - y);
  if (e.key === '0') {
    clearColorOnTargets(idxs);
    return;
  }
  const color = MaweColors.COLOR_PALETTE[Number(e.key) - 1];
  if (color) assignColor(idxs, color.name);
});

// Enter：聚焦最后点击的主/副字幕对应的字幕编辑区，并把光标置于末尾。
// 绑定字幕同时选中时仍以最后点击的一侧为准；内联编辑态、已聚焦编辑区或模态打开时不触发。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (MaweInlineEdit.editingState || MaweInlineEdit.extensionEditingState) return;  // 内联编辑态的 Enter 交给 split/commit 处理
  if (e.target === MaweDom.cuePanelText) return;  // 已在字幕编辑区
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;  // 仅响应裸 Enter
  const a = document.activeElement;
  if (a && (
    a.tagName === 'INPUT'
    || a.tagName === 'TEXTAREA'
    || a.tagName === 'SELECT'
    || a.tagName === 'BUTTON'
    || a.isContentEditable
  )) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (!MaweCuePanel.getCurrentCuePanelTarget()) {
    e.preventDefault();
    e.stopPropagation();
    MaweShortcuts.showShortcutBlocked('请先选中字幕');
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  MaweCuePanel.focusCuePanelText();
});

// C：合并连续选中的字幕块。少于两条时只提示，不改动工程。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'c' && e.key !== 'C') return;
  if (MaweInlineEdit.editingState || e.repeat) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  e.stopPropagation();
  const currentTarget = MaweCuePanel.getCurrentCuePanelTarget();
  if (
    MaweSelection.selectedExtensionIdxs.size > 0
    && (currentTarget?.kind === 'extension' || MaweSelection.selectedIdxs.size === 0)
  ) {
    MaweSegmentOps.mergeExtensionSegments(
      [...MaweSelection.selectedExtensionIdxs],
      currentTarget?.kind === 'extension' ? currentTarget.track : MaweMultiSubtitleCore.getActiveExtensionTrack(),
    );
    return;
  }
  MaweSegmentOps.mergeSegments([...MaweSelection.selectedIdxs]);
});

// Ctrl(Cmd)+Z 撤销；Ctrl(Cmd)+Shift+Z 或 Ctrl(Cmd)+Y 重做
document.addEventListener('keydown', (e) => {
  const isZ = e.key === 'z' || e.key === 'Z';
  const isY = e.key === 'y' || e.key === 'Y';
  if (!isZ && !isY) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  const isRedo = isY || e.shiftKey;
  // 编辑文本时让浏览器自己处理 input 内的撤销/重做
  if (MaweHistory.historyGuarded()) return;
  e.preventDefault();
  if (isRedo) MaweHistory.performRedo();
  else MaweHistory.performUndo();
});

// Delete 键删除选中的字幕（最小命令面，供回归测试与键盘操作）
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  // 编辑文本时让浏览器自己处理
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
  // modal 打开时不触发
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (MaweSelection.selectedIdxs.size === 0 && MaweSelection.selectedExtensionIdxs.size > 0) {
    e.preventDefault();
    e.stopPropagation();
    MaweSegmentOps.deleteExtensionSegments([...MaweSelection.selectedExtensionIdxs]);
    return;
  }
  if (MaweSelection.selectedIdxs.size === 0) return;
  e.preventDefault();
  e.stopPropagation();
  MaweSegmentOps.deleteSegments([...MaweSelection.selectedIdxs]);
});

// 波形工具切换：V=选择（默认），R=剃刀，Esc=切回选择。与 J/K/L 一样只在
// 非输入/非模态/非编辑态下触发，避免抢占文本编辑与弹窗按键。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'v' && e.key !== 'V' && e.key !== 'r' && e.key !== 'R' && e.key !== 'Escape') return;
  if (!MaweCoreState.waveformEditor) return;
  // Escape：上下文菜单/弹窗/编辑态各自先处理；只有波形工具在 razor 时才切回。
  if (e.key === 'Escape') {
    if (MaweInlineEdit.editingState) return;
    if (MaweDom.ctxmenu.classList.contains('show')) return;
    if (MaweDom.replaceModal.classList.contains('show')) return;
    if (MaweDom.stickerModal.classList.contains('show')) return;
    if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
    if (MaweDom.projectMediaModal.classList.contains('show')) return;
    if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
    if (MaweCoreState.waveformEditor.getTool() !== 'razor') return;
    e.preventDefault();
    MaweCoreState.waveformEditor.setTool('select');
    return;
  }
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
  if (MaweInlineEdit.editingState) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  const tool = (e.key === 'v' || e.key === 'V') ? 'select' : 'razor';
  if (MaweCoreState.waveformEditor.getTool() === tool) return;
  e.preventDefault();
  MaweCoreState.waveformEditor.setTool(tool);
});

// F：跳转并播放选中字幕（多选跳到第一条）。任意单击行为下都生效；
// 文本编辑、弹窗和修饰键状态下不抢占输入。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'f' && e.key !== 'F') return;
  if (MaweInlineEdit.editingState || e.repeat) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  const target = MaweCuePanel.getCurrentCuePanelTarget();
  const extensionTarget = target?.kind === 'extension';
  const selected = extensionTarget ? MaweSelection.selectedExtensionIdxs : MaweSelection.selectedIdxs;
  const segments = extensionTarget ? target.track.segments : DATA.segments;
  if (!selected.size) return;
  const first = Math.min(...selected);
  const segment = segments[first];
  if (!segment) return;
  seekFromWaveform(segment.start / 1000);
  if (MaweCoreState.player.paused) MaweMediaPlayback.togglePlayback();
});

// N：仅在鼠标位于波形行时，从指针音频位置创建字幕；创建后单选新字幕，
// 切换当前字幕面板并聚焦面板文本框。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'n' && e.key !== 'N') return;
  if (MaweInlineEdit.editingState || e.repeat || MaweKeyboardTargets.isTextEditingTarget(e)) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  const reference = MaweNavPreview.keyboardOperationReference();
  if (!reference) {
    MaweHint.flashHint('无有效的快捷键时间基准', 'invalid');
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  MaweNavPreview.lastEditRegion = 'waveform';
  if (reference.track === 'extension' && MaweMultiSubtitleCore.multiSubtitleVisible()) {
    addExtensionAtWaveformTime(reference.timeMs, MaweNavPreview.lastPointerPos?.x || 0, MaweNavPreview.lastPointerPos?.y || 0, MaweMultiSubtitleCore.getExtensionTrack(reference.trackId));
  } else {
    addCueAtWaveformTime(reference.timeMs, MaweNavPreview.lastPointerPos?.x || 0, MaweNavPreview.lastPointerPos?.y || 0);
  }
});

// G：绑定当前单选的副字幕。若同时选中一条主字幕则直接绑定，否则沿用
// 右键「绑定到主字幕」的自动匹配/等待选择流程。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'g' && e.key !== 'G') return;
  if (MaweInlineEdit.editingState || MaweInlineEdit.extensionEditingState || e.repeat) return;
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
  if (!MaweMultiSubtitleCore.multiSubtitleVisible()) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (MaweSelection.selectedExtensionIdxs.size !== 1) {
    e.preventDefault();
    e.stopPropagation();
    MaweShortcuts.showShortcutBlocked('请先选中一条副字幕');
    return;
  }
  if (MaweSelection.selectedIdxs.size > 1) {
    e.preventDefault();
    e.stopPropagation();
    MaweShortcuts.showShortcutBlocked('绑定最多需要一条主字幕');
    return;
  }
  const extensionIndex = [...MaweSelection.selectedExtensionIdxs][0];
  const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
  const extension = track?.segments?.[extensionIndex];
  const binding = MaweMultiSubtitleCore.bindingForExtensionIndex(extensionIndex, track);
  if (!extension) {
    e.preventDefault();
    e.stopPropagation();
    MaweShortcuts.showShortcutBlocked('当前副字幕不存在');
    return;
  }
  if (e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();
    if (!binding) {
      MaweHint.flashHint('当前副字幕没有绑定关系', 'invalid');
      return;
    }
    MaweBindingAlign.unbindSelectedSubtitlePair();
    return;
  }
  if (e.shiftKey) return;
  if (binding) {
    e.preventDefault();
    e.stopPropagation();
    MaweShortcuts.showShortcutBlocked('当前副字幕已绑定，请先解绑后再绑定');
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  if (MaweSelection.selectedIdxs.size === 1) {
    MaweBindingAlign.bindSelectedSubtitlePair();
  } else {
    MaweBindingAlign.beginPendingExtensionBinding(extensionIndex, track);
  }
});

// H：把当前选中的副字幕批量对齐到各自绑定的主字幕时间轴。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'h' && e.key !== 'H') return;
  if (MaweInlineEdit.editingState || MaweInlineEdit.extensionEditingState || e.repeat) return;
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
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  if (!MaweMultiSubtitleCore.multiSubtitleVisible()) return;
  if (!MaweSelection.selectedExtensionIdxs.size) {
    e.preventDefault();
    e.stopPropagation();
    MaweShortcuts.showShortcutBlocked('请先选中至少一条副字幕');
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  MaweBindingAlign.alignSelectedExtensionSubtitleRanges();
});

// B：按当前键盘时间基准与指针所在区域分发——
// 1) 鼠标悬停在已单选的字幕列表行上：按指针对应的文字位置拆分；
// 2) 鼠标位于波形上：按指针的音频位置拆分（与波形右键「按音频位置拆分」一致）；
// 3) 其它位置：按当前键盘时间基准拆分。
// 文本编辑、弹窗和修饰键状态下不抢占输入。
document.addEventListener('keydown', (e) => {
  if (e.key !== 'b' && e.key !== 'B') return;
  if (e.repeat) return;
  const forceMainEdit = MaweInlineEdit.editingState?.forceSplitArmed === true;
  if (MaweInlineEdit.extensionEditingState && !forceMainEdit) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const state = MaweInlineEdit.extensionEditingState;
    const offset = MaweInlineEdit.caretOffsetInText(state.textEl);
    const track = MaweMultiSubtitleCore.getExtensionTrack(state.trackId);
    if (!Number.isFinite(offset) || !track?.segments?.[state.index]) {
      MaweHint.flashHint('无法定位副字幕的文字光标', 'warning');
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    // 先在编辑 DOM 消失前记录列表内光标位置，弹窗提交后的刀光留在原位。
    const editFeedbackPoint = MaweNinja.ninjaSplitPointFromRange(
      null, state.textEl, offset, String(state.textEl.innerText || '').length,
    );
    MaweInlineEdit.finishExtensionEdit(true);
    MaweSplitCore.openExtensionSplitModal(state.index, null, track, {
      extensionOffset: offset,
      feedbackPoint: editFeedbackPoint,
      ninjaFromList: true,
    });
    return;
  }
  if (MaweInlineEdit.editingState && !forceMainEdit) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'
    || (a.isContentEditable && !forceMainEdit))) return;
  if (MaweDom.replaceModal.classList.contains('show')) return;
  if (MaweDom.stickerModal.classList.contains('show')) return;
  if (MaweDom.stickerPreviewModal.classList.contains('show')) return;
  if (MaweDom.projectMediaModal.classList.contains('show')) return;
  if (document.getElementById('sticker-root-modal').classList.contains('show')) return;
  if (MaweDom.ctxmenu.classList.contains('show')) return;
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
  if (forceMainEdit) {
    e.preventDefault();
    e.stopImmediatePropagation();
    MaweSplitCore.splitAtCursor();
    return;
  }
  const splitAt = (idx, x, y, timeMs) => {
    e.preventDefault();
    // B 打开弹窗后，事件仍会继续传播到后面注册的弹窗快捷键监听器；
    // 立即停止同一事件，避免“按 B 打开”被误当成“按 B 确认”。
    e.stopImmediatePropagation();
    MaweSplitContext.splitFromContextMenu(idx, x, y, timeMs);
  };
  // 多重字幕下，只有副字幕是当前编辑焦点时，B 才直接打开副字幕拆分流程。
  // 绑定关系会让点击主字幕时同时选中副字幕；不能仅凭 selectedExtensionIdxs
  // 判断当前轨道，否则主字幕 active 时会被误判成副字幕单独拆分。
  const activeCuePanel = MaweCuePanel.getCurrentCuePanelTarget();
  const operationReference = MaweNavPreview.keyboardOperationReference();
  const pointerMainIndex = operationReference
    ? findWaveformCueAtTime(operationReference.timeMs, DATA.segments) : -1;
  const activeExtensionTrack = MaweMultiSubtitleCore.getActiveExtensionTrack();
  const pointerExtensionIndex = operationReference?.track === 'extension'
    ? findWaveformCueAtTime(operationReference.timeMs, MaweMultiSubtitleCore.getExtensionTrack(operationReference.trackId)?.segments) : -1;
  if (MaweSelection.selectedExtensionIdxs.size === 1) {
    const context = MaweNavPreview.hoveredSelectedCueContext();
    if (context?.kind === 'extension' && context.track?.segments?.[context.idx]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const initial = Number.isFinite(context.offset)
        ? {
          extensionOffset: context.offset,
          feedbackPoint: context.caretRect ? MaweNinja.ninjaSplitPointFromRect(context.caretRect) : null,
          ninjaFromList: true,
        } : {};
      MaweSplitCore.openExtensionSplitModal(context.idx, null, context.track, initial);
      return;
    }
  }
  // 波形区点击副字幕后，绑定关系可能同时选中主字幕；但只要当前面板和
  // 波形指针都明确落在这条单选副字幕上，B 就应拆分副字幕，而不是被重叠
  // 的主字幕时间范围抢走目标。主字幕面板仍不会进入这个例外分支。
  const waveformExtensionIsActive = MaweMultiSubtitleCore.multiSubtitleVisible()
    && activeCuePanel?.kind === 'extension'
    && MaweSelection.selectedExtensionIdxs.size === 1
    && MaweSelection.selectedExtensionIdxs.has(activeCuePanel.index)
    && operationReference?.track === 'extension'
    && pointerExtensionIndex === activeCuePanel.index;
  const extensionIsActive = MaweMultiSubtitleCore.multiSubtitleVisible()
    && activeCuePanel?.kind === 'extension'
    && MaweSelection.selectedExtensionIdxs.size === 1
    && MaweSelection.selectedExtensionIdxs.has(activeCuePanel.index)
    && (!operationReference || pointerMainIndex < 0 || waveformExtensionIsActive);
  if (extensionIsActive) {
    const extensionIndex = [...MaweSelection.selectedExtensionIdxs][0];
    const track = activeExtensionTrack;
    const extension = track?.segments?.[extensionIndex];
    if (!extension) return;
    let timeMs = null;
    const pointerElement = MaweNavPreview.lastPointerPos
      ? document.elementFromPoint(MaweNavPreview.lastPointerPos.x, MaweNavPreview.lastPointerPos.y)
      : null;
    if (MaweSettings.EDITOR_SETTINGS.keyboardOperationReference === 'pointer'
        && MaweNavPreview.lastPointerPos && (pointerElement?.closest('#waveform-pane') || MaweNavPreview.lastEditRegion === 'waveform')) {
      const pointerTimeMs = MaweCoreState.waveformEditor?.timeMsAtPoint?.(MaweNavPreview.lastPointerPos.x, MaweNavPreview.lastPointerPos.y);
      if (Number.isFinite(pointerTimeMs) && pointerTimeMs > extension.start && pointerTimeMs < extension.end) {
        timeMs = pointerTimeMs;
      }
    }
    e.preventDefault();
    // 同上：首次 B 只负责打开副字幕拆分弹窗。
    e.stopImmediatePropagation();
    MaweSplitCore.openExtensionSplitModal(
      extensionIndex,
      MaweSettings.EDITOR_SETTINGS.keyboardOperationReference === 'playhead'
        ? operationReference?.timeMs ?? null : timeMs,
      track,
    );
    return;
  }
  // 1) 字幕列表：需要单选 + 悬停提供文字位置
  if (MaweSelection.selectedIdxs.size === 1) {
    const context = MaweNavPreview.hoveredSelectedCueContext();
    if (context && DATA.segments[context.idx]) {
      splitAt(context.idx, context.x, context.y, null);
      return;
    }
  }
  // 2) 波形：指针音频位置
  if (operationReference?.source === 'pointer' || operationReference?.track === 'extension') {
    const idx = findWaveformCueAtTime(operationReference.timeMs, DATA.segments);
    if (idx >= 0) {
      splitAt(idx, 0, 0, operationReference.timeMs);
      return;
    }
    const extensionTrack = MaweMultiSubtitleCore.getActiveExtensionTrack();
    const extensionIndex = MaweMultiSubtitleCore.multiSubtitleVisible() && operationReference.track === 'extension'
      ? findWaveformCueAtTime(operationReference.timeMs, MaweMultiSubtitleCore.getExtensionTrack(operationReference.trackId)?.segments) : -1;
    if (extensionIndex >= 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      MaweSplitCore.openExtensionSplitModal(extensionIndex, operationReference.timeMs, MaweMultiSubtitleCore.getExtensionTrack(operationReference.trackId));
      return;
    }
    MaweHint.flashHint('指针位置没有可拆分字幕', 'invalid');
    return;
  }
  // 3) 播放头位置
  const timeMs = operationReference?.timeMs ?? Math.round(MaweCoreState.player.currentTime * 1000);
  const idx = DATA.segments.findIndex((segment) => timeMs > segment.start && timeMs < segment.end);
  if (idx >= 0) {
    splitAt(idx, 0, 0, timeMs);
    return;
  }
  const extensionTrack = MaweMultiSubtitleCore.getActiveExtensionTrack();
  const extensionIndex = MaweMultiSubtitleCore.multiSubtitleVisible()
    ? findWaveformCueAtTime(timeMs, extensionTrack?.segments) : -1;
  if (extensionIndex >= 0) {
    e.preventDefault();
    e.stopImmediatePropagation();
    MaweSplitCore.openExtensionSplitModal(extensionIndex, timeMs, extensionTrack);
    return;
  }
  MaweHint.flashHint('播放头位置没有可拆分字幕', 'invalid');
});

// 点击输入框外 -> 完成内联编辑。使用 pointerdown 捕获阶段，确保字幕行、
// 波形或其它控件的 pointerdown 处理/重绘发生前，当前文字已经写回 DATA。
// 双列时编辑行的容器同时包含主/副两列，因此只判断当前 contenteditable。
document.addEventListener('pointerdown', (e) => {
  const target = e.target instanceof Node ? e.target : null;
  if (MaweInlineEdit.editingState && (!target || !MaweInlineEdit.editingState.textEl.contains(target))) MaweInlineEdit.finishEdit(true);
  if (MaweInlineEdit.extensionEditingState && (
    !target || !MaweInlineEdit.extensionEditingState.textEl.contains(target)
  )) MaweInlineEdit.finishExtensionEdit(true);
}, true);
MaweAppearance.initializeSubtitleFontFamilyScanner();
MawePreviewGeometry.bindPreviewBoxPointerEvents(MaweDom.overlayEl, 'subtitle');

// --- 键盘操作（聚焦时），字幕预览与表情包预览共用 ---
// 方向键移动 1%；Shift 加速到 10%；Alt+方向缩放；Enter 切换 editable；Esc 失焦。
function handlePreviewBoxKeydown(event, target) {
  if (!MawePreviewGeometry.previewTargetEnabled(target)) return;
  const el = MawePreviewGeometry.previewTargetEl(target);
  if (event.key === 'Escape') { el.blur(); return; }
  if (event.key === 'Enter') {
    event.preventDefault();
    el.classList.toggle('editable');
    return;
  }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const dir = arrows[event.key];
  if (!dir) return;
  event.preventDefault();
  const step = event.shiftKey ? 0.10 : 0.01;
  const resize = event.altKey;  // Alt+方向缩放；否则移动
  const dx = dir[0] * step;
  const dy = dir[1] * step;
  const targetLabel = target === 'sticker' ? '表情包预览' : '字幕预览';
  MaweHistory.pushPreviewUndo((resize ? '缩放' : '移动') + targetLabel, MaweHistory.snapshotPreviewState());
  const startGeo = MawePreviewGeometry.getTargetGeometry(target);
  const next = resize
    ? MaweAppearance.GEO_UTILS.applyPreviewGeometryDelta(startGeo, dir[0] !== 0 ? 'e' : 's', dx, dy)
    : MaweAppearance.GEO_UTILS.applyPreviewGeometryDelta(startGeo, 'move', dx, dy);
  MawePreviewGeometry.setTargetGeometry(target, next);
}
MaweDom.overlayEl.addEventListener('keydown', (event) => handlePreviewBoxKeydown(event, 'subtitle'));

// 点击预览框（字幕/表情包）以外的地方：失焦并退出控制点编辑态，调整框随之隐藏。
// 捕获阶段监听，避免其他组件 pointerdown 的 stopPropagation 跳过失焦。
document.addEventListener('pointerdown', (event) => {
  if (MawePreviewGeometry.previewGesture) return;
  [MaweDom.overlayEl, MaweStickerOverlay.stickerOverlayLayer].forEach((el) => {
    if (el.contains(event.target)) return;
    el.classList.remove('editable');
    if (document.activeElement === el) el.blur();
  });
}, true);

// 播放器缩放时几何以百分比表达，天然自适应；ResizeObserver 仅在盒子越界后回钳。
if (typeof ResizeObserver === 'function') {
  const previewResizeObserver = new ResizeObserver(() => {
    MawePreviewGeometry.applyPreviewGeometryToDom(MaweAppearance.getPreviewGeometry());
  });
  previewResizeObserver.observe(MaweDom.playerStage);
}
MaweStickerOverlay.stickerOverlayLayer.id = 'sticker-overlay-layer';
MaweStickerOverlay.stickerOverlayLayer.className = 'geo-box';
MaweStickerOverlay.stickerOverlayLayer.tabIndex = 0;
MaweStickerOverlay.stickerOverlayLayer.setAttribute('role', 'group');
MaweStickerOverlay.stickerOverlayLayer.setAttribute('aria-label', '表情包预览位置。可拖动调整；方向键移动，按住 Shift 加速，按住 Alt 配合方向键调整大小，Enter 显示控制点，Esc 退出。');
MaweStickerOverlay.stickerOverlayContent.className = 'sticker-overlay-content';
MaweStickerOverlay.stickerOverlayLayer.appendChild(MaweStickerOverlay.stickerOverlayContent);
['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((h) => {
  const handle = document.createElement('span');
  handle.className = 'overlay-handle';
  handle.dataset.handle = h;
  MaweStickerOverlay.stickerOverlayLayer.appendChild(handle);
});
MaweDom.playerStage.appendChild(MaweStickerOverlay.stickerOverlayLayer);
MawePreviewGeometry.bindPreviewBoxPointerEvents(MaweStickerOverlay.stickerOverlayLayer, 'sticker');
MaweStickerOverlay.stickerOverlayLayer.addEventListener('keydown', (event) => handlePreviewBoxKeydown(event, 'sticker'));

MaweDom.stickerOverlayToggle?.addEventListener('change', () => {
  updateEditorSettings({ stickerOverlayEnabled: MaweDom.stickerOverlayToggle.checked });
  MawePreviewGeometry.refreshPreviewGeometryEditable();
  MawePlaybackLoop.update();
});

// 初次应用（不弄脏工程）：字幕与表情包预览几何。必须在 stickerOverlayLayer 创建之后执行（TDZ）。
MawePreviewGeometry.setPreviewGeometry(MaweAppearance.getPreviewGeometry(), { markDirty: false });
MawePreviewGeometry.setStickerGeometry(MawePreviewGeometry.getStickerGeometry(), { markDirty: false });
MawePreviewGeometry.refreshPreviewGeometryEditable();

MaweMediaPlayback.bindPlayerEvents(MaweCoreState.player);
MaweDom.overlayToggle.addEventListener('change', () => {
  // change 触发时 checked 已是新值；其它预览样式和副字幕开关仍从当前快照保留。
  const previous = MaweHistory.snapshotPreviewState();
  previous.overlay = !MaweDom.overlayToggle.checked;
  MaweHistory.pushPreviewUndo('切换字幕预览', previous);
  updateEditorSettings({ overlayEnabled: MaweDom.overlayToggle.checked });
  MawePreviewGeometry.refreshPreviewGeometryEditable();
  if (!MaweDom.overlayToggle.checked) MaweDom.overlayEl.classList.add('hidden');
  else MawePlaybackLoop.update();
});

function buildJson() {
  const repairedTimingCount = repairCurrentProjectTimings();
  if (repairedTimingCount > 0) {
    MaweHint.flashHint(`已自动修复 ${repairedTimingCount} 处异常时间码（保底 100ms）`, 'warning');
  }
  const out = {
    media: DATA.media || '',
    language: DATA.language || '',
    model: DATA.model || '',
    sticker_root: STICKER_ROOT || '',
    segments: DATA.segments.map(s => {
      const o = {
        id: s.id,
        start: s.start, end: s.end, text: s.text,
        items: s.items || [],
        sticker: s.sticker || null,
        sticker_ref: s.sticker_ref || null,
        color: s.color || null,
        color_ref: s.color_ref || null,
      };
      // 持久化"已改动"标记，便于二次打开时仍能识别脏行 / 离开提醒等
      if (s._dirty) o._dirty = true;
      // 持久化"禁用"标记（未禁用的不写字段，加载时默认 undefined=falsy 兼容旧工程）
      if (s.disabled) o.disabled = true;
      return o;
    }),
  };
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  out.multi_subtitle = {
    schema: multi.schema || MULTI_SUBTITLE_UTILS.MULTI_SUBTITLE_SCHEMA,
    enabled: multi.enabled === true,
    display_mode: multi.display_mode || 'both',
    main_split_mode: MaweMultiSubtitleCore.isConfiguredSubtitleSplitMode(multi.main_split_mode)
      ? multi.main_split_mode : MaweMultiSubtitleCore.getMainSubtitleSplitMode(DATA.segments[0]),
    tracks: (multi.tracks || []).map((track) => ({
      id: track.id,
      role: 'extension',
      name: track.name || '副字幕',
      language: track.language || '',
      split_mode: track.split_mode || 'word',
      source_name: track.source_name || '',
      segments: (track.segments || []).map((segment) => {
        const outSegment = {
          id: segment.id,
          start: segment.start,
          end: segment.end,
          text: segment.text || '',
        };
        if (Array.isArray(segment.items)) outSegment.items = segment.items;
        if (segment._dirty) outSegment._dirty = true;
        if (segment.disabled) outSegment.disabled = true;
        return outSegment;
      }),
    })),
    bindings: (multi.bindings || []).map((binding) => ({
      id: binding.id,
      track_id: binding.track_id,
      main_segment_ids: [...(binding.main_segment_ids || [])],
      extension_segment_ids: [...(binding.extension_segment_ids || [])],
      start_offset_ms: binding.start_offset_ms || 0,
      end_offset_ms: binding.end_offset_ms || 0,
    })),
  };
  if (DATA.waveform) out.waveform = DATA.waveform;
  if (DATA.spectral) out.spectral = DATA.spectral;
  if (DATA.waveform_reapeaks) out.waveform_reapeaks = DATA.waveform_reapeaks;
  if (DATA.gap_remove) out.gap_remove = MaweGapRemoveData.normalizedGapRemoveData(DATA.gap_remove);
  if (DATA.script_alignment) out.script_alignment = DATA.script_alignment;
  const workspace = MaweExportTimeline.buildCurrentWorkspaceData();
  if (workspace) out.workspace = workspace;
  // 预览几何：始终写入归一化后的当前几何，便于跨机/重开保持位置。
  const preview = { subtitle: { ...MaweAppearance.getPreviewGeometry(), ...MaweAppearance.getSubtitleAppearance() } };
  if (MaweMultiSubtitleCore.getActiveExtensionTrack() || DATA.preview?.extension_subtitle) {
    preview.extension_subtitle = { ...MaweAppearance.getStoredExtensionSubtitleAppearance() };
  }
  out.preview = preview;
  return JSON.stringify(out, null, 2);
}

// 保存/导出前的最后一道时间码兜底。波形拖动会把词时间码按像素取整，
// 极短词可能因此出现 1ms 的前后重叠；打开工程时的修复不足以覆盖这种
// “打开后编辑、随后保存”的路径。主轨和所有副字幕轨统一使用同一规则。
function normalizeProjectTimings(project, { repairSegmentRanges = true } = {}) {
  if (!project || typeof project !== 'object') return 0;
  const normalize = repairSegmentRanges
    ? window.AsrEditorUtils.normalizeSegmentTimings
    : window.AsrEditorUtils.normalizeItemTimingRanges;
  let fixed = normalize(project.segments);
  const tracks = project.multi_subtitle?.tracks;
  if (Array.isArray(tracks)) {
    tracks.forEach((track) => {
      fixed += normalize(track?.segments);
    });
  }
  return fixed;
}

function timingRepairSignature(segment) {
  return JSON.stringify({
    start: segment?.start,
    end: segment?.end,
    items: Array.isArray(segment?.items)
      ? segment.items.map((item) => ({ text: item?.text, start: item?.start, end: item?.end }))
      : null,
  });
}

function repairTimingGroup(segments) {
  const source = Array.isArray(segments) ? segments : [];
  const before = source.map((segment) => timingRepairSignature(segment));
  const fixed = window.AsrEditorUtils.normalizeItemTimingRanges(source);
  const changed = source.filter((segment, index) => (
    timingRepairSignature(segment) !== before[index]
  ));
  return { fixed, changed };
}

function repairCurrentProjectTimings() {
  const main = repairTimingGroup(DATA.segments);
  const extension = (MaweMultiSubtitleCore.getMultiSubtitleState().tracks || []).reduce((result, track) => {
    const repaired = repairTimingGroup(track?.segments);
    result.fixed += repaired.fixed;
    result.changed.push(...repaired.changed);
    return result;
  }, { fixed: 0, changed: [] });
  const fixed = main.fixed + extension.fixed;
  if (fixed > 0) {
    MaweMultiSubtitleCore.markMainSegmentsDirty(main.changed);
    extension.changed.forEach((segment) => { segment._dirty = true; });
    if (main.changed.length || extension.changed.length) MaweMultiSubtitleCore.markMultiSubtitleStateDirty();
    MaweMultiSubtitleCore.syncBindingOffsets();
  }
  return fixed;
}

let projectImportDirty = false;
let projectCheckpointed = Boolean(SERVER_CONFIG?.canSave)
  || !document.getElementById('json-name')?.classList.contains('empty');
let projectCheckpointInFlight = false;
// 浏览器「新建工程 / 另存为」选择的文件由页面持有 FileSystemFileHandle 持续写回；
// Server 绑定的工程仍由服务器按真实路径原子保存，且优先级高于句柄。
let projectFileHandle = null;

function serverProjectSavingEnabled() {
  return !!(SERVER_CONFIG && SERVER_CONFIG.saveUrl && SERVER_CONFIG.canSave);
}

function projectSaveTargetEnabled() {
  return serverProjectSavingEnabled() || projectFileHandle !== null;
}

function parseProjectValidationTarget(detail) {
  const value = String(detail || '');
  const mainMatch = /^\$\.segments\[(\d+)\](?:\.items\[(\d+)\])?(?:\.[A-Za-z_]\w*)?\s*:/.exec(value);
  const extensionMatch = /^\$\.multi_subtitle\.tracks\[(\d+)\]\.segments\[(\d+)\](?:\.items\[(\d+)\])?(?:\.[A-Za-z_]\w*)?\s*:/.exec(value);
  if (!mainMatch && !extensionMatch) return null;
  const kind = mainMatch ? 'main' : 'extension';
  const trackIndex = extensionMatch ? Number(extensionMatch[1]) : null;
  const segmentIndex = Number(mainMatch ? mainMatch[1] : extensionMatch[2]);
  const itemValue = mainMatch ? mainMatch[2] : extensionMatch[3];
  const itemIndex = itemValue === undefined ? null : Number(itemValue);
  const track = extensionMatch ? MaweMultiSubtitleCore.getMultiSubtitleState().tracks?.[trackIndex] : null;
  const segments = kind === 'main' ? DATA.segments : (track?.segments || []);
  const segment = segments[segmentIndex];
  if (!segment) return null;
  const item = itemIndex === null
    ? null
    : (Array.isArray(segment.items) ? segment.items[itemIndex] : null);
  return {
    kind,
    trackIndex,
    track,
    segments,
    segmentIndex,
    itemIndex,
    segment,
    item: item && typeof item === 'object' ? item : null,
  };
}

function validationPreviewText(target) {
  const value = target.item?.text ?? target.segment.text;
  if (typeof value === 'string') return value || '（空）';
  try {
    return JSON.stringify(target.item || target.segment);
  } catch (_) {
    return '（无法预览）';
  }
}

function projectSegmentOverlap(target) {
  const segments = target?.segments;
  const currentIndex = Number(target?.segmentIndex);
  if (!Array.isArray(segments) || !Number.isInteger(currentIndex) || currentIndex <= 0) return null;
  const previous = segments[currentIndex - 1];
  const current = segments[currentIndex];
  const previousEnd = Number(previous?.end);
  const currentStart = Number(current?.start);
  const overlapMs = Math.round(previousEnd - currentStart);
  if (!previous || !current || !Number.isFinite(overlapMs) || overlapMs <= 0) return null;
  return {
    previousIndex: currentIndex - 1,
    currentIndex,
    previous,
    current,
    overlapMs,
  };
}

function repairProjectSegmentOverlap(target, mode, card) {
  const segments = target?.segments;
  const currentIndex = Number(target?.segmentIndex);
  if (!Array.isArray(segments)) return false;
  let previewSegments;
  try {
    previewSegments = JSON.parse(JSON.stringify(segments));
  } catch (_) {
    MaweHint.flashHint('无法准备时间范围修复，请先关闭提示后手动调整字幕边界', 'warning');
    return false;
  }
  const preview = window.AsrEditorUtils.repairSegmentOverlap(previewSegments, currentIndex, mode);
  if (!preview?.changed) {
    MaweHint.flashHint('当前字幕边界已经发生变化，请重新保存并查看最新的校验提示', 'warning');
    return false;
  }

  MaweHistory.pushUndo('修复字幕时间重叠', { captureView: true });
  const result = window.AsrEditorUtils.repairSegmentOverlap(segments, currentIndex, mode);
  if (!result?.changed) {
    MaweHint.flashHint('当前字幕边界已经发生变化，修复未应用', 'warning');
    return false;
  }
  const changedSegments = (result.changedIndices || [])
    .map((index) => segments[index])
    .filter(Boolean);
  if (target.kind === 'main') MaweMultiSubtitleCore.markMainSegmentsDirty(changedSegments);
  else changedSegments.forEach((segment) => { segment._dirty = true; });
  MaweMultiSubtitleCore.syncBindingOffsets();
  if (target.kind === 'extension' || MaweMultiSubtitleCore.getMultiSubtitleState().tracks?.length) {
    MaweMultiSubtitleCore.markMultiSubtitleStateDirty();
  }
  MaweCuePanel.renderAll({ waveform: 'overlay' });
  MawePlaybackLoop.updateWithoutCueListAutoScroll();
  MaweHistory.updateUndoRedoButtons();
  MaweHint.dismissHintCard(card);
  const suffix = result.itemsCleared
    ? '，已清除受影响字幕的字词时间码'
    : '';
  MaweHint.flashHint(`已修复字幕时间重叠${suffix}，正在重新保存`, result.itemsCleared ? 'warning' : 'success');
  window.setTimeout(() => { void saveCurrentProject({ silent: false }); }, 0);
  return true;
}

function focusProjectValidationTarget(target) {
  const { segmentIndex, segment } = target || {};
  const segments = target?.segments || DATA.segments;
  if (!segment || !segments[segmentIndex]) return;

  // 校验错误不能因为用户当前的筛选状态而再次变得不可见。
  if (MaweDom.hideDisabled && segment.disabled) {
    MaweDom.hideDisabled = false;
    MaweDom.hideDisabledToggle.checked = false;
    MaweCoreState.container.classList.remove('hide-disabled');
  }
  const cueSelector = target.kind === 'extension'
    ? `.cue[data-ext-idx="${segmentIndex}"]`
    : `.cue[data-idx="${segmentIndex}"]`;
  const cueBeforeFilter = MaweCoreState.container.querySelector(cueSelector);
  if (cueBeforeFilter?.classList.contains('hidden')) {
    MaweDom.searchEl.value = '';
    MaweSearch.refreshSearchClearVisibility();
    const filterOver = document.getElementById('filter-over');
    if (filterOver?.classList.contains('active')) filterOver.classList.remove('active');
    MaweSearch.applySearch('');
  }

  if (target.kind === 'extension') {
    MaweSelection.selectOnlyExtension(segmentIndex, target.track || MaweMultiSubtitleCore.getActiveExtensionTrack());
    MaweSelection.lastClickedExtensionIdx = segmentIndex;
  } else {
    MaweSelection.selectOnly(segmentIndex);
    MaweSelection.lastClickedIdx = segmentIndex;
  }
  const cue = MaweCoreState.container.querySelector(cueSelector);
  if (cue) {
    cue.classList.remove('validation-target');
    // 重新触发一次短暂的高亮，即使用户连续点击多个错误提示也能看出目标。
    void cue.offsetWidth;
    cue.classList.add('validation-target');
    MaweCueListAnchor.scrollCueToCenter(cue);
    window.setTimeout(() => cue.classList.remove('validation-target'), 2200);
  }
  MaweCoreState.waveformEditor?.revealTime(segment.start, true);
  if (MaweMediaPlayback.hasLoadedMedia()) seekFromWaveform(segment.start / 1000);
}

function showProjectSaveError(detail) {
  const target = parseProjectValidationTarget(detail);
  if (!target) {
    MaweHint.flashHint(`保存失败：${detail}`, 'warning');
    return;
  }

  MaweHint.flashHint('', 'warning', {
    durationMs: 12000,
    contentBuilder: (card) => {
      card.classList.add('hint-project-error');

      const header = document.createElement('div');
      header.className = 'hint-project-header';
      const title = document.createElement('strong');
      title.textContent = '保存失败';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'hint-close';
      close.setAttribute('aria-label', '关闭提示');
      close.textContent = '×';
      close.addEventListener('click', () => MaweHint.dismissHintCard(card));
      header.append(title, close);

      const detailEl = document.createElement('code');
      detailEl.className = 'hint-project-detail';
      detailEl.textContent = String(detail || '未知校验错误');

      const location = document.createElement('div');
      location.className = 'hint-project-location';
      location.textContent = target.itemIndex === null
        ? `第 ${target.segmentIndex + 1} 条字幕`
        : `第 ${target.segmentIndex + 1} 条字幕 · item ${target.itemIndex + 1}`;

      const previewLabel = document.createElement('div');
      previewLabel.className = 'hint-project-preview-label';
      previewLabel.textContent = target.itemIndex === null ? '字幕内容' : 'item 内容';
      const preview = document.createElement('div');
      preview.className = 'hint-project-preview-value';
      preview.textContent = validationPreviewText(target);

      const overlapElements = [];
      const overlap = projectSegmentOverlap(target);
      if (overlap) {
        const conflict = document.createElement('div');
        conflict.className = 'hint-project-conflict';
        conflict.textContent = `第 ${overlap.previousIndex + 1} 条字幕结束于 ${MaweCueElements.fmtShort(overlap.previous.end)}，第 ${overlap.currentIndex + 1} 条字幕开始于 ${MaweCueElements.fmtShort(overlap.current.start)}，重叠 ${overlap.overlapMs}ms。`;

        const repairDescription = document.createElement('div');
        repairDescription.className = 'hint-project-repair-description';
        repairDescription.textContent = overlap.overlapMs <= PROJECT_SEGMENT_OVERLAP_AUTO_FIX_MAX_MS
          ? `这是小于等于 ${PROJECT_SEGMENT_OVERLAP_AUTO_FIX_MAX_MS}ms 的边界误差，可以安全把后句起点吸附到前句终点。`
          : `重叠超过 ${PROJECT_SEGMENT_OVERLAP_AUTO_FIX_MAX_MS}ms，请确认要保留哪一侧的时间边界；修复后会自动再次保存。`;

        const repairActions = document.createElement('div');
        repairActions.className = 'hint-project-actions';
        const addRepairButton = (className, text, mode) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `hint-project-action ${className}`;
          button.textContent = text;
          button.addEventListener('click', () => {
            button.disabled = true;
            if (!repairProjectSegmentOverlap(target, mode, card)) button.disabled = false;
          });
          repairActions.appendChild(button);
        };
        if (overlap.overlapMs <= PROJECT_SEGMENT_OVERLAP_AUTO_FIX_MAX_MS) {
          addRepairButton(
            'hint-project-repair-auto',
            `自动修复：推迟第 ${overlap.currentIndex + 1} 条字幕（${overlap.overlapMs}ms）`,
            'shift-current',
          );
        } else {
          addRepairButton('hint-project-repair-trim', '缩短前一句', 'trim-previous');
          addRepairButton('hint-project-repair-shift', '推迟后一句', 'shift-current');
        }
        overlapElements.push(conflict, repairDescription, repairActions);
      }

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'hint-project-action';
      action.textContent = `定位到第 ${target.segmentIndex + 1} 条字幕`;
      action.addEventListener('click', () => {
        focusProjectValidationTarget(target);
        MaweHint.dismissHintCard(card);
      });

      card.append(header, detailEl, location, previewLabel, preview, ...overlapElements, action);
    },
  });
}

function configureServerSaveControls() {
  const hasServer = !!(SERVER_CONFIG && SERVER_CONFIG.saveUrl);
  // 浏览器持有工程句柄时同样显示保存控件；服务器绑定优先于句柄。
  if (MaweDom.saveProjectDropdown) MaweDom.saveProjectDropdown.hidden = !(hasServer || projectFileHandle !== null);
  [MaweDom.saveProjectButton, document.getElementById('save-project-menu-btn')].forEach((button) => {
    if (!button) return;
    button.disabled = !projectSaveTargetEnabled();
     if (!projectSaveTargetEnabled()) button.title = '当前服务器未绑定工程；请先导出 .mosp，再重新打开该文件';
  });
  if (MaweDom.saveProjectButton && projectSaveTargetEnabled()) {
    MaweDom.saveProjectButton.title = '保存回当前工程文件（Ctrl(Cmd)+S）';
  }
  // 另存为走系统文件对话框，不依赖服务器绑定，始终可用。
  if (MaweDom.saveProjectAsButton) {
    MaweDom.saveProjectAsButton.title = '另存为工程文件（Ctrl(Cmd)+Shift+S）';
  }
  syncStickerOtioExportMode();
}

let autoSaveTimer = null;
let autoSaveFlushTimer = null;
let projectSaveInFlight = false;
const EDIT_SAVE_DEBOUNCE_MS = 400;

function scheduleAutoSave() {
  if (autoSaveTimer !== null) {
    window.clearInterval(autoSaveTimer);
    autoSaveTimer = null;
  }
  if (!projectSaveTargetEnabled() || !MaweSettings.EDITOR_SETTINGS.autoSaveProject) return;
  autoSaveTimer = window.setInterval(() => {
    if (hasUnsavedProjectChanges() && !projectSaveInFlight && !projectCheckpointInFlight) {
      void saveCurrentProject({ silent: true });
    }
  }, MaweSettings.EDITOR_SETTINGS.autoSaveIntervalSeconds * 1000);
}

  function configureServerAutoSave() {
    if (!MaweDom.serverAutoSaveSettings || !MaweDom.autoSaveProjectToggle || !MaweDom.autoSaveIntervalField || !MaweDom.autoSaveIntervalInput) return;
    // 服务器绑定工程或浏览器保存对话框（句柄模式）任一可用时都可自动保存。
    const available = Boolean(SERVER_CONFIG?.saveUrl || window.showSaveFilePicker);
    MaweDom.serverAutoSaveSettings.hidden = !available;
    if (!available) return;
  const sync = () => {
    MaweDom.autoSaveProjectToggle.checked = MaweSettings.EDITOR_SETTINGS.autoSaveProject;
    MaweDom.autoSaveIntervalInput.value = String(MaweSettings.EDITOR_SETTINGS.autoSaveIntervalSeconds);
    MaweDom.autoSaveIntervalField.hidden = !MaweSettings.EDITOR_SETTINGS.autoSaveProject;
    MaweDom.autoSaveProjectToggle.disabled = false;
    MaweDom.autoSaveIntervalInput.disabled = !MaweSettings.EDITOR_SETTINGS.autoSaveProject;
  };
  sync();
  MaweDom.autoSaveProjectToggle.addEventListener('change', () => {
    updateEditorSettings({ autoSaveProject: MaweDom.autoSaveProjectToggle.checked });
    sync();
    scheduleAutoSave();
  });
  MaweDom.autoSaveIntervalInput.addEventListener('change', () => {
    updateEditorSettings({ autoSaveIntervalSeconds: MaweSettings.clampAutoSaveInterval(MaweDom.autoSaveIntervalInput.value) });
    sync();
    scheduleAutoSave();
  });
  scheduleAutoSave();
}

function hasUnsavedProjectChanges() {
  const multiDirty = Boolean(DATA.multi_subtitle?._dirty)
    || (DATA.multi_subtitle?.tracks || []).some((track) => track.segments?.some((segment) => segment._dirty));
  return projectImportDirty || MaweHistory.gapRemoveDirty || MaweAppearance.previewGeometryDirty
    || DATA.segments.some((segment) => segment._dirty)
    || multiDirty;
}

// 文字编辑先写入页面内存，避免每个按键都请求服务器；失焦后短暂防抖保存，
// 这样点击其它字幕或刷新页面时不会因为 30 秒定时保存尚未到点而丢失刚完成的修改。
function scheduleAutoSaveFlush() {
  if (autoSaveFlushTimer !== null) {
    window.clearTimeout(autoSaveFlushTimer);
    autoSaveFlushTimer = null;
  }
  if (!projectSaveTargetEnabled() || !MaweSettings.EDITOR_SETTINGS.autoSaveProject) return;
  autoSaveFlushTimer = window.setTimeout(() => {
    autoSaveFlushTimer = null;
    if (hasUnsavedProjectChanges() && !projectSaveInFlight) {
      void saveCurrentProject({ silent: true });
    }
  }, EDIT_SAVE_DEBOUNCE_MS);
}

async function openRecentProject(project) {
  if (!SERVER_CONFIG?.recentProjectsUrl) return;
  if (hasUnsavedProjectChanges()
      && !confirm('当前有未保存的改动，是否确定打开最近工程？将丢失未保存内容。')) {
    return;
  }
  try {
    const response = await fetch(SERVER_CONFIG.recentProjectsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: project.path }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      const error = new Error(result.error || `服务器返回 ${response.status}`);
      error.missing = result.missing === true;
      throw error;
    }
    window.location.reload();
  } catch (error) {
    if (error?.missing) {
      project.exists = false;
      markRecentProjectMissing(project);
    }
    MaweHint.flashHint(`打开工程失败：${error.message || error}`, 'warning');
  }
}

// 浏览器文件选择器拿不到工程的真实路径，但 MAW 工程记录的媒体是绝对路径。
// 把工程名与内容交给服务器，由它定位同目录同名工程并接管：
// 成功后整页刷新，由服务器渲染出自动加载媒体且可直接保存的状态。
// 任何失败都静默回退为「手动选择媒体」的便携流程。
async function attachProjectToServer(fileName, projectData) {
  try {
    const response = await fetch(SERVER_CONFIG.attachUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, project: projectData }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) return false;
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

function renderMissingRecentProjectItem(item, project) {
  item.className = 'dropdown-item is-missing';
  item.style.cursor = 'not-allowed';
  item.replaceChildren();
  const label = document.createElement('span');
  label.className = 'recent-project-name';
  label.textContent = project.name;
  item.appendChild(label);
  const badge = document.createElement('span');
  badge.className = 'recent-project-badge is-missing';
  badge.textContent = '已失效';
  item.appendChild(badge);
  item.title = `工程路径失效：${project.path}`;
}

function markRecentProjectMissing(project) {
  if (!MaweDom.recentProjectsList || !project || typeof project.path !== 'string') return;
  const item = Array.from(MaweDom.recentProjectsList.children)
    .find((candidate) => candidate.dataset.projectPath === project.path);
  if (item) renderMissingRecentProjectItem(item, project);
}

function configureRecentProjects() {
  if (!SERVER_CONFIG?.recentProjectsUrl || !MaweDom.recentProjectsEl || !MaweDom.recentProjectsToggle
      || !MaweDom.recentProjectsMenu || !MaweDom.recentProjectsList) {
    return;
  }
  const projects = Array.isArray(SERVER_CONFIG.recentProjects) ? SERVER_CONFIG.recentProjects : [];
  MaweDom.recentProjectsEl.hidden = false;
  MaweDom.recentProjectsList.replaceChildren();
  if (MaweDom.recentProjectsSeparator) MaweDom.recentProjectsSeparator.hidden = !projects.length;
  projects.forEach((project, index) => {
    if (!project || typeof project.path !== 'string' || typeof project.name !== 'string') return;
    const item = document.createElement('div');
    item.dataset.projectPath = project.path;
    if (project.exists === false) {
      renderMissingRecentProjectItem(item, project);
    } else {
      item.className = 'dropdown-item';
      // 工程名与其它项一致占正文；「上次打开」只作为右侧徽标标记，不写进名字
      const label = document.createElement('span');
      label.className = 'recent-project-name';
      label.textContent = project.name;
      item.appendChild(label);
      if (index === 0) {
        const badge = document.createElement('span');
        badge.className = 'recent-project-badge';
        badge.textContent = '上次打开';
        item.appendChild(badge);
      }
      item.title = project.path;
    }
    item.addEventListener('click', () => {
      MaweDom.recentProjectsEl.classList.remove('open');
      if (item.classList.contains('is-missing')) {
        MaweHint.flashHint('工程路径失效，文件可能已被移动或删除', 'warning');
        return;
      }
      openRecentProject(project);
    });
    MaweDom.recentProjectsList.appendChild(item);
  });
  if (MaweDom.recentProjectsEl.dataset.listenersBound !== 'true') {
    MaweDom.recentProjectsToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      MaweDom.recentProjectsEl.classList.toggle('open');
    });
    document.addEventListener('click', (event) => {
      if (!MaweDom.recentProjectsEl.contains(event.target)) MaweDom.recentProjectsEl.classList.remove('open');
    });
    MaweDom.recentProjectsEl.dataset.listenersBound = 'true';
  }
}

function configureServerProjectSettings() {
  if (!SERVER_CONFIG?.settingsUrl || !MaweDom.serverProjectSettingsEl || !MaweDom.autoOpenLastProjectToggle) return;
  MaweDom.serverProjectSettingsEl.hidden = false;
  MaweDom.autoOpenLastProjectToggle.checked = SERVER_CONFIG.autoOpenLastProject !== false;
  if (MaweDom.autoOpenLastProjectToggle.dataset.listenersBound !== 'true') {
    MaweDom.autoOpenLastProjectToggle.addEventListener('change', async () => {
      const enabled = MaweDom.autoOpenLastProjectToggle.checked;
      MaweDom.autoOpenLastProjectToggle.disabled = true;
      try {
        const response = await fetch(SERVER_CONFIG.settingsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoOpenLastProject: enabled }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || `服务器返回 ${response.status}`);
        }
        SERVER_CONFIG.autoOpenLastProject = result.autoOpenLastProject;
      } catch (error) {
        MaweDom.autoOpenLastProjectToggle.checked = SERVER_CONFIG.autoOpenLastProject !== false;
        MaweHint.flashHint(`保存设置失败：${error.message || error}`, 'warning');
      } finally {
        MaweDom.autoOpenLastProjectToggle.disabled = false;
      }
    });
    MaweDom.autoOpenLastProjectToggle.dataset.listenersBound = 'true';
  }
}

// === 工作区库：服务器版可把工作区（窗口布局 + 显示状态）保存到本机设置，跨工程复用 ===
const BUILTIN_WORKSPACE_IDS = window.AsrWaveform?.builtinWorkspaceIds || ['classic', 'wave-right', 'three-fold', 'cinema'];
let currentServerWorkspaceName = '';
let currentBuiltinWorkspaceName = '';
const workspacePresetSelect = document.getElementById('workspace-preset');
const saveWorkspaceButton = document.getElementById('workspace-save');
const saveWorkspaceAsButton = document.getElementById('workspace-save-as');
const deleteWorkspaceButton = document.getElementById('workspace-delete');

function getSavedServerWorkspaces() {
  return SERVER_CONFIG?.savedWorkspaces && typeof SERVER_CONFIG.savedWorkspaces === 'object'
    ? SERVER_CONFIG.savedWorkspaces : {};
}

function getSavedPresetWorkspaces() {
  return SERVER_CONFIG?.presetWorkspaces && typeof SERVER_CONFIG.presetWorkspaces === 'object'
    ? SERVER_CONFIG.presetWorkspaces : {};
}

// 覆盖可能只存导航状态（后端自动创建），没有布局数据；只有含 navigation
// 以外字段的覆盖才能作为布局来源，否则退回内置默认布局。
function presetWorkspaceHasLayout(workspace) {
  return Boolean(workspace) && Object.keys(workspace).some((key) => key !== 'navigation');
}

function currentWorkspaceDisplayName() {
  const selected = workspacePresetSelect?.selectedOptions?.[0];
  return selected?.textContent?.trim() || currentServerWorkspaceName || currentBuiltinWorkspaceName || '当前工作区';
}

function refreshWorkspaceSelect() {
  if (!workspacePresetSelect) return;
  const workspaces = getSavedServerWorkspaces();
  workspacePresetSelect.querySelector('optgroup[data-saved-workspaces]')?.remove();
  const names = Object.keys(workspaces).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (names.length) {
    const group = document.createElement('optgroup');
    group.label = '已保存工作区';
    group.dataset.savedWorkspaces = 'true';
    names.forEach((name) => group.append(new Option(name, `saved:${name}`)));
    workspacePresetSelect.append(group);
  }
  if (currentServerWorkspaceName && workspaces[currentServerWorkspaceName]) {
    workspacePresetSelect.value = `saved:${currentServerWorkspaceName}`;
  }
}

function syncWorkspaceControls() {
  const hasServerLibrary = Boolean(SERVER_CONFIG?.settingsUrl && MaweCoreState.waveformEditor);
  const isEditing = MaweCoreState.waveformEditor?.isCustomLayout?.() === true;
  const hasCustomWorkspace = Boolean(currentServerWorkspaceName && getSavedServerWorkspaces()[currentServerWorkspaceName]);
  const hasBuiltinWorkspace = Boolean(currentBuiltinWorkspaceName);
  if (saveWorkspaceButton) saveWorkspaceButton.hidden = !hasServerLibrary || !isEditing || (!hasCustomWorkspace && !hasBuiltinWorkspace);
  if (saveWorkspaceAsButton) saveWorkspaceAsButton.hidden = !hasServerLibrary || !isEditing;
  if (deleteWorkspaceButton) deleteWorkspaceButton.hidden = !hasServerLibrary || !isEditing || !hasCustomWorkspace;
}

function restoreWorkspaceSelection() {
  const selectedPreset = DATA.workspace?.selectedPreset;
  if (typeof selectedPreset !== 'string' || !workspacePresetSelect) return;
  if (selectedPreset.startsWith('saved:')) {
    const name = selectedPreset.slice('saved:'.length);
    if (getSavedServerWorkspaces()[name]) {
      currentServerWorkspaceName = name;
      currentBuiltinWorkspaceName = '';
      refreshWorkspaceSelect();
    }
    return;
  }
  if (BUILTIN_WORKSPACE_IDS.includes(selectedPreset)) {
    currentServerWorkspaceName = '';
    currentBuiltinWorkspaceName = selectedPreset;
    workspacePresetSelect.value = selectedPreset;
  }
}

async function updateServerWorkspaceSettings(payload) {
  const response = await fetch(SERVER_CONFIG.settingsUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || `服务器返回 ${response.status}`);
  SERVER_CONFIG.savedWorkspaces = result.savedWorkspaces || {};
  SERVER_CONFIG.presetWorkspaces = result.presetWorkspaces || {};
  SERVER_CONFIG.activeWorkspaceName = result.activeWorkspaceName || '';
  SERVER_CONFIG.autoOpenLastProject = result.autoOpenLastProject !== false;
  return result;
}

function currentWorkspaceNavigation() {
  const snapshot = MaweCoreState.waveformEditor?.getNavigationSnapshot?.();
  const cueListScrollTop = Math.max(0, Math.round(Number(MaweCoreState.container?.scrollTop) || 0));
  return {
    ...(snapshot || {}),
    cueListScrollTop,
  };
}

async function saveWorkspaceNavigation(target) {
  if (!target || !SERVER_CONFIG?.settingsUrl || !MaweCoreState.waveformEditor) return;
  const navigation = currentWorkspaceNavigation();
  try {
    const result = await updateServerWorkspaceSettings({
      updateWorkspaceNavigation: { ...target, navigation },
    });
    SERVER_CONFIG.savedWorkspaces = result.savedWorkspaces || {};
    SERVER_CONFIG.presetWorkspaces = result.presetWorkspaces || {};
  } catch (error) {
    MaweHint.flashHint(`记住工作区导航失败：${error.message || error}`, 'warning');
  }
}

function restoreWorkspaceNavigation(workspace) {
  MaweCoreState.waveformEditor?.restoreNavigation?.(workspace?.navigation);
}

async function saveCurrentWorkspace({ saveAs }) {
  if (!MaweCoreState.waveformEditor || !SERVER_CONFIG?.settingsUrl) return;
  let name = currentServerWorkspaceName;
  if (saveAs) {
    name = prompt('请输入工作区名称：', '我的工作区')?.trim() || '';
    if (!name) return;
  }
  if (!name && !currentBuiltinWorkspaceName) return;
  const displayName = saveAs ? name : currentWorkspaceDisplayName();
  const button = saveAs ? saveWorkspaceAsButton : saveWorkspaceButton;
  if (button) button.disabled = true;
  try {
    const workspace = MaweExportTimeline.buildCurrentWorkspaceData();
    if (saveAs) {
      await updateServerWorkspaceSettings({ saveWorkspace: { name, workspace, overwrite: false } });
      SERVER_CONFIG.savedWorkspaces = { ...getSavedServerWorkspaces(), [name]: workspace };
      currentServerWorkspaceName = name;
      currentBuiltinWorkspaceName = '';
    } else if (currentServerWorkspaceName) {
      await updateServerWorkspaceSettings({ saveWorkspace: { name, workspace, overwrite: true } });
      SERVER_CONFIG.savedWorkspaces = { ...getSavedServerWorkspaces(), [name]: workspace };
    } else {
      await updateServerWorkspaceSettings({ savePresetWorkspace: { preset: currentBuiltinWorkspaceName, workspace } });
      SERVER_CONFIG.presetWorkspaces = { ...getSavedPresetWorkspaces(), [currentBuiltinWorkspaceName]: workspace };
    }
    refreshWorkspaceSelect();
    syncWorkspaceControls();
    MaweHint.flashHint(saveAs ? `已另存工作区：${displayName}` : `已保存工作区：${displayName}`, 'success');
  } catch (error) {
    MaweHint.flashHint(`保存工作区失败：${error.message || error}`, 'warning');
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteCurrentServerWorkspace() {
  const name = currentServerWorkspaceName;
  if (!name || !SERVER_CONFIG?.settingsUrl || !confirm(`确定删除工作区「${name}」吗？`)) return;
  deleteWorkspaceButton.disabled = true;
  try {
    await updateServerWorkspaceSettings({ deleteWorkspaceName: name });
    currentServerWorkspaceName = '';
    refreshWorkspaceSelect();
    syncWorkspaceControls();
    MaweHint.flashHint(`已删除工作区：${name}`, 'success');
  } catch (error) {
    MaweHint.flashHint(`删除工作区失败：${error.message || error}`, 'warning');
  } finally {
    deleteWorkspaceButton.disabled = false;
  }
}

// 应用一次下拉选择：saved:* 从本机库恢复；内置 id 优先用本机覆盖版，否则用默认定义。
// 工作区 = 窗口布局 + 显示状态，切换时同时恢复该工作区保存的显示开关。
async function applyWorkspaceSelection(preset) {
  const previousTarget = currentServerWorkspaceName
    ? { name: currentServerWorkspaceName }
    : currentBuiltinWorkspaceName ? { preset: currentBuiltinWorkspaceName } : null;
  if (previousTarget && (preset !== `saved:${currentServerWorkspaceName}`
      && preset !== currentBuiltinWorkspaceName)) {
    await saveWorkspaceNavigation(previousTarget);
  }
  if (preset.startsWith('saved:')) {
    const name = preset.slice('saved:'.length);
    const workspace = getSavedServerWorkspaces()[name];
    if (!workspace) return;
    MaweCoreState.waveformEditor.setLayoutData({ ...workspace, selectedPreset: `saved:${name}` });
    MaweDisplaySettings.applyEditorDisplaySettings(workspace.editorDisplay);
    restoreWorkspaceNavigation(workspace);
    currentServerWorkspaceName = name;
    currentBuiltinWorkspaceName = '';
    refreshWorkspaceSelect();
    syncWorkspaceControls();
    void updateServerWorkspaceSettings({ activeWorkspaceName: name }).catch((error) => {
      MaweHint.flashHint(`记住工作区失败：${error.message || error}`, 'warning');
    });
    MaweHint.flashHint(`已应用工作区：${name}`, 'success');
    return;
  }
  if (!BUILTIN_WORKSPACE_IDS.includes(preset)) return;
  currentServerWorkspaceName = '';
  currentBuiltinWorkspaceName = preset;
  const savedPreset = getSavedPresetWorkspaces()[preset];
  const layoutPreset = presetWorkspaceHasLayout(savedPreset) ? savedPreset : null;
  if (layoutPreset) MaweCoreState.waveformEditor.setLayoutData(layoutPreset);
  else MaweCoreState.waveformEditor.setLayout(preset);
  MaweDisplaySettings.applyEditorDisplaySettings(
    savedPreset?.editorDisplay || window.AsrWaveform?.builtinWorkspaces?.[preset]?.editorDisplay,
  );
  workspacePresetSelect.value = preset;
  restoreWorkspaceNavigation(savedPreset);
  refreshWorkspaceSelect();
  syncWorkspaceControls();
  void updateServerWorkspaceSettings({ activeWorkspaceName: '' }).catch((error) => {
    MaweHint.flashHint(`记住工作区失败：${error.message || error}`, 'warning');
  });
}

function configureServerWorkspaceLibrary() {
  if (!SERVER_CONFIG?.settingsUrl || !MaweCoreState.waveformEditor) return;
  const savedSelection = DATA.workspace?.selectedPreset;
  currentServerWorkspaceName = typeof savedSelection === 'string' && savedSelection.startsWith('saved:')
    && getSavedServerWorkspaces()[savedSelection.slice('saved:'.length)]
    ? savedSelection.slice('saved:'.length)
    : !savedSelection && getSavedServerWorkspaces()[SERVER_CONFIG.activeWorkspaceName]
      ? SERVER_CONFIG.activeWorkspaceName : '';
  const initialPreset = typeof savedSelection === 'string' && !savedSelection.startsWith('saved:')
    ? savedSelection : DATA.workspace?.preset;
  currentBuiltinWorkspaceName = currentServerWorkspaceName ? ''
    : BUILTIN_WORKSPACE_IDS.includes(initialPreset) ? initialPreset : 'wave-right';
  if (!savedSelection && currentBuiltinWorkspaceName && presetWorkspaceHasLayout(getSavedPresetWorkspaces()[currentBuiltinWorkspaceName])) {
    MaweCoreState.waveformEditor.setLayoutData(getSavedPresetWorkspaces()[currentBuiltinWorkspaceName]);
    if (workspacePresetSelect) workspacePresetSelect.value = currentBuiltinWorkspaceName;
  }
  refreshWorkspaceSelect();
  restoreWorkspaceSelection();
  if (workspacePresetSelect?.dataset.listenersBound !== 'true') {
    workspacePresetSelect?.addEventListener('change', () => applyWorkspaceSelection(workspacePresetSelect.value));
    document.getElementById('layout-edit-toggle')?.addEventListener('click', () => {
      // 拖放编辑只改窗口排列，不改变下拉框当前选中的工作区名称。
      if (currentServerWorkspaceName) refreshWorkspaceSelect();
      else if (currentBuiltinWorkspaceName && workspacePresetSelect) workspacePresetSelect.value = currentBuiltinWorkspaceName;
      syncWorkspaceControls();
    });
    document.getElementById('layout-reset')?.addEventListener('click', () => {
      const preset = currentBuiltinWorkspaceName;
      if (preset) {
        MaweCoreState.waveformEditor.setLayout(preset);
        void updateServerWorkspaceSettings({ resetPresetWorkspace: preset }).then(() => {
          MaweHint.flashHint(`已恢复「${preset}」默认工作区`, 'success');
        }).catch((error) => {
          MaweHint.flashHint(`重置工作区失败：${error.message || error}`, 'warning');
        });
      }
      syncWorkspaceControls();
    });
    saveWorkspaceButton?.addEventListener('click', () => { void saveCurrentWorkspace({ saveAs: false }); });
    saveWorkspaceAsButton?.addEventListener('click', () => { void saveCurrentWorkspace({ saveAs: true }); });
    deleteWorkspaceButton?.addEventListener('click', () => { void deleteCurrentServerWorkspace(); });
    workspacePresetSelect.dataset.listenersBound = 'true';
   }
   const initialWorkspace = currentServerWorkspaceName
     ? getSavedServerWorkspaces()[currentServerWorkspaceName]
     : getSavedPresetWorkspaces()[currentBuiltinWorkspaceName];
   restoreWorkspaceNavigation(initialWorkspace || DATA.workspace);
   syncWorkspaceControls();
}

function configureWorkspaceTransfer() {
  if (!MaweCoreState.waveformEditor) return;
  // 「工作区配置 ▾」在服务器版与单文件版都可用，便于以文件显式备份/迁移工作区。
  const transferDropdown = document.getElementById('workspace-transfer-dropdown');
  const exportButton = document.getElementById('workspace-export');
  const importButton = document.getElementById('workspace-import');
  const importFile = document.getElementById('workspace-import-file');
  if (transferDropdown) transferDropdown.hidden = false;
  exportButton?.addEventListener('click', async () => {
    await MaweExportTimeline.downloadFile(MaweExportTimeline.buildWorkspaceJson(), `${FILENAME_BASE}.workspace.json`, 'application/json', {
      desc: '编辑器工作区文件', types: { 'application/json': ['.workspace.json', '.json'] },
    });
  });
  importButton?.addEventListener('click', () => {
    if (!importFile) return;
    importFile.value = '';
    importFile.click();
  });
  importFile?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const workspace = data.workspace || data;
      MaweHistory.pushLayoutUndo('导入工作区', MaweCoreState.waveformEditor.getLayoutHistorySnapshot?.());
      MaweCoreState.waveformEditor.setLayoutData(workspace);
      MaweDisplaySettings.applyEditorDisplaySettings(workspace?.editorDisplay);
      DATA.workspace = MaweCoreState.waveformEditor.getLayoutData();
      MaweHint.flashHint(`已导入工作区：${file.name}`, 'success');
    } catch (error) {
      MaweHint.flashHint(`工作区导入失败：${error.message || error}`, 'warning');
    }
  });
  if (SERVER_CONFIG?.settingsUrl) return;  // 服务器版的下拉选择由工作区库接管
  // 单文件编辑器不承诺 file:// 间的浏览器存储；内置工作区与显式文件迁移最可靠。
  let selectedWorkspaceId = workspacePresetSelect?.value || 'wave-right';
  workspacePresetSelect?.addEventListener('change', () => {
    selectedWorkspaceId = workspacePresetSelect.value;
    if (BUILTIN_WORKSPACE_IDS.includes(selectedWorkspaceId)) {
      MaweCoreState.waveformEditor.setLayout(selectedWorkspaceId);
      MaweDisplaySettings.applyEditorDisplaySettings(window.AsrWaveform?.builtinWorkspaces?.[selectedWorkspaceId]?.editorDisplay);
    }
  });
  document.getElementById('layout-edit-toggle')?.addEventListener('click', () => {
    // 拖放编辑只改窗口排列，不改变下拉框当前选中的工作区名称。
    if (workspacePresetSelect) workspacePresetSelect.value = selectedWorkspaceId;
  });
}

function markProjectSaved(filename, backupName, { silent = false } = {}) {
  DATA.segments.forEach((segment) => { delete segment._dirty; });
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  delete multi._dirty;
  (multi.tracks || []).forEach((track) => track.segments.forEach((segment) => { delete segment._dirty; }));
  MaweHistory.gapRemoveDirty = false;
  MaweAppearance.previewGeometryDirty = false;
  projectImportDirty = false;
  FILENAME_BASE = filename.replace(/\.(json|mosp)$/i, '');
  const jsonEl = document.getElementById('json-name');
  if (jsonEl) {
    jsonEl.textContent = filename;
    jsonEl.title = `点击复制工程文件名：${filename}`;
    jsonEl.classList.remove('empty');
  }
  MaweCuePanel.renderAll();
  if (!silent) MaweHint.flashHint('保存成功！', 'success');
}

async function saveProjectToServer({ silent = false } = {}) {
  if (!serverProjectSavingEnabled()) {
    if (!silent) MaweHint.flashHint('当前服务器未绑定工程；请先导出 .mosp，再重新打开该文件', 'invalid');
    return false;
  }
  if (projectSaveInFlight || projectCheckpointInFlight) return false;
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  if (MaweInlineEdit.extensionEditingState) MaweInlineEdit.finishExtensionEdit(true);
  MaweCuePanel.commitCuePanelEdit();
  const projectJson = buildJson();
  projectSaveInFlight = true;
  try {
    const saveUrl = new URL(SERVER_CONFIG.saveUrl, window.location.href);
    const response = await fetch(saveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: JSON.parse(projectJson), filename: null }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `服务器返回 ${response.status}`);
    }
    markProjectSaved(result.filename, result.backup, { silent });
    return true;
  } catch (error) {
    const detail = error?.message || error;
    showProjectSaveError(detail);
    // A stale browser tab can outlive the localhost process (the browser reports
    // ERR_CONNECTION_REFUSED). Offer a real file save so Ctrl+S never strands
    // completed edits, while making clear that the bound JSON was not overwritten.
    if (error instanceof TypeError
        && confirm('无法连接本地编辑器服务器。是否改为导出工程文件，以免丢失改动？')) {
      const saved = await MaweExportTimeline.downloadFile(projectJson, `${FILENAME_BASE}.mosp`, 'application/json', {
        desc: 'MOSE 工程文件', types: { 'application/json': ['.mosp', '.json'] }
      });
      if (saved) MaweHint.flashHint('服务器未连接；工程已导出为 .mosp，请重新打开该文件后继续', 'success');
    }
    return false;
  } finally {
    projectSaveInFlight = false;
  }
}

// 把当前工程写回页面持有的浏览器文件句柄（新建工程 / 另存为选定的目标）。
async function saveProjectToHandle({ silent = false } = {}) {
  if (!projectFileHandle) return false;
  if (projectSaveInFlight || projectCheckpointInFlight) return false;
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  if (MaweInlineEdit.extensionEditingState) MaweInlineEdit.finishExtensionEdit(true);
  MaweCuePanel.commitCuePanelEdit();
  const projectJson = buildJson();
  projectSaveInFlight = true;
  try {
    const writable = await projectFileHandle.createWritable();
    await writable.write(new Blob([projectJson], { type: 'application/json;charset=utf-8' }));
    await writable.close();
    markProjectSaved(projectFileHandle.name, null, { silent });
    return true;
  } catch (error) {
    MaweHint.flashHint(`保存失败：${error?.message || error}`, 'warning');
    return false;
  } finally {
    projectSaveInFlight = false;
  }
}

// 统一保存入口：句柄目标优先（最近一次新建/另存为选定的文件），否则写回服务器绑定工程。
async function saveCurrentProject({ silent = false } = {}) {
  if (projectFileHandle) return saveProjectToHandle({ silent });
  return saveProjectToServer({ silent });
}

// 另存为：打开系统文件浏览对话框把工程文件保存到用户选择的位置。
// 与「导出工程」的区别：保存成功后当前工程名跟随新文件（标题、导出默认名随之更新），
// 且后续 Ctrl(Cmd)+S / 自动保存都写回这个新选定的文件。
async function saveProjectAsToFile() {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  if (MaweInlineEdit.extensionEditingState) MaweInlineEdit.finishExtensionEdit(true);
  MaweCuePanel.commitCuePanelEdit();
  const suggested = `${FILENAME_BASE}.mosp`;
  // 无原生保存对话框的浏览器：退化为普通下载（文件名不可考，标题保持不变）。
  if (!window.showSaveFilePicker) {
    await MaweExportTimeline.downloadFile(buildJson(), suggested, 'application/json', {
      desc: 'MOSE 工程文件', types: { 'application/json': ['.mosp', '.json'] }
    });
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggested,
      types: [{ description: 'MOSE 工程文件', accept: { 'application/json': ['.mosp', '.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(new Blob([buildJson()], { type: 'application/json;charset=utf-8' }));
    await writable.close();
    projectFileHandle = handle;
    markProjectSaved(handle.name, null);
    configureServerSaveControls();
    scheduleAutoSave();
  } catch (error) {
    if (error && error.name === 'AbortError') return;  // 用户取消保存对话框
    MaweHint.flashHint(`保存失败：${error?.message || error}`, 'warning');
  }
}

const mediaNameEl = document.getElementById('media-name');
if (mediaNameEl && !mediaNameEl.classList.contains('empty')) {
  mediaNameEl.addEventListener('click', () => {
    const name = mediaNameEl.textContent.trim();
    if (name) MaweExportTimeline.copyText(name, `已复制媒体名：${name}`);
  });
}

const jsonNameEl = document.getElementById('json-name');
if (jsonNameEl && !jsonNameEl.classList.contains('empty')) {
  jsonNameEl.addEventListener('click', () => {
    const name = jsonNameEl.textContent.trim();
    if (name) MaweExportTimeline.copyText(name, `已复制：${name}`);
  });
}

function translatedEditorText(text) {
  return window.MAWE_I18N?.translateText?.(text) || text;
}

function closeFcp7ExportModal() {
  MaweDom.fcp7ExportModal.classList.remove('show');
}

function openFcp7ExportModal() {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  if (MaweInlineEdit.extensionEditingState) MaweInlineEdit.finishExtensionEdit(true);
  MaweCuePanel.commitCuePanelEdit();
  const extensionAvailable = Boolean(MaweMultiSubtitleCore.getActiveExtensionTrack());
  const extensionOption = MaweDom.fcp7ExportSubtitleTracks.querySelector('option[value="main_and_extension"]');
  extensionOption.disabled = !extensionAvailable;
  if (!extensionAvailable) MaweDom.fcp7ExportSubtitleTracks.value = 'main';
  MaweDom.fcp7ExportNativeText.checked = false;
  MaweDom.fcp7ExportModal.classList.add('show');
  MaweDom.fcp7ExportTimelineMode.focus();
}

async function exportFcp7Xml() {
  MaweDom.fcp7ExportConfirm.disabled = true;
  try {
    const durationMs = MaweCoreState.waveformEditor?.durationMs
      || Math.round(Number(MaweCoreState.player?.duration) * 1000)
      || DATA.waveform?.duration_ms
      || 0;
    const options = window.AsrEditorUtils.normalizeExportOptions({
      timelineMode: MaweDom.fcp7ExportTimelineMode.value,
      fps: MaweDom.fcp7ExportFps.value,
      subtitleTracks: MaweDom.fcp7ExportSubtitleTracks.value,
      nativeTextObjects: MaweDom.fcp7ExportNativeText.checked,
      baseName: FILENAME_BASE,
    });
    const plan = window.AsrEditorUtils.buildProjectExportPlan(DATA, {
      ...options,
      durationMs: Math.round(durationMs),
    });
    const [artifact] = window.AsrEditorUtils.buildFcp7ExportArtifacts(plan, options);
    closeFcp7ExportModal();
    const result = await MaweExportTimeline.downloadFile(
      artifact.content,
      artifact.filename,
      artifact.mime,
      { desc: 'FCP 7 XML', types: { 'application/xml': ['.xml'] } },
       { detailed: true },
    );
    const messages = {
      saved: ['FCP 7 XML 已保存', 'success'],
      dispatched: ['FCP 7 XML 下载已发起', 'success'],
      cancelled: ['FCP 7 XML 保存已取消', 'invalid'],
      failed: ['FCP 7 XML 保存失败', 'warning'],
    };
    const [message, type] = messages[result.status] || messages.failed;
    MaweHint.flashHint(translatedEditorText(message), type);
  } catch (error) {
    MaweHint.flashHint(`${translatedEditorText('FCP 7 XML 导出失败')}：${error.message}`, 'warning');
  } finally {
    MaweDom.fcp7ExportConfirm.disabled = false;
  }
}

document.getElementById('download-fcp7-export')?.addEventListener('click', openFcp7ExportModal);
MaweDom.fcp7ExportCancel?.addEventListener('click', closeFcp7ExportModal);
MaweDom.fcp7ExportConfirm?.addEventListener('click', () => { void exportFcp7Xml(); });
MaweDom.fcp7ExportModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.fcp7ExportModal) closeFcp7ExportModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweDom.fcp7ExportModal.classList.contains('show')) return;
  event.preventDefault();
  event.stopPropagation();
  closeFcp7ExportModal();
}, true);

function lottieExportAvailable() {
  return Boolean(SERVER_CONFIG?.canLottieExport && SERVER_CONFIG?.lottieExportUrl);
}

function updateLottieExportButton() {
  const button = document.getElementById('download-lottie');
  if (!button) return;
  if (!button.dataset.originalTitle) button.dataset.originalTitle = button.title;
  const disabled = !lottieExportAvailable();
  button.classList.toggle('sticker-disabled', disabled);
  button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  button.title = disabled
    ? translatedEditorText('服务器打包模式不可用：请以 server-editor 打开并绑定工程文件后再导出动态字幕')
    : button.dataset.originalTitle;
}

function lottieExportBlocked() {
  if (lottieExportAvailable()) return false;
  const message = '当前模式不可用：动态字幕 .lottie 导出需要以 server-editor 打开并绑定工程文件';
  MaweHint.flashHint(window.MAWE_I18N?.translateText?.(message) || message, 'warning');
  return true;
}

function closeLottieExportModal() {
  MaweDom.lottieExportModal?.classList.remove('show');
}

function openLottieExportModal() {
  if (lottieExportBlocked()) return;
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  if (MaweInlineEdit.extensionEditingState) MaweInlineEdit.finishExtensionEdit(true);
  MaweCuePanel.commitCuePanelEdit();
  const extensionOption = MaweDom.lottieExportTrack?.querySelector('option[value="extension"]');
  const extensionAvailable = Boolean(MaweMultiSubtitleCore.getActiveExtensionTrack());
  if (extensionOption) extensionOption.disabled = !extensionAvailable;
  if (!extensionAvailable && MaweDom.lottieExportTrack) MaweDom.lottieExportTrack.value = 'main';
  MaweDom.lottieExportModal?.classList.add('show');
  MaweDom.lottieExportTrack?.focus();
}

function lottieExportCanvasSize() {
  const match = /^(\d+)x(\d+)$/u.exec(MaweDom.lottieExportResolution?.value || '');
  if (!match) return { width: 1920, height: 1080 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function exportLottieDynamicCaptions() {
  if (lottieExportBlocked()) return;
  MaweDom.lottieExportConfirm.disabled = true;
  try {
    const extension = MaweDom.lottieExportTrack?.value === 'extension';
    const track = extension ? MaweMultiSubtitleCore.getActiveExtensionTrack() : null;
    const sourceSegments = extension ? track?.segments : DATA.segments;
    if (!Array.isArray(sourceSegments) || !sourceSegments.some((segment) => (
      !segment?.disabled && String(segment?.text || '').trim()
    ))) {
      throw new Error(translatedEditorText(
        extension ? '当前副字幕轨没有可导出的字幕' : '当前主轨没有可导出的字幕',
      ));
    }
    const gapRemoved = MaweDom.lottieExportGapRemoved?.checked === true;
    const exportData = MaweExportSrt.buildDynamicCaptionExportData(sourceSegments, gapRemoved);
    if (!exportData) return;
    const { segments, durationMs } = exportData;
    if (!segments.some((segment) => !segment?.disabled && String(segment?.text || '').trim())) {
      throw new Error(translatedEditorText(
        extension ? '当前副字幕轨没有可导出的字幕' : '当前主轨没有可导出的字幕',
      ));
    }
    const size = lottieExportCanvasSize();
    const appearance = extension ? MaweAppearance.getExtensionSubtitleAppearance() : MaweAppearance.getSubtitleAppearance();
    const animation = window.AsrEditorUtils.buildLottieAnimation(segments, {
      durationMs: Math.round(durationMs),
      fps: MaweDom.lottieExportFps?.value || '30',
      renderMode: MaweDom.lottieExportRenderMode?.value || 'text',
      width: size.width,
      height: size.height,
      subtitle: { ...MaweAppearance.getPreviewGeometry(), ...appearance },
    });
    MaweHint.flashHint(translatedEditorText('正在生成动态字幕 .lottie…'));
    const response = await fetch(new URL(SERVER_CONFIG.lottieExportUrl, window.location.href), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestToken: SERVER_CONFIG.requestToken, animation }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `服务器返回 ${response.status}`);
    }
    const blob = await response.blob();
    closeLottieExportModal();
    const suffix = extension ? '_extension' : '';
    const gapSuffix = gapRemoved ? '_gap-removed' : '';
    const saved = await MaweExportTimeline.downloadFile(
      blob,
      `${FILENAME_BASE}${suffix}${gapSuffix}_dynamic-caption.lottie`,
      'application/zip+dotlottie',
      { desc: 'Lottie 动态字幕', types: { 'application/zip+dotlottie': ['.lottie'] } },
    );
    if (saved) MaweHint.flashHint(translatedEditorText('动态字幕 .lottie 已生成'), 'success');
  } catch (error) {
    MaweHint.flashHint(`${translatedEditorText('动态字幕 .lottie 导出失败')}：${error.message || error}`, 'warning');
  } finally {
    MaweDom.lottieExportConfirm.disabled = false;
  }
}

document.getElementById('download-lottie')?.addEventListener('click', openLottieExportModal);
MaweDom.lottieExportCancel?.addEventListener('click', closeLottieExportModal);
MaweDom.lottieExportConfirm?.addEventListener('click', () => { void exportLottieDynamicCaptions(); });
MaweDom.lottieExportModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.lottieExportModal) closeLottieExportModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweDom.lottieExportModal?.classList.contains('show')) return;
  event.preventDefault();
  event.stopPropagation();
  closeLottieExportModal();
}, true);

function ografExportAvailable() {
  return Boolean(SERVER_CONFIG?.canOgrafExport && SERVER_CONFIG?.ografExportUrl);
}

function updateOgrafExportButton() {
  const button = document.getElementById('download-ograf');
  if (!button) return;
  if (!button.dataset.originalTitle) button.dataset.originalTitle = button.title;
  const disabled = !ografExportAvailable();
  button.classList.toggle('sticker-disabled', disabled);
  button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  button.title = disabled
    ? translatedEditorText('服务器打包模式不可用：请以 server-editor 打开并绑定工程文件后再导出动态字幕')
    : button.dataset.originalTitle;
}

function ografExportBlocked() {
  if (ografExportAvailable()) return false;
  const message = '当前模式不可用：OGraf 动态字幕导出需要以 server-editor 打开并绑定工程文件';
  MaweHint.flashHint(window.MAWE_I18N?.translateText?.(message) || message, 'warning');
  return true;
}

function closeOgrafExportModal() {
  MaweDom.ografExportModal?.classList.remove('show');
}

function openOgrafExportModal() {
  if (ografExportBlocked()) return;
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  if (MaweInlineEdit.extensionEditingState) MaweInlineEdit.finishExtensionEdit(true);
  MaweCuePanel.commitCuePanelEdit();
  const extensionOption = MaweDom.ografExportTrack?.querySelector('option[value="extension"]');
  const extensionAvailable = Boolean(MaweMultiSubtitleCore.getActiveExtensionTrack());
  if (extensionOption) extensionOption.disabled = !extensionAvailable;
  if (!extensionAvailable && MaweDom.ografExportTrack) MaweDom.ografExportTrack.value = 'main';
  MaweDom.ografExportModal?.classList.add('show');
  MaweDom.ografExportTrack?.focus();
}

function ografExportCanvasSize() {
  const match = /^(\d+)x(\d+)$/u.exec(MaweDom.ografExportResolution?.value || '');
  if (!match) return { width: 1920, height: 1080 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function exportOgrafDynamicCaptions() {
  if (ografExportBlocked()) return;
  MaweDom.ografExportConfirm.disabled = true;
  try {
    const extension = MaweDom.ografExportTrack?.value === 'extension';
    const track = extension ? MaweMultiSubtitleCore.getActiveExtensionTrack() : null;
    const sourceSegments = extension ? track?.segments : DATA.segments;
    if (!Array.isArray(sourceSegments) || !sourceSegments.some((segment) => (
      !segment?.disabled && String(segment?.text || '').trim()
    ))) {
      throw new Error(translatedEditorText(
        extension ? '当前副字幕轨没有可导出的字幕' : '当前主轨没有可导出的字幕',
      ));
    }
    const gapRemoved = MaweDom.ografExportGapRemoved?.checked === true;
    const exportData = MaweExportSrt.buildDynamicCaptionExportData(sourceSegments, gapRemoved);
    if (!exportData) return;
    const { segments, durationMs } = exportData;
    if (!segments.some((segment) => !segment?.disabled && String(segment?.text || '').trim())) {
      throw new Error(translatedEditorText(
        extension ? '当前副字幕轨没有可导出的字幕' : '当前主轨没有可导出的字幕',
      ));
    }
    const size = ografExportCanvasSize();
    const appearance = extension ? MaweAppearance.getExtensionSubtitleAppearance() : MaweAppearance.getSubtitleAppearance();
    const graphic = window.AsrEditorUtils.buildOgrafGraphic(segments, {
      durationMs: Math.round(durationMs),
      fps: MaweDom.ografExportFps?.value || '30',
      width: size.width,
      height: size.height,
      subtitle: { ...MaweAppearance.getPreviewGeometry(), ...appearance },
    });
    MaweHint.flashHint(translatedEditorText('正在生成动态字幕 .ograf.zip…'));
    const response = await fetch(new URL(SERVER_CONFIG.ografExportUrl, window.location.href), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestToken: SERVER_CONFIG.requestToken, graphic }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `服务器返回 ${response.status}`);
    }
    const blob = await response.blob();
    closeOgrafExportModal();
    const suffix = extension ? '_extension' : '';
    const gapSuffix = gapRemoved ? '_gap-removed' : '';
    const saved = await MaweExportTimeline.downloadFile(
      blob,
      `${FILENAME_BASE}${suffix}${gapSuffix}_dynamic-caption.ograf.zip`,
      'application/zip',
      { desc: 'OGraf 动态字幕', types: { 'application/zip': ['.zip'] } },
    );
    if (saved) MaweHint.flashHint(translatedEditorText('动态字幕 .ograf.zip 已生成；请先解压'), 'success');
  } catch (error) {
    MaweHint.flashHint(`${translatedEditorText('动态字幕 .ograf.zip 导出失败')}：${error.message || error}`, 'warning');
  } finally {
    MaweDom.ografExportConfirm.disabled = false;
  }
}

document.getElementById('download-ograf')?.addEventListener('click', openOgrafExportModal);
MaweDom.ografExportCancel?.addEventListener('click', closeOgrafExportModal);
MaweDom.ografExportConfirm?.addEventListener('click', () => { void exportOgrafDynamicCaptions(); });
MaweDom.ografExportModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.ografExportModal) closeOgrafExportModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweDom.ografExportModal?.classList.contains('show')) return;
  event.preventDefault();
  event.stopPropagation();
  closeOgrafExportModal();
}, true);

MaweDom.downloadMultiSrtButton?.addEventListener('click', async () => {
  if (MaweInlineEdit.extensionEditingState) MaweInlineEdit.finishExtensionEdit(true);
  const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
  if (!track) return;
  await MaweExportTimeline.downloadFile(MaweExportSrt.buildExtensionSrt(track), `${FILENAME_BASE}_extension.srt`, 'text/plain', {
    desc: '副字幕 SRT 文件', types: { 'text/plain': ['.srt'] },
  });
});
document.getElementById('download-full-srt')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  await MaweExportTimeline.downloadFile(MaweExportSrt.buildSrt(), `${FILENAME_BASE}.srt`, 'text/plain', {
    desc: '完整 SRT 字幕文件', types: { 'text/plain': ['.srt'] }
  });
});
document.getElementById('download-color-srt')?.addEventListener('click', () => MaweExportSrt.downloadColorSrts(false));
document.getElementById('download-plain-text')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  await MaweExportTimeline.downloadFile(window.AsrEditorUtils.buildPlainTextPayload(DATA.segments), `${FILENAME_BASE}.txt`, 'text/plain', {
    desc: '纯文本字幕文件', types: { 'text/plain': ['.txt'] }
  });
});
document.getElementById('download-json')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  await MaweExportTimeline.downloadFile(buildJson(), `${FILENAME_BASE}.mosp`, 'application/json', {
    desc: 'MOSE 工程文件', types: { 'application/json': ['.mosp', '.json'] }
  });
});
MaweDom.saveProjectButton?.addEventListener('click', () => saveCurrentProject());
MaweDom.saveProjectAsButton?.addEventListener('click', () => saveProjectAsToFile());
// Project-level save shortcuts intentionally override the browser page-save
// command. finishEdit() inside saveProjectToServer commits an active text edit.
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  if (event.shiftKey) {
    void saveProjectAsToFile();
  } else {
    void saveCurrentProject();
  }
});
document.getElementById('download-resolve-json')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportTimeline.buildResolveJson();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${FILENAME_BASE}_resolve.json`, 'application/json', {
      desc: 'Resolve JSON', types: { 'application/json': ['.json'] }
    });
  }
});
const stickerOtioExportMode = document.getElementById('sticker-otio-export-mode');
const portableStickerExportOption = stickerOtioExportMode?.querySelector('option[value="portable"]');

function syncStickerOtioExportMode() {
  const available = Boolean(
    SERVER_CONFIG?.canPortableStickerExport && SERVER_CONFIG?.portableStickerExportUrl
  );
  if (portableStickerExportOption) portableStickerExportOption.disabled = !available;
  if (stickerOtioExportMode) {
    stickerOtioExportMode.value = available
      ? MaweSettings.EDITOR_SETTINGS.stickerOtioExportMode
      : 'original';
  }
  return available;
}

stickerOtioExportMode?.addEventListener('change', () => {
  updateEditorSettings({ stickerOtioExportMode: stickerOtioExportMode.value });
});

async function exportStickerOtio(kind, buildTimeline, filename, description) {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = buildTimeline();
  if (!payload) return;
  if (stickerOtioExportMode?.value !== 'portable') {
    await MaweExportTimeline.downloadFile(payload, filename, 'application/vnd.opentimelineio+json', {
      desc: description, types: { 'application/vnd.opentimelineio+json': ['.otio'] }
    });
    return;
  }
  if (!syncStickerOtioExportMode()) {
    MaweHint.flashHint('当前工程无法导出便携表情包 OTIO 文件夹', 'warning');
    return;
  }
  MaweHint.flashHint('正在生成便携表情包 OTIO 文件夹…');
  try {
    const response = await fetch(new URL(SERVER_CONFIG.portableStickerExportUrl, window.location.href), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestToken: SERVER_CONFIG.requestToken,
        kind,
        timeline: JSON.parse(payload),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `服务器返回 ${response.status}`);
    MaweHint.flashHint(`已生成 ${result.folderPath}，复制 ${result.stickerCount} 张表情包`, 'success');
  } catch (error) {
    MaweHint.flashHint(`便携表情包 OTIO 导出失败：${error.message || error}`, 'warning');
  }
}

document.getElementById('download-sticker-otio')?.addEventListener('click', () => {
  if (MaweExportTimeline.stickerExportBlocked('download-sticker-otio')) return;
  exportStickerOtio(
    'stickers', MaweExportTimeline.buildStickerOtio, `${FILENAME_BASE}_stickers.otio`, 'OTIO 工程文件'
  );
});
document.getElementById('download-gap-removed-srt')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportSrt.buildGapRemovedSrt();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${FILENAME_BASE}_gap-removed.srt`, 'text/plain', {
      desc: '去空隙字幕 SRT', types: { 'text/plain': ['.srt'] }
    });
  }
});
document.getElementById('download-gap-removed-color-srt')?.addEventListener('click', () => MaweExportSrt.downloadColorSrts(true));
document.getElementById('download-otio')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportTimeline.buildSourceOtio();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, FILENAME_BASE + '.otio', 'application/vnd.opentimelineio+json', {
      desc: 'OTIO 工程', types: { 'application/vnd.opentimelineio+json': ['.otio'] }
    });
  }
});
document.getElementById('download-otioz')?.addEventListener('click', async () => {
  await MaweExportTimeline.exportTimelineOtioz(
    'source',
    MaweExportTimeline.buildSourceOtio,
    FILENAME_BASE + '.otioz',
    'OTIOZ 打包工程',
  );
});
document.getElementById('download-gap-removed-otio')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportTimeline.buildGapRemovedOtio();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${FILENAME_BASE}_gap-removed.otio`, 'application/vnd.opentimelineio+json', {
      desc: '去空隙 OTIO 工程', types: { 'application/vnd.opentimelineio+json': ['.otio'] }
    });
  }
});
document.getElementById('download-gap-removed-otioz')?.addEventListener('click', async () => {
  await MaweExportTimeline.exportTimelineOtioz(
    'gap-removed',
    MaweExportTimeline.buildGapRemovedOtio,
    `${FILENAME_BASE}_gap-removed.otioz`,
    '去空隙时间线 OTIOZ 打包工程',
  );
});
document.getElementById('download-gap-removed-ffconcat')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportSrt.buildGapRemovedFfconcat();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${FILENAME_BASE}_gap-removed.ffconcat`, 'text/plain', {
      desc: 'FFconcat 剪辑计划', types: { 'text/plain': ['.ffconcat'] }
    });
  }
});
document.getElementById('download-gap-removed-regions-json')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportSrt.buildGapRemovedRegionsJson();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${FILENAME_BASE}_gap-removed.keep-regions.json`, 'application/json', {
      desc: '去空隙保留区域 JSON', types: { 'application/json': ['.json'] }
    });
  }
});
document.getElementById('download-gap-removed-sticker-otio')?.addEventListener('click', async () => {
  if (MaweExportTimeline.stickerExportBlocked('download-gap-removed-sticker-otio')) return;
  await exportStickerOtio(
    'gap-removed-stickers', MaweExportTimeline.buildGapRemovedStickerOtio,
    `${FILENAME_BASE}_gap-removed-stickers.otio`, '去空隙表情包 OTIO 工程'
  );
});
document.getElementById('download-gap-removed-sticker-otioz')?.addEventListener('click', async () => {
  if (MaweExportTimeline.stickerExportBlocked('download-gap-removed-sticker-otioz')) return;
  const removed = MaweGapRemoveData.getRemovedGapRanges();
  if (!removed.length) {
    const msg = '没有已移除的静音空隙；请先使用「移除静音空隙」扫描并移除';
    MaweHint.flashHint(window.MAWE_I18N?.translateText?.(msg) || msg);
    return;
  }
  await MaweExportTimeline.exportStickerOtoz(
    'gap-removed-stickers', MaweExportTimeline.buildGapRemovedStickerOtio,
    `${FILENAME_BASE}_gap-removed-stickers.otioz`, '去空隙表情包 OTIOZ 打包工程'
  );
});
document.getElementById('download-sticker-otioz')?.addEventListener('click', async () => {
  if (MaweExportTimeline.stickerExportBlocked('download-sticker-otioz')) return;
  await MaweExportTimeline.exportStickerOtoz(
    'stickers', MaweExportTimeline.buildStickerOtio,
    `${FILENAME_BASE}_stickers.otioz`, '表情包 OTIOZ 打包工程'
  );
});

// 初始按服务器模式刷新表情包 OTIOZ 导出按钮的可用性
MaweExportTimeline.updateStickerExportButtons();
MaweExportTimeline.updateTimelineOtiozExportButtons();
updateLottieExportButton();
updateOgrafExportButton();

// === 工具栏导出下拉菜单 ===
const SUBMENU_CLOSE_DELAY_MS = 160;
const SUBMENU_AIM_TOLERANCE_PX = 8;

function bindToolbarExportDropdown(dropdownId, buttonId, menuId, positioner = null) {
  const dd = document.getElementById(dropdownId);
  const btn = document.getElementById(buttonId);
  const menu = document.getElementById(menuId);
  if (!dd || !btn || !menu) return;
  const submenuWrappers = [...menu.children].filter((item) => item.classList.contains('dropdown-submenu'));
  const submenuCloseTimers = new WeakMap();
  let pendingSubmenuSwitch = null;
  let lastPointerPoint = null;
  let previousPointerPoint = null;
  let lastPointInsideOpenWrapper = null;
  const directItems = (container) => [...container.children].flatMap((child) => {
    if (child.classList.contains('dropdown-item')) {
      return child.classList.contains('disabled') || child.hidden ? [] : [child];
    }
    if (!child.classList.contains('dropdown-submenu')) return [];
    const toggle = child.querySelector(':scope > .dropdown-submenu-toggle');
    return toggle && !toggle.classList.contains('disabled') && !toggle.hidden ? [toggle] : [];
  });
  const pointerPoint = (event) => {
    if (!event || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    return { x: event.clientX, y: event.clientY };
  };
  const clearPendingSubmenuSwitch = () => {
    if (!pendingSubmenuSwitch) return;
    clearTimeout(pendingSubmenuSwitch.timer);
    pendingSubmenuSwitch = null;
  };
  const openSubmenu = () => submenuWrappers.find((wrapper) => wrapper.classList.contains('open'));
  const pointInTriangle = (point, a, b, c) => {
    const sign = (p1, p2, p3) => (
      (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
    );
    const first = sign(point, a, b);
    const second = sign(point, b, c);
    const third = sign(point, c, a);
    const hasNegative = first < 0 || second < 0 || third < 0;
    const hasPositive = first > 0 || second > 0 || third > 0;
    return !(hasNegative && hasPositive);
  };
  const shouldDelaySubmenuSwitch = (wrapper, point, previousPoint) => {
    const active = openSubmenu();
    const apex = previousPoint || lastPointInsideOpenWrapper;
    if (!active || active === wrapper || !point || !apex) return false;
    const submenu = active.querySelector(':scope > .dropdown-submenu-menu');
    if (!submenu) return false;
    const activeRect = active.getBoundingClientRect();
    const submenuRect = submenu.getBoundingClientRect();
    const opensLeft = submenuRect.right <= activeRect.left + SUBMENU_AIM_TOLERANCE_PX;
    const opensRight = submenuRect.left >= activeRect.right - SUBMENU_AIM_TOLERANCE_PX;
    if (!opensLeft && !opensRight) return false;
    const direction = opensLeft ? -1 : 1;
    if ((direction < 0 && point.x > apex.x + SUBMENU_AIM_TOLERANCE_PX)
      || (direction > 0 && point.x < apex.x - SUBMENU_AIM_TOLERANCE_PX)) return false;
    const edgeX = direction < 0 ? submenuRect.right : submenuRect.left;
    return pointInTriangle(
      point,
      apex,
      { x: edgeX, y: submenuRect.top - SUBMENU_AIM_TOLERANCE_PX },
      { x: edgeX, y: submenuRect.bottom + SUBMENU_AIM_TOLERANCE_PX },
    );
  };
  const clearSubmenuClose = (wrapper) => {
    const timer = submenuCloseTimers.get(wrapper);
    if (timer) {
      clearTimeout(timer);
      submenuCloseTimers.delete(wrapper);
    }
  };
  const closeSubmenu = (wrapper) => {
    clearSubmenuClose(wrapper);
    if (wrapper.classList.contains('open')) lastPointInsideOpenWrapper = null;
    wrapper.classList.remove('open');
    wrapper.querySelector(':scope > .dropdown-submenu-toggle')
      ?.setAttribute('aria-expanded', 'false');
  };
  const closeSubmenus = () => {
    submenuWrappers.forEach(closeSubmenu);
  };
  const scheduleSubmenuSwitch = (wrapper) => {
    // menu-aim：鼠标进入同级菜单项时，沿当前子菜单近侧边缘的三角通道移动，先保留当前菜单。
    clearPendingSubmenuSwitch();
    const active = openSubmenu();
    if (active && active !== wrapper) clearSubmenuClose(active);
    const timer = setTimeout(() => {
      if (!pendingSubmenuSwitch || pendingSubmenuSwitch.wrapper !== wrapper) return;
      pendingSubmenuSwitch = null;
      if (wrapper.matches(':hover') || wrapper.contains(document.activeElement)) {
        setSubmenuOpen(wrapper, true);
      }
    }, SUBMENU_CLOSE_DELAY_MS);
    pendingSubmenuSwitch = { wrapper, timer };
  };
  const setSubmenuOpen = (wrapper, open, focusFirst = false) => {
    if (!wrapper) return;
    const toggle = wrapper.querySelector(':scope > .dropdown-submenu-toggle');
    const submenu = wrapper.querySelector(':scope > .dropdown-submenu-menu');
    if (!toggle || !submenu) return;
    clearSubmenuClose(wrapper);
    if (open) {
      clearPendingSubmenuSwitch();
      submenuWrappers.forEach((other) => {
        if (other !== wrapper) closeSubmenu(other);
      });
    }
    wrapper.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && focusFirst) directItems(submenu)[0]?.focus();
  };
  const scheduleSubmenuClose = (wrapper) => {
    clearSubmenuClose(wrapper);
    const timer = setTimeout(() => {
      submenuCloseTimers.delete(wrapper);
      if (!wrapper.matches(':hover') && !wrapper.contains(document.activeElement)) {
        closeSubmenu(wrapper);
      }
    }, SUBMENU_CLOSE_DELAY_MS);
    submenuCloseTimers.set(wrapper, timer);
  };
  const setOpen = (open, { restoreFocus = false } = {}) => {
    dd.classList.toggle('open', open);
    if (btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) {
      closeSubmenus();
      lastPointerPoint = null;
      previousPointerPoint = null;
      lastPointInsideOpenWrapper = null;
    }
    if (open && positioner) requestAnimationFrame(positioner);
    if (!open && restoreFocus) btn.focus();
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.toolbar .dropdown.open').forEach((other) => {
      if (other !== dd) {
        other.classList.remove('open');
        other.querySelector('button[aria-expanded]')?.setAttribute('aria-expanded', 'false');
        other.querySelectorAll('.dropdown-submenu').forEach((submenu) => {
          submenu.classList.remove('open');
          submenu.querySelector('.dropdown-submenu-toggle')?.setAttribute('aria-expanded', 'false');
        });
      }
    });
    setOpen(!dd.classList.contains('open'));
  });
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    setOpen(true);
    const items = directItems(menu);
    items[e.key === 'ArrowDown' ? 0 : items.length - 1]?.focus();
  });
  submenuWrappers.forEach((wrapper) => {
    const submenu = wrapper.querySelector(':scope > .dropdown-submenu-menu');
    const keepOpen = (event) => {
      const point = pointerPoint(event);
      const sameAsLastPoint = point && lastPointerPoint
        && point.x === lastPointerPoint.x && point.y === lastPointerPoint.y;
      const previousPoint = point
        ? (sameAsLastPoint ? previousPointerPoint : lastPointerPoint)
        : null;
      if (point && !sameAsLastPoint) previousPointerPoint = lastPointerPoint;
      if (point) lastPointerPoint = point;
      if (point && shouldDelaySubmenuSwitch(wrapper, point, previousPoint)) {
        scheduleSubmenuSwitch(wrapper);
        return;
      }
      setSubmenuOpen(wrapper, true);
      if (point) lastPointInsideOpenWrapper = point;
    };
    const deferClose = (event) => {
      if (pendingSubmenuSwitch?.wrapper === wrapper
        && (!event?.relatedTarget || !wrapper.contains(event.relatedTarget))) {
        clearPendingSubmenuSwitch();
        const active = openSubmenu();
        if (active && active !== wrapper) scheduleSubmenuClose(active);
      }
      scheduleSubmenuClose(wrapper);
    };
    wrapper.addEventListener('pointerenter', keepOpen);
    wrapper.addEventListener('pointerleave', deferClose);
    wrapper.addEventListener('focusin', keepOpen);
    wrapper.addEventListener('focusout', (e) => {
      if (!e.relatedTarget || !wrapper.contains(e.relatedTarget)) deferClose();
    });
    submenu?.addEventListener('pointerenter', keepOpen);
    submenu?.addEventListener('pointerleave', deferClose);
  });
  menu.addEventListener('pointermove', (event) => {
    const point = pointerPoint(event);
    if (!point) return;
    if (!lastPointerPoint || point.x !== lastPointerPoint.x || point.y !== lastPointerPoint.y) {
      previousPointerPoint = lastPointerPoint;
    }
    lastPointerPoint = point;
    const active = openSubmenu();
    if (active?.contains(event.target)) lastPointInsideOpenWrapper = point;
  });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || !menu.contains(item)) return;
    if (item.classList.contains('dropdown-submenu-toggle')) {
      e.stopPropagation();
      const wrapper = item.closest('.dropdown-submenu');
      setSubmenuOpen(wrapper, !wrapper.classList.contains('open'));
      return;
    }
    setOpen(false);
  });
  menu.addEventListener('keydown', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || !menu.contains(item)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false, { restoreFocus: true });
      return;
    }
    const submenuWrapper = item.closest('.dropdown-submenu');
    const submenu = submenuWrapper?.querySelector(':scope > .dropdown-submenu-menu');
    if (e.key === 'ArrowRight' && item.classList.contains('dropdown-submenu-toggle')) {
      e.preventDefault();
      setSubmenuOpen(submenuWrapper, true, true);
      return;
    }
    if (e.key === 'ArrowLeft' && submenuWrapper && !item.classList.contains('dropdown-submenu-toggle')) {
      e.preventDefault();
      setSubmenuOpen(submenuWrapper, false);
      submenuWrapper.querySelector(':scope > .dropdown-submenu-toggle')?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const container = submenu && submenu.contains(item) ? submenu : menu;
      const items = directItems(container);
      const index = items.indexOf(item);
      if (index < 0 || !items.length) return;
      const offset = e.key === 'ArrowDown' ? 1 : -1;
      items[(index + offset + items.length) % items.length].focus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      item.click();
      if (!item.classList.contains('dropdown-submenu-toggle')) btn.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dd.classList.contains('open')) {
      e.preventDefault();
      setOpen(false, { restoreFocus: true });
    }
  });
  if (positioner) {
    window.addEventListener('resize', positioner);
    window.addEventListener('scroll', positioner, true);
    dd.closest('.cue-list-toolbar, .toolbar')?.addEventListener('scroll', positioner);
  }
}
bindToolbarExportDropdown('subtitle-export-dropdown', 'subtitle-export-btn', 'subtitle-export-menu');
bindToolbarExportDropdown('gap-removed-export-dropdown', 'gap-removed-export-btn', 'gap-removed-export-menu');
bindToolbarExportDropdown('extra-export-dropdown', 'extra-export-btn', 'extra-export-menu');
bindToolbarExportDropdown('open-project-dropdown', 'open-project-menu-btn', 'open-project-menu');
bindToolbarExportDropdown('save-project-dropdown', 'save-project-menu-btn', 'save-project-menu');
bindToolbarExportDropdown('workspace-transfer-dropdown', 'workspace-transfer-btn', 'workspace-transfer-menu');
bindToolbarExportDropdown('multi-subtitle-settings-dropdown', 'multi-subtitle-settings-toggle', 'multi-subtitle-settings-menu');
function positionBatchOperationsMenu() {
  const dropdown = document.getElementById('batch-operations-dropdown');
  const button = document.getElementById('batch-operations-btn');
  const menu = document.getElementById('batch-operations-menu');
  if (!dropdown?.classList.contains('open') || !button || !menu) return;
  const buttonRect = button.getBoundingClientRect();
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const margin = 8;
  const left = Math.min(
    Math.max(margin, buttonRect.left),
    Math.max(margin, window.innerWidth - menuWidth - margin),
  );
  const belowTop = buttonRect.bottom + 6;
  const aboveTop = buttonRect.top - menuHeight - 6;
  let top = belowTop;
  if (belowTop + menuHeight > window.innerHeight - margin && aboveTop >= margin) {
    top = aboveTop;
  } else if (belowTop + menuHeight > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - menuHeight - margin);
  }
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}
bindToolbarExportDropdown(
  'batch-operations-dropdown', 'batch-operations-btn', 'batch-operations-menu',
  positionBatchOperationsMenu,
);

// === 打开工程 ===
const openProjectFileInput = document.getElementById('open-project-file');
const loadMediaFileInput = document.getElementById('load-media-file');
const loadSrtFileInput = document.getElementById('load-srt-file');
let currentMediaBlobUrl = null;  // 跟踪 blob URL，便于切换时 revoke 防泄漏
let pendingProjectMediaSelection = null;

function closeProjectMediaModal(clearPending = false) {
  MaweDom.projectMediaModal.classList.remove('show');
  if (clearPending) pendingProjectMediaSelection = null;
  setTimeout(() => window.MAWE_ONBOARDING?.scheduleStart(), 0);
}

function showProjectMediaModal() {
  MaweDom.projectMediaModal.classList.add('show');
  MaweDom.projectMediaSelectButton.focus();
}

MaweDom.projectMediaSelectButton.addEventListener('click', () => {
  closeProjectMediaModal(false);
  loadMediaFileInput.value = '';
  loadMediaFileInput.click();
});

MaweDom.projectMediaLaterButton.addEventListener('click', () => {
  closeProjectMediaModal(true);
  MaweHint.flashHint('可稍后点击“加载媒体”选择关联媒体', 'invalid');
});

MaweDom.projectMediaModal.addEventListener('click', (event) => {
  if (event.target === MaweDom.projectMediaModal) MaweDom.projectMediaLaterButton.click();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweDom.projectMediaModal.classList.contains('show')) return;
  event.preventDefault();
  event.stopPropagation();
  MaweDom.projectMediaLaterButton.click();
}, true);

function updateUnloadedMediaLabel(mediaPath) {
  const mediaName = window.AsrEditorUtils.fileBasename(mediaPath);
  const mediaNameEl = document.getElementById('media-name');
  if (!mediaNameEl) return;
  if (!mediaName) {
    mediaNameEl.textContent = '未加载媒体';
    mediaNameEl.title = '';
    mediaNameEl.classList.add('empty');
    mediaNameEl.onclick = null;
    return;
  }
  mediaNameEl.textContent = `未加载：${mediaName}`;
  mediaNameEl.title = `工程关联媒体：${mediaPath}`;
  mediaNameEl.classList.add('empty');
  mediaNameEl.onclick = () => MaweExportTimeline.copyText(mediaPath, `已复制媒体路径：${mediaPath}`);
}

function resetLoadedMedia() {
  if (currentMediaBlobUrl) URL.revokeObjectURL(currentMediaBlobUrl);
  currentMediaBlobUrl = null;
  const oldPlayer = MaweCoreState.player;
  try { oldPlayer?.pause(); } catch (_) {}
  const emptyPlayer = document.createElement('audio');
  emptyPlayer.id = 'player';
  emptyPlayer.preload = 'metadata';
  emptyPlayer.style.cssText = 'width:100%;display:block;';
  oldPlayer?.parentNode?.replaceChild(emptyPlayer, oldPlayer);
  MaweCoreState.player = emptyPlayer;
  MaweMediaPlayback.bindPlayerEvents(MaweCoreState.player);
  MaweNavPreview.seekWarned = false;
  MaweNavPreview.pendingMediaSeekTimeSec = null;
  MaweNavPreview.autoLoadedMediaReadyNotified = false;
  MaweCoreState.waveformEditor?.attachPlayer(MaweCoreState.player);
  syncPlayerPlaceholder();
}

function buildBlankProject() {
  return { media: '', language: '', model: '', segments: [] };
}

function suggestedProjectName(file = null) {
  const stem = file?.name?.replace(/\.[^.]+$/i, '').trim();
  return `${stem || 'untitled'}.mosp`;
}

function applyCanonicalProject(data, filename) {
  MaweCuePanelState.currentCuePanelIdx = -1;
  MaweCuePanelState.currentCuePanelKind = 'main';
  MaweCuePanelState.currentCuePanelTrackId = null;
  MaweCuePanelState.resetCuePanelEditState();
  resetLoadedMedia();
  DATA.media = typeof data.media === 'string' ? data.media : '';
  DATA.language = data.language || '';
  DATA.model = data.model || '';
  DATA.media_time_reference = data.media_time_reference || null;
  DATA.waveform = data.waveform || null;
  DATA.spectral = data.spectral || null;
  DATA.waveform_reapeaks = data.waveform_reapeaks || null;
  DATA.workspace = data.workspace || null;
  DATA.gap_remove = data.gap_remove || null;
  DATA.script_alignment = data.script_alignment || null;
  DATA.preview = (data.preview && typeof data.preview === 'object') ? data.preview : null;
  MaweHistory.gapRemoveDirty = false;
  MaweAppearance.previewGeometryDirty = false;
  projectImportDirty = false;
  // 外部载入的工程没有页面持有的文件句柄；新建/另存为会在载入后重新绑定句柄。
  projectFileHandle = null;
  MawePreviewGeometry.setPreviewGeometry(MaweAppearance.getPreviewGeometry(), { markDirty: false });
  MaweAppearance.applyExtensionSubtitleAppearance(DATA.preview?.extension_subtitle);
  MawePreviewGeometry.setStickerGeometry(MawePreviewGeometry.getStickerGeometry(), { markDirty: false });
  MawePreviewGeometry.refreshPreviewGeometryEditable();
  if (data.sticker_root) STICKER_ROOT = data.sticker_root;
  DATA.segments.length = 0;
  data.segments.forEach((segment) => DATA.segments.push(segment));
  DATA.multi_subtitle = MULTI_SUBTITLE_UTILS.normalizeMultiSubtitle(data.multi_subtitle, DATA.segments);
  MaweHistory.editorHistory.clear();
  MaweHistory.updateUndoRedoButtons();
  MaweSelection.clearSelection();
  MawePlaybackLoop.lastActive = -1;
  if (MaweCoreState.waveformEditor) {
    MaweCoreState.waveformEditor.setLayoutData(DATA.workspace, { render: false });
    MaweDisplaySettings.applyEditorDisplaySettings(DATA.workspace?.editorDisplay);
    restoreWorkspaceSelection();
    syncWorkspaceControls();
    MaweCoreState.waveformLoadedFromProject = MaweCoreState.waveformEditor.setPayload(DATA.waveform, { render: false });
    MaweCoreState.waveformEditor.setSpectralPayload(DATA.spectral, { render: false });
    MaweCoreState.waveformEditor.setReapeaksWaveform(DATA.waveform_reapeaks, { render: false });
  }
  MaweGapRemoveUi.updateGapRemoveUi();
  MaweCuePanel.renderAll({ waveform: 'full', preserveCueListScroll: false });
  MawePlaybackLoop.refreshSubtitlePreview(0, -1);
  updateUnloadedMediaLabel(DATA.media);
  FILENAME_BASE = filename.replace(/\.(json|mosp)$/i, '');
  const jsonEl = document.getElementById('json-name');
  if (jsonEl) {
    jsonEl.textContent = filename;
    jsonEl.title = `点击复制工程文件名：${filename}`;
    jsonEl.classList.remove('empty');
    jsonEl.onclick = () => MaweExportTimeline.copyText(filename, `已复制：${filename}`);
  }
  projectCheckpointed = true;
  configureServerSaveControls();
  scheduleAutoSave();
}

// 新建工程：浏览器原生保存对话框选择位置，页面持有句柄持续写回。
// 不再经过服务器 helper；服务器绑定的旧工程在创建成功后解除保存，避免串写。
async function createProjectCheckpoint(project, suggestedName) {
  if (projectCheckpointInFlight || projectSaveInFlight) {
    MaweHint.flashHint('工程正在保存，请稍候再试', 'warning');
    return false;
  }
  projectCheckpointInFlight = true;
  try {
    if (!window.showSaveFilePicker || !navigator.userActivation?.isActive) {
      // 检查点只用于确认后续导入可以继续；无用户手势时不能弹出保存对话框，
      // 直接建立内存工程检查点，后续仍通过显式导出保存。
      applyCanonicalProject(project, suggestedName);
      detachServerProjectSaving();
      return true;
    }
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'MOSE 工程文件', accept: { 'application/json': ['.mosp', '.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json;charset=utf-8' }));
    await writable.close();
    applyCanonicalProject(project, handle.name);
    projectFileHandle = handle;
    // detachServerProjectSaving 内部会刷新保存控件并重启自动保存。
    detachServerProjectSaving();
    return true;
  } catch (error) {
    if (error && error.name === 'AbortError') return false;  // 用户取消保存对话框
    if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
      try {
        const saved = await MaweExportTimeline.downloadFile(
          JSON.stringify(project, null, 2),
          suggestedName,
          'application/json',
          { desc: 'MOSE 工程文件', types: { 'application/json': ['.mosp', '.json'] } },
          { usePicker: false },
        );
        if (saved) {
          applyCanonicalProject(project, suggestedName);
          detachServerProjectSaving();
          return true;
        }
      } catch (fallbackError) {
        MaweHint.flashHint(`创建工程失败：${fallbackError.message || fallbackError}`, 'warning');
        return false;
      }
    }
    MaweHint.flashHint(`创建工程失败：${error.message || error}`, 'warning');
    return false;
  } finally {
    projectCheckpointInFlight = false;
  }
}

// 浏览器自行管理的工程（句柄或下载创建）不能再写回服务器绑定的旧工程文件，
// 便携表情包 OTIO 也随之退回引用原始素材（服务器已不跟踪当前工程）。
function detachServerProjectSaving() {
  if (SERVER_CONFIG) {
    SERVER_CONFIG.canSave = false;
    SERVER_CONFIG.canPortableStickerExport = false;
    SERVER_CONFIG.canLottieExport = false;
    SERVER_CONFIG.canOgrafExport = false;
  }
  configureServerSaveControls();
  updateLottieExportButton();
  updateOgrafExportButton();
  scheduleAutoSave();
}

async function ensureProjectCheckpointForImport(file, { usePicker = true } = {}) {
  if (projectCheckpointed) return true;
  if (usePicker && window.showSaveFilePicker) {
    return createProjectCheckpoint(buildBlankProject(), suggestedProjectName(file));
  }
  // Drag/drop imports are asynchronous by the time they reach here; do not
  // open a save picker as part of importing a subtitle.
  applyCanonicalProject(buildBlankProject(), suggestedProjectName(file));
  detachServerProjectSaving();
  return true;
}

function isMawProject(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.segments)) return false;
  let previousEnd = 0;
  return data.segments.every((segment) => {
    if (!segment || typeof segment !== 'object'
        || !Number.isInteger(segment.start) || !Number.isInteger(segment.end)
        || segment.start < 0 || segment.end <= segment.start || segment.start < previousEnd
        || typeof segment.text !== 'string') return false;
    previousEnd = segment.end;
    if (!Array.isArray(segment.items)) return segment.items === undefined;
    let itemEnd = segment.start;
    return segment.items.every((item) => {
      if (!item || typeof item !== 'object'
          || !Number.isInteger(item.start) || !Number.isInteger(item.end)
          || item.start < segment.start || item.end > segment.end || item.end <= item.start
          || item.start < itemEnd || typeof item.text !== 'string') return false;
      itemEnd = item.end;
      return true;
    });
  });
}

function parseSrtTimestamp(value) {
  const match = /^(\d+):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4].padEnd(3, '0'));
  if (minutes >= 60 || seconds >= 60) return null;
  return (((hours * 60 + minutes) * 60) + seconds) * 1000 + milliseconds;
}

function parseSrtSegments(text) {
  const blocks = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    if (/^\d+$/.test(lines[0]?.trim() || '')) lines.shift();
    const timing = /^\s*(.+?)\s*-->\s*(.+?)(?:\s+.*)?$/.exec(lines.shift() || '');
    if (!timing) throw new Error('缺少有效时间码');
    const start = parseSrtTimestamp(timing[1]);
    const end = parseSrtTimestamp(timing[2]);
    const cueText = lines.join('\n').trim();
    if (start === null || end === null || end <= start || !cueText) throw new Error('包含无效字幕段');
    const previous = segments[segments.length - 1];
    if (previous && start < previous.end) throw new Error('字幕时间重叠');
    segments.push({ start, end, text: cueText });
  }
  if (!segments.length) throw new Error('没有可导入的字幕');
  return segments;
}

function replaceMainTrack(segments, displayName = '字幕') {
  // 导入/替换主轨是字幕编辑操作，保留替换前的主轨和多字幕状态，
  // 这样用户可以用 Ctrl(Cmd)+Z 回到替换前，而不影响后续重做。
  // 先提交当前编辑区，再替换 DATA；否则 clearSelection() 在替换后提交旧面板
  // 文本时，会把旧字幕写回新导入的同一下标，表现为“导入后又变回旧值”。
  MaweCuePanel.commitCuePanelEdit();
  MaweCuePanelState.currentCuePanelIdx = -1;
  MaweCuePanelState.currentCuePanelKind = 'main';
  MaweCuePanelState.currentCuePanelTrackId = null;
  MaweCuePanelState.resetCuePanelEditState();
  MaweHistory.pushUndo('替换字幕');
  DATA.segments.length = 0;
  (segments || []).forEach((segment) => DATA.segments.push({ ...segment }));
  DATA.multi_subtitle = {
    schema: MULTI_SUBTITLE_UTILS.MULTI_SUBTITLE_SCHEMA,
    enabled: false,
    display_mode: 'both',
    tracks: [],
    bindings: [],
  };
  MULTI_SUBTITLE_UTILS.normalizeMultiSubtitleProject(DATA);
  DATA.gap_remove = null;
  MaweHistory.gapRemoveDirty = false;
  projectImportDirty = true;
  MaweHistory.updateUndoRedoButtons();
  MaweSelection.clearSelection({ commitCuePanel: false });
  MawePlaybackLoop.lastActive = -1;
  MaweGapRemoveUi.updateGapRemoveUi();
  MaweCuePanel.renderAll({ preserveCueListScroll: false });
  FILENAME_BASE = displayName.replace(/\.[^.]+$/i, '');
  const jsonEl = document.getElementById('json-name');
  if (jsonEl) {
    jsonEl.textContent = `导入字幕：${displayName}`;
    jsonEl.title = 'SRT 字幕只能通过导出下载保存为工程文件';
    jsonEl.classList.add('empty');
  }
  configureServerSaveControls();
  scheduleAutoSave();
  MaweHint.flashHint(`已加载字幕：${displayName}（${DATA.segments.length} 条）`, 'success');
  return true;
}

const editorLoading = document.getElementById('editor-loading');
const editorLoadingLabel = document.getElementById('editor-loading-label');
const editorLoadingProgress = document.getElementById('editor-loading-progress');
const editorLoadingProgressValue = document.getElementById('editor-loading-progress-value');
let editorLoadingDepth = 0;

function updateEditorLoading(progress, label = null) {
  if (!editorLoading || editorLoadingDepth <= 0) return;
  const value = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
  if (label) editorLoadingLabel.textContent = label;
  editorLoadingProgress.value = value;
  editorLoadingProgressValue.textContent = `${value}%`;
}

function beginEditorLoading(label, progress = 0) {
  if (!editorLoading) return () => {};
  editorLoadingDepth += 1;
  editorLoading.hidden = false;
  updateEditorLoading(progress, label);
  return () => {
    editorLoadingDepth = Math.max(0, editorLoadingDepth - 1);
    if (!editorLoadingDepth) editorLoading.hidden = true;
  };
}

async function readFileTextWithProgress(file) {
  updateEditorLoading(20, `正在读取 ${file?.name || '文件'}…`);
  return window.AsrEditorUtils.decodeSubtitleText(await file.arrayBuffer());
}

async function parseSubtitleImportFile(file) {
  const finishLoading = beginEditorLoading(`正在读取字幕 ${file.name}…`, 5);
  try {
    if (isSrtFile(file)) return parseSrtSegments(await readFileTextWithProgress(file));
    const data = JSON.parse(await readFileTextWithProgress(file));
    if (!data || !Array.isArray(data.segments)) throw new Error('缺少有效 segments 数组');
    const sourceSegments = data.segments.map((segment) => {
      const copy = {
        start: segment.start,
        end: segment.end,
        text: typeof segment.text === 'string' ? segment.text : '',
      };
      if (Array.isArray(segment.items)) {
        copy.items = segment.items.map((item) => ({ ...item }));
      }
      return copy;
    });
    window.AsrEditorUtils.normalizeSegmentTimings(sourceSegments);
    const validSegments = sourceSegments.filter((segment) => segment.text.trim());
    if (!validSegments.length) {
      throw new Error('副字幕没有可导入的有效文本或时间码');
    }
    return validSegments;
  } finally {
    finishLoading();
  }
}

let pendingMultiImport = null;

function closeMultiSubtitleImportModal() {
  MaweDom.multiSubtitleImportModal?.classList.remove('show');
  pendingMultiImport = null;
  if (MaweDom.multiSubtitleImportChoiceActions) MaweDom.multiSubtitleImportChoiceActions.hidden = false;
  if (MaweDom.multiSubtitleImportResultActions) MaweDom.multiSubtitleImportResultActions.hidden = false;
  if (MaweDom.multiSubtitleImportResultConfirm) MaweDom.multiSubtitleImportResultConfirm.disabled = true;
  [MaweDom.multiSubtitleImportReplace, MaweDom.multiSubtitleImportExtension].forEach((button) => {
    button?.setAttribute('aria-pressed', 'false');
  });
}

function renderMultiImportPreview(match = null, segments = []) {
  if (!MaweDom.multiSubtitleImportPreview) return;
  if (!match) {
    MaweDom.multiSubtitleImportPreview.hidden = true;
    MaweDom.multiSubtitleImportPreview.innerHTML = `<div class="summary">共 ${segments.length} 条待导入字幕</div>`;
    return;
  }
  MaweDom.multiSubtitleImportPreview.hidden = false;
  MaweDom.multiSubtitleImportPreview.innerHTML = [
    `<div class="summary">副字幕 ${segments.length} 条 · 自动绑定 ${match.matches.length} 条</div>`,
    `<div>未绑定 ${match.unmatchedExtension.length} 条 · 主轨未绑定 ${match.unmatchedMain.length} 条 · 冲突 ${match.conflicts} 组</div>`,
    `<div class="warning">时间容差：${match.tolerance_ms}ms。未绑定字幕会保留，可稍后手动绑定。</div>`,
  ].join('');
}

function renderMainImportPreview(pending) {
  if (!MaweDom.multiSubtitleImportPreview) return;
  MaweDom.multiSubtitleImportPreview.hidden = false;
  MaweDom.multiSubtitleImportPreview.innerHTML = [
    `<div class="summary">将替换当前主字幕</div>`,
    `<div>${MaweCueElements.escapeHtml(pending.file.name)} · ${pending.segments.length} 条字幕</div>`,
    '<div>导入后仍可使用撤销恢复当前字幕。</div>',
  ].join('');
}

function renderProjectImportPreview(pending) {
  if (!MaweDom.multiSubtitleImportPreview) return;
  const itemCount = pending.segments.reduce((count, segment) => (
    count + (Array.isArray(segment.items) ? segment.items.length : 0)
  ), 0);
  MaweDom.multiSubtitleImportPreview.hidden = false;
  MaweDom.multiSubtitleImportPreview.innerHTML = [
    `<div class="summary">工程字幕 ${pending.segments.length} 条${itemCount ? ` · 字词时间码 ${itemCount} 项` : ''}</div>`,
    `<div>${MaweCueElements.escapeHtml(pending.file.name)}</div>`,
    '<div>打开工程会替换当前工程；使用工程字幕作为副字幕只导入字幕和可选字词时间码。</div>',
  ].join('');
}

async function showMultiSubtitleImportChoice(file, segments, options = {}) {
  const existingTrack = MaweMultiSubtitleCore.getActiveExtensionTrack();
  const projectFile = options.projectFile || null;
  const projectImport = Boolean(projectFile);
  pendingMultiImport = {
    file,
    segments,
    existingTrackId: existingTrack?.id || null,
    match: null,
    choice: null,
    projectFile,
    projectMediaFile: options.projectMediaFile || null,
    projectImport,
  };
  if (MaweDom.multiSubtitleImportDescription) MaweDom.multiSubtitleImportDescription.textContent = '请选择你要执行的行为：';
  if (MaweDom.multiSubtitleImportReplace) {
    MaweDom.multiSubtitleImportReplace.textContent = projectImport
      ? '打开工程' : (existingTrack ? '替换副轨' : '替换当前字幕');
  }
  if (MaweDom.multiSubtitleImportExtension) {
    MaweDom.multiSubtitleImportExtension.hidden = projectImport ? false : Boolean(existingTrack);
    MaweDom.multiSubtitleImportExtension.textContent = projectImport
      ? '使用工程字幕作为副字幕' : '作为多重字幕';
  }
  if (MaweDom.multiSubtitleImportChoiceActions) MaweDom.multiSubtitleImportChoiceActions.hidden = false;
  if (MaweDom.multiSubtitleImportResultActions) MaweDom.multiSubtitleImportResultActions.hidden = false;
  if (MaweDom.multiSubtitleImportResultConfirm) MaweDom.multiSubtitleImportResultConfirm.disabled = true;
  [MaweDom.multiSubtitleImportReplace, MaweDom.multiSubtitleImportExtension].forEach((button) => {
    button?.setAttribute('aria-pressed', 'false');
  });
  if (projectImport) renderProjectImportPreview(pendingMultiImport);
  else renderMultiImportPreview(null, segments);
  MaweDom.multiSubtitleImportModal?.classList.add('show');
  // 工程文件必须明确选择“打开”或“作为副字幕”；SRT 保持原有默认导入路径。
  if (!projectImport) prepareMultiSubtitleImport();
  (projectImport ? MaweDom.multiSubtitleImportReplace
    : (existingTrack ? MaweDom.multiSubtitleImportReplace : MaweDom.multiSubtitleImportExtension))?.focus();
}

function prepareMultiSubtitleImport() {
  const pending = pendingMultiImport;
  if (!pending) return;
  pending.choice = pending.existingTrackId ? 'replace-extension' : 'extension';
  const match = MULTI_SUBTITLE_UTILS.matchSubtitleSegments(
    DATA.segments,
    pending.segments,
    MULTI_SUBTITLE_TOLERANCE_MS,
  );
  pending.match = match;
  renderMultiImportPreview(match, pending.segments);
  if (MaweDom.multiSubtitleImportReplace) {
    MaweDom.multiSubtitleImportReplace.setAttribute('aria-pressed', pending.choice === 'replace-extension' ? 'true' : 'false');
  }
  if (MaweDom.multiSubtitleImportExtension) {
    MaweDom.multiSubtitleImportExtension.setAttribute('aria-pressed', pending.choice === 'extension' ? 'true' : 'false');
  }
  if (MaweDom.multiSubtitleImportResultConfirm) MaweDom.multiSubtitleImportResultConfirm.disabled = false;
}

function commitMultiSubtitleImport() {
  const pending = pendingMultiImport;
  if (!pending) return false;
  const match = pending.match || MULTI_SUBTITLE_UTILS.matchSubtitleSegments(
    DATA.segments, pending.segments, MULTI_SUBTITLE_TOLERANCE_MS,
  );
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  const replacing = Boolean(pending.existingTrackId);
  const oldTrack = replacing ? MaweMultiSubtitleCore.getExtensionTrack(pending.existingTrackId) : null;
  const trackId = oldTrack?.id || MULTI_SUBTITLE_UTILS.uniqueStableSegmentId(
    multi.tracks || [], 'extension-1', 'extension',
  );
  const extensionSegments = pending.segments.map((segment, index) => ({
    ...segment,
    id: MULTI_SUBTITLE_UTILS.uniqueStableSegmentId(
      pending.segments.slice(0, index), `${trackId}-segment-${String(index + 1).padStart(3, '0')}`, `${trackId}-segment`,
    ),
    _dirty: true,
  }));
  const track = {
    id: trackId,
    role: 'extension',
    name: pending.file.name.replace(/\.[^.]+$/i, '') || '副字幕',
    language: '',
    source_name: pending.file.name,
    split_mode: MULTI_SUBTITLE_UTILS.detectSubtitleSplitMode(
      extensionSegments.map((segment) => segment.text).join('\n'),
    ),
    segments: extensionSegments,
  };
  MaweHistory.pushUndo(replacing ? '替换副字幕' : '导入多重字幕');
  if (replacing) {
    const oldIds = new Set(oldTrack?.segments?.map((segment) => segment.id) || []);
    multi.bindings = (multi.bindings || []).filter((binding) => (
      binding.track_id !== trackId && !binding.extension_segment_ids?.some((id) => oldIds.has(id))
    ));
    const oldIndex = multi.tracks.findIndex((candidate) => candidate.id === trackId);
    if (oldIndex >= 0) multi.tracks.splice(oldIndex, 1, track);
    else multi.tracks.push(track);
  } else {
    multi.tracks = [track, ...(multi.tracks || []).filter((candidate) => candidate.id !== trackId)];
  }
  match.matches.forEach((candidate) => {
    const main = DATA.segments[candidate.mainIndex];
    const extension = extensionSegments[candidate.extensionIndex];
    if (main && extension) multi.bindings.push(
      MULTI_SUBTITLE_UTILS.buildSubtitleBinding(main, extension, trackId),
    );
  });
  multi.enabled = true;
  multi.display_mode = multi.display_mode || 'both';
  MaweMultiSubtitleCore.markMainSegmentsDirty(DATA.segments.filter((_, index) => match.matches.some((candidate) => candidate.mainIndex === index)));
  MaweMultiSubtitleCore.markMultiSubtitleDirty();
  closeMultiSubtitleImportModal();
  MaweSelection.clearSelection();
  // 导入可能首次创建副字幕 lane，必须重建波形行结构。
  MaweCuePanel.renderAll({ waveform: 'full' });
  MawePlaybackLoop.updateWithoutCueListAutoScroll();
  MaweHint.flashHint(`已导入副字幕：绑定 ${match.matches.length} 条，未绑定 ${match.unmatchedExtension.length} 条`, 'success');
  return true;
}

function swapMainAndExtensionSubtitles() {
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
  if (!multi.enabled) {
    MaweHint.flashHint('请先开启多重字幕', 'invalid');
    return false;
  }
  if ((multi.tracks || []).length !== 1) {
    MaweHint.flashHint('当前只支持交换唯一的副字幕轨', 'invalid');
    return false;
  }
  if (!track?.segments?.length || !DATA.segments.length) {
    MaweHint.flashHint('主字幕和副字幕都不能为空', 'invalid');
    return false;
  }
  MaweHistory.pushUndo('交换主副字幕');
  const result = MULTI_SUBTITLE_UTILS.swapMainAndExtensionSubtitle(DATA, track.id);
  if (!result.swapped) {
    MaweHint.flashHint('交换主副字幕失败', 'warning');
    return false;
  }
  MaweMultiSubtitleCore.markMainSegmentsDirty(DATA.segments);
  MaweMultiSubtitleCore.markMultiSubtitleDirty();
  MaweSelection.clearSelection();
  MaweCuePanel.renderAll({ waveform: 'full' });
  MawePlaybackLoop.updateWithoutCueListAutoScroll();
  MaweHint.flashHint(`已交换主副字幕：主轨 ${result.mainCount} 条，副轨 ${result.extensionCount} 条`, 'success');
  return true;
}

async function openSrtFile(file) {
  const finishLoading = beginEditorLoading(`正在读取字幕 ${file.name}…`, 5);
  try {
    const segments = parseSrtSegments(await readFileTextWithProgress(file));
    updateEditorLoading(75, `正在载入字幕 ${file.name}…`);
    if (!await ensureProjectCheckpointForImport(file)) return false;
    const imported = replaceMainTrack(segments, file.name);
    if (imported && projectSaveTargetEnabled()) await saveCurrentProject({ silent: true });
    return imported;
  } catch (error) {
    MaweHint.flashHint(`加载字幕失败：${error.message || error}`, 'warning');
    return false;
  } finally {
    finishLoading();
  }
}

async function openProjectFile(file, options = {}) {
  const suppressMediaPrompt = options.suppressMediaPrompt === true;
  const finishLoading = beginEditorLoading(`正在读取工程 ${file.name}…`, 5);
  try {
    const text = await readFileTextWithProgress(file);
    updateEditorLoading(60, `正在解析工程 ${file.name}…`);
    const data = JSON.parse(text);
    // 先兜底修复 0 长/倒挂时间码（保底 100ms），再校验结构，让旧工程仍能打开。
    if (data && Array.isArray(data.segments)) {
      window.AsrEditorUtils.normalizeSegmentTimings(data.segments);
      window.AsrEditorUtils.repairGroupReferenceIndices(data.segments);
      MULTI_SUBTITLE_UTILS.normalizeMultiSubtitleProject(data);
      normalizeProjectTimings(data);
    }
    if (!isMawProject(data)) {
      MaweHint.flashHint('打开了错误的文件，请使用 MAW 生成的工程文件。', 'warning');
      return false;
    }
    applyCanonicalProject(data, file.name);
    // 工程可能携带新 sticker_root；刷新表情包导出按钮的互斥灰显状态
    MaweExportTimeline.updateStickerExportButtons();
    projectLoadedFromSrt = false;
    const expectedName = window.AsrEditorUtils.fileBasename(DATA.media);
    // 服务器版：浏览器拿不到工程真实路径，但工程记录的媒体是绝对路径。
    // 先让服务器按它定位同目录同名工程并接管（自动加载媒体、允许 Ctrl(Cmd)+S 保存）；
    // 接管失败（媒体已移动 / 同名工程缺失 / 内容不一致）再回退为手动选择媒体。
    if (expectedName && SERVER_CONFIG?.attachUrl) {
      updateEditorLoading(85, '正在连接本地编辑器服务器…');
      if (await attachProjectToServer(file.name, data)) return true;
    }
    // 工程未被服务器接管（无媒体可定位 / 接管失败）：服务器仍绑定旧工程，
    // 当前内容不能再写回它；后续保存退化为「导出工程」，直到重新经服务器打开。
    if (SERVER_CONFIG?.saveUrl) detachServerProjectSaving();
    if (expectedName && !suppressMediaPrompt) {
      pendingProjectMediaSelection = { projectReady: true };
      showProjectMediaModal();
    }
    MaweHint.flashHint(expectedName
      ? `已加载工程：${file.name}（${suppressMediaPrompt ? '正在加载关联媒体' : `等待选择关联媒体：${expectedName}`}）`
      : `已加载工程：${file.name}（${DATA.segments.length} 条字幕）`);
    return true;
  } catch (error) {
    pendingProjectMediaSelection = null;
    MaweHint.flashHint(error instanceof SyntaxError
      ? '打开了错误的文件，请使用 MAW 生成的工程文件。'
      : `加载失败：${error.message}`, 'warning');
    console.error(error);
    return false;
  } finally {
    finishLoading();
  }
}

document.getElementById('new-project')?.addEventListener('click', async () => {
  if (hasUnsavedProjectChanges()
      && !confirm('当前有未保存的改动，是否确定新建工程？将丢失未保存内容。')) return;
  await createProjectCheckpoint(buildBlankProject(), suggestedProjectName());
});

document.getElementById('open-project')?.addEventListener('click', () => {
  if (hasUnsavedProjectChanges()) {
    if (!confirm('当前有未保存的改动，是否确定打开新工程？将丢失未保存内容。')) return;
  }
  openProjectFileInput.value = '';
  openProjectFileInput.click();
});

openProjectFileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file || !isJsonFile(file)) {
    MaweHint.flashHint('请选择一个 .mosp 或 .json 工程文件。', 'invalid');
    return;
  }
  await openProjectFile(file);
});

// === 加载媒体 ===
// 通过浏览器文件选择器选本地媒体（视频/音频），用 blob URL 替换播放器源。
// 如果媒体类型与当前播放器标签不一致（video<->audio），会原地替换整个 <video>/<audio> 元素。
document.getElementById('load-media')?.addEventListener('click', () => {
  pendingProjectMediaSelection = null;
  loadMediaFileInput.value = '';
  loadMediaFileInput.click();
});
document.getElementById('load-srt')?.addEventListener('click', () => {
  MaweMultiSubtitleCore.pendingSrtImportAsExtension = false;
  if (hasUnsavedProjectChanges()
      && !confirm('当前有未保存的改动，是否确定加载字幕？将替换当前字幕。')) return;
  loadSrtFileInput.value = '';
  loadSrtFileInput.click();
});

loadSrtFileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  const importAsExtension = MaweMultiSubtitleCore.pendingSrtImportAsExtension;
  MaweMultiSubtitleCore.pendingSrtImportAsExtension = false;
  if (!file) return;
  if (importAsExtension) {
    try {
      const segments = await parseSubtitleImportFile(file);
      await showMultiSubtitleImportChoice(file, segments);
    } catch (error) {
      MaweHint.flashHint(`导入字幕失败：${error.message || error}`, 'warning');
    }
    return;
  }
  await openSrtFile(file);
});

MaweDom.multiSubtitleImportResultCancel?.addEventListener('click', closeMultiSubtitleImportModal);
MaweDom.multiSubtitleImportExtension?.addEventListener('click', prepareMultiSubtitleImport);
MaweDom.multiSubtitleImportReplace?.addEventListener('click', () => {
  const pending = pendingMultiImport;
  if (!pending) return;
  if (pending.projectImport) {
    pending.choice = 'open-project';
    pending.match = null;
    MaweDom.multiSubtitleImportReplace?.setAttribute('aria-pressed', 'true');
    MaweDom.multiSubtitleImportExtension?.setAttribute('aria-pressed', 'false');
    renderProjectImportPreview(pending);
    if (MaweDom.multiSubtitleImportResultConfirm) MaweDom.multiSubtitleImportResultConfirm.disabled = false;
    return;
  }
  if (pending.existingTrackId) {
    prepareMultiSubtitleImport();
    return;
  }
  pending.choice = 'replace-main';
  pending.match = null;
  if (MaweDom.multiSubtitleImportReplace) MaweDom.multiSubtitleImportReplace.setAttribute('aria-pressed', 'true');
  if (MaweDom.multiSubtitleImportExtension) MaweDom.multiSubtitleImportExtension.setAttribute('aria-pressed', 'false');
  renderMainImportPreview(pending);
  if (MaweDom.multiSubtitleImportResultConfirm) MaweDom.multiSubtitleImportResultConfirm.disabled = false;
});
MaweDom.multiSubtitleImportResultConfirm?.addEventListener('click', async () => {
  const pending = pendingMultiImport;
  if (!pending?.choice) return;
  if (pending.choice === 'open-project') {
    const { projectFile, projectMediaFile } = pending;
    closeMultiSubtitleImportModal();
    const opened = await openProjectFile(projectFile, { suppressMediaPrompt: Boolean(projectMediaFile) });
    if (opened && projectMediaFile) await loadMediaFile(projectMediaFile);
    return;
  }
  if (pending.choice === 'replace-main') {
    const { segments, file } = pending;
    closeMultiSubtitleImportModal();
    replaceMainTrack(segments, file.name);
    return;
  }
  commitMultiSubtitleImport();
});
MaweDom.multiSubtitleImportModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.multiSubtitleImportModal) closeMultiSubtitleImportModal();
});
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
  closeMultiSubtitleImportModal();
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

async function loadMediaFile(file) {
  if (!file) return;
  const finishLoading = beginEditorLoading(`正在加载媒体 ${file.name}…`, 5);
  try {
  MaweJklPlayback.stop({ render: false });
  const preserveProjectWaveform = MaweCoreState.waveformLoadedFromProject
    && Boolean(MaweCoreState.waveformEditor?.getPayload?.());
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/') ||
    /\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v)$/i.test(file.name);
  const oldPlayer = document.getElementById('player');
  const wantTag = isVideo ? 'VIDEO' : 'AUDIO';
  const oldParent = oldPlayer.parentNode;
  const previousSource = oldPlayer.querySelector('source')?.src || oldPlayer.currentSrc || oldPlayer.src || '';
  let candidatePlayer = oldPlayer;

  if (oldPlayer.tagName === wantTag) {
    // 同类型：直接换 src，最简最安全
    const src = oldPlayer.querySelector('source');
    if (src) src.src = url; else oldPlayer.src = url;
    oldPlayer.load();
  } else {
    // 不同类型：替换整个元素
    const newPlayer = document.createElement(isVideo ? 'video' : 'audio');
    newPlayer.id = 'player';
    newPlayer.preload = 'metadata';
    if (isVideo) {
      newPlayer.style.cssText = 'width:100%;background:#000;display:block;';
    } else {
      newPlayer.style.cssText = 'width:100%;display:block;';
    }
    const source = document.createElement('source');
    source.src = url;
    newPlayer.appendChild(source);
    oldPlayer.parentNode.replaceChild(newPlayer, oldPlayer);
    candidatePlayer = newPlayer;
    // 重新绑定全局引用与事件
    MaweCoreState.player = newPlayer;
    MaweMediaPlayback.bindPlayerEvents(MaweCoreState.player);
    MaweNavPreview.seekWarned = false;  // 新媒体重新探测 seek 能力
    MaweNavPreview.pendingMediaSeekTimeSec = null;
    MaweNavPreview.autoLoadedMediaReadyNotified = false;
  }

  try {
    updateEditorLoading(45, `正在读取媒体信息 ${file.name}…`);
    await waitForMediaMetadata(candidatePlayer, file);
  } catch (error) {
    if (candidatePlayer !== oldPlayer && oldParent) {
      oldParent.replaceChild(oldPlayer, candidatePlayer);
      MaweCoreState.player = oldPlayer;
      MaweCoreState.waveformEditor?.attachPlayer(MaweCoreState.player);
    } else if (previousSource) {
      const previous = oldPlayer.querySelector('source');
      if (previous) previous.src = previousSource; else oldPlayer.src = previousSource;
      oldPlayer.load();
    } else {
      oldPlayer.removeAttribute('src');
      oldPlayer.querySelector('source')?.removeAttribute('src');
    }
    URL.revokeObjectURL(url);
    syncPlayerPlaceholder();
    MaweHint.flashHint(error.message || `媒体加载失败：${file.name}`, 'warning');
    return false;
  }

  let mediaTimeReference = null;
  try {
    mediaTimeReference = await window.AsrEditorUtils.readBwfTimeReferenceFromFile(file);
  } catch (_) {
    // BWF metadata is optional; an unreadable header must not block playback.
  }

  if (MaweCoreState.waveformEditor) MaweCoreState.waveformEditor.attachPlayer(MaweCoreState.player);
  syncPlayerPlaceholder();
  // 部分浏览器会在 load() 完成前暂时不给 currentSrc；文件既已由用户选定，立即恢复彩色波形。
  MaweCoreState.waveformEditor?.setMediaAvailable(true);

  // 释放旧 blob URL（不会影响 file:// 加载的原始媒体——那不是 blob URL）
  if (currentMediaBlobUrl) URL.revokeObjectURL(currentMediaBlobUrl);
  currentMediaBlobUrl = url;

  // 更新标题区媒体名 + FILENAME_BASE（用文件名去扩展名作为导出基名）
  const stem = file.name.replace(/\.[^.]+$/, '');
  FILENAME_BASE = stem;
  DATA.media = file.name;
  DATA.media_time_reference = mediaTimeReference;
  const mnEl = document.getElementById('media-name');
  if (mnEl) {
    mnEl.textContent = file.name;
    mnEl.title = `点击复制媒体名：${file.name}`;
    mnEl.classList.remove('empty');
    mnEl.onclick = () => MaweExportTimeline.copyText(file.name, `已复制媒体名：${file.name}`);
  }

  MawePlaybackLoop.lastActive = -1;
  MaweHint.flashHint(translatedEditorText(`已加载媒体：${file.name}`), 'success');
  if (MaweCoreState.waveformEditor && !preserveProjectWaveform) {
    try {
      DATA.spectral = null;
      DATA.waveform_reapeaks = null;
      MaweCoreState.waveformEditor.setSpectralPayload(null);
      MaweCoreState.waveformEditor.setReapeaksWaveform(null);
      updateEditorLoading(75, `正在生成波形 ${file.name}…`);
      await MaweCoreState.waveformEditor.processFile(file);
    } catch (error) {
      MaweHint.flashHint(error.message || String(error), 'warning');
    }
  }
  updateEditorLoading(100, `媒体加载完成：${file.name}`);
  MaweGapRemoveUi.updateGapRemoveUi();
  return true;
  } finally {
    finishLoading();
  }
}

async function loadReapeaksFile(file) {
  if (!file || !MaweCoreState.isReapeaksFile(file) || !MaweCoreState.waveformEditor) return false;
  try {
    const parsed = window.AsrWaveform.testing.decodeReapeaksFile(
      await file.arrayBuffer(),
      { name: file.name, size: file.size, modified_ms: file.lastModified },
    );
    if (!parsed?.waveform) throw new Error('无法解析 .ReaPeaks 文件或文件不包含 wave 层');
    DATA.waveform_reapeaks = parsed.waveform;
    DATA.spectral = parsed.spectral;
    MaweCoreState.waveformEditor.setReapeaksWaveform(parsed.waveform);
    MaweCoreState.waveformEditor.setSpectralPayload(parsed.spectral);
    MaweCoreState.waveformEditor.setMediaAvailable(false);
    MaweHint.flashHint(`已加载 ReaPeaks 缓存：${file.name}`, 'success');
    return true;
  } catch (error) {
    MaweHint.flashHint(`加载 ReaPeaks 失败：${error.message || error}`, 'warning');
    return false;
  }
}

function waitForMediaMetadata(mediaElement, file) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error(mediaLoadErrorMessage(file))), 8000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      mediaElement.removeEventListener('loadedmetadata', onLoaded);
      mediaElement.removeEventListener('error', onError);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolve();
    };
    const onLoaded = () => finish();
    const onError = () => finish(new Error(mediaLoadErrorMessage(file)));
    mediaElement.addEventListener('loadedmetadata', onLoaded, { once: true });
    mediaElement.addEventListener('error', onError, { once: true });
    if (mediaElement.readyState >= 1) queueMicrotask(onLoaded);
  });
}

function mediaLoadErrorMessage(file) {
  const name = String(file?.name || '媒体文件');
  if (/\.flv$/i.test(name)) {
    return `无法播放 ${name}：当前浏览器未能解码 FLV，请先用 FFmpeg 转成 MP4。`;
  }
  return `无法播放 ${name}：浏览器不支持该媒体格式或编码。`;
}

loadMediaFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!pendingProjectMediaSelection && !await ensureProjectCheckpointForImport(file)) return;
  pendingProjectMediaSelection = null;
  const imported = await loadMediaFile(file);
  if (imported) {
    projectImportDirty = true;
    if (projectSaveTargetEnabled()) await saveCurrentProject({ silent: true });
  }
});

loadMediaFileInput.addEventListener('cancel', () => {
  pendingProjectMediaSelection = null;
});

// === 表情包根目录配置 ===
const stickerRootModal = document.getElementById('sticker-root-modal');
const stickerRootInput = document.getElementById('sticker-root-input');
const stickerRootRead = document.getElementById('sticker-root-read');
const stickerRootStatus = document.getElementById('sticker-root-status');
const stickerRootServerEnabled = Boolean(SERVER_CONFIG?.stickerRootUrl);
let stickerRootReturnFocus = null;
let stickerRootHintCard = null;

function setStickerRootStatus(message) {
  stickerRootStatus.textContent = message;
}

function setStickerRootModalOpen(open) {
  if (open) {
    stickerRootReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    stickerRootModal.classList.add('show');
    const initialFocus = stickerRootServerEnabled
      ? stickerRootInput : document.getElementById('sticker-root-cancel');
    setTimeout(() => initialFocus.focus(), 50);
    return;
  }
  stickerRootModal.classList.remove('show');
  stickerRootReturnFocus?.focus();
  stickerRootReturnFocus = null;
}

document.getElementById('sticker-root-confirm')?.addEventListener('click', () => {
  const newRoot = stickerRootInput.value.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  STICKER_ROOT = newRoot;
  MaweExportTimeline.updateStickerExportButtons();
  stickerRootModal.classList.remove('show');
  stickerRootReturnFocus?.focus();
  stickerRootReturnFocus = null;
  // 重新渲染所有 cue 让 sticker URL 用新根目录拼接
  MaweCuePanel.renderAll();
  MaweHint.flashHint(newRoot ? `根目录已更新` : '已清空根目录', 'success');
});

function flashStickerRootHint(message, type) {
  stickerRootHintCard?.remove();
  stickerRootHintCard = MaweHint.flashHint(message, type);
}

if (!stickerRootServerEnabled) {
  stickerRootInput.disabled = true;
  stickerRootRead.disabled = true;
}

document.getElementById('sticker-root-btn')?.addEventListener('click', () => {
  stickerRootInput.value = STICKER_ROOT || '';
  setStickerRootStatus(stickerRootServerEnabled
    ? (STICKER_ROOT
      ? `当前路径已读取 ${Number(SERVER_CONFIG.initialStickerCount) || STICKERS.length} 张图片。可输入 Windows、macOS 或 Linux 绝对路径。`
      : '请输入绝对路径，例如 C:\\Media\\Stickers、/Users/name/Stickers 或 /home/name/Stickers。')
    : '仅 Server 编辑器可以读取和验证表情包绝对路径。');
  setStickerRootModalOpen(true);
});

document.getElementById('sticker-root-cancel')?.addEventListener('click', () => setStickerRootModalOpen(false));
stickerRootModal?.addEventListener('click', (event) => {
  if (event.target === stickerRootModal) setStickerRootModalOpen(false);
});
stickerRootModal?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    setStickerRootModalOpen(false);
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...stickerRootModal.querySelectorAll('input:not(:disabled), button:not(:disabled)')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

stickerRootRead.addEventListener('click', async () => {
  if (!stickerRootServerEnabled || stickerRootRead.disabled) return;
  const path = stickerRootInput.value.trim();
  stickerRootHintCard?.remove();
  stickerRootHintCard = null;
  stickerRootRead.disabled = true;
  stickerRootInput.disabled = true;
  setStickerRootStatus('正在读取并验证表情包目录…');
  try {
    const response = await fetch(new URL(SERVER_CONFIG.stickerRootUrl, window.location.href), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestToken: SERVER_CONFIG.requestToken, path }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || `服务器返回 ${response.status}`);
    STICKERS.splice(0, STICKERS.length, ...result.stickers);
    STICKER_ROOT = result.root;
    SERVER_CONFIG.initialStickerCount = result.count;
    stickerRootInput.value = result.root;
    stickerAssetRevision += 1;
    projectImportDirty = true;
    MaweCuePanel.renderAll();
    setStickerRootStatus(`路径有效，已读取 ${result.count} 张图片。`);
    flashStickerRootHint(`表情包根目录已更新，读取 ${result.count} 张图片`, 'success');
  } catch (error) {
    setStickerRootStatus(`读取失败：${error.message || error}。当前有效根目录和表情包保持不变。`);
    flashStickerRootHint(`表情包根目录读取失败：${error.message || error}`, 'warning');
  } finally {
    stickerRootRead.disabled = false;
    stickerRootInput.disabled = false;
    stickerRootInput.focus();
  }
});

// === 批量替换 ===
const findInput = document.getElementById('find-input');
const replaceInput = document.getElementById('replace-input');
const caseSensitiveCb = document.getElementById('case-sensitive');
const useRegexCb = document.getElementById('use-regex');
const replacePreview = document.getElementById('replace-preview');
const replaceScopeInfo = document.getElementById('replace-scope-info');
const replaceModalTitle = document.getElementById('replace-modal-title');
const replaceSelectedOnlyCb = document.getElementById('replace-selected-only');
const replaceSelectedOnlyHint = document.getElementById('replace-selected-only-hint');

// null = 全部；[idxs] = 仅这些行
let replaceScope = null;
let replaceSelectionSnapshot = [];

function normalizeBatchSelection(indexes) {
  const candidates = Array.isArray(indexes) ? indexes : [...MaweSelection.selectedIdxs];
  return [...new Set(candidates
    .filter((index) => Number.isInteger(index) && index >= 0 && index < DATA.segments.length))]
    .sort((a, b) => a - b);
}

function getReplaceTargets() {
  if (replaceScope && replaceScope.length) {
    return replaceScope.map(i => DATA.segments[i]).filter(Boolean);
  }
  return DATA.segments;
}

function buildReplaceRegex() {
  const find = findInput.value;
  if (!find) return null;
  const flags = (caseSensitiveCb.checked ? '' : 'i') + 'g';
  if (useRegexCb.checked) {
    try { return new RegExp(find, flags); } catch (e) { return { error: e.message }; }
  } else {
    return new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  }
}

function updatePreview() {
  const find = findInput.value;
  replacePreview.replaceChildren();
  if (!find) {
    replacePreview.textContent = '输入查找内容查看预览';
    replacePreview.style.color = '#888';
    return;
  }
  const targetIndexes = replaceScope && replaceScope.length
    ? replaceScope : DATA.segments.map((_, index) => index);
  const result = window.AsrEditorUtils.buildReplacementPreview(
    DATA.segments,
    targetIndexes,
    find,
    replaceInput.value,
    { caseSensitive: caseSensitiveCb.checked, useRegex: useRegexCb.checked },
  );
  if (result.error) {
    replacePreview.textContent = `正则错误: ${result.error}`;
    replacePreview.style.color = '#ffaaaa';
    return;
  }
  replacePreview.style.color = result.matchCount ? '#9ed4a4' : '#888';
  const summary = document.createElement('div');
  summary.className = 'replace-preview-summary';
  summary.textContent = result.matchCount
    ? `将在 ${result.lineCount} 行中替换 ${result.matchCount} 处匹配（展开查看前后文本）`
    : '没有匹配';
  replacePreview.appendChild(summary);
  result.rows.forEach((row) => {
    const details = document.createElement('details');
    details.className = 'replace-preview-row';
    const title = document.createElement('summary');
    title.textContent = `第 ${row.index + 1} 条 · ${row.matchCount} 处`;
    details.appendChild(title);
    const before = document.createElement('div');
    before.className = 'replace-preview-before';
    before.textContent = `替换前：${row.before}`;
    const after = document.createElement('div');
    after.className = 'replace-preview-after';
    after.textContent = `替换后：${row.after}`;
    details.append(before, after);
    replacePreview.appendChild(details);
  });
}

function refreshScopeInfo() {
  if (replaceScope && replaceScope.length) {
    replaceModalTitle.textContent = `批量替换（仅 ${replaceScope.length} 条选中）`;
    replaceScopeInfo.textContent = `范围限定为已选中的 ${replaceScope.length} 条字幕`;
    replaceScopeInfo.style.color = '#d4a04a';
  } else {
    replaceModalTitle.textContent = '批量替换';
    replaceScopeInfo.textContent = `范围：全部 ${DATA.segments.length} 条字幕`;
    replaceScopeInfo.style.color = '#888';
  }
}

function refreshReplaceSelectionControl() {
  if (!replaceSelectedOnlyCb) return;
  const available = replaceSelectionSnapshot.length > 0;
  replaceSelectedOnlyCb.disabled = !available;
  if (!available) replaceSelectedOnlyCb.checked = false;
  if (replaceSelectedOnlyHint) replaceSelectedOnlyHint.hidden = available;
  replaceScope = replaceSelectedOnlyCb.checked ? [...replaceSelectionSnapshot] : null;
  refreshScopeInfo();
}

[findInput, replaceInput].forEach(el => el.addEventListener('input', updatePreview));
[caseSensitiveCb, useRegexCb].forEach(el => el.addEventListener('change', updatePreview));
replaceSelectedOnlyCb?.addEventListener('change', () => {
  replaceScope = replaceSelectedOnlyCb.checked ? [...replaceSelectionSnapshot] : null;
  refreshScopeInfo();
  updatePreview();
});

function openReplaceModal(scope) {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  replaceSelectionSnapshot = normalizeBatchSelection(
    Array.isArray(scope) && scope.length ? scope : [...MaweSelection.selectedIdxs],
  );
  replaceSelectedOnlyCb.checked = replaceSelectionSnapshot.length > 0;
  refreshReplaceSelectionControl();
  refreshScopeInfo();
  MaweDom.replaceModal.classList.add('show');
  setTimeout(() => findInput.focus(), 50);
  updatePreview();
}

document.getElementById('replace-btn')?.addEventListener('click', () => openReplaceModal(null));
document.getElementById('replace-cancel')?.addEventListener('click', () => MaweDom.replaceModal.classList.remove('show'));
MaweDom.replaceModal.addEventListener('click', (e) => { if (e.target === MaweDom.replaceModal) MaweDom.replaceModal.classList.remove('show'); });
document.getElementById('replace-confirm')?.addEventListener('click', () => {
  const re = buildReplaceRegex();
  if (!re || re.error) return;
  const repl = replaceInput.value;
  // 先 dry-run 确认是否真的会改动，避免空操作压栈
  let willChange = 0;
  getReplaceTargets().forEach(s => {
    re.lastIndex = 0;
    if (s.text.replace(re, repl) !== s.text) willChange++;
  });
  if (willChange === 0) {
    MaweDom.replaceModal.classList.remove('show');
    MaweHint.flashHint('没有匹配的内容', 'invalid');
    return;
  }
  MaweHistory.pushUndo('批量替换');
  let changedRows = 0;
  getReplaceTargets().forEach(s => {
    re.lastIndex = 0;
    const newText = s.text.replace(re, repl);
    if (newText !== s.text) { s.text = newText; s._dirty = true; changedRows++; }
  });
  MaweDom.replaceModal.classList.remove('show');
  MaweCuePanel.renderAll();
  MaweHint.flashHint(`已修改 ${changedRows} 行`, 'success');
});

// === 文本处理 ===
const textProcessButton = document.getElementById('text-process-btn');
const textProcessSelectedOnlyCb = document.getElementById('text-process-selected-only');
const textProcessSelectedOnlyHint = document.getElementById('text-process-selected-only-hint');
const textProcessScopeInfo = document.getElementById('text-process-scope-info');
const textProcessPreview = document.getElementById('text-process-preview');
const textProcessConfirm = document.getElementById('text-process-confirm');
const textProcessTrim = document.getElementById('text-process-trim');
const textProcessCapitalize = document.getElementById('text-process-capitalize');
const textProcessPrefix = document.getElementById('text-process-prefix');
const textProcessPrefixInput = document.getElementById('text-process-prefix-input');
const textProcessSuffix = document.getElementById('text-process-suffix');
const textProcessSuffixInput = document.getElementById('text-process-suffix-input');
const textProcessStripMarkdown = document.getElementById('text-process-strip-markdown');
let textProcessSelectionSnapshot = [];
let textProcessScope = null;

function textProcessSelectionTargets() {
  const targets = [...MaweSelection.selectedIdxs]
    .sort((a, b) => a - b)
    .map((index) => ({ kind: 'main', index }));
  const extensionTrack = MaweMultiSubtitleCore.getActiveExtensionTrack();
  if (extensionTrack) {
    [...MaweSelection.selectedExtensionIdxs]
      .sort((a, b) => a - b)
      .forEach((index) => targets.push({
        kind: 'extension',
        index,
        trackId: extensionTrack.id,
      }));
  }
  return targets;
}

function textProcessAllTargets() {
  return DATA.segments.map((_, index) => ({ kind: 'main', index }));
}

function textProcessTargetSegments(target) {
  return target?.kind === 'extension'
    ? MaweMultiSubtitleCore.getExtensionTrack(target.trackId)?.segments || []
    : DATA.segments;
}

function textProcessTargetLabel(target) {
  return `${target?.kind === 'extension' ? '副字幕' : '主字幕'}第 ${(target?.index ?? 0) + 1} 条`;
}

function textProcessTargets() {
  return textProcessScope && textProcessScope.length
    ? textProcessScope
    : textProcessAllTargets();
}

function buildTextProcessPreview(targets, options) {
  return (Array.isArray(targets) ? targets : []).flatMap((target) => {
    const segments = textProcessTargetSegments(target);
    const segment = segments[target.index];
    if (!segment) return [];
    const before = String(segment.text == null ? '' : segment.text);
    const after = window.AsrEditorUtils.applyTextProcessing(before, options);
    return [{ ...target, before, after, changed: before !== after }];
  });
}

function getTextProcessOptions() {
  return {
    trim: textProcessTrim.checked,
    capitalize: textProcessCapitalize.checked,
    addPrefix: textProcessPrefix.checked,
    prefix: textProcessPrefixInput.value,
    addSuffix: textProcessSuffix.checked,
    suffix: textProcessSuffixInput.value,
    stripMarkdown: textProcessStripMarkdown.checked,
  };
}

function refreshTextProcessScopeInfo() {
  const selected = textProcessScope && textProcessScope.length;
  textProcessScopeInfo.textContent = selected
    ? `范围：仅选中的 ${textProcessScope.length} 条字幕`
    : `范围：全部 ${DATA.segments.length} 条字幕`;
  textProcessScopeInfo.classList.toggle('selected', Boolean(selected));
}

function refreshTextProcessSelectionControl() {
  const available = textProcessSelectionSnapshot.length > 0;
  textProcessSelectedOnlyCb.disabled = !available;
  if (!available) textProcessSelectedOnlyCb.checked = false;
  if (textProcessSelectedOnlyHint) textProcessSelectedOnlyHint.hidden = available;
  textProcessScope = textProcessSelectedOnlyCb.checked
    ? [...textProcessSelectionSnapshot] : null;
  refreshTextProcessScopeInfo();
}

function renderTextProcessPreview() {
  const options = getTextProcessOptions();
  const hasOperation = textProcessTrim.checked || textProcessCapitalize.checked
    || textProcessPrefix.checked || textProcessSuffix.checked || textProcessStripMarkdown.checked;
  const targets = textProcessTargets();
  textProcessPreview.replaceChildren();
  if (!hasOperation) {
    textProcessPreview.textContent = '请选择至少一项文本处理操作';
    textProcessPreview.style.color = '';
    textProcessConfirm.disabled = true;
    return;
  }
  const rows = buildTextProcessPreview(targets, options);
  const result = {
    targetCount: rows.length,
    changedCount: rows.filter((row) => row.changed).length,
    rows,
  };
  textProcessPreview.style.color = result.changedCount ? '' : 'var(--text-muted)';
  const summary = document.createElement('div');
  summary.className = 'replace-preview-summary';
  summary.textContent = result.changedCount
    ? `将处理 ${result.targetCount} 条字幕，预计修改 ${result.changedCount} 条（展开查看前后文本）`
    : `选定的 ${result.targetCount} 条字幕不会发生变化`;
  textProcessPreview.appendChild(summary);
  result.rows.filter((row) => row.changed).forEach((row) => {
    const details = document.createElement('details');
    details.className = 'replace-preview-row';
    const title = document.createElement('summary');
    title.textContent = textProcessTargetLabel(row);
    details.appendChild(title);
    const before = document.createElement('div');
    before.className = 'replace-preview-before';
    before.textContent = `处理前：${row.before}`;
    const after = document.createElement('div');
    after.className = 'replace-preview-after';
    after.textContent = `处理后：${row.after}`;
    details.append(before, after);
    textProcessPreview.appendChild(details);
  });
  textProcessConfirm.disabled = false;
}

function refreshTextProcessInputState() {
  textProcessPrefixInput.disabled = !textProcessPrefix.checked;
  textProcessSuffixInput.disabled = !textProcessSuffix.checked;
}

function closeTextProcessModal() {
  MaweDom.textProcessModal.classList.remove('show');
}

function openTextProcessModal() {
  if (!DATA.segments.length && !MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments?.length) {
    MaweHint.flashHint('当前没有可处理的字幕', 'invalid');
    return;
  }
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  textProcessSelectionSnapshot = textProcessSelectionTargets();
  textProcessSelectedOnlyCb.checked = textProcessSelectionSnapshot.length > 0;
  refreshTextProcessSelectionControl();
  [textProcessTrim, textProcessCapitalize, textProcessPrefix,
    textProcessSuffix, textProcessStripMarkdown].forEach((input) => { input.checked = false; });
  textProcessPrefixInput.value = '';
  textProcessSuffixInput.value = '';
  refreshTextProcessInputState();
  MaweDom.textProcessModal.classList.add('show');
  renderTextProcessPreview();
  setTimeout(() => textProcessTrim.focus(), 50);
}

textProcessButton?.addEventListener('click', openTextProcessModal);
textProcessSelectedOnlyCb?.addEventListener('change', () => {
  textProcessScope = textProcessSelectedOnlyCb.checked
    ? [...textProcessSelectionSnapshot] : null;
  refreshTextProcessScopeInfo();
  renderTextProcessPreview();
});
[textProcessTrim, textProcessCapitalize, textProcessPrefix,
  textProcessSuffix, textProcessStripMarkdown].forEach((input) => {
  input?.addEventListener('change', () => {
    refreshTextProcessInputState();
    renderTextProcessPreview();
  });
});
[textProcessPrefixInput, textProcessSuffixInput].forEach((input) => {
  input?.addEventListener('input', renderTextProcessPreview);
});
document.getElementById('text-process-cancel')?.addEventListener('click', closeTextProcessModal);
MaweDom.textProcessModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.textProcessModal) closeTextProcessModal();
});
textProcessConfirm?.addEventListener('click', () => {
  const options = getTextProcessOptions();
  const result = {
    rows: buildTextProcessPreview(textProcessTargets(), options),
  };
  result.changedCount = result.rows.filter((row) => row.changed).length;
  if (!result.changedCount) {
    MaweHint.flashHint('当前文本处理对于选中的字幕没有任何影响，未作改动', 'invalid');
    return;
  }
  let mainDraftTexts = null;
  const extensionDrafts = new Map();
  result.rows.filter((row) => row.changed).forEach((row) => {
    if (row.kind === 'extension') {
      const track = MaweMultiSubtitleCore.getExtensionTrack(row.trackId);
      if (!track) return;
      const draft = extensionDrafts.get(track.id) || {
        track,
        texts: track.segments.map((segment) => String(segment?.text || '')),
      };
      draft.texts[row.index] = row.after;
      extensionDrafts.set(track.id, draft);
      return;
    }
    if (!mainDraftTexts) {
      mainDraftTexts = DATA.segments.map((segment) => String(segment?.text || ''));
    }
    mainDraftTexts[row.index] = row.after;
  });
  const nextMainSegments = mainDraftTexts
    ? window.AsrEditorUtils.applyTimedTextEdit(DATA.segments, mainDraftTexts)
    : null;
  const nextExtensionSegments = [];
  for (const draft of extensionDrafts.values()) {
    const nextSegments = window.AsrEditorUtils.applyTimedTextEdit(draft.track.segments, draft.texts);
    if (!nextSegments) {
      MaweHint.flashHint('无法应用文本处理：字幕行结构发生了变化', 'warning');
      return;
    }
    nextExtensionSegments.push({ track: draft.track, segments: nextSegments });
  }
  if (mainDraftTexts && !nextMainSegments) {
    MaweHint.flashHint('无法应用文本处理：字幕行结构发生了变化', 'warning');
    return;
  }
  MaweHistory.pushUndo('文本处理');
  if (nextMainSegments) {
    DATA.segments.splice(0, DATA.segments.length, ...nextMainSegments);
    MaweMultiSubtitleCore.markMainSegmentsDirty(DATA.segments);
  }
  nextExtensionSegments.forEach(({ track, segments }) => {
    track.segments.splice(0, track.segments.length, ...segments);
    track.segments.forEach((segment) => { segment._dirty = true; });
  });
  if (nextExtensionSegments.length) MaweMultiSubtitleCore.markMultiSubtitleDirty();
  MaweMultiSubtitleCore.syncBindingOffsets();
  scheduleAutoSaveFlush();
  closeTextProcessModal();
  MaweCuePanel.renderAll({ waveform: 'overlay' });
  MawePlaybackLoop.updateWithoutCueListAutoScroll();
  MaweHistory.updateUndoRedoButtons();
  MaweHint.flashHint(`已应用文本处理：${result.changedCount} 条字幕`, 'success');
});

// === 纯文本编辑（支持调整字幕行结构的 MVP） ===
function timedTextEditSegments(kind) {
  return kind === 'extension' ? MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments || [] : DATA.segments;
}

function timedTextEditSourceSelection(kind, showDisabled = false) {
  const allSegments = timedTextEditSegments(kind);
  const sourceSegmentIndexes = allSegments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => showDisabled || segment?.disabled !== true)
    .map(({ index }) => index);
  return {
    allSegments,
    sourceSegmentIndexes,
    sourceSegments: sourceSegmentIndexes.map((index) => allSegments[index]),
  };
}

function currentTimedTextEditKind() {
  const panelTarget = MaweCuePanel.getCurrentCuePanelTarget?.();
  if (panelTarget?.kind === 'extension' && panelTarget.track?.segments?.length) return 'extension';
  if (MaweSelection.selectedIdxs.size === 0 && MaweSelection.selectedExtensionIdxs.size > 0
      && MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments?.length) return 'extension';
  return 'main';
}

function timedTextEditTrackLabel(kind) {
  if (kind !== 'extension') return '主字幕';
  const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
  return track?.name ? `副字幕（${track.name}）` : '副字幕';
}

function appendTimedTextEditStat(container, label, value, filterKey = null, count = 0) {
  const row = document.createElement('div');
  row.className = 'timed-text-edit-stat-row';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const valueEl = filterKey && count > 0 ? document.createElement('button') : document.createElement('strong');
  if (filterKey && count > 0) {
    valueEl.type = 'button';
    valueEl.className = 'timed-text-edit-stat-filter';
    valueEl.classList.toggle('active', MaweDom.timedTextEditDraft?.filter === filterKey);
    valueEl.addEventListener('click', () => {
      if (!MaweDom.timedTextEditDraft) return;
      MaweDom.timedTextEditDraft.filter = filterKey;
      MaweDom.timedTextEditChangeDetails.open = true;
      flushTimedTextEditReport();
    });
  }
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  container.appendChild(row);
}

function appendTimedTextEditDivider(container) {
  const divider = document.createElement('div');
  divider.className = 'timed-text-edit-report-divider';
  container.appendChild(divider);
}

function appendTimedTextEditDiffLine(container, label, parts, className) {
  const line = document.createElement('div');
  line.className = `timed-text-edit-diff-line ${className}`;
  const labelEl = document.createElement('span');
  labelEl.className = 'timed-text-edit-diff-label';
  labelEl.textContent = label;
  line.appendChild(labelEl);
  (parts || []).forEach((part) => {
    if (!part?.text) return;
    const text = document.createElement('span');
    text.className = `timed-text-edit-diff-part ${part.kind || 'equal'}`;
    text.textContent = part.text;
    line.appendChild(text);
  });
  container.appendChild(line);
}

function renderTimedTextEditRowDiff(rowElement, reportRow) {
  const diffElement = rowElement.querySelector('.timed-text-edit-row-diff');
  if (!diffElement) return;
  diffElement.replaceChildren();
  diffElement.hidden = !reportRow.changed && !reportRow.timingChanged && !reportRow.timingEstimated;
  if (reportRow.changed) {
    appendTimedTextEditDiffLine(diffElement, '修改前：', reportRow.diff.before, 'before');
    appendTimedTextEditDiffLine(diffElement, '修改后：', reportRow.diff.after, 'after');
  }
  if (reportRow.timingChanged) {
    const timing = document.createElement('div');
    timing.className = 'timed-text-edit-timing-change';
    timing.textContent = `时间范围：${MaweCueElements.fmtSrtTime(reportRow.beforeStart)} – ${MaweCueElements.fmtSrtTime(reportRow.beforeEnd)} → ${MaweCueElements.fmtSrtTime(reportRow.afterStart)} – ${MaweCueElements.fmtSrtTime(reportRow.afterEnd)}`;
    diffElement.appendChild(timing);
  }
  if (reportRow.timingEstimated) {
    const estimated = document.createElement('div');
    estimated.className = 'timed-text-edit-estimated-timing';
    estimated.textContent = '时间范围为自动估算（按原字幕范围/文字长度分配）';
    diffElement.appendChild(estimated);
  }
  if (reportRow.deleted) {
    const deleted = document.createElement('div');
    deleted.className = 'timed-text-edit-deleted-label';
    deleted.textContent = '整句删除（时间码已转移到其他字幕）';
    diffElement.appendChild(deleted);
  }
}

function timedTextEditMappingLabel(status) {
  return {
    full: '完整映射',
    partial: '部分映射',
    lost: '时间码丢失',
    unavailable: '原本没有字词时间码',
    boundary: '边界移动（时间码已转移）',
    structure: '结构调整（时间码已重新分配）',
    deleted: '整句删除（时间码已转移）',
  }[status] || '未分析';
}

function timedTextEditCoverageClass(percent) {
  if (percent <= 0) return 'none';
  return percent > 90 ? 'good' : 'partial';
}

function renderTimedTextEditMetric(element, percent, kind, title = '') {
  if (!element) return;
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const isReuse = kind === 'reuse';
  element.textContent = `${isReuse ? '♻️' : '⌚️'}${safePercent}%`;
  element.className = `timed-text-edit-${isReuse ? 'reuse' : 'coverage'} ${timedTextEditCoverageClass(safePercent)}`;
  element.title = title || `${isReuse ? '原始时间码复用率' : '有效字词时间码覆盖率'}：${safePercent}%`;
}

function renderTimedTextEditChangeList(report) {
  const wasOpen = MaweDom.timedTextEditChangeDetails.open;
  MaweDom.timedTextEditChangeList.replaceChildren();
  const filter = MaweDom.timedTextEditDraft?.filter || null;
  const deletedRows = report.structure?.valid
    ? (report.rows || [])
      .filter((row) => row.deleted)
      .map((row) => ({ ...row, mappingStatus: 'deleted' }))
    : [];
  const displayRows = report.structure?.valid && report.outputRows?.length
    ? [...report.outputRows, ...deletedRows]
    : report.changedRows;
  const rows = filter === 'unchanged'
    ? []
    : displayRows.filter((row) => row.changed && (!filter || row.mappingStatus === filter));
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'modal-hint';
    empty.textContent = filter ? '当前筛选没有修改内容。' : '还没有修改内容。';
    MaweDom.timedTextEditChangeList.appendChild(empty);
    MaweDom.timedTextEditChangeDetails.open = Boolean(filter && filter !== 'unchanged');
    return;
  }
  rows.forEach((row) => {
    const item = document.createElement('div');
    item.className = `timed-text-edit-change-item${row.deleted ? ' deleted' : ''}`;
    const title = document.createElement('div');
    title.className = 'timed-text-edit-change-item-title';
    title.textContent = `第 ${row.index + 1} 条 · ${timedTextEditMappingLabel(row.mappingStatus)}`;
    item.appendChild(title);
    appendTimedTextEditDiffLine(item, '前：', row.diff.before, 'before');
    appendTimedTextEditDiffLine(item, '后：', row.diff.after, 'after');
    if (row.timingChanged) {
      const timing = document.createElement('div');
      timing.className = 'timed-text-edit-timing-change';
      timing.textContent = `时间范围：${MaweCueElements.fmtSrtTime(row.beforeStart)} – ${MaweCueElements.fmtSrtTime(row.beforeEnd)} → ${MaweCueElements.fmtSrtTime(row.afterStart)} – ${MaweCueElements.fmtSrtTime(row.afterEnd)}`;
      item.appendChild(timing);
    }
    if (row.timingEstimated) {
      const estimated = document.createElement('div');
      estimated.className = 'timed-text-edit-estimated-timing';
      estimated.textContent = '时间范围为自动估算（按原字幕范围/文字长度分配）';
      item.appendChild(estimated);
    }
    if (row.deleted) {
      const deleted = document.createElement('div');
      deleted.className = 'timed-text-edit-deleted-label';
      deleted.textContent = '整句删除（时间码已转移到其他字幕）';
      item.appendChild(deleted);
    }
    MaweDom.timedTextEditChangeList.appendChild(item);
  });
  MaweDom.timedTextEditChangeDetails.open = wasOpen;
}

function renderTimedTextEditRows() {
  MaweDom.timedTextEditRows.replaceChildren();
  if (!MaweDom.timedTextEditDraft) return;
  const report = MaweDom.timedTextEditDraft.report;
  const rowReports = timedTextEditDraftRowReports(report, MaweDom.timedTextEditDraft.texts);
  MaweDom.timedTextEditDraft.texts.forEach((textValue, index) => {
    const rowReport = rowReports[index];
    const segment = report?.structure?.valid && Number.isInteger(rowReport?.draftIndex)
      ? report.previewSegments[rowReport.index]
      : (!report?.structure?.valid && MaweDom.timedTextEditDraft.texts.length === MaweDom.timedTextEditDraft.sourceSegments.length
        ? MaweDom.timedTextEditDraft.sourceSegments[index] : null);
    const rowSourceIndexes = Array.isArray(rowReport?.sourceIndexes)
      ? rowReport.sourceIndexes : [index];
    const rowIncludesDisabled = rowSourceIndexes.some((sourceIndex) => (
      MaweDom.timedTextEditDraft.sourceSegments[sourceIndex]?.disabled === true
    ));
    const row = document.createElement('div');
    row.className = `timed-text-edit-row${rowReport?.deleted ? ' deleted' : ''}${rowIncludesDisabled ? ' disabled' : ''}`;
    if (rowIncludesDisabled) row.title = '已禁用字幕';
    row.dataset.index = String(index);
    const meta = document.createElement('div');
    meta.className = 'timed-text-edit-row-meta';
    const number = document.createElement('strong');
    number.textContent = String(index + 1);
    const time = document.createElement('span');
    time.className = 'timed-text-edit-row-time';
    time.textContent = segment
      ? `${MaweCueElements.fmtSrtTime(segment.start)}\n${MaweCueElements.fmtSrtTime(segment.end)}` : '—\n—';
    const coverage = document.createElement('span');
    const coverageData = window.AsrEditorUtils.timedTextItemCoverage(
      textValue, segment?.items,
    );
    const reuseData = window.AsrEditorUtils.timedTextItemReuse(
      textValue, segment?.items, textValue, segment?.items, 'full',
    );
    renderTimedTextEditMetric(
      coverage,
      coverageData.percent,
      'coverage',
      segment ? `有效字词时间码覆盖率：${coverageData.coveredCharacters}/${coverageData.totalCharacters}` : '等待可靠时间码映射',
    );
    const reuse = document.createElement('span');
    renderTimedTextEditMetric(
      reuse,
      reuseData.percent,
      'reuse',
      segment ? `原始时间码复用率：${reuseData.reusedCharacters}/${reuseData.totalCharacters}` : '等待原始时间码映射',
    );
    const badges = document.createElement('span');
    badges.className = 'timed-text-edit-time-badges';
    badges.append(coverage, reuse);
    const timeLine = document.createElement('div');
    timeLine.className = 'timed-text-edit-row-time-line';
    timeLine.append(time, badges);
    meta.append(number, timeLine);
    const main = document.createElement('div');
    main.className = 'timed-text-edit-row-main';
    const textarea = document.createElement('textarea');
    textarea.dataset.index = String(index);
    textarea.value = textValue;
    textarea.rows = Math.min(5, Math.max(2, String(textValue || '').split('\n').length));
    textarea.spellcheck = false;
    textarea.setAttribute('aria-label', `第 ${index + 1} 条字幕文本`);
    const diff = document.createElement('div');
    diff.className = 'timed-text-edit-row-diff';
    diff.hidden = true;
    main.append(textarea, diff);
    row.append(meta, main);
    MaweDom.timedTextEditRows.appendChild(row);
  });
}

function timedTextEditCanUseSingleView() {
  return Boolean(MaweDom.timedTextEditDraft?.sourceSegments.every((segment, index) => {
    return !String(segment?.text || '').includes('\n');
  }));
}

function renderTimedTextEditView() {
  if (!MaweDom.timedTextEditDraft) return;
  const canUseSingle = timedTextEditCanUseSingleView();
  const singleOption = MaweDom.timedTextEditView?.querySelector('[data-view="single"]');
  if (singleOption) singleOption.disabled = !canUseSingle;
  if (!canUseSingle && MaweDom.timedTextEditDraft.view === 'single') MaweDom.timedTextEditDraft.view = 'rows';
  const single = MaweDom.timedTextEditDraft.view === 'single' && canUseSingle;
  MaweDom.timedTextEditView?.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === (single ? 'single' : 'rows');
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  MaweDom.timedTextEditRows.hidden = single;
  MaweDom.timedTextEditCharcountThresholdControl.hidden = !single;
  MaweDom.timedTextEditSingleEditor.hidden = !single;
  MaweDom.timedTextEditSingleTextarea.hidden = !single;
  MaweDom.timedTextEditSingleHint.hidden = !single || !MaweDom.timedTextEditDraft.singleLineError;
  if (single) {
    MaweCueElements.syncCharCountThresholdInputs();
    MaweDom.timedTextEditSingleTextarea.value = MaweDom.timedTextEditDraft.singleText;
    MaweCueElements.updateTimedTextEditSingleGuide();
  }
}

function timedTextEditRowFilterKey(row) {
  return row.changed ? row.mappingStatus : 'unchanged';
}

function timedTextEditDraftRowReports(report, texts) {
  const source = Array.isArray(texts) ? texts : [];
  if (!report?.structure?.valid) {
    return source.map((_, index) => report?.rows?.[index] || null);
  }
  const outputByDraftIndex = new Map(
    (report.outputRows || [])
      .filter((row) => Number.isInteger(row?.draftIndex))
      .map((row) => [row.draftIndex, row]),
  );
  const deletedRows = (report.rows || []).filter((row) => row?.deleted);
  let deletedIndex = 0;
  return source.map((text, index) => {
    const output = outputByDraftIndex.get(index);
    if (output) return output;
    if (!String(text == null ? '' : text).trim()) return deletedRows[deletedIndex++] || null;
    return null;
  });
}

function normalizeTimedTextEditDraftLines(texts) {
  const lines = (Array.isArray(texts) ? texts : [])
    .map((text) => String(text == null ? '' : text));
  // 整体编辑末尾的换行只是输入习惯，不额外创建一条空字幕；真正清空的
  // 中间行仍保留到预览中，并在应用时按删除字幕处理。
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.length ? lines : [''];
}

function syncTimedTextEditDraftFromDom() {
  if (!MaweDom.timedTextEditDraft || MaweDom.timedTextEditDraft.view !== 'single'
      || !MaweDom.timedTextEditSingleTextarea) return;
  const normalized = MaweDom.timedTextEditSingleTextarea.value.replace(/\r\n?/g, '\n');
  MaweDom.timedTextEditDraft.texts = normalizeTimedTextEditDraftLines(normalized.split('\n'));
  MaweDom.timedTextEditDraft.singleText = MaweDom.timedTextEditDraft.texts.join('\n');
  MaweDom.timedTextEditDraft.singleLineError = '';
}

function cancelTimedTextEditReport() {
  if (MaweDom.timedTextEditReportTimer === null) return;
  clearTimeout(MaweDom.timedTextEditReportTimer);
  MaweDom.timedTextEditReportTimer = null;
}

function flushTimedTextEditReport() {
  cancelTimedTextEditReport();
  updateTimedTextEditReport();
}

function scheduleTimedTextEditReport() {
  cancelTimedTextEditReport();
  MaweDom.timedTextEditReportTimer = setTimeout(() => {
    MaweDom.timedTextEditReportTimer = null;
    updateTimedTextEditReport();
  }, MaweDom.TIMED_TEXT_EDIT_REPORT_DEBOUNCE_MS);
}

function updateTimedTextEditReport() {
  if (!MaweDom.timedTextEditDraft) return;
  const report = window.AsrEditorUtils.buildTimedTextEditReport(
    MaweDom.timedTextEditDraft.sourceSegments,
    MaweDom.timedTextEditDraft.texts,
  );
  MaweDom.timedTextEditDraft.report = report;
  const { stats } = report;
  if (MaweDom.timedTextEditRows.childElementCount !== MaweDom.timedTextEditDraft.texts.length) {
    renderTimedTextEditRows();
  }
  MaweDom.timedTextEditReportSummary.replaceChildren();
  appendTimedTextEditStat(
    MaweDom.timedTextEditReportSummary,
    '字幕行',
    report.structure?.valid ? `${stats.totalSegments} → ${report.previewSegments.length} 条` : `${stats.totalSegments} 条`,
  );
  appendTimedTextEditStat(
    MaweDom.timedTextEditReportSummary,
    '修改内容',
    `${stats.changedSegments} 条（未修改 ${stats.unchangedSegments} 条）`,
  );
  appendTimedTextEditStat(
    MaweDom.timedTextEditReportSummary,
    '字符变化',
    `+${stats.addedCharacters} / -${stats.removedCharacters}`,
  );

  MaweDom.timedTextEditReportMapping.replaceChildren();
  appendTimedTextEditDivider(MaweDom.timedTextEditReportMapping);
  appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '未修改（原样保留）', `${stats.unchangedSegments} 条`, 'unchanged', stats.unchangedSegments);
  appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '修改后完整映射', `${stats.fullMappedCues} 条`, 'full', stats.fullMappedCues);
  appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '部分保留', `${stats.partialMappedCues} 条`, 'partial', stats.partialMappedCues);
  appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '边界移动（转移时间码）', `${stats.boundaryMappedCues} 条`, 'boundary', stats.boundaryMappedCues);
  if (stats.structureMappedCues > 0) {
    appendTimedTextEditStat(
      MaweDom.timedTextEditReportMapping,
      '结构调整（重新分配时间码）',
      `${stats.structureMappedCues} 条`,
      'structure',
      stats.structureMappedCues,
    );
  }
  appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '时间码丢失', `${stats.lostMappedCues} 条`, 'lost', stats.lostMappedCues);
  appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '原本没有字词码', `${stats.unavailableMappedCues} 条`, 'unavailable', stats.unavailableMappedCues);
  MaweDom.timedTextEditShowAll.hidden = !MaweDom.timedTextEditDraft.filter;
  MaweDom.timedTextEditShowAll.textContent = '显示全部';

  MaweDom.timedTextEditReportHint.classList.remove('warning');
  if (report.structure && !report.structure.valid && report.structure.error) {
    MaweDom.timedTextEditReportHint.classList.add('warning');
    MaweDom.timedTextEditReportHint.textContent = report.structure.error;
  } else if (stats.estimatedTimingCues) {
    MaweDom.timedTextEditReportHint.classList.add('warning');
    MaweDom.timedTextEditReportHint.textContent = `有 ${stats.estimatedTimingCues} 条字幕缺少可复用的字词时间码，应用后将按原字幕范围/文字长度自动估算时间；不会伪造精确字词时间码。`;
  } else if (!stats.changedSegments) {
    MaweDom.timedTextEditReportHint.textContent = '修改后会保持当前字幕段的开始、结束时间不变。';
  } else if (stats.lostMappedCues) {
    MaweDom.timedTextEditReportHint.classList.add('warning');
    MaweDom.timedTextEditReportHint.textContent = '部分字幕无法可靠映射原字词时间码；应用后只保留字幕段整体时间范围。';
  } else if (stats.partialMappedCues) {
    MaweDom.timedTextEditReportHint.classList.add('warning');
    MaweDom.timedTextEditReportHint.textContent = '修改范围内的字词会合并为较粗的时间码，未受影响的字词仍会保留。';
  } else if (stats.boundaryMoves) {
    MaweDom.timedTextEditReportHint.textContent = '检测到相邻字幕之间的开头/结尾移动；对应字词时间码会一起转移，并更新字幕段范围。';
  } else if (stats.structureMappedCues) {
    MaweDom.timedTextEditReportHint.textContent = '检测到字幕行结构变化；应用后会按字词时间码拆分、合并或删除字幕行，并解除受影响的多字幕绑定。';
  } else {
    MaweDom.timedTextEditReportHint.textContent = '当前修改可以完整复用原字词时间码；字幕段整体时间范围不会改变。';
  }

  const draftRowReports = timedTextEditDraftRowReports(report, MaweDom.timedTextEditDraft.texts);
  draftRowReports.forEach((rowReport, index) => {
    const rowElement = MaweDom.timedTextEditRows.querySelector(`.timed-text-edit-row[data-index="${index}"]`);
    if (!rowElement) return;
    rowElement.classList.toggle('changed', Boolean(rowReport?.changed));
    rowElement.classList.toggle('deleted', Boolean(rowReport?.deleted));
    rowElement.hidden = Boolean(MaweDom.timedTextEditDraft.filter)
      && (!rowReport || timedTextEditRowFilterKey(rowReport) !== MaweDom.timedTextEditDraft.filter);
    if (rowReport) renderTimedTextEditRowDiff(rowElement, rowReport);
  });
  MaweDom.timedTextEditDraft.texts.forEach((text, index) => {
    const rowElement = MaweDom.timedTextEditRows.querySelector(`.timed-text-edit-row[data-index="${index}"]`);
    const coverage = rowElement?.querySelector('.timed-text-edit-coverage');
    const reuse = rowElement?.querySelector('.timed-text-edit-reuse');
    const rowReport = draftRowReports[index];
    const preview = report.structure?.valid && Number.isInteger(rowReport?.draftIndex)
      ? report.previewSegments[rowReport.index]
      : (!report.structure?.valid ? report.rows[index]?.items : null);
    const items = report.structure?.valid ? preview?.items : preview;
    const coverageData = rowReport?.itemCoverageData
      || window.AsrEditorUtils.timedTextItemCoverage(text, items);
    const reuseData = rowReport?.itemReuseData || {
      percent: 0,
      reusedCharacters: 0,
      totalCharacters: Array.from(String(text == null ? '' : text)).length,
    };
    renderTimedTextEditMetric(
      coverage,
      coverageData.percent,
      'coverage',
      `有效字词时间码覆盖率：${coverageData.coveredCharacters}/${coverageData.totalCharacters}`,
    );
    renderTimedTextEditMetric(
      reuse,
      reuseData.percent,
      'reuse',
      `原始时间码复用率：${reuseData.reusedCharacters}/${reuseData.totalCharacters}`,
    );
  });
  renderTimedTextEditChangeList(report);
  const singleHint = report.structure?.valid ? '' : (report.structure?.error || MaweDom.timedTextEditDraft.singleLineError || '');
  MaweDom.timedTextEditSingleHint.textContent = singleHint;
  MaweDom.timedTextEditSingleHint.hidden = MaweDom.timedTextEditDraft.view !== 'single' || !singleHint;
  if (!MaweDom.timedTextEditDraft.sourceSegments.length && MaweDom.timedTextEditDraft.allSourceSegments.length) {
    MaweDom.timedTextEditReportHint.textContent = '当前没有显示中的字幕；打开“显示已禁用字幕”后才能编辑。';
  }
  MaweDom.timedTextEditApply.disabled = !report.valid;
}

function refreshTimedTextEditTrackOptions(kind = currentTimedTextEditKind()) {
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  // 「已开启模式但尚未导入副轨」时没有第二条字幕可编辑，不显示轨道切换控件。
  const multiSubtitleEnabled = multi.enabled === true && Boolean((multi.tracks || []).length);
  if (MaweDom.timedTextEditTrackControl) MaweDom.timedTextEditTrackControl.hidden = !multiSubtitleEnabled;
  const extensionAvailable = multiSubtitleEnabled && Boolean(MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments?.length);
  const extensionOption = MaweDom.timedTextEditTrack.querySelector('option[value="extension"]');
  if (extensionOption) extensionOption.hidden = !extensionAvailable;
  const nextKind = kind === 'extension' && extensionAvailable ? 'extension' : 'main';
  MaweDom.timedTextEditTrack.value = nextKind;
  return nextKind;
}

function loadTimedTextEditTrack(kind, { showDisabled = false } = {}) {
  cancelTimedTextEditReport();
  const nextKind = refreshTimedTextEditTrackOptions(kind);
  const selection = timedTextEditSourceSelection(nextKind, showDisabled);
  const sourceSegments = selection.sourceSegments;
  const hiddenDisabledCount = selection.allSegments.length - sourceSegments.length;
  MaweDom.timedTextEditDraft = {
    kind: nextKind,
    trackId: nextKind === 'extension' ? MaweMultiSubtitleCore.getActiveExtensionTrack()?.id || null : null,
    showDisabled: Boolean(showDisabled),
    sourceSegmentIndexes: selection.sourceSegmentIndexes,
    allSourceSegments: JSON.parse(JSON.stringify(selection.allSegments || [])),
    sourceSegments: JSON.parse(JSON.stringify(sourceSegments || [])),
    texts: (sourceSegments || []).map((segment) => String(segment?.text || '')),
    view: 'rows',
    filter: null,
    singleText: (sourceSegments || []).map((segment) => String(segment?.text || '')).join('\n'),
    singleLineError: '',
    report: null,
  };
  if (MaweDom.timedTextEditShowDisabledToggle) MaweDom.timedTextEditShowDisabledToggle.checked = Boolean(showDisabled);
  MaweDom.timedTextEditSourceInfo.textContent = `${timedTextEditTrackLabel(nextKind)} · ${sourceSegments.length} 条${hiddenDisabledCount ? `（已隐藏 ${hiddenDisabledCount} 条禁用字幕）` : ''}`;
  renderTimedTextEditRows();
  renderTimedTextEditView();
  updateTimedTextEditReport();
}

function refreshTimedTextEditButton() {
  if (!MaweDom.timedTextEditButton) return;
  const hasMain = DATA.segments.length > 0;
  const hasExtension = Boolean(MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments?.length);
  MaweDom.timedTextEditButton.disabled = !hasMain && !hasExtension;
}

function closeTimedTextEdit() {
  cancelTimedTextEditReport();
  MaweDom.timedTextEditModal.classList.remove('show');
  MaweDom.timedTextEditDraft = null;
  MaweDom.timedTextEditRows.replaceChildren();
  MaweDom.timedTextEditReturnFocus?.focus();
  MaweDom.timedTextEditReturnFocus = null;
}

function timedTextEditHasUnappliedChanges() {
  return Boolean(MaweDom.timedTextEditDraft?.report?.stats.changedSegments || MaweDom.timedTextEditDraft?.singleLineError);
}

function mergeTimedTextEditSegmentsWithHidden(
  allSourceSegments,
  sourceSegmentIndexes,
  nextSegments,
  report,
) {
  const all = Array.isArray(allSourceSegments) ? allSourceSegments : [];
  const visibleIndexes = Array.isArray(sourceSegmentIndexes) ? sourceSegmentIndexes : [];
  const outputBySourceIndex = new Map();
  const unassigned = [];
  const structural = report?.structure?.valid === true;
  const sourceIndexById = new Map();
  visibleIndexes.forEach((sourceIndex) => {
    const id = all[sourceIndex]?.id;
    if (id) sourceIndexById.set(id, sourceIndex);
  });
  const fixedOutputSourceIndexes = structural ? [] : (report?.rows || [])
    .map((row, index) => (row?.deleted ? -1 : index))
    .filter((index) => index >= 0);
  (nextSegments || []).forEach((segment, outputIndex) => {
    const sourceIndexes = structural
      ? report.structure.outputMeta?.[outputIndex]?.sourceIndexes
      : null;
    let sourceIndex = null;
    if (segment?.id && sourceIndexById.has(segment.id)) {
      sourceIndex = sourceIndexById.get(segment.id);
    } else {
      const visibleIndex = Number.isInteger(sourceIndexes?.[0])
        ? sourceIndexes[0] : (fixedOutputSourceIndexes[outputIndex] ?? outputIndex);
      sourceIndex = visibleIndexes[visibleIndex];
    }
    if (!Number.isInteger(sourceIndex)) {
      unassigned.push(segment);
      return;
    }
    const outputs = outputBySourceIndex.get(sourceIndex) || [];
    outputs.push(segment);
    outputBySourceIndex.set(sourceIndex, outputs);
  });

  const visibleSet = new Set(visibleIndexes);
  const merged = [];
  all.forEach((segment, sourceIndex) => {
    if (!visibleSet.has(sourceIndex)) {
      merged.push(JSON.parse(JSON.stringify(segment)));
      return;
    }
    (outputBySourceIndex.get(sourceIndex) || []).forEach((output) => merged.push(output));
  });
  // 正常的结构计划每个输出都应能追溯到至少一个可见来源行；保留兜底，
  // 避免异常数据被静默丢掉，且不影响默认的可见字幕编辑路径。
  unassigned.forEach((segment) => merged.push(segment));
  return merged;
}

function applyTimedTextEditSegments(
  kind,
  sourceSegments,
  targetSegments,
  nextSegments,
  report,
  texts,
  sourceSegmentIndexes = null,
) {
  const visibleSourceIndexes = Array.isArray(sourceSegmentIndexes)
    ? sourceSegmentIndexes : (sourceSegments || []).map((_, index) => index);
  const filtered = visibleSourceIndexes.length !== targetSegments.length
    || visibleSourceIndexes.some((sourceIndex, index) => sourceIndex !== index);
  const allSourceSegments = filtered ? targetSegments : sourceSegments;
  const publishedSegments = filtered
    ? mergeTimedTextEditSegmentsWithHidden(
      allSourceSegments,
      visibleSourceIndexes,
      nextSegments,
      report,
    )
    : nextSegments;
  const nextIds = new Set((nextSegments || []).map((segment) => segment?.id).filter(Boolean));
  const removedVisibleIndexes = new Set((sourceSegments || []).map((segment, index) => {
    if (segment?.id) return nextIds.has(segment.id) ? -1 : index;
    const row = report?.rows?.[index];
    return row?.changed && !String(row.after || '') ? index : -1;
  }).filter((index) => index >= 0));
  (report?.structure?.removedSourceIndexes || []).forEach((index) => removedVisibleIndexes.add(index));
  const removedIndexes = new Set([...removedVisibleIndexes]
    .map((index) => visibleSourceIndexes[index])
    .filter((index) => Number.isInteger(index)));
  const structureChanged = Boolean(report?.structure?.valid
    && (report.structure.affectedSourceIndexes?.length || nextSegments.length !== sourceSegments.length));
  if (!removedIndexes.size && !structureChanged) {
    targetSegments.splice(0, targetSegments.length, ...publishedSegments);
    return 0;
  }

  const removedIndexList = [...removedIndexes].sort((a, b) => a - b);
  const removeSet = new Set(removedIndexList);
  const removedIds = removedIndexList.map((index) => allSourceSegments[index]?.id).filter(Boolean);
  const affectedIndexes = new Set((report?.structure?.affectedSourceIndexes || [])
    .map((index) => visibleSourceIndexes[index])
    .filter((index) => Number.isInteger(index)));
  removedIndexList.forEach((index) => affectedIndexes.add(index));
  const affectedIds = [...affectedIndexes].map((index) => allSourceSegments[index]?.id).filter(Boolean);
  const pairedExtensionIndices = new Set();
  let extensionTrack = null;
  let bindingsChanged = false;

  if (kind === 'extension') {
    const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
    const beforeBindingCount = (multi.bindings || []).length;
    MaweMultiSubtitleCore.removeBindingsForSegmentIds([], affectedIds);
    bindingsChanged = (multi.bindings || []).length !== beforeBindingCount;
  } else {
    const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
    extensionTrack = MaweMultiSubtitleCore.multiSubtitleVisible() && removedIds.length ? MaweMultiSubtitleCore.getActiveExtensionTrack() : null;
    if (extensionTrack) {
      (multi.bindings || []).forEach((binding) => {
        if (!binding.main_segment_ids?.some((id) => removedIds.includes(id))) return;
        (binding.extension_segment_ids || []).forEach((id) => {
          const index = extensionTrack.segments.findIndex((segment) => segment?.id === id);
          if (index >= 0) pairedExtensionIndices.add(index);
        });
      });
    }
    const beforeBindingCount = (multi.bindings || []).length;
    MaweMultiSubtitleCore.removeBindingsForSegmentIds(
      affectedIds,
      extensionTrack
        ? [...pairedExtensionIndices].map((index) => extensionTrack.segments[index]?.id)
        : [],
    );
    bindingsChanged = (multi.bindings || []).length !== beforeBindingCount;

    if (removedIndexList.length) {
      // 与删除字幕相同的分组语义：来源行离开后，颜色 / 表情包组在切点处拆开。
      MaweSegmentOps.splitGroupsAtCutPoints(removeSet, 'sticker', 'sticker_ref');
      MaweSegmentOps.splitGroupsAtCutPoints(removeSet, 'color', 'color_ref');
      DATA.segments.forEach((segment, index) => {
        if (removeSet.has(index)) return;
        if (segment.sticker_ref && removeSet.has(segment.sticker_ref.headIdx)) {
          segment.sticker_ref = null;
        }
        if (segment.color_ref && removeSet.has(segment.color_ref.headIdx)) {
          segment.color_ref = null;
        }
      });
    }
  }

  // 结构发生变化后，旧下标选中态和字幕编辑面板都必须失效，避免渲染后指向相邻字幕。
  MaweSelection.clearSelection({ silent: true });
  MaweCuePanelState.currentCuePanelKind = 'main';
  MaweCuePanelState.currentCuePanelIdx = -1;
  MaweCuePanelState.currentCuePanelTrackId = null;
  MaweSelection.lastClickedIdx = -1;
  MaweSelection.lastClickedExtensionIdx = -1;
  MawePlaybackLoop.lastActive = -1;
  targetSegments.splice(0, targetSegments.length, ...publishedSegments);

  if (kind !== 'extension') {
    const shiftHeadIdx = (ref) => {
      let shift = 0;
      for (const removedIndex of removedIndexList) {
        if (removedIndex < ref.headIdx) shift += 1;
        else break;
      }
      if (shift) ref.headIdx -= shift;
    };
    DATA.segments.forEach((segment) => {
      if (segment.sticker_ref) shiftHeadIdx(segment.sticker_ref);
      if (segment.color_ref) shiftHeadIdx(segment.color_ref);
    });
    window.AsrEditorUtils.repairGroupReferenceIndices(DATA.segments);
    if (extensionTrack && pairedExtensionIndices.size) {
      [...pairedExtensionIndices].sort((a, b) => b - a)
        .forEach((index) => extensionTrack.segments.splice(index, 1));
    }
  }
  if (bindingsChanged || pairedExtensionIndices.size) MaweMultiSubtitleCore.markMultiSubtitleDirty();
  return removedIndexes.length;
}

function requestCloseTimedTextEdit() {
  if (timedTextEditHasUnappliedChanges()
      && !window.confirm('当前有未应用的文本修改，确定关闭编辑窗口吗？')) return false;
  closeTimedTextEdit();
  return true;
}

function openTimedTextEdit() {
  if (!DATA.segments.length && !MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments?.length) {
    MaweHint.flashHint('当前没有可编辑的字幕', 'invalid');
    return;
  }
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  MaweDom.timedTextEditReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : null;
  loadTimedTextEditTrack(currentTimedTextEditKind());
  MaweDom.timedTextEditModal.classList.add('show');
  setTimeout(() => (MaweDom.timedTextEditDraft?.view === 'single'
    ? MaweDom.timedTextEditSingleTextarea : MaweDom.timedTextEditRows.querySelector('textarea'))?.focus(), 50);
}

MaweDom.timedTextEditButton?.addEventListener('click', openTimedTextEdit);
MaweDom.timedTextEditRows?.addEventListener('input', (event) => {
  const textarea = event.target.closest?.('textarea[data-index]');
  if (!textarea || !MaweDom.timedTextEditDraft) return;
  const index = Number(textarea.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= MaweDom.timedTextEditDraft.texts.length) return;
  const replacementLines = textarea.value.replace(/\r\n?/g, '\n').split('\n');
  MaweDom.timedTextEditDraft.texts.splice(index, 1, ...replacementLines);
  MaweDom.timedTextEditDraft.texts = normalizeTimedTextEditDraftLines(MaweDom.timedTextEditDraft.texts);
  MaweDom.timedTextEditDraft.singleText = MaweDom.timedTextEditDraft.texts.join('\n');
  MaweDom.timedTextEditDraft.singleLineError = '';
  renderTimedTextEditView();
  scheduleTimedTextEditReport();
});
MaweDom.timedTextEditSingleTextarea?.addEventListener('input', () => {
  if (!MaweDom.timedTextEditDraft) return;
  MaweDom.timedTextEditDraft.singleText = MaweDom.timedTextEditSingleTextarea.value.replace(/\r\n?/g, '\n');
  MaweDom.timedTextEditDraft.texts = normalizeTimedTextEditDraftLines(
    MaweDom.timedTextEditDraft.singleText.split('\n'),
  );
  MaweDom.timedTextEditDraft.singleText = MaweDom.timedTextEditDraft.texts.join('\n');
  MaweDom.timedTextEditDraft.singleLineError = '';
  scheduleTimedTextEditReport();
});
MaweDom.timedTextEditView?.addEventListener('click', (event) => {
  const button = event.target.closest?.('button[data-view]');
  if (!button || button.disabled || !MaweDom.timedTextEditDraft) return;
  // 视图切换可能紧跟在浏览器原生输入事件之前；以 textarea 当前值为准，
  // 避免“整体编辑”切到“逐行编辑”时回填旧草稿，导致修改前/修改后相同。
  syncTimedTextEditDraftFromDom();
  const nextView = button.dataset.view === 'single' ? 'single' : 'rows';
  if (nextView === 'single' && !timedTextEditCanUseSingleView()) {
    MaweHint.flashHint('当前字幕包含换行，暂不能切换到整体编辑视图', 'invalid');
    return;
  }
  MaweDom.timedTextEditDraft.view = nextView;
  if (nextView === 'single') MaweDom.timedTextEditDraft.singleText = MaweDom.timedTextEditDraft.texts.join('\n');
  else renderTimedTextEditRows();
  renderTimedTextEditView();
  flushTimedTextEditReport();
  setTimeout(() => (nextView === 'single'
    ? MaweDom.timedTextEditSingleTextarea : MaweDom.timedTextEditRows.querySelector('textarea'))?.focus(), 0);
});
MaweDom.timedTextEditShowAll?.addEventListener('click', () => {
  if (!MaweDom.timedTextEditDraft) return;
  MaweDom.timedTextEditDraft.filter = null;
  flushTimedTextEditReport();
});
MaweDom.timedTextEditShowDisabledToggle?.addEventListener('change', () => {
  if (!MaweDom.timedTextEditDraft) return;
  const nextShowDisabled = MaweDom.timedTextEditShowDisabledToggle.checked;
  if (nextShowDisabled === MaweDom.timedTextEditDraft.showDisabled) return;
  if (timedTextEditHasUnappliedChanges()
      && !window.confirm('切换显示范围会丢弃当前未应用的文本修改，是否继续？')) {
    MaweDom.timedTextEditShowDisabledToggle.checked = MaweDom.timedTextEditDraft.showDisabled;
    return;
  }
  loadTimedTextEditTrack(MaweDom.timedTextEditDraft.kind, { showDisabled: nextShowDisabled });
});
MaweDom.timedTextEditTrack?.addEventListener('change', () => {
  if (!MaweDom.timedTextEditDraft) return;
  if (timedTextEditHasUnappliedChanges()) {
    const confirmed = window.confirm('切换轨道会丢弃当前未应用的文本修改，是否继续？');
    if (!confirmed) {
      MaweDom.timedTextEditTrack.value = MaweDom.timedTextEditDraft.kind;
      return;
    }
  }
  loadTimedTextEditTrack(MaweDom.timedTextEditTrack.value, {
    showDisabled: MaweDom.timedTextEditDraft.showDisabled === true,
  });
});
MaweDom.timedTextEditClose?.addEventListener('click', requestCloseTimedTextEdit);
MaweDom.timedTextEditCancel?.addEventListener('click', requestCloseTimedTextEdit);
MaweDom.timedTextEditModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.timedTextEditModal) requestCloseTimedTextEdit();
});
MaweDom.timedTextEditApply?.addEventListener('click', () => {
  const draft = MaweDom.timedTextEditDraft;
  if (!draft) return;
  syncTimedTextEditDraftFromDom();
  flushTimedTextEditReport();
  if (!draft.report?.valid) return;
  if (!draft.report.stats.changedSegments) {
    MaweHint.flashHint('当前没有文本修改，未作改动', 'invalid');
    return;
  }
  const targetSegments = timedTextEditSegments(draft.kind);
  const snapshotSegments = Array.isArray(draft.allSourceSegments)
    ? draft.allSourceSegments : draft.sourceSegments;
  const currentMatchesSnapshot = targetSegments.length === snapshotSegments.length
    && targetSegments.every((segment, index) => {
      const source = snapshotSegments[index];
      return segment?.id === source?.id
        && Number(segment?.start) === Number(source?.start)
        && Number(segment?.end) === Number(source?.end)
        && String(segment?.text || '') === String(source?.text || '')
        && Boolean(segment?.disabled) === Boolean(source?.disabled);
    });
  if (!currentMatchesSnapshot) {
    MaweHint.flashHint('字幕在编辑窗口打开后发生了变化，请关闭窗口并重新打开', 'warning');
    closeTimedTextEdit();
    return;
  }
  const nextSegments = window.AsrEditorUtils.applyTimedTextEdit(
    draft.sourceSegments,
    draft.texts,
  );
  if (!nextSegments) {
    MaweHint.flashHint('无法应用文本修改：字幕行结构发生了变化', 'warning');
    return;
  }
  MaweHistory.pushUndo('纯文本编辑');
  const dirtyFlags = window.AsrEditorUtils.timedTextEditDirtyFlags(
    draft.sourceSegments,
    nextSegments,
    draft.report,
  );
  nextSegments.forEach((segment, index) => {
    if (dirtyFlags[index]) segment._dirty = true;
    else delete segment._dirty;
  });
  const removedCount = applyTimedTextEditSegments(
    draft.kind,
    draft.sourceSegments,
    targetSegments,
    nextSegments,
    draft.report,
    draft.texts,
    draft.sourceSegmentIndexes,
  );
  if (draft.kind === 'extension') MaweMultiSubtitleCore.markMultiSubtitleStateDirty();
  MaweMultiSubtitleCore.syncBindingOffsets();
  // 纯文本编辑应用后暂不主动触发自动保存，让 dirty 标记短暂保留，
  // 便于用户确认哪些字幕确实发生了变化；已有的自动保存计时器仍照常执行。
  const changedCount = draft.report.stats.changedSegments;
  const lostCount = draft.report.stats.lostMappedCues;
  const estimatedCount = draft.report.stats.estimatedTimingCues || 0;
  closeTimedTextEdit();
  MaweCuePanel.renderAll({ waveform: 'overlay' });
  MawePlaybackLoop.updateWithoutCueListAutoScroll();
  MaweHistory.updateUndoRedoButtons();
  MaweHint.flashHint(
    `已应用纯文本编辑：${changedCount} 条字幕${removedCount ? `，移除 ${removedCount} 条空字幕行` : ''}${lostCount ? `，${lostCount} 条字词时间码已清除` : ''}${estimatedCount ? `，${estimatedCount} 条时间范围为自动估算` : ''}`,
    'success',
  );
});

// === 表情包 ===
let stickerTargetMode = null;  // 'single' | 'multi'
let stickerTargetIdxs = [];     // 要分配的 segment indexes

function openStickerPicker(idxs, isMulti) {
  if (!STICKERS.length) {
    MaweHint.flashHint('没有可用的表情包，请先用🦊按钮配置表情包文件夹', 'invalid');
    return;
  }
  stickerTargetMode = isMulti ? 'multi' : 'single';
  stickerTargetIdxs = idxs;
  document.getElementById('sticker-modal-title').textContent =
    isMulti ? `分配表情包到 ${idxs.length} 条字幕（跨时间）` : `分配表情包到第 ${idxs[0] + 1} 条`;
  renderStickerGrid('');
  document.getElementById('sticker-filter').value = '';
  MaweDom.stickerModal.classList.add('show');
  setTimeout(() => document.getElementById('sticker-filter').focus(), 50);
}

function renderStickerGrid(filter) {
  const grid = document.getElementById('sticker-grid');
  grid.innerHTML = '';
  const f = filter.trim().toLowerCase();
  STICKERS.forEach((s, i) => {
    const it = document.createElement('div');
    it.className = 'sticker-item';
    if (f && !s.name.toLowerCase().includes(f) && !s.filename.toLowerCase().includes(f)) {
      it.classList.add('hidden');
    }
    const img = document.createElement('img');
    img.src = MaweSelection.stickerUrl(s); img.alt = s.name;
    const nameEl = document.createElement('div');
    nameEl.className = 'sname'; nameEl.textContent = s.name;
    it.appendChild(img); it.appendChild(nameEl);
    it.addEventListener('click', () => assignSticker(s));
    grid.appendChild(it);
  });
}

function assignSticker(sticker) {
  const hadStickers = DATA.segments.some((segment) => segment.sticker || segment.sticker_ref);
  MaweHistory.pushUndo('分配表情包');
  if (stickerTargetMode === 'multi' && stickerTargetIdxs.length > 1) {
    const sorted = [...stickerTargetIdxs].sort((a, b) => a - b);
    const headIdx = sorted[0];
    // 每条字幕都是一个独立的时间实例；head 只负责保存素材，不能把多条字幕
    // 的时间范围合并成一条，否则 XML/OTIO 会把中间的引用压成连续长片段。
    DATA.segments[headIdx].sticker = {
      ...sticker, start: DATA.segments[headIdx].start, end: DATA.segments[headIdx].end,
    };
    DATA.segments[headIdx].sticker_ref = null;
    // 后续条：sticker_ref 标记，便于显示和导航
    for (let i = 1; i < sorted.length; i++) {
      DATA.segments[sorted[i]].sticker = null;
      DATA.segments[sorted[i]].sticker_ref = { name: sticker.name, headIdx };
    }
  } else {
    const idx = stickerTargetIdxs[0];
    // 如果当前条已经是 head（被其他 ref 引用），同步更新所有引用 idx 的 ref.name
    DATA.segments.forEach(s => {
      if (s.sticker_ref && s.sticker_ref.headIdx === idx) {
        s.sticker_ref.name = sticker.name;
      }
    });
    DATA.segments[idx].sticker = { ...sticker };
    DATA.segments[idx].sticker_ref = null;
  }
  MaweDom.stickerModal.classList.remove('show');
  if (!hadStickers && !MaweSettings.EDITOR_SETTINGS.cueListShowSticker && !MaweSettings.EDITOR_SETTINGS.cueEditorShowSticker
      && confirm('Oi！检测到你添加了表情包，是否需要帮你打开「设置」中的字幕列表/编辑区的表情包显示开关？   ヾ(´･ω･｀)ﾉ')) {
    updateEditorSettings({ cueListShowSticker: true, cueEditorShowSticker: true });
    MaweDisplaySettings.applyCueListDisplaySettings();
    MaweDisplaySettings.applyCueEditorDisplaySettings();
  }
  MaweColorFilter.refreshStickerAssignmentUi();
  MaweHint.flashHint(`已分配「${sticker.name}」`, 'success');
}

function clearStickerOnTargets() {
  MaweHistory.pushUndo('清除表情包');
  // 一次性切除所有目标 idx，触发组拆分
  MaweSegmentOps.splitGroupsAtCutPoints(new Set(stickerTargetIdxs), 'sticker', 'sticker_ref');
  MaweDom.stickerModal.classList.remove('show');
  MaweColorFilter.refreshStickerAssignmentUi();
  MaweHint.flashHint('已清除', 'success');
}

document.getElementById('sticker-filter')?.addEventListener('input', (e) => {
  renderStickerGrid(e.target.value);
});
document.getElementById('sticker-cancel')?.addEventListener('click', () => MaweDom.stickerModal.classList.remove('show'));
document.getElementById('sticker-clear')?.addEventListener('click', clearStickerOnTargets);
MaweDom.stickerModal?.addEventListener('click', (e) => { if (e.target === MaweDom.stickerModal) MaweDom.stickerModal.classList.remove('show'); });

// 表情包预览 modal
let previewIdx = -1;
function openStickerPreview(idx) {
  const seg = DATA.segments[idx];
  if (!seg.sticker) return;
  previewIdx = idx;
  document.getElementById('sticker-preview-img').src = MaweSelection.stickerUrl(seg.sticker);
  document.getElementById('sticker-preview-name').textContent = seg.sticker.name;
  MaweDom.stickerPreviewModal.classList.add('show');
}
document.getElementById('sticker-preview-close')?.addEventListener('click', () => MaweDom.stickerPreviewModal.classList.remove('show'));
MaweDom.stickerPreviewModal?.addEventListener('click', (e) => { if (e.target === MaweDom.stickerPreviewModal) MaweDom.stickerPreviewModal.classList.remove('show'); });
document.getElementById('sticker-preview-delete')?.addEventListener('click', () => {
  if (previewIdx < 0) return;
  // 如果删除的是 head，要把所有引用它的 sticker_ref 也清掉
  removeStickerCascade(previewIdx);
  MaweDom.stickerPreviewModal.classList.remove('show');
  MaweCuePanel.renderAll();
  MaweHint.flashHint('已删除', 'success');
});

// 删除表情包时级联清理引用：
// - 如果 idx 是 head，清掉所有 headIdx===idx 的 sticker_ref
// - 如果 idx 是 ref，仅清自己（不影响 head）
function removeStickerCascade(idx) {
  MaweHistory.pushUndo('删除表情包');
  // 走组拆分：被切除的 idx 后面的同 group ref 自动晋升新 head
  MaweSegmentOps.splitGroupsAtCutPoints(new Set([idx]), 'sticker', 'sticker_ref');
}
document.getElementById('sticker-preview-replace')?.addEventListener('click', () => {
  if (previewIdx < 0) return;
  MaweDom.stickerPreviewModal.classList.remove('show');
  openStickerPicker([previewIdx], false);
});

// 拓展表情包时间到多选范围
// 选中范围内可以包含 sticker（head）或 sticker_ref（引用），都视作"已有表情包"
function expandStickerTime(idxs) {
  const sorted = [...idxs].sort((a, b) => a - b);
  // 找选中范围内的 sticker：优先取 head；如果只有 ref，从 ref 回溯到原 head
  let sourceSticker = null;
  for (const i of sorted) {
    if (DATA.segments[i].sticker) {
      sourceSticker = DATA.segments[i].sticker;
      break;
    }
  }
  if (!sourceSticker) {
    for (const i of sorted) {
      const ref = DATA.segments[i].sticker_ref;
      if (ref && DATA.segments[ref.headIdx]?.sticker) {
        sourceSticker = DATA.segments[ref.headIdx].sticker;
        break;
      }
    }
  }
  if (!sourceSticker) {
    MaweHint.flashHint('选中范围内没有表情包', 'invalid');
    return;
  }
  MaweHistory.pushUndo('拓展表情包时长');
  const sticker = { ...sourceSticker };
  sticker.start = DATA.segments[sorted[0]].start;
  sticker.end = DATA.segments[sorted[sorted.length - 1]].end;
  // 清除范围内所有 sticker / sticker_ref
  sorted.forEach(i => {
    DATA.segments[i].sticker = null;
    DATA.segments[i].sticker_ref = null;
  });
  // head：放完整 sticker；后续：放 sticker_ref
  const headIdx = sorted[0];
  DATA.segments[headIdx].sticker = sticker;
  for (let k = 1; k < sorted.length; k++) {
    DATA.segments[sorted[k]].sticker_ref = { name: sticker.name, headIdx };
  }
  MaweCuePanel.renderAll();
  MaweHint.flashHint(`已拓展到 ${sorted.length} 条`, 'success');
}

// === 标记颜色 ===
// 数据结构与表情包同构：head 持完整 color，后续条持 color_ref（仅 name + headIdx）
// 单选 → 设为 head；多选 → 第一条为 head，时间跨整个范围，后续为 ref
function assignColor(idxs, colorName) {
  if (!idxs.length) return;
  const def = MaweColors.COLOR_BY_NAME[colorName];
  if (!def) return;
  MaweHistory.pushUndo('标记颜色');
  const sorted = [...idxs].sort((a, b) => a - b);
  if (sorted.length === 1) {
    const idx = sorted[0];
    // 如果当前条已经是 head，同步更新所有引用 idx 的 ref.name
    DATA.segments.forEach(s => {
      if (s.color_ref && s.color_ref.headIdx === idx) {
        s.color_ref.name = colorName;
      }
    });
    DATA.segments[idx].color = {
      name: colorName, value: def.value,
      start: DATA.segments[idx].start, end: DATA.segments[idx].end,
    };
    DATA.segments[idx].color_ref = null;
  } else {
    const headIdx = sorted[0];
    const start = DATA.segments[headIdx].start;
    const end = DATA.segments[sorted[sorted.length - 1]].end;
    DATA.segments[headIdx].color = { name: colorName, value: def.value, start, end };
    DATA.segments[headIdx].color_ref = null;
    for (let k = 1; k < sorted.length; k++) {
      DATA.segments[sorted[k]].color = null;
      DATA.segments[sorted[k]].color_ref = { name: colorName, headIdx };
    }
  }
  // 单条修改 lead（其 color_ref 成员仍指向它）或多选统一分配时，视为整组联动修改
  const isUnifiedGroup = sorted.length > 1
    || DATA.segments.some((s) => s.color_ref && s.color_ref.headIdx === sorted[0]);
  MaweColorFilter.refreshColorAssignmentUi();
  MaweHint.flashHint(isUnifiedGroup
    ? `已将关联字幕统一设为「${def.label}色」`
    : `已将字幕设为「${def.label}色」`, 'success');
}

// 删除颜色（级联清理）：
//   - idx 是 head: 清自己 + 所有 headIdx===idx 的 ref
//   - idx 是 ref: 仅清自己
function removeColorCascade(idx) {
  // 走组拆分：被切除的 idx 后面的同 group ref 自动晋升新 head
  MaweSegmentOps.splitGroupsAtCutPoints(new Set([idx]), 'color', 'color_ref');
}

function clearColorOnTargets(idxs) {
  MaweHistory.pushUndo('清除颜色');
  // 一次性切除所有目标 idx，触发组拆分
  MaweSegmentOps.splitGroupsAtCutPoints(new Set(idxs), 'color', 'color_ref');
  MaweColorFilter.refreshColorAssignmentUi();
  MaweHint.flashHint('已清除颜色', 'success');
}

// === 禁用/启用 ===
// 统一切换语义：目标全部禁用 → 全部启用；否则全部禁用
// 单条时即"切换这一条的状态"（Alt+点击 / 右键菜单均走这里）
function toggleDisabled(idxs, track = 'main', { successDetail = null } = {}) {
  const extensionTrack = track === 'extension'
    ? MaweMultiSubtitleCore.getActiveExtensionTrack()
    : (track?.segments ? track : null);
  const isExtension = Boolean(extensionTrack);
  const segments = isExtension ? extensionTrack.segments : DATA.segments;
  const validIdxs = [...new Set(idxs.filter((index) => Number.isInteger(index) && segments[index]))];
  if (!validIdxs.length) return;
  MaweHistory.pushUndo('切换禁用');
  const allDisabled = validIdxs.every((index) => segments[index].disabled);
  const nextDisabled = !allDisabled;
  const boundExtensionTargets = new Map();
  validIdxs.forEach((index) => {
    segments[index].disabled = nextDisabled;
    segments[index]._dirty = true;
  });
  if (!isExtension) {
    // 主字幕是绑定关系的控制端：禁用/启用时同步同一绑定的副字幕；
    // 副字幕自身的操作不反向修改主字幕，保持它可以单独禁用。
    validIdxs.forEach((index) => {
      const binding = MaweMultiSubtitleCore.bindingForMainIndex(index);
      const boundTrack = binding ? MaweMultiSubtitleCore.getExtensionTrack(binding.track_id) : null;
      if (!boundTrack) return;
      const targets = boundExtensionTargets.get(boundTrack) || new Set();
      (binding.extension_segment_ids || []).forEach((id) => {
        const extensionIndex = boundTrack.segments.findIndex((segment) => segment?.id === id);
        if (extensionIndex < 0) return;
        const extension = boundTrack.segments[extensionIndex];
        extension.disabled = nextDisabled;
        extension._dirty = true;
        targets.add(extensionIndex);
      });
      if (targets.size) boundExtensionTargets.set(boundTrack, targets);
    });
  }
  if (isExtension || boundExtensionTargets.size) MaweMultiSubtitleCore.markMultiSubtitleDirty();
  MaweCuePanel.renderAll();
  // 隐藏开关开启时，刚禁用的项需从选中集移除（保持状态一致）
  if (MaweDom.hideDisabled && !allDisabled) {
    const mainDisabled = isExtension ? new Set() : new Set(validIdxs);
    const extensionDisabled = isExtension
      ? new Map([[extensionTrack, new Set(validIdxs)]])
      : boundExtensionTargets;
    mainDisabled.forEach((index) => {
      MaweSelection.selectedIdxs.delete(index);
      MaweCoreState.container.querySelector(`.cue[data-idx="${index}"]`)?.classList.remove('selected');
    });
    extensionDisabled.forEach((indexes) => indexes.forEach((index) => {
      MaweSelection.selectedExtensionIdxs.delete(index);
      MaweCoreState.container.querySelectorAll(
        `.multi-cue[data-ext-idx="${index}"], .multi-extension-cue[data-ext-idx="${index}"]`,
      ).forEach((el) => el.classList.remove('selected'));
    }));
    MaweSelection.updateMultiSelectionClasses();
    MaweDom.selCountEl.textContent = String(MaweSelection.selectedIdxs.size + MaweSelection.selectedExtensionIdxs.size);
  }
  const action = allDisabled ? '启用' : '禁用';
  const extensionCount = [...boundExtensionTargets.values()]
    .reduce((total, indexes) => total + indexes.size, 0);
  const detail = successDetail && !allDisabled
    ? `${validIdxs.length} 条${successDetail}${!isExtension && extensionCount ? `，以及副字幕 ${extensionCount} 条` : ''}`
    : !isExtension && extensionCount
    ? `主字幕 ${validIdxs.length} 条及副字幕 ${extensionCount} 条`
    : `${validIdxs.length} 条`;
  MaweHint.flashHint(`已${action} ${detail}`, 'success');
  // 禁用状态同时决定当前时间的预览可见性；列表重绘不会自动触发播放头刷新。
  MawePlaybackLoop.updateWithoutCueListAutoScroll();
}

// === 从波形空白处新增字幕 ===
function addExtensionRangeFromWaveform(
  requestedStart,
  requestedEnd,
  clickX,
  clickY,
  track = MaweMultiSubtitleCore.getActiveExtensionTrack(),
) {
  const duration = MaweCoreState.waveformEditor?.durationMs || (Number.isFinite(MaweCoreState.player.duration) ? MaweCoreState.player.duration * 1000 : 0);
  if (!duration) { MaweHint.flashHint('媒体时长尚未加载', 'invalid'); return; }
  if (!track?.segments) { MaweHint.flashHint('当前没有可用的副字幕轨', 'invalid'); return; }
  const start = Math.min(requestedStart, requestedEnd);
  const end = Math.max(requestedStart, requestedEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  if (track.segments.some((segment) => start < segment.end && end > segment.start)) {
    MaweHint.flashHint('拖动范围包含已有副字幕，无法新增副字幕', 'warning');
    return;
  }
  const insertAt = track.segments.findIndex((segment) => segment.start > start);
  const index = insertAt < 0 ? track.segments.length : insertAt;
  const previousEnd = index > 0 ? Number(track.segments[index - 1].end) : 0;
  const nextStart = index < track.segments.length ? Number(track.segments[index].start) : duration;
  const safeStart = Math.max(previousEnd, Math.min(duration, Math.round(start / 10) * 10));
  const safeEnd = Math.min(nextStart, Math.max(safeStart, Math.round(end / 10) * 10));
  if (safeEnd - safeStart < SUBTITLE_MIN_DURATION_MS) {
    MaweHint.flashHint('该空白区域不足 100ms，无法新增副字幕', 'warning');
    return;
  }
  MaweCuePanel.commitCuePanelEdit();
  MaweHistory.pushUndo('新增副字幕');
  track.segments.splice(index, 0, {
    id: MULTI_SUBTITLE_UTILS.uniqueStableSegmentId(track.segments, `${track.id}-${index + 1}`, 'extension'),
    start: safeStart,
    end: safeEnd,
    text: '',
    items: [],
    _dirty: true,
  });
  MaweMultiSubtitleCore.markMultiSubtitleDirty();
  MaweSelection.clearSelection({ silent: true });
  MaweCuePanel.renderAll({ preserveCueListScroll: false });
  MaweSelection.selectOnlyExtension(index, track);
  const extensionText = MaweCoreState.container.querySelector(
    `.multi-extension-cue[data-ext-idx="${index}"] .multi-cue-column.extension, `
      + `.multi-dual-cue[data-ext-idx="${index}"] .multi-cue-column.extension`,
  );
  if (extensionText) {
    const cue = extensionText.closest('.cue');
    if (cue) MaweCueListAnchor.scrollCueToCenter(cue);
    setTimeout(() => MaweInlineEdit.startExtensionEdit(extensionText, index, track), 0);
  }
  MaweCoreState.waveformEditor?.revealTime(safeStart, true);
  MaweHint.flashHint(`已新增第 ${index + 1} 条副字幕`, 'success');
}

function addCueRangeFromWaveform(requestedStart, requestedEnd, clickX, clickY, track = 'main') {
  if (track === 'extension') {
    addExtensionRangeFromWaveform(requestedStart, requestedEnd, clickX, clickY);
    return;
  }
  const duration = MaweCoreState.waveformEditor?.durationMs || (Number.isFinite(MaweCoreState.player.duration) ? MaweCoreState.player.duration * 1000 : 0);
  if (!duration) { MaweHint.flashHint('媒体时长尚未加载', 'invalid'); return; }
  const start = Math.min(requestedStart, requestedEnd);
  const end = Math.max(requestedStart, requestedEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  if (DATA.segments.some((segment) => start < segment.end && end > segment.start)) {
    MaweHint.flashHint('拖动范围包含已有字幕，无法新增字幕', 'warning');
    return;
  }
  const insertAt = DATA.segments.findIndex((segment) => segment.start > start);
  const index = insertAt < 0 ? DATA.segments.length : insertAt;
  const previousEnd = index > 0 ? DATA.segments[index - 1].end : 0;
  const nextStart = index < DATA.segments.length ? DATA.segments[index].start : duration;
  const safeStart = Math.max(previousEnd, Math.min(duration, Math.round(start / 10) * 10));
  const safeEnd = Math.min(nextStart, Math.max(safeStart, Math.round(end / 10) * 10));
  if (safeEnd - safeStart < 100) {
    MaweHint.flashHint('该空白区域不足 100ms，无法新增字幕', 'warning');
    return;
  }
  MaweCuePanel.commitCuePanelEdit();
  MaweHistory.pushUndo('新增字幕');
  DATA.segments.splice(index, 0, {
    id: MULTI_SUBTITLE_UTILS.uniqueStableSegmentId(DATA.segments, `main-${index + 1}`, 'main'),
    start: safeStart,
    end: safeEnd,
    text: '',
    items: [],
    _dirty: true,
  });
  window.AsrEditorUtils.shiftGroupReferenceIndices(DATA.segments, index, 1);
  MaweSelection.clearSelection({ silent: true });
  MaweCuePanel.renderAll({ preserveCueListScroll: false });
  MaweSelection.selectOnly(index);
  const cue = MaweCoreState.container.querySelector(`.cue[data-idx="${index}"]`);
  if (cue) {
    MaweCueListAnchor.scrollCueToCenter(cue);
  }
  setTimeout(() => MaweCuePanel.focusCuePanelText(index), 0);
  MaweCoreState.waveformEditor?.revealTime(safeStart, true);
  MaweHint.flashHint(`已新增第 ${index + 1} 条字幕`, 'success');
}

function addCueAtWaveformTime(timeMs, clickX, clickY) {
  const duration = MaweCoreState.waveformEditor?.durationMs || (Number.isFinite(MaweCoreState.player.duration) ? MaweCoreState.player.duration * 1000 : 0);
  if (!duration) { MaweHint.flashHint('媒体时长尚未加载', 'invalid'); return; }
  if (findWaveformCueAtTime(timeMs) >= 0) {
    MaweHint.flashHint('当前位置已有字幕，请使用“按音频位置拆分当前字幕”', 'invalid');
    return;
  }
  const insertAt = DATA.segments.findIndex((segment) => segment.start > timeMs);
  const index = insertAt < 0 ? DATA.segments.length : insertAt;
  const previousEnd = index > 0 ? DATA.segments[index - 1].end : 0;
  const nextStart = index < DATA.segments.length ? DATA.segments[index].start : duration;
  if (timeMs < previousEnd) {
    MaweHint.flashHint('当前位置已有字幕，请使用“按音频位置拆分当前字幕”', 'invalid');
    return;
  }
  const gap = nextStart - previousEnd;
  if (gap < 100) {
    MaweHint.flashHint('这里没有足够的空白区域', 'warning');
    return;
  }
  const start = Math.max(previousEnd, Math.min(Math.round(timeMs / 10) * 10, nextStart - 100));
  const end = Math.min(nextStart, start + 1000);
  const adjustedStart = end - start >= 100 ? start : Math.max(previousEnd, nextStart - 1000);
  addCueRangeFromWaveform(adjustedStart, end, clickX, clickY);
}

function addExtensionAtWaveformTime(timeMs, clickX, clickY, track = MaweMultiSubtitleCore.getActiveExtensionTrack()) {
  const duration = MaweCoreState.waveformEditor?.durationMs || (Number.isFinite(MaweCoreState.player.duration) ? MaweCoreState.player.duration * 1000 : 0);
  if (!duration) { MaweHint.flashHint('媒体时长尚未加载', 'invalid'); return; }
  if (!track || !Array.isArray(track.segments)) {
    MaweHint.flashHint('当前没有可用的副字幕轨', 'invalid');
    return;
  }
  const insertAt = track.segments.findIndex((segment) => Number(segment.start) > timeMs);
  const index = insertAt < 0 ? track.segments.length : insertAt;
  const previousEnd = index > 0 ? Number(track.segments[index - 1].end) : 0;
  const nextStart = index < track.segments.length ? Number(track.segments[index].start) : duration;
  if (timeMs < previousEnd || timeMs > nextStart) {
    MaweHint.flashHint('当前位置已有副字幕，请先调整相邻字幕时间', 'invalid');
    return;
  }
  const gap = nextStart - previousEnd;
  if (gap < 100) {
    MaweHint.flashHint('这里没有足够的空白区域', 'warning');
    return;
  }
  const start = Math.max(previousEnd, Math.min(Math.round(timeMs / 10) * 10, nextStart - 100));
  const end = Math.min(nextStart, start + 1000);
  const adjustedStart = end - start >= 100 ? start : Math.max(previousEnd, nextStart - 1000);
  if (end - adjustedStart < 100) {
    MaweHint.flashHint('这里没有足够的空白区域', 'warning');
    return;
  }
  MaweHistory.pushUndo('新增副字幕');
  const segment = {
    id: MULTI_SUBTITLE_UTILS.uniqueStableSegmentId(
      track.segments,
      `${track.id}-segment-${index + 1}`,
      'extension',
    ),
    start: adjustedStart,
    end,
    text: '',
    _dirty: true,
  };
  track.segments.splice(index, 0, segment);
  MaweMultiSubtitleCore.markMultiSubtitleDirty();
  MaweSelection.clearSelection();
  MaweCuePanel.renderAll({ preserveCueListScroll: false });
  MaweSelection.selectOnlyExtension(index);
  const extensionText = MaweCoreState.container.querySelector(
    `.multi-extension-cue[data-ext-idx="${index}"] .multi-cue-column.extension, `
      + `.multi-dual-cue[data-ext-idx="${index}"] .multi-cue-column.extension`,
  );
  if (extensionText) {
    const cue = extensionText.closest('.cue');
    if (cue) MaweCueListAnchor.scrollCueToCenter(cue);
    setTimeout(() => MaweInlineEdit.startExtensionEdit(extensionText, index, track), 0);
  }
  MaweCoreState.waveformEditor?.revealTime(adjustedStart, true);
  MaweHint.flashHint(`已新增第 ${index + 1} 条副字幕`, 'success');
}

function getBoundDragTarget(index, sourceSegments) {
  const source = sourceSegments[index];
  if (!source) return null;
  const binding = MaweMultiSubtitleCore.bindingForMainIndex(index);
  if (!binding) return null;
  const target = MaweMultiSubtitleCore.extensionSegmentById(binding.extension_segment_ids?.[0], MaweMultiSubtitleCore.getExtensionTrack(binding.track_id));
  return target ? { target, binding } : null;
}

function ensureBoundDragOriginal(drag, index, target) {
  if (!drag.boundOriginals) drag.boundOriginals = new Map();
  if (!drag.boundOriginals.has(index)) {
    drag.boundOriginals.set(index, {
      target,
      start: target.start,
      end: target.end,
      items: Array.isArray(target.items)
        ? target.items.map((item) => ({ ...item })) : target.items,
    });
  }
  return drag.boundOriginals.get(index);
}

function snapshotBoundDragTrack(track) {
  return {
    track,
    segments: (track?.segments || []).map((segment) => ({
      segment,
      start: segment.start,
      end: segment.end,
      items: Array.isArray(segment.items)
        ? segment.items.map((item) => ({ ...item })) : segment.items,
    })),
    dirty: track?._dirty,
  };
}

// Alt 主字幕拖动中的副字幕挤压是临时预览：同一次拖动把主字幕拉回去时，
// 副字幕轨也必须从拖动开始时的完整快照恢复，而不能只恢复当前绑定的跟随字幕。
function ensureBoundDragTimelineOriginals(drag) {
  if (drag?.track !== 'main' || drag.boundDragTimelineOriginals) return;
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  drag.boundDragTimelineOriginals = {
    tracks: (multi.tracks || []).map((track) => snapshotBoundDragTrack(track)),
    bindings: JSON.parse(JSON.stringify(multi.bindings || [])),
  };
}

function restoreBoundDragTimelineOriginals(drag) {
  const snapshot = drag?.boundDragTimelineOriginals;
  if (!snapshot) return;
  snapshot.tracks.forEach(({ track, segments, dirty }) => {
    if (!track) return;
    track.segments = segments.map((entry) => {
      entry.segment.start = entry.start;
      entry.segment.end = entry.end;
      entry.segment.items = Array.isArray(entry.items)
        ? entry.items.map((item) => ({ ...item })) : entry.items;
      return entry.segment;
    });
    track._dirty = track._dirty || dirty;
  });
  const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
  multi.bindings = JSON.parse(JSON.stringify(snapshot.bindings));
  MaweMultiSubtitleCore.syncBindingOffsets();
}

function getBoundDragEdge(drag, index) {
  if (drag.kind === 'move') return { mode: 'move', edge: null };
  if (drag.kind === 'resize-left') return { mode: 'edge', edge: 'start' };
  if (drag.kind === 'resize-right') return { mode: 'edge', edge: 'end' };
  if (drag.kind === 'resize-boundary') {
    return { mode: 'edge', edge: index === drag.index ? 'end' : 'start' };
  }
  if (drag.kind === 'resize-boundary-independent') {
    return { mode: 'edge', edge: drag.edge };
  }
  return null;
}

function syncBoundCueDrag(drag) {
  // 副字幕拖动只调整副字幕自身；绑定关系保留，但新的时间范围通过
  // binding offset 记录，不再反向改动主字幕或被主字幕轨道边界限制。
  // 主字幕即使因为“自动吸附调整相邻字幕”关闭而走
  // resize-boundary-independent，也仍需带着绑定副字幕一起调整。
  if (!drag || drag.track !== 'main' || !MaweMultiSubtitleCore.multiSubtitleVisible()) return;
  ensureBoundDragTimelineOriginals(drag);
  if (drag.allowSqueeze) restoreBoundDragTimelineOriginals(drag);
  const sourceSegments = DATA.segments;
  if (!drag.boundOriginals) drag.boundOriginals = new Map();

  const boundEntries = drag.indices.map((index) => ({
    index,
    bound: getBoundDragTarget(index, sourceSegments),
    sourceOriginal: drag.originals.get(index),
  })).filter((entry) => entry.bound && entry.sourceOriginal);
  const movedFollowerSegments = new Set(boundEntries.map((entry) => entry.bound.target));
  boundEntries.forEach(({ index, bound, sourceOriginal }) => {
    const { target, binding } = bound;
    const targetOriginal = ensureBoundDragOriginal(drag, index, target);
    const source = sourceSegments[index];
    let nextStart = targetOriginal.start;
    let nextEnd = targetOriginal.end;
    if (drag.kind === 'move') {
      const delta = source.start - sourceOriginal.start;
      nextStart = targetOriginal.start + delta;
      nextEnd = targetOriginal.end + delta;
    } else if (drag.kind === 'resize-left') {
      nextStart = targetOriginal.start + (source.start - sourceOriginal.start);
    } else if (drag.kind === 'resize-right') {
      nextEnd = targetOriginal.end + (source.end - sourceOriginal.end);
    } else if (drag.kind === 'resize-boundary') {
      if (index === drag.index) nextEnd = targetOriginal.end + (source.end - sourceOriginal.end);
      else nextStart = targetOriginal.start + (source.start - sourceOriginal.start);
    } else if (drag.kind === 'resize-boundary-independent') {
      if (drag.edge === 'start') nextStart = targetOriginal.start + (source.start - sourceOriginal.start);
      else nextEnd = targetOriginal.end + (source.end - sourceOriginal.end);
    }
    if (nextEnd <= nextStart) nextEnd = nextStart + SUBTITLE_MIN_DURATION_MS;

    const targetTrack = MaweMultiSubtitleCore.getExtensionTrack(binding.track_id);
    const dragEdge = getBoundDragEdge(drag, index);
    const resolved = MaweMultiSubtitleCore.resolveExtensionFollowerRange(
      target,
      nextStart,
      nextEnd,
      dragEdge?.mode === 'edge' ? dragEdge.edge : dragEdge?.mode,
      targetTrack,
      movedFollowerSegments,
      { sortSegments: false },
    );
    if (resolved.squeezedCount > 0 || resolved.removedCount > 0) {
      const details = [];
      if (resolved.squeezedCount) details.push(`挤压 ${resolved.squeezedCount} 条副字幕`);
      if (resolved.removedCount) details.push(`删除 ${resolved.removedCount} 条副字幕`);
      MaweMultiSubtitleCore.notifyBoundSyncWarning(
        drag,
        `副字幕发生冲突，已${details.join('，')}${resolved.unboundCount ? '并解除绑定' : ''}`,
      );
    }
    target.start = resolved.start;
    target.end = resolved.end;
    target.items = MaweCuePanel.remapPanelItems(
      targetOriginal.items,
      targetOriginal.start,
      targetOriginal.end,
      target.start,
      target.end,
    );
    target._dirty = true;
  });
  MaweMultiSubtitleCore.syncBindingOffsets();
}

function findWaveformCueAtTime(timeMs, segments = DATA.segments) {
  const time = Number(timeMs);
  if (!Number.isFinite(time)) return -1;
  const list = Array.isArray(segments) ? segments : DATA.segments;
  return list.findIndex((segment) => {
    const start = Number(segment?.start);
    const end = Number(segment?.end);
    return Number.isFinite(start) && Number.isFinite(end) && start < time && time < end;
  });
}

// 右键波形背景：添加空隙、创建字幕，或按右键对应的音频位置拆分命中的字幕。
function showWaveformBlankMenu(timeMs, clickX, clickY, track = 'main') {
  MaweDom.ctxmenu.innerHTML = '';
  // 空白波形按鼠标实际落入的 lane 决定创建轨道；但拆分动作按时间点上
  // 实际存在的两条轨道分别展示，避免用户为了拆副字幕必须先点到副轨空白。
  const effectiveTrack = track === 'extension' ? 'extension' : 'main';
  function addItem(label, kbd, fn, disabled = false) {
    const it = document.createElement('div');
    it.className = `item${disabled ? ' disabled' : ''}`;
    const lbl = document.createElement('span'); lbl.textContent = label;
    it.appendChild(lbl);
    const kb = document.createElement('kbd');
    kb.textContent = kbd || '';
    if (!kbd) kb.style.visibility = 'hidden';
    it.appendChild(kb);
    if (!disabled) {
      it.addEventListener('click', () => { MaweDom.ctxmenu.classList.remove('show'); fn(); });
    }
    MaweDom.ctxmenu.appendChild(it);
  }
  const mainIdx = findWaveformCueAtTime(timeMs, DATA.segments);
  const extensionTrack = MaweMultiSubtitleCore.getActiveExtensionTrack();
  const extensionIdx = findWaveformCueAtTime(timeMs, extensionTrack?.segments);
  if (effectiveTrack === 'extension') {
    addItem(
      '创建副字幕',
      '',
      () => addExtensionAtWaveformTime(timeMs, clickX, clickY, extensionTrack),
      extensionIdx >= 0,
    );
  } else {
    addItem(
      '创建字幕',
      '',
      () => addCueAtWaveformTime(timeMs, clickX, clickY),
      mainIdx >= 0,
    );
  }
  addItem('添加空隙', '', () => MaweGapRemoveUi.addGapAtWaveformTime(timeMs));
  if (Array.isArray(DATA.segments) && DATA.segments.length) {
    addItem(
      '按音频位置拆分主字幕',
      'B',
      () => MaweSplitContext.splitFromContextMenu(mainIdx, clickX, clickY, timeMs),
      mainIdx < 0,
    );
  }
  if (Array.isArray(extensionTrack?.segments) && extensionTrack.segments.length) {
    addItem(
      '按音频位置拆分副字幕',
      '',
      () => MaweSplitCore.openExtensionSplitModal(extensionIdx, timeMs, extensionTrack),
      extensionIdx < 0,
    );
  }

  MaweDom.ctxmenu.classList.add('show');
  const rect = MaweDom.ctxmenu.getBoundingClientRect();
  let nx = clickX, ny = clickY;
  if (clickX + rect.width > window.innerWidth) nx = window.innerWidth - rect.width - 4;
  if (clickY + rect.height > window.innerHeight) ny = window.innerHeight - rect.height - 4;
  MaweDom.ctxmenu.style.left = nx + 'px';
  MaweDom.ctxmenu.style.top = ny + 'px';
}

// === 右键菜单 ===
let ctxLastClickX = 0, ctxLastClickY = 0;
function showContextMenu(x, y, idx, waveformTimeMs = null) {
  ctxLastClickX = x; ctxLastClickY = y;
  MaweDom.ctxmenu.innerHTML = '';
  // 当前条不在选中里 → 立刻选中（但不改变多选）
  const isMulti = MaweSelection.selectedIdxs.size > 1 && MaweSelection.selectedIdxs.has(idx);
  if (!isMulti && (!MaweSelection.selectedIdxs.has(idx) || MaweSelection.selectedIdxs.size !== 1)) {
    MaweSelection.selectOnly(idx);
    MaweSelection.lastClickedIdx = idx;
  }
  const targetIdxs = isMulti ? [...MaweSelection.selectedIdxs] : [idx];

  function addItem(label, kbd, fn, opts = {}) {
    const it = document.createElement('div');
    it.className = 'item' + (opts.danger ? ' danger' : '') + (opts.disabled ? ' disabled' : '');
    const lbl = document.createElement('span'); lbl.textContent = label;
    const kb = document.createElement('kbd'); kb.textContent = kbd || '';
    if (!kbd) kb.style.visibility = 'hidden';
    it.appendChild(lbl); it.appendChild(kb);
    if (!opts.disabled) it.addEventListener('click', () => { MaweDom.ctxmenu.classList.remove('show'); fn(); });
    MaweDom.ctxmenu.appendChild(it);
  }
  function addSep() {
    const s = document.createElement('div'); s.className = 'sep'; MaweDom.ctxmenu.appendChild(s);
  }

  // 颜色子菜单：首行「标记颜色 + 1~5 键位提示」，下方一排加大号色块（好辨认也好点击）
  function addColorSubmenu(targets) {
    const row = document.createElement('div');
    row.className = 'item';
    row.style.cssText = 'cursor:default;display:block;';
    row.addEventListener('click', e => e.stopPropagation());
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;';
    const lbl = document.createElement('span');
    lbl.textContent = '标记颜色';
    head.appendChild(lbl);
    const rangeHint = document.createElement('kbd');
    rangeHint.textContent = '1~5';
    rangeHint.style.marginLeft = 'auto';
    head.appendChild(rangeHint);
    row.appendChild(head);
    const swatches = document.createElement('div');
    swatches.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
    MaweColors.COLOR_PALETTE.forEach((c, colorIndex) => {
      const sw = document.createElement('span');
      sw.title = `${c.label}（按 ${colorIndex + 1}）`;
      sw.style.cssText = `width:22px;height:22px;border-radius:50%;background:${c.value};border:1px solid rgba(255,255,255,.25);cursor:pointer;display:inline-block;box-sizing:border-box;flex:0 0 auto;`;
      sw.addEventListener('mouseenter', () => sw.style.transform = 'scale(1.15)');
      sw.addEventListener('mouseleave', () => sw.style.transform = '');
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        MaweDom.ctxmenu.classList.remove('show');
        assignColor(targets, c.name);
      });
      swatches.appendChild(sw);
    });
    row.appendChild(swatches);
    MaweDom.ctxmenu.appendChild(row);
    // 「清除颜色」项：仅当选中范围内有颜色时显示
    const hasColorInRange = targets.some(i =>
      DATA.segments[i].color || DATA.segments[i].color_ref);
    if (hasColorInRange) {
      addItem('清除颜色', '0', () => clearColorOnTargets(targets), { danger: true });
    }
  }

  if (!isMulti) {
    // 组 1：拆分与跳转。拆分是字幕行右键菜单的首要动作。
    const splitLabel = Number.isFinite(waveformTimeMs)
      ? '按音频位置拆分'
      : '按文字位置拆分';
    // 「按音频位置拆分」对应波形上的 B；「按文字位置拆分」对应列表内悬停已选行时的 B。
    const splitKbd = 'B';
    addItem(splitLabel, splitKbd, () => MaweSplitContext.splitFromContextMenu(idx, x, y, waveformTimeMs));
    // 仅「仅选中」模式提供「跳转并播放」——其它两种单击行为本身就会跳转。
    if (MaweSettings.EDITOR_SETTINGS.clickBehavior === 'select-only') {
      addItem('跳转并播放', 'F', () => {
        seekFromWaveform(DATA.segments[idx].start / 1000);
        if (MaweCoreState.player.paused) MaweMediaPlayback.togglePlayback();
      });
    }
    addSep();
    // 组 2：外观（表情包与颜色）
    addItem('分配表情包…', 'T', () => openStickerPicker([idx], false));
    if (DATA.segments[idx].sticker || DATA.segments[idx].sticker_ref) {
      addItem('删除表情包', '', () => {
        removeStickerCascade(idx);
        MaweCuePanel.renderAll();
        MaweHint.flashHint('已删除', 'success');
      }, { danger: true });
    }
    addColorSubmenu(targetIdxs);
    addSep();
    // 组 3：状态与删除
    addItem(
      DATA.segments[idx].disabled ? '启用此条' : '禁用此条',
      'Alt+点击',
      () => toggleDisabled([idx])
    );
    addItem('删除字幕', 'Delete', () => {
      MaweSegmentOps.deleteSegments([idx]);
    }, { danger: true });
    if (MaweMultiSubtitleCore.bindingForMainIndex(idx)) {
      addItem('解绑', 'Shift+G', () => {
        MaweSelection.selectOnly(idx);
        MaweBindingAlign.unbindSelectedSubtitlePair();
      });
    }
  } else {
    // 组 1：合并与批量文本操作
    addItem(`合并 ${targetIdxs.length} 条字幕`, 'C', () => MaweSegmentOps.mergeSegments(targetIdxs));
    addItem('批量替换选中字幕…', '', () => openReplaceModal(targetIdxs));
    addSep();
    // 组 2：外观（表情包与颜色）；「拓展表情包时长」仅在范围内已有表情包时显示
    const hasStickerInRange = targetIdxs.some(i =>
      DATA.segments[i].sticker || DATA.segments[i].sticker_ref);
    if (hasStickerInRange) {
      addItem('拓展表情包时长', '', () => expandStickerTime(targetIdxs));
    }
    addItem('统一分配表情包…', 'T', () => openStickerPicker(targetIdxs, true));
    addColorSubmenu(targetIdxs);
    addSep();
    // 组 3：状态与删除
    const _disabledInSel = targetIdxs.filter(i => DATA.segments[i].disabled).length;
    addItem(
      _disabledInSel === targetIdxs.length ? '启用选中' : '禁用选中',
      '',
      () => toggleDisabled(targetIdxs)
    );
    addItem(`删除 ${targetIdxs.length} 条字幕`, 'Delete', () => {
      MaweSegmentOps.deleteSegments(targetIdxs);
    }, { danger: true });
    addItem('取消选择', `${MaweDisplaySettings.modKeyLabel()}+D`, () => MaweSelection.clearSelection());
  }

  // 调整 ctxmenu 位置（避免溢出）
  MaweDom.ctxmenu.classList.add('show');
  const rect = MaweDom.ctxmenu.getBoundingClientRect();
  let nx = x, ny = y;
  if (x + rect.width > window.innerWidth) nx = window.innerWidth - rect.width - 4;
  if (y + rect.height > window.innerHeight) ny = window.innerHeight - rect.height - 4;
  MaweDom.ctxmenu.style.left = nx + 'px';
  MaweDom.ctxmenu.style.top = ny + 'px';
}

function showExtensionContextMenu(x, y, index, timeMs = null, track = MaweMultiSubtitleCore.getActiveExtensionTrack()) {
  const segment = track?.segments?.[index];
  if (!segment) return;
  MaweDom.ctxmenu.innerHTML = '';
  const addItem = (label, fn, danger = false, disabled = false, kbd = '') => {
    const item = document.createElement('div');
    item.className = `item${danger ? ' danger' : ''}${disabled ? ' disabled' : ''}`;
    const text = document.createElement('span');
    text.textContent = label;
    item.appendChild(text);
    const key = document.createElement('kbd');
    key.textContent = kbd;
    if (!kbd) key.style.visibility = 'hidden';
    item.appendChild(key);
    if (disabled) {
      item.setAttribute('aria-disabled', 'true');
      item.title = '请先解绑当前副字幕';
    } else item.addEventListener('click', () => {
      MaweDom.ctxmenu.classList.remove('show');
      fn();
    });
    MaweDom.ctxmenu.appendChild(item);
  };
  const binding = MaweMultiSubtitleCore.bindingForExtensionIndex(index, track);
  addItem('在鼠标位置拆分', () => MaweSplitCore.openExtensionSplitModal(index, timeMs, track), false, false, 'B');
  const extensionSelectionOnly = MaweSelection.selectedExtensionIdxs.size > 1
    && MaweSelection.selectedExtensionIdxs.has(index);
  addItem(
    '合并副字幕块',
    () => MaweSegmentOps.mergeExtensionSegments([...MaweSelection.selectedExtensionIdxs], track),
    false,
    !extensionSelectionOnly,
    'C',
  );
  addItem(
    segment.disabled ? '启用副字幕' : '禁用副字幕',
    () => toggleDisabled([index], track),
    false,
    false,
    'Alt+点击',
  );
  addItem('删除副字幕', () => MaweSegmentOps.deleteExtensionSegments([index]), true);
  if (binding) addItem('对齐主字幕时间范围', () => MaweBindingAlign.alignExtensionToMainTimeRange(index, track), false, false, 'H');
  if (binding) addItem('解绑', () => {
    MaweSelection.selectOnlyExtension(index);
    MaweBindingAlign.unbindSelectedSubtitlePair();
  }, false, false, 'Shift+G');
  if (binding) {
    // 一对一关系已经存在时，必须先解绑，避免用户误以为点击后会静默换绑。
    addItem('重新绑定需先解绑', null, false, true);
  } else {
    if (MaweSelection.selectedIdxs.size === 1) {
      addItem('与选中的主字幕绑定', () => {
        // 右键不会触发副字幕的普通 pointerdown；先补上副轨选择，
        // 再复用顶部「绑定」操作。这里是用户明确保留主字幕后发起的绑定，
        // 因此保留主字幕选区，作为有意的直接绑定/替换入口。
        MaweSelection.selectOnlyExtension(index, track, true, true);
        MaweBindingAlign.bindSelectedSubtitlePair();
      }, false, false, 'G');
    }
    // 即使当前还保留着一条主字幕选区，也保留自动匹配入口，方便按时间
    // 选择最早的未绑定主字幕；明确绑定选中项则使用上面的入口。
    addItem('绑定到主字幕', () => MaweBindingAlign.beginPendingExtensionBinding(index, track), false, false, 'G');
  }
  MaweDom.ctxmenu.classList.add('show');
  const rect = MaweDom.ctxmenu.getBoundingClientRect();
  MaweDom.ctxmenu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))}px`;
  MaweDom.ctxmenu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))}px`;
}

function showGapContextMenu(x, y, index) {
  const gap = MaweGapRemoveData.getGapRemoveGaps()[index];
  if (!gap) return;
  MaweDom.ctxmenu.innerHTML = '';
  const addItem = (label, fn, { danger = false } = {}) => {
    const item = document.createElement('div');
    item.className = 'item' + (danger ? ' danger' : '');
    const text = document.createElement('span');
    text.textContent = label;
    item.appendChild(text);
    item.addEventListener('click', () => {
      MaweDom.ctxmenu.classList.remove('show');
      fn();
    });
    MaweDom.ctxmenu.appendChild(item);
  };
  addItem(gap.removed === false ? '移除区段' : '恢复区段', () => MaweGapRemoveUi.toggleGapRemoved(index));
  const separator = document.createElement('div');
  separator.className = 'sep';
  MaweDom.ctxmenu.appendChild(separator);
  addItem('清理空隙', () => MaweGapRemoveUi.clearGap(index), { danger: true });

  MaweDom.ctxmenu.classList.add('show');
  const rect = MaweDom.ctxmenu.getBoundingClientRect();
  MaweDom.ctxmenu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))}px`;
  MaweDom.ctxmenu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))}px`;
}

function closeContextMenuOnOutsidePointerDown(event) {
  if (!MaweDom.ctxmenu.contains(event.target)) MaweDom.ctxmenu.classList.remove('show');
}
// 使用捕获阶段的 pointerdown：波形空白区自己的 pointerdown 可能阻止后续
// click 事件，不能再依赖 mouseup 后才触发的 document.click 来关闭菜单。
document.addEventListener('pointerdown', closeContextMenuOnOutsidePointerDown, true);
// 保留键盘触发 click 的关闭路径；真实鼠标/触控操作已经在 pointerdown 阶段关闭。
document.addEventListener('click', (e) => {
  if (e.detail === 0) closeContextMenuOnOutsidePointerDown(e);
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

// === cleanPunctuation ===
function cleanPunctuation() {
  const PUNCT_REPL = '  ';
  const REPLACE_INSIDE = /[，。]/g;
  for (const seg of DATA.segments) {
    if (!seg.text) continue;
    let t = seg.text;
    while (t.length && (t.endsWith('，') || t.endsWith('。'))) t = t.slice(0, -1);
    seg.text = t.replace(REPLACE_INSIDE, PUNCT_REPL).replace(/[ \t]+$/, '');
    if (seg.items) {
      const total = seg.items.length;
      for (let i = 0; i < total; i++) {
        let it = seg.items[i].text;
        if (i === total - 1) {
          while (it.length && (it.endsWith('，') || it.endsWith('。'))) it = it.slice(0, -1);
        }
        it = it.replace(REPLACE_INSIDE, PUNCT_REPL);
        seg.items[i].text = it;
      }
    }
  }
}

function syncTimelineGroupRanges() {
  function sync(headField, refField) {
    DATA.segments.forEach((segment, headIdx) => {
      const head = segment[headField];
      if (!head) return;
      let end = segment.end;
      DATA.segments.forEach((candidate) => {
        if (candidate[refField]?.headIdx === headIdx) end = Math.max(end, candidate.end);
      });
      head.start = segment.start;
      head.end = end;
    });
  }
  sync('sticker', 'sticker_ref');
  sync('color', 'color_ref');
}

function seekFromWaveform(timeSec, { dragPreview = false } = {}) {
  const seekableEnd = MaweCoreState.player.seekable.length ? MaweCoreState.player.seekable.end(MaweCoreState.player.seekable.length - 1) : 0;
  if (seekableEnd <= 0 && !MaweNavPreview.seekWarned) {
    if (MaweCoreState.player.readyState < 1 || MaweCoreState.player.networkState === HTMLMediaElement.NETWORK_LOADING) {
      MaweNavPreview.pendingMediaSeekTimeSec = timeSec;
      return;
    }
    MaweNavPreview.seekWarned = true;
    MaweHint.flashHint('媒体尚不可 seek；请等待加载完成或用 file:// 直接打开 HTML', 'warning');
  }
  try {
    MaweCoreState.player.currentTime = Math.max(0, timeSec);
    if (!dragPreview) {
      MawePlaybackLoop.update();
      // currentTime 的 seeked/timeupdate 事件是异步触发的；先同步刷新波形，
      // 避免字幕已选中但红色播放头要等下一拍才移动。
      MaweCoreState.waveformEditor?.updatePlayback();
    }
  } catch (error) {
    MaweHint.flashHint(`跳转失败：${error.message}`, 'warning');
  }
}

function notifyAutoLoadedMediaReady(mediaElement) {
  if (mediaElement !== MaweCoreState.player || MaweNavPreview.autoLoadedMediaReadyNotified || !SERVER_CONFIG?.autoLoadedMediaName) return;
  MaweNavPreview.autoLoadedMediaReadyNotified = true;
  MaweHint.flashHint(translatedEditorText(`已加载媒体：${SERVER_CONFIG.autoLoadedMediaName}`), 'success');
}

function flushPendingMediaSeek(mediaElement) {
  if (mediaElement !== MaweCoreState.player || MaweNavPreview.pendingMediaSeekTimeSec === null) return;
  const timeSec = MaweNavPreview.pendingMediaSeekTimeSec;
  MaweNavPreview.pendingMediaSeekTimeSec = null;
  seekFromWaveform(timeSec);
}

function initWaveformEditor() {
  if (!window.AsrWaveform) {
    MaweHint.flashHint('波形模块加载失败，字幕编辑仍可使用', 'warning');
    return;
  }
  MaweCoreState.waveformEditor = window.AsrWaveform.create({
    getSegments: (track = 'main') => track === 'extension'
      ? (MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments || []) : DATA.segments,
    getExtensionSegments: (trackId = null) => MaweMultiSubtitleCore.getExtensionTrack(trackId)?.segments || [],
    getCrossTrackSnapTargets: (track = 'main') => {
      if (!MaweMultiSubtitleCore.multiSubtitleVisible() || !MaweSettings.EDITOR_SETTINGS.crossTrackSnap) return [];
      const otherSegments = track === 'extension'
        ? DATA.segments : (MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments || []);
      return otherSegments.flatMap((segment) => [segment?.start, segment?.end])
        .filter((timeMs) => Number.isFinite(Number(timeMs)))
        .map((timeMs) => Number(timeMs));
    },
    getSelection: (track = 'main') => track === 'extension' ? MaweSelection.selectedExtensionIdxs : MaweSelection.selectedIdxs,
    getExtensionSelection: () => MaweSelection.selectedExtensionIdxs,
    getBindingMarkerTargets: MaweMultiSubtitleCore.getBindingMarkerTargets,
    multiSubtitleVisible: () => MaweMultiSubtitleCore.multiSubtitleVisible(),
    // 波形上已经选中的块不会再次调用 selectCue；单独提供激活回调，
    // 避免联动选中主副字幕后点击另一条字幕时编辑区不切换。
    activateCue: (idx) => MaweCuePanel.setCurrentCuePanelIndex(idx),
    enterCueEditor: (idx) => {
      MaweCuePanel.setCurrentCuePanelIndex(idx);
      MaweCuePanel.focusCuePanelText(idx, 'main');
    },
    activateExtensionCue: (idx) => {
      MaweCuePanel.setCurrentCuePanelExtensionIndex(idx, MaweMultiSubtitleCore.getActiveExtensionTrack());
    },
    enterExtensionCueEditor: (idx) => {
      MaweCuePanel.setCurrentCuePanelExtensionIndex(idx, MaweMultiSubtitleCore.getActiveExtensionTrack());
      MaweCuePanel.focusCuePanelText(idx, 'extension');
    },
    selectCue: (idx) => {
      MaweBindingAlign.selectCueByClick(idx);
      MaweSelection.lastClickedIdx = idx;
      const cue = MaweCoreState.container.querySelector(`.cue[data-idx="${idx}"]`);
      if (cue) MaweCueListAnchor.scrollCueIntoViewIfNeeded(cue);
    },
    clearSelection: () => MaweSelection.clearSelection(),
    toggleCueSelection: (idx) => {
      MaweSelection.toggleSel(idx);
      MaweSelection.lastClickedIdx = idx;
    },
    selectExtensionCue: (idx) => {
      MaweSelection.selectOnlyExtension(idx);
      MaweSelection.lastClickedExtensionIdx = idx;
    },
    toggleExtensionSelection: (idx) => {
      MaweSelection.toggleExtensionSelection(idx, MaweMultiSubtitleCore.getActiveExtensionTrack());
      MaweSelection.lastClickedExtensionIdx = idx;
    },
    selectExtensionRange: (idx) => {
      if (MaweSelection.lastClickedExtensionIdx >= 0) MaweSelection.selectExtensionRange(MaweSelection.lastClickedExtensionIdx, idx);
      else MaweSelection.selectOnlyExtension(idx);
      MaweSelection.lastClickedExtensionIdx = idx;
    },
    selectCueRange: (idx) => {
      if (MaweSelection.lastClickedIdx >= 0) MaweSelection.selectRange(MaweSelection.lastClickedIdx, idx);
      else MaweSelection.selectOnly(idx);
      MaweSelection.lastClickedIdx = idx;
    },
    // 波形 Shift+框选：把命中的一批下标追加进当前多选（追加语义，不改 Shift 锚点）
    addCueSelection: (idxs) => {
      idxs.forEach((idx) => MaweSelection.addToSelection(idx));
    },
    addExtensionSelection: (idxs) => {
      const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
      idxs.forEach((idx) => MaweSelection.addExtensionToSelection(idx, track));
    },
    seek: seekFromWaveform,
    onPlayheadDragStateChange: (active) => {
      MawePlaybackLoop.waveformPlayheadDragging = active === true;
    },
    togglePlayback: MaweMediaPlayback.togglePlayback,
    toggleDisabled: (idxs, track = 'main') => toggleDisabled(idxs, track),
    getHideDisabled: () => MaweDom.hideDisabled,
    getGapRemoveGaps: MaweGapRemoveData.getGapRemoveGaps,
    getGapOperationMode: MaweGapRemoveUi.getGapRemoveOperationMode,
    toggleGapRemoved: MaweGapRemoveUi.toggleGapRemoved,
    applyGapRange: MaweGapRemoveUi.applyManualGapRange,
    resizeGapBoundary: MaweGapRemoveUi.resizeManualGapBoundary,
    moveGap: (index, deltaMs) => MaweGapRemoveUi.translateManualGap(index, deltaMs, 'move'),
    copyGap: (index, deltaMs) => MaweGapRemoveUi.translateManualGap(index, deltaMs, 'copy'),
    previewGapAt: MawePlaybackLoop.previewGapAt,
    showGapContextMenu: (x, y, index) => showGapContextMenu(x, y, index),
    showContextMenu: (x, y, idx, timeMs) => showContextMenu(x, y, idx, timeMs),
    showExtensionContextMenu: (x, y, idx, timeMs) => showExtensionContextMenu(x, y, idx, timeMs),
    showBlankWaveformMenu: (timeMs, x, y, track) => showWaveformBlankMenu(timeMs, x, y, track),
    addCueRange: (startMs, endMs, x, y, track = 'main') => (
      addCueRangeFromWaveform(startMs, endMs, x, y, track)
    ),
    onCueCreateRejected: (reason) => {
      if (reason === 'too-short') MaweHint.flashHint('该空白区域不足 100ms，无法新增字幕', 'warning');
      if (reason === 'occupied') MaweHint.flashHint('该位置已有字幕，无法新增字幕', 'warning');
    },
    // 剃刀工具：在波形指针位置安全拆分字幕。复用右键菜单的波形时间拆分路径；
    // 有可靠主轨字词时间码时沿用字词锚点，否则在弹窗中保留指针的绝对切点。
    splitCueAtTime: (idx, timeMs) => MaweSplitContext.splitFromContextMenu(idx, 0, 0, timeMs),
    getClickBehavior: () => MaweSettings.EDITOR_SETTINGS.clickBehavior,
    getClickTarget: () => MaweSettings.EDITOR_SETTINGS.clickTarget,
    getAutoSnapAdjacentCues: () => MaweSettings.EDITOR_SETTINGS.autoSnapAdjacentCues,
    getWaveShapeSource: () => MaweSettings.EDITOR_SETTINGS.waveShapeSource,
    // JKL 倒放靠逐帧回退实现，媒体元素本身处于暂停态；倒放期间同样视为播放中。
    getHoverSeekPreview: () => MaweSettings.EDITOR_SETTINGS.hoverSeekPreview && !MaweJklPlayback.isReversePlaying(),
    showTrackBadges: () => MaweSettings.EDITOR_SETTINGS.multiSubtitleShowTrackBadges,
    onBeginEdit: (label) => MaweHistory.pushUndo(label),
    syncBoundCueDrag,
    onLayoutUndo: (label, snapshot) => MaweHistory.pushLayoutUndo(label, snapshot),
    onCommitEdit: (idxs, kind, track = 'main', independent = false, details = null) => {
      let linkedChanged = false;
      if (kind === 'resize-boundary-pointer' && track === 'main' && !independent) {
        const targetIndex = Number.isInteger(details?.targetIndex) ? details.targetIndex : idxs[0];
        const main = DATA.segments[targetIndex];
        const original = details?.original;
        if (main && original) {
          linkedChanged = MaweMultiSubtitleCore.syncBoundExtensionForMain(main, {
            oldStart: original.start,
            oldEnd: original.end,
            edge: details.edge,
            mode: 'range',
          });
        }
      }
      syncTimelineGroupRanges();
      // 拖动预览期间保持下标稳定；提交时再整理副轨数组，避免冲突裁剪后
      // 原本位于目标前面的字幕保留右侧区间而落到目标之后，保存时违反顺序契约。
      if (MaweMultiSubtitleCore.multiSubtitleVisible()) MaweMultiSubtitleCore.sortExtensionTrackSegments(MaweMultiSubtitleCore.getActiveExtensionTrack());
      MaweMultiSubtitleCore.syncBindingOffsets();
      MaweMultiSubtitleCore.markMainSegmentsDirty(track === 'main' ? idxs.map((idx) => DATA.segments[idx]).filter(Boolean) : []);
      if (linkedChanged || MaweMultiSubtitleCore.multiSubtitleVisible() || track === 'extension') MaweMultiSubtitleCore.markMultiSubtitleDirty();
      MaweCuePanel.renderAll();
      MawePlaybackLoop.updateWithoutCueListAutoScroll();
      MaweHint.flashHint(kind === 'move'
        ? track === 'extension'
          ? `已移动 ${idxs.length} 条副字幕`
          : `已${independent ? '独立' : '联动'}移动 ${idxs.length} 条字幕`
        : kind === 'resize-boundary-pointer'
          ? `已将${track === 'extension' ? '副字幕' : '字幕'}${details?.edge === 'start' ? '起点' : '终点'}定位到鼠标位置`
        : kind === 'resize-boundary'
          ? `已${independent ? '独立' : '联动'}调整第 ${idxs[0] + 1} / ${idxs[1] + 1} 条边界`
          : kind === 'resize-boundary-independent'
            ? `已独立调整第 ${idxs[0] + 1} 条字幕边界`
            : `已调整第 ${idxs[0] + 1} 条字幕时间`);
    },
    onPayload: (payload) => {
      DATA.waveform = payload;
      MaweCoreState.waveformLoadedFromProject = false;
    },
  });
  MaweCoreState.waveformEditor.attachPlayer(MaweCoreState.player);
  MaweCoreState.waveformEditor.setLayoutData(DATA.workspace || null, { render: false });
  MaweDisplaySettings.applyEditorDisplaySettings(DATA.workspace?.editorDisplay);
  MaweCoreState.waveformEditor.setSpectralPayload(DATA.spectral || null, { render: false });
  MaweCoreState.waveformEditor.setReapeaksWaveform(DATA.waveform_reapeaks || null, { render: false });
  MaweCoreState.waveformLoadedFromProject = MaweCoreState.waveformEditor.setPayload(DATA.waveform || null, { render: false });
}

async function loadDeferredReapeaks() {
  const url = SERVER_CONFIG?.waveformUrl;
  if (!url || !MaweCoreState.waveformEditor) return;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) throw new Error(result.error || `服务器返回 ${response.status}`);
    if (result.status === 'loading' || result.status === 'pending') {
      window.setTimeout(() => { void loadDeferredReapeaks(); }, 500);
      return;
    }
    if (result.status !== 'ready') return;
    const hasPayload = Boolean(result.spectral || result.waveform_reapeaks);
    if (!hasPayload) return;
    DATA.spectral = result.spectral || null;
    DATA.waveform_reapeaks = result.waveform_reapeaks || null;
    MaweCoreState.waveformEditor.setSpectralPayload(DATA.spectral, { render: false });
    MaweCoreState.waveformEditor.setReapeaksWaveform(DATA.waveform_reapeaks, { render: false });
    MaweCuePanel.renderAll({ waveform: 'full' });
  } catch (_error) {
    window.setTimeout(() => { void loadDeferredReapeaks(); }, 1000);
  }
}

// Server-editor 页面可能在本地服务退出后继续留在浏览器中。定期复用
// startup-status 这个轻量 JSON 接口：断联时保留页面里的编辑内容，并显示
// 持久横幅；服务恢复后自动清掉横幅，不刷新页面，避免覆盖未保存的改动。
const SERVER_CONNECTION_CHECK_INTERVAL_MS = 2000;
const SERVER_CONNECTION_REQUEST_TIMEOUT_MS = 1500;
const SERVER_CONNECTION_FAILURE_THRESHOLD = 2;
const serverConnectionBanner = document.getElementById('server-connection-banner');
let serverConnectionCheckTimer = 0;
let serverConnectionCheckInFlight = false;
let serverConnectionFailureCount = 0;

function serverConnectionCheckUrl() {
  return SERVER_CONFIG?.healthUrl || SERVER_CONFIG?.startupStatusUrl || '';
}

function renderServerConnectionBanner(disconnected) {
  if (serverConnectionBanner) serverConnectionBanner.hidden = !disconnected;
}

function scheduleServerConnectionCheck(delayMs = SERVER_CONNECTION_CHECK_INTERVAL_MS) {
  if (!serverConnectionCheckUrl()) return;
  if (serverConnectionCheckTimer) window.clearTimeout(serverConnectionCheckTimer);
  serverConnectionCheckTimer = window.setTimeout(() => {
    serverConnectionCheckTimer = 0;
    void checkServerConnection();
  }, Math.max(0, delayMs));
}

async function checkServerConnection() {
  const url = serverConnectionCheckUrl();
  if (!url || serverConnectionCheckInFlight) return;
  serverConnectionCheckInFlight = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SERVER_CONNECTION_REQUEST_TIMEOUT_MS);
  let healthy = false;
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    const result = await response.json().catch(() => null);
    healthy = response.ok && result?.ok === true;
  } catch (_error) {
    // A refused/aborted local request is the expected signal that the server disappeared.
  } finally {
    window.clearTimeout(timeout);
    serverConnectionCheckInFlight = false;
  }

  if (healthy) {
    serverConnectionFailureCount = 0;
    renderServerConnectionBanner(false);
  } else {
    serverConnectionFailureCount += 1;
    if (serverConnectionFailureCount >= SERVER_CONNECTION_FAILURE_THRESHOLD) {
      renderServerConnectionBanner(true);
    }
  }
  scheduleServerConnectionCheck();
}

function startServerConnectionMonitor() {
  if (!serverConnectionBanner || !serverConnectionCheckUrl()) return;
  renderServerConnectionBanner(false);
  void checkServerConnection();
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleServerConnectionCheck(0);
});
window.addEventListener('online', () => scheduleServerConnectionCheck(0));

const SERVER_STARTUP_LABELS = {
  zh: {
    starting: '正在启动编辑器…',
    reading_project: '正在读取工程…',
    validating_project: '正在校验工程…',
    preparing_media: '正在准备媒体…',
    preparing_waveform: '正在生成波形…',
    finalizing: '正在完成工程加载…',
    ready: '工程加载完成',
    error: '工程加载失败',
    preparing: '正在准备工程…',
  },
  en: {
    starting: 'Starting editor…',
    reading_project: 'Reading project…',
    validating_project: 'Validating project…',
    preparing_media: 'Preparing media…',
    preparing_waveform: 'Generating waveform…',
    finalizing: 'Finishing project loading…',
    ready: 'Project loaded',
    error: 'Project loading failed',
    preparing: 'Preparing project…',
  },
};

function serverStartupLabel(stage) {
  const language = window.MAWE_I18N?.language === 'en' ? 'en' : 'zh';
  return SERVER_STARTUP_LABELS[language][stage] || SERVER_STARTUP_LABELS[language].preparing;
}

async function loadServerStartup() {
  const url = SERVER_CONFIG?.startupStatusUrl;
  const status = SERVER_CONFIG?.startupStatus;
  if (!url || status === 'ready') return;
  if (status === 'error') {
    const detail = SERVER_CONFIG.startupError || serverStartupLabel('error');
    MaweHint.flashHint(`${serverStartupLabel('error')}：${detail}`, 'warning');
    return;
  }

  const finishLoading = beginEditorLoading(
    serverStartupLabel(SERVER_CONFIG.startupStage),
    SERVER_CONFIG.startupProgress,
  );
  const poll = async () => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) {
        throw new Error(result.error || `服务器返回 ${response.status}`);
      }
      if (result.status === 'ready') {
        updateEditorLoading(100, serverStartupLabel('ready'));
        finishLoading();
        // 页面中的 DATA、媒体标签和保存能力都由服务端工程一起渲染；
        // 工程准备好后刷新一次即可无竞态地接管完整工程和波形。
        window.location.reload();
        return;
      }
      if (result.status === 'error') {
        finishLoading();
        MaweHint.flashHint(
          `${serverStartupLabel('error')}：${result.error || serverStartupLabel('error')}`,
          'warning',
        );
        return;
      }
      updateEditorLoading(result.progress, serverStartupLabel(result.stage));
      window.setTimeout(() => { void poll(); }, 500);
    } catch (_error) {
      window.setTimeout(() => { void poll(); }, 1000);
    }
  };
  await poll();
}

// === Drag & Drop：拖入视频/音频/JSON/SRT 自动加载 ===
const dragOverlay = document.getElementById('drag-overlay');
function isJsonFile(f) {
  const name = f.name.toLowerCase();
  return f.type === 'application/json' || name.endsWith('.json') || name.endsWith('.mosp');
}
function isSrtFile(f) {
  return f.name.toLowerCase().endsWith('.srt');
}
async function handleDroppedFiles(files) {
  if (!files.length) return;
  const finishLoading = beginEditorLoading('正在处理拖入文件…', 2);
  try {
  const mediaFile = files.find(MaweCoreState.isMediaFile);
  const reapeaksFile = files.find(MaweCoreState.isReapeaksFile);
  const jsonFile = files.find(isJsonFile);
  const srtFile = files.find(isSrtFile);
  let stagedSrtSegments = null;
  if (!mediaFile && !reapeaksFile && !jsonFile && !srtFile) {
    MaweHint.flashHint('不支持的文件类型（仅支持视频 / 音频 / JSON / SRT / ReaPeaks）', 'warning');
    return;
  }
  if (jsonFile) {
    if (DATA.segments.length > 0) {
      if (hasUnsavedProjectChanges()
          && !confirm('当前有未保存的改动，是否继续处理此工程文件？选择“打开工程”仍会替换当前工程。')) return;
      try {
        const segments = await parseSubtitleImportFile(jsonFile);
        await showMultiSubtitleImportChoice(jsonFile, segments, {
          projectFile: jsonFile,
          projectMediaFile: mediaFile,
        });
      } catch (error) {
        MaweHint.flashHint(`导入工程字幕失败：${error.message || error}`, 'warning');
      }
      return;
    }
    // 工程与媒体一起拖入时，媒体随工程自动加载，不再弹窗要求重选。
    const opened = await openProjectFile(jsonFile, { suppressMediaPrompt: Boolean(mediaFile) });
    if (opened && mediaFile) await loadMediaFile(mediaFile);
    return;
  }
  if (reapeaksFile && !mediaFile && !srtFile) {
    await loadReapeaksFile(reapeaksFile);
    return;
  }
  if (srtFile && DATA.segments.length === 0) {
    try {
      stagedSrtSegments = parseSrtSegments(await readFileTextWithProgress(srtFile));
    } catch (error) {
      MaweHint.flashHint(`导入字幕失败：${error.message || error}`, 'warning');
      return;
    }
  }
  if ((mediaFile || srtFile) && !await ensureProjectCheckpointForImport(mediaFile || srtFile, { usePicker: false })) return;
  if (mediaFile) {
    const imported = await loadMediaFile(mediaFile);
    if (imported) projectImportDirty = true;
  }
  if (reapeaksFile) await loadReapeaksFile(reapeaksFile);
  if (srtFile) {
    if (DATA.segments.length > 0) {
      try {
        const segments = await parseSubtitleImportFile(srtFile);
        await showMultiSubtitleImportChoice(srtFile, segments);
      } catch (error) {
        MaweHint.flashHint(`导入字幕失败：${error.message || error}`, 'warning');
      }
    } else {
      replaceMainTrack(stagedSrtSegments, srtFile.name);
    }
  }
  if ((mediaFile || srtFile) && projectSaveTargetEnabled()) await saveCurrentProject({ silent: true });
  updateEditorLoading(100, '文件加载完成');
  } finally {
    finishLoading();
  }
}
let dragCounter = 0;  // dragenter/leave 计数，避免子元素进出导致遮罩闪烁
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  dragCounter++;
  if (dragCounter === 1) dragOverlay.classList.add('show');
});
window.addEventListener('dragover', (e) => {
  if (e.dataTransfer && e.dataTransfer.types.includes('Files')) e.preventDefault();
});
window.addEventListener('dragleave', (e) => {
  if (!e.dataTransfer) return;
  dragCounter--;
  if (dragCounter <= 0) { dragCounter = 0; dragOverlay.classList.remove('show'); }
});
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  dragCounter = 0;
  dragOverlay.classList.remove('show');
  void handleDroppedFiles(Array.from(e.dataTransfer.files));
});

// === 启动 ===
// 兜底：工程可能带有上游写入的 0 长/倒挂段、词时间码（旧版工具或异常识别结果），
// 加载时统一拉齐到至少 100ms，避免拆分后看不见字幕块、工程无法保存。
const repairedGroupReferenceCount = window.AsrEditorUtils.repairGroupReferenceIndices(DATA.segments);
const repairedTimingCount = normalizeProjectTimings(DATA);
maweDebug('boot:begin', {
  server: Boolean(SERVER_CONFIG),
  segments: Array.isArray(DATA.segments) ? DATA.segments.length : null,
  media: DATA.media || '',
  recentProjects: SERVER_CONFIG?.recentProjects?.length || 0,
});
cleanPunctuation();
configureServerSaveControls();
configureServerAutoSave();
configureRecentProjects();
configureServerProjectSettings();
initWaveformEditor();
configureServerWorkspaceLibrary();
configureWorkspaceTransfer();
MaweDom.totalCountEl.textContent = DATA.segments.length;
// 新手引导通过这个窄桥接访问编辑器核心状态；引导本身在 editor-onboarding.js 中按需初始化。
window.MAWE_EDITOR_BRIDGE = Object.freeze({
  get data() { return DATA; },
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
  openHelp: () => helpFloatingPanel.open(),
  openHelpAtTab,
  closeHelp: () => helpFloatingPanel.close(),
});
window.MAWE?.register('editor-bridge', () => window.MAWE_EDITOR_BRIDGE);
MaweCuePanel.renderAll({ waveform: 'full' });
maweDebug('boot:complete', {
  renderedSegments: MaweCoreState.container?.querySelectorAll?.('.cue-row')?.length || 0,
  recentProjectsVisible: MaweDom.recentProjectsEl ? !MaweDom.recentProjectsEl.hidden : false,
  mediaName: mediaNameEl?.textContent || '',
  placeholderVisible: MaweDom.playerEmpty ? !MaweDom.playerEmpty.hidden : null,
});
MaweGapRemoveUi.updateGapRemoveUi();
if (repairedTimingCount > 0) {
  MaweHint.flashHint(`已自动修复 ${repairedTimingCount} 处异常时间码（保底 100ms）`, 'warning');
} else if (repairedGroupReferenceCount > 0) {
  MaweHint.flashHint(`已自动修复 ${repairedGroupReferenceCount} 处分组引用`, 'warning');
}
void loadServerStartup();
startServerConnectionMonitor();
if (SERVER_CONFIG?.startupStatus !== 'loading') void loadDeferredReapeaks();

document.getElementById('filter-over')?.addEventListener('click', (e) => {
  e.currentTarget.classList.toggle('active');
  if (!e.currentTarget.classList.contains('active')) {
    MaweCueElements.clearTemporaryVisibleSplitCues();
  }
  MaweSearch.applySearch(MaweDom.searchEl.value);
});

// 「隐藏禁用项」开关：开启后禁用项 display:none，并从选中集移除
MaweDom.hideDisabledToggle?.addEventListener('change', () => {
  const cueListAnchor = MaweCueListAnchor.captureCueListRenderAnchor();
  MaweDom.hideDisabled = MaweDom.hideDisabledToggle.checked;
  updateEditorSettings({ cueListHideDisabled: MaweDom.hideDisabled });
  MaweCoreState.container.classList.toggle('hide-disabled', MaweDom.hideDisabled);
  if (MaweDom.hideDisabled) {
    // 清理选中集中的禁用项（隐藏了但还留在选中集会造成状态不一致）
    [...MaweSelection.selectedIdxs].forEach(i => {
      if (DATA.segments[i]?.disabled) {
        MaweSelection.selectedIdxs.delete(i);
        const el = MaweCoreState.container.querySelector(`.cue[data-idx="${i}"]`);
        if (el) el.classList.remove('selected');
      }
    });
    const extensionTrack = MaweMultiSubtitleCore.getActiveExtensionTrack();
    [...MaweSelection.selectedExtensionIdxs].forEach((index) => {
      if (extensionTrack?.segments[index]?.disabled) MaweSelection.selectedExtensionIdxs.delete(index);
    });
    MaweSelection.updateMultiSelectionClasses();
    MaweDom.selCountEl.textContent = String(MaweSelection.selectedIdxs.size + MaweSelection.selectedExtensionIdxs.size);
    if (MaweCoreState.waveformEditor) MaweCoreState.waveformEditor.updateSelection();
  }
  if (MaweCoreState.waveformEditor) MaweCoreState.waveformEditor.updateDisabledVisibility();
  MaweCueListAnchor.restoreCueListRenderAnchor(cueListAnchor);
});

// 离开提示
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedProjectChanges()) { e.preventDefault(); e.returnValue = ''; }
});
