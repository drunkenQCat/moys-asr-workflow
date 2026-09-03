// 设置面板绑定（上）：拆分模式与移除符号、自动合并、字幕延长、字幕列表/编辑区显示、导出与点击行为。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。
MaweDom.splitKeySel.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ splitKey: MaweDom.splitKeySel.value });
  MaweSplitMode.refreshSplitKeyHelp();
});
MaweDom.splitUseWordTimestampsToggle?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ splitUseWordTimestamps: MaweDom.splitUseWordTimestampsToggle.checked });
});
MaweDom.multiSubtitleSplitAutoSubmit?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ splitAutoSubmit: MaweDom.multiSubtitleSplitAutoSubmit.checked });
});
if (MaweDom.mergeJoinTextContinuousInput) MaweDom.mergeJoinTextContinuousInput.addEventListener('input', () => {
  MaweSettings.updateEditorSettings({ mergeJoinTextContinuous: MaweDom.mergeJoinTextContinuousInput.value });
});
if (MaweDom.mergeJoinTextWordInput) MaweDom.mergeJoinTextWordInput.addEventListener('input', () => {
  MaweSettings.updateEditorSettings({ mergeJoinTextWord: MaweDom.mergeJoinTextWordInput.value });
});
MaweSplitTrim.renderSplitTrimSymbolGrid();
MaweSplitTrim.refreshSplitTrimExtraInput();
MaweSplitTrim.splitTrimExtraInput?.addEventListener('change', () => {
  const extras = MULTI_SUBTITLE_UTILS.parseSplitTrimSymbolInput(MaweSplitTrim.splitTrimExtraInput.value);
  MaweSplitTrim.persistSplitTrimSymbols([...MaweSplitTrim.splitTrimPrimaryCheckedSet(), ...extras]);
  MaweSplitTrim.refreshSplitTrimExtraInput();
});
MaweSplitTrim.splitTrimSymbolsReset?.addEventListener('click', () => {
  const defaults = MULTI_SUBTITLE_UTILS.setSplitTrimSymbols(
    [...MULTI_SUBTITLE_UTILS.DEFAULT_SPLIT_TRIM_SYMBOLS],
  );
  MaweSettings.updateEditorSettings({ splitTrimSymbols: defaults });
  MaweSplitTrim.renderSplitTrimSymbolGrid();
  MaweSplitTrim.refreshSplitTrimExtraInput();
});
MaweDom.autoMergeCloseButton?.addEventListener('click', () => MaweFloatingPanel.autoMergeFloatingPanel.close());
MaweDom.autoMergeRunButton?.addEventListener('click', MaweSegmentOps.autoMergeSegments);
MaweDom.autoMergeGapMsInput?.addEventListener('input', () => {
  MaweSettings.updateEditorSettings({ autoMergeGapMs: MaweSettings.clampAutoMergeGapMs(MaweDom.autoMergeGapMsInput.value) });
});
MaweDom.autoMergeGapMsInput?.addEventListener('change', () => {
  MaweDom.autoMergeGapMsInput.value = String(MaweSettings.EDITOR_SETTINGS.autoMergeGapMs);
});
MaweDom.autoMergeSnapDirectionSelect?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({
    autoMergeSnapDirection: MaweDom.autoMergeSnapDirectionSelect.value === 'forward' ? 'forward' : 'backward',
  });
});
MaweDom.autoMergeAbsorbShortToggle?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ autoMergeAbsorbShort: MaweDom.autoMergeAbsorbShortToggle.checked });
  MaweSegmentOps.syncAutoMergeAbsorbFields();
});
MaweDom.autoMergeShortCountInput?.addEventListener('input', () => {
  MaweSettings.updateEditorSettings({ autoMergeShortCount: MaweSettings.clampAutoMergeShortCount(MaweDom.autoMergeShortCountInput.value) });
});
MaweDom.autoMergeShortCountInput?.addEventListener('change', () => {
  MaweDom.autoMergeShortCountInput.value = String(MaweSettings.EDITOR_SETTINGS.autoMergeShortCount);
});
MaweDom.autoMergeAbsorbDirectionSelect?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({
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
MaweDom.subtitleExtendCloseButton?.addEventListener('click', () => MaweFloatingPanel.subtitleExtendFloatingPanel.close());
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
  MaweSettings.updateEditorSettings({ cueListKeepSplitVisible: MaweDom.cueListKeepSplitVisibleToggle.checked });
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
  MaweSettings.updateEditorSettings({ exportStartAtZero: MaweDom.exportStartAtZeroToggle.checked });
});
MaweDom.selectGroupMembersToggle?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ selectGroupMembers: MaweDom.selectGroupMembersToggle.checked });
});
MaweDom.exportColorUnifiedToggle?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ exportColorUnified: MaweDom.exportColorUnifiedToggle.checked });
});
MaweDom.clickBehaviorSelect?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ clickBehavior: MaweSettings.normalizeClickBehavior(MaweDom.clickBehaviorSelect.value) });
  MaweBehaviorHints.refreshClickBehaviorHint();
});
MaweDom.clickTargetSelect?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ clickTarget: MaweSettings.normalizeClickTarget(MaweDom.clickTargetSelect.value) });
});
MaweDom.keyboardOperationReferenceSelect?.addEventListener('change', () => {
  const mode = MaweSettings.normalizeKeyboardOperationReferenceMode(MaweDom.keyboardOperationReferenceSelect.value);
  MaweSettings.updateEditorSettings({ keyboardOperationReference: mode });
  MaweBehaviorHints.refreshKeyboardOperationReferenceHint();
});
MaweDom.hoverSeekPreviewToggle?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ hoverSeekPreview: MaweDom.hoverSeekPreviewToggle.checked });
});
