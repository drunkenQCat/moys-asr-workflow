// 查找替换弹窗：输入联动、大小写与正则开关、替换选中项、确认与取消。
// 自 web/editor/boot/entry.js 的 423 条平铺接线语句按接线域连续切段而来。

[MaweFindReplace.findInput, MaweFindReplace.replaceInput].forEach(el => el.addEventListener('input', MaweFindReplace.updatePreview));
[MaweFindReplace.caseSensitiveCb, MaweFindReplace.useRegexCb].forEach(el => el.addEventListener('change', MaweFindReplace.updatePreview));
MaweFindReplace.replaceSelectedOnlyCb?.addEventListener('change', () => {
  MaweFindReplace.replaceScope = MaweFindReplace.replaceSelectedOnlyCb.checked ? [...MaweFindReplace.replaceSelectionSnapshot] : null;
  MaweFindReplace.refreshScopeInfo();
  MaweFindReplace.updatePreview();
});

document.getElementById('replace-btn')?.addEventListener('click', () => MaweFindReplace.openReplaceModal(null));
document.getElementById('replace-cancel')?.addEventListener('click', () => MaweDom.replaceModal.classList.remove('show'));
MaweDom.replaceModal.addEventListener('click', (e) => { if (e.target === MaweDom.replaceModal) MaweDom.replaceModal.classList.remove('show'); });
document.getElementById('replace-confirm')?.addEventListener('click', () => {
  const re = MaweFindReplace.buildReplaceRegex();
  if (!re || re.error) return;
  const repl = MaweFindReplace.replaceInput.value;
  // 先 dry-run 确认是否真的会改动，避免空操作压栈
  let willChange = 0;
  MaweFindReplace.getReplaceTargets().forEach(s => {
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
  MaweFindReplace.getReplaceTargets().forEach(s => {
    re.lastIndex = 0;
    const newText = s.text.replace(re, repl);
    if (newText !== s.text) { s.text = newText; s._dirty = true; changedRows++; }
  });
  MaweDom.replaceModal.classList.remove('show');
  MaweCuePanel.renderAll();
  MaweHint.flashHint(`已修改 ${changedRows} 行`, 'success');
});
