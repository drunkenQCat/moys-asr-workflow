// 绑定与对齐：G 把单选副字幕绑到主字幕、H 把选中副字幕批量对齐到各自绑定的主字幕时间轴。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

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
