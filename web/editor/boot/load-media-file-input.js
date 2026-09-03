// 本地媒体文件输入的 change/cancel 处理。它在原文件里就排在拆分弹窗之后：事件注册顺序不能重排，所以单独成段。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

MaweProjectMediaInputs.loadMediaFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!MaweProjectMediaInputs.pendingProjectMediaSelection && !await MaweProjectLoad.ensureProjectCheckpointForImport(file)) return;
  MaweProjectMediaInputs.pendingProjectMediaSelection = null;
  const imported = await MaweMediaLoad.loadMediaFile(file);
  if (imported) {
    MaweServerSave.projectImportDirty = true;
    if (MaweServerSave.projectSaveTargetEnabled()) await MaweProjectSave.saveCurrentProject({ silent: true });
  }
});

MaweProjectMediaInputs.loadMediaFileInput.addEventListener('cancel', () => {
  MaweProjectMediaInputs.pendingProjectMediaSelection = null;
});
