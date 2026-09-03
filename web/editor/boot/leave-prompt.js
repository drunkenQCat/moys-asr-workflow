// 离开提示：有未保存工程改动时拦下 beforeunload。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。
// 离开提示
window.addEventListener('beforeunload', (e) => {
  if (MaweServerSave.hasUnsavedProjectChanges()) { e.preventDefault(); e.returnValue = ''; }
});
