// 启动前置：全局错误探针、两个共享工具绑定、DOM 契约自检、拆分移除符号同步、撤销/重做按钮。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来（本段是第一段）。
// MULTI_SUBTITLE_UTILS 与 EDITOR_SETTINGS_UTILS 是这一层的顶层 const，后续段直接读取，本段必须最先装配。

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
MaweBoot.maweDomContractCheck();

MaweMultiSubtitleCore.normalizeMultiSubtitleState();
// 把用户配置的拆分移除符号同步给共享工具层；设置面板修改时也会同步。
MULTI_SUBTITLE_UTILS.setSplitTrimSymbols(MaweSettings.EDITOR_SETTINGS.splitTrimSymbols);
if (!Array.isArray(window.ASR_EDITOR_PALETTE) || !window.ASR_EDITOR_PALETTE.length) {
  throw new Error('调色板未注入：缺少 window.ASR_EDITOR_PALETTE（检查 edit.py / serve.py 渲染管线）');
}
if (MaweHistory.undoBtn) MaweHistory.undoBtn.addEventListener('click', () => MaweHistory.performUndo());
if (MaweHistory.redoBtn) MaweHistory.redoBtn.addEventListener('click', () => MaweHistory.performRedo());
MaweHistory.updateUndoRedoButtons();
