// 预览浮层：点击外部完成内联编辑、字幕与表情包预览框几何与控制点、播放器事件与叠加显示开关。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

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
MaweDom.overlayEl.addEventListener('keydown', (event) => MawePreviewGeometry.handlePreviewBoxKeydown(event, 'subtitle'));

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
MaweStickerOverlay.stickerOverlayLayer.addEventListener('keydown', (event) => MawePreviewGeometry.handlePreviewBoxKeydown(event, 'sticker'));

MaweDom.stickerOverlayToggle?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ stickerOverlayEnabled: MaweDom.stickerOverlayToggle.checked });
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
  MaweSettings.updateEditorSettings({ overlayEnabled: MaweDom.overlayToggle.checked });
  MawePreviewGeometry.refreshPreviewGeometryEditable();
  if (!MaweDom.overlayToggle.checked) MaweDom.overlayEl.classList.add('hidden');
  else MawePlaybackLoop.update();
});
if (MaweProjectSave.mediaNameEl && !MaweProjectSave.mediaNameEl.classList.contains('empty')) {
  MaweProjectSave.mediaNameEl.addEventListener('click', () => {
    const name = MaweProjectSave.mediaNameEl.textContent.trim();
    if (name) MaweExportTimeline.copyText(name, `已复制媒体名：${name}`);
  });
}
if (MaweProjectSave.jsonNameEl && !MaweProjectSave.jsonNameEl.classList.contains('empty')) {
  MaweProjectSave.jsonNameEl.addEventListener('click', () => {
    const name = MaweProjectSave.jsonNameEl.textContent.trim();
    if (name) MaweExportTimeline.copyText(name, `已复制：${name}`);
  });
}
