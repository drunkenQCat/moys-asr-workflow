// 导出接线：FCP7/Lottie/OGraf 弹窗、各类 SRT/JSON/OTIO(T)/ffconcat 导出按钮、保存快捷键与工具栏下拉。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

document.getElementById('download-fcp7-export')?.addEventListener('click', MaweDynamicExports.openFcp7ExportModal);
MaweDom.fcp7ExportCancel?.addEventListener('click', MaweDynamicExports.closeFcp7ExportModal);
MaweDom.fcp7ExportConfirm?.addEventListener('click', () => { void MaweDynamicExports.exportFcp7Xml(); });
MaweDom.fcp7ExportModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.fcp7ExportModal) MaweDynamicExports.closeFcp7ExportModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweDom.fcp7ExportModal.classList.contains('show')) return;
  event.preventDefault();
  event.stopPropagation();
  MaweDynamicExports.closeFcp7ExportModal();
}, true);

document.getElementById('download-lottie')?.addEventListener('click', MaweDynamicExports.openLottieExportModal);
MaweDom.lottieExportCancel?.addEventListener('click', MaweDynamicExports.closeLottieExportModal);
MaweDom.lottieExportConfirm?.addEventListener('click', () => { void MaweDynamicExports.exportLottieDynamicCaptions(); });
MaweDom.lottieExportModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.lottieExportModal) MaweDynamicExports.closeLottieExportModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweDom.lottieExportModal?.classList.contains('show')) return;
  event.preventDefault();
  event.stopPropagation();
  MaweDynamicExports.closeLottieExportModal();
}, true);

document.getElementById('download-ograf')?.addEventListener('click', MaweDynamicExports.openOgrafExportModal);
MaweDom.ografExportCancel?.addEventListener('click', MaweDynamicExports.closeOgrafExportModal);
MaweDom.ografExportConfirm?.addEventListener('click', () => { void MaweDynamicExports.exportOgrafDynamicCaptions(); });
MaweDom.ografExportModal?.addEventListener('click', (event) => {
  if (event.target === MaweDom.ografExportModal) MaweDynamicExports.closeOgrafExportModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !MaweDom.ografExportModal?.classList.contains('show')) return;
  event.preventDefault();
  event.stopPropagation();
  MaweDynamicExports.closeOgrafExportModal();
}, true);

MaweDom.downloadMultiSrtButton?.addEventListener('click', async () => {
  if (MaweInlineEdit.extensionEditingState) MaweInlineEdit.finishExtensionEdit(true);
  const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
  if (!track) return;
  await MaweExportTimeline.downloadFile(MaweExportSrt.buildExtensionSrt(track), `${MaweBoot.FILENAME_BASE}_extension.srt`, 'text/plain', {
    desc: '副字幕 SRT 文件', types: { 'text/plain': ['.srt'] },
  });
});
document.getElementById('download-full-srt')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  await MaweExportTimeline.downloadFile(MaweExportSrt.buildSrt(), `${MaweBoot.FILENAME_BASE}.srt`, 'text/plain', {
    desc: '完整 SRT 字幕文件', types: { 'text/plain': ['.srt'] }
  });
});
document.getElementById('download-color-srt')?.addEventListener('click', () => MaweExportSrt.downloadColorSrts(false));
document.getElementById('download-plain-text')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  await MaweExportTimeline.downloadFile(window.AsrEditorUtils.buildPlainTextPayload(MaweBoot.DATA.segments), `${MaweBoot.FILENAME_BASE}.txt`, 'text/plain', {
    desc: '纯文本字幕文件', types: { 'text/plain': ['.txt'] }
  });
});
document.getElementById('download-json')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  await MaweExportTimeline.downloadFile(MaweJsonRepair.buildJson(), `${MaweBoot.FILENAME_BASE}.mosp`, 'application/json', {
    desc: 'MOSE 工程文件', types: { 'application/json': ['.mosp', '.json'] }
  });
});
MaweDom.saveProjectButton?.addEventListener('click', () => MaweProjectSave.saveCurrentProject());
MaweDom.saveProjectAsButton?.addEventListener('click', () => MaweProjectSave.saveProjectAsToFile());
// Project-level save shortcuts intentionally override the browser page-save
// command. finishEdit() inside saveProjectToServer commits an active text edit.
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  if (event.shiftKey) {
    void MaweProjectSave.saveProjectAsToFile();
  } else {
    void MaweProjectSave.saveCurrentProject();
  }
});
document.getElementById('download-resolve-json')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportTimeline.buildResolveJson();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${MaweBoot.FILENAME_BASE}_resolve.json`, 'application/json', {
      desc: 'Resolve JSON', types: { 'application/json': ['.json'] }
    });
  }
});

MaweStickerOtioExport.stickerOtioExportMode?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ stickerOtioExportMode: MaweStickerOtioExport.stickerOtioExportMode.value });
});

document.getElementById('download-sticker-otio')?.addEventListener('click', () => {
  if (MaweExportTimeline.stickerExportBlocked('download-sticker-otio')) return;
  MaweStickerOtioExport.exportStickerOtio(
    'stickers', MaweExportTimeline.buildStickerOtio, `${MaweBoot.FILENAME_BASE}_stickers.otio`, 'OTIO 工程文件'
  );
});
document.getElementById('download-gap-removed-srt')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportSrt.buildGapRemovedSrt();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${MaweBoot.FILENAME_BASE}_gap-removed.srt`, 'text/plain', {
      desc: '去空隙字幕 SRT', types: { 'text/plain': ['.srt'] }
    });
  }
});
document.getElementById('download-gap-removed-color-srt')?.addEventListener('click', () => MaweExportSrt.downloadColorSrts(true));
document.getElementById('download-otio')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportTimeline.buildSourceOtio();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, MaweBoot.FILENAME_BASE + '.otio', 'application/vnd.opentimelineio+json', {
      desc: 'OTIO 工程', types: { 'application/vnd.opentimelineio+json': ['.otio'] }
    });
  }
});
document.getElementById('download-otioz')?.addEventListener('click', async () => {
  await MaweExportTimeline.exportTimelineOtioz(
    'source',
    MaweExportTimeline.buildSourceOtio,
    MaweBoot.FILENAME_BASE + '.otioz',
    'OTIOZ 打包工程',
  );
});
document.getElementById('download-gap-removed-otio')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportTimeline.buildGapRemovedOtio();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${MaweBoot.FILENAME_BASE}_gap-removed.otio`, 'application/vnd.opentimelineio+json', {
      desc: '去空隙 OTIO 工程', types: { 'application/vnd.opentimelineio+json': ['.otio'] }
    });
  }
});
document.getElementById('download-gap-removed-otioz')?.addEventListener('click', async () => {
  await MaweExportTimeline.exportTimelineOtioz(
    'gap-removed',
    MaweExportTimeline.buildGapRemovedOtio,
    `${MaweBoot.FILENAME_BASE}_gap-removed.otioz`,
    '去空隙时间线 OTIOZ 打包工程',
  );
});
document.getElementById('download-gap-removed-ffconcat')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportSrt.buildGapRemovedFfconcat();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${MaweBoot.FILENAME_BASE}_gap-removed.ffconcat`, 'text/plain', {
      desc: 'FFconcat 剪辑计划', types: { 'text/plain': ['.ffconcat'] }
    });
  }
});
document.getElementById('download-gap-removed-regions-json')?.addEventListener('click', async () => {
  if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
  const payload = MaweExportSrt.buildGapRemovedRegionsJson();
  if (payload) {
    await MaweExportTimeline.downloadFile(payload, `${MaweBoot.FILENAME_BASE}_gap-removed.keep-regions.json`, 'application/json', {
      desc: '去空隙保留区域 JSON', types: { 'application/json': ['.json'] }
    });
  }
});
document.getElementById('download-gap-removed-sticker-otio')?.addEventListener('click', async () => {
  if (MaweExportTimeline.stickerExportBlocked('download-gap-removed-sticker-otio')) return;
  await MaweStickerOtioExport.exportStickerOtio(
    'gap-removed-stickers', MaweExportTimeline.buildGapRemovedStickerOtio,
    `${MaweBoot.FILENAME_BASE}_gap-removed-stickers.otio`, '去空隙表情包 OTIO 工程'
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
    `${MaweBoot.FILENAME_BASE}_gap-removed-stickers.otioz`, '去空隙表情包 OTIOZ 打包工程'
  );
});
document.getElementById('download-sticker-otioz')?.addEventListener('click', async () => {
  if (MaweExportTimeline.stickerExportBlocked('download-sticker-otioz')) return;
  await MaweExportTimeline.exportStickerOtoz(
    'stickers', MaweExportTimeline.buildStickerOtio,
    `${MaweBoot.FILENAME_BASE}_stickers.otioz`, '表情包 OTIOZ 打包工程'
  );
});

// 初始按服务器模式刷新表情包 OTIOZ 导出按钮的可用性
MaweExportTimeline.updateStickerExportButtons();
MaweExportTimeline.updateTimelineOtiozExportButtons();
MaweDynamicExports.updateLottieExportButton();
MaweDynamicExports.updateOgrafExportButton();
MaweExportMenus.bindToolbarExportDropdown('subtitle-export-dropdown', 'subtitle-export-btn', 'subtitle-export-menu');
MaweExportMenus.bindToolbarExportDropdown('gap-removed-export-dropdown', 'gap-removed-export-btn', 'gap-removed-export-menu');
MaweExportMenus.bindToolbarExportDropdown('extra-export-dropdown', 'extra-export-btn', 'extra-export-menu');
MaweExportMenus.bindToolbarExportDropdown('open-project-dropdown', 'open-project-menu-btn', 'open-project-menu');
MaweExportMenus.bindToolbarExportDropdown('save-project-dropdown', 'save-project-menu-btn', 'save-project-menu');
MaweExportMenus.bindToolbarExportDropdown('workspace-transfer-dropdown', 'workspace-transfer-btn', 'workspace-transfer-menu');
MaweExportMenus.bindToolbarExportDropdown('multi-subtitle-settings-dropdown', 'multi-subtitle-settings-toggle', 'multi-subtitle-settings-menu');
MaweExportMenus.bindToolbarExportDropdown(
  'batch-operations-dropdown', 'batch-operations-btn', 'batch-operations-menu',
  MaweExportMenus.positionBatchOperationsMenu,
);
