// 设置面板绑定（下）：主/副字幕字体、颜色与背景、字体扫描、点击与快捷键操作提示文案。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。
MaweDom.subtitleFontFamilySelect?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('调整字幕字体', MaweHistory.snapshotPreviewState());
  MaweAppearance.setSubtitleAppearance({ font_family: MaweDom.subtitleFontFamilySelect.value });
});
MaweDom.subtitleBackgroundColorInput?.addEventListener('input', () => MaweAppearanceInputs.applySubtitleBackgroundColorInput());
MaweDom.subtitleBackgroundColorInput?.addEventListener('change', () => MaweAppearanceInputs.applySubtitleBackgroundColorInput({ finalize: true }));
MaweDom.subtitleBackgroundAlphaInput?.addEventListener('input', () => MaweAppearanceInputs.applySubtitleBackgroundAlphaInput());
MaweDom.subtitleBackgroundAlphaInput?.addEventListener('change', () => MaweAppearanceInputs.applySubtitleBackgroundAlphaInput({ finalize: true }));
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
MaweDom.extensionSubtitleBackgroundAlphaInput?.addEventListener('input', () => MaweAppearanceInputs.applyExtensionSubtitleBackgroundAlphaInput());
MaweDom.extensionSubtitleBackgroundAlphaInput?.addEventListener('change', () => MaweAppearanceInputs.applyExtensionSubtitleBackgroundAlphaInput({ finalize: true }));
MaweDom.extensionOverlayToggle?.addEventListener('change', () => {
  const previous = MaweHistory.snapshotPreviewState();
  previous.extensionOverlay = !MaweDom.extensionOverlayToggle.checked;
  MaweHistory.pushPreviewUndo('切换副字幕预览', previous);
  MaweSettings.updateEditorSettings({ extensionOverlayEnabled: MaweDom.extensionOverlayToggle.checked });
  MawePreviewGeometry.refreshPreviewGeometryEditable();
  MawePlaybackLoop.update();
});
MaweBehaviorHints.refreshClickBehaviorHint();
document.addEventListener('mawe:languagechange', MaweBehaviorHints.refreshClickBehaviorHint);
MaweBehaviorHints.refreshKeyboardOperationReferenceHint();
document.addEventListener('mawe:languagechange', MaweBehaviorHints.refreshKeyboardOperationReferenceHint);
