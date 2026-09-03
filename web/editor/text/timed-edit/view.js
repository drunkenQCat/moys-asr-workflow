// 编辑器视图的打开、关闭、轨道切换与整体重绘。
// 自 web/editor/text/timed-edit.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweText；
// 兼容出口 window.MaweTimedTextEdit 仍由 editor/text/timed-edit/compat-surface.js 统一组装。
(function initMaweTimedEditView(global) {
  'use strict';

  const U = global.MaweText;



  function renderTimedTextEditRows() {
    MaweDom.timedTextEditRows.replaceChildren();
    if (!MaweDom.timedTextEditDraft) return;
    const report = MaweDom.timedTextEditDraft.report;
    const rowReports = U.timedTextEditDraftRowReports(report, MaweDom.timedTextEditDraft.texts);
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
      U.renderTimedTextEditMetric(
        coverage,
        coverageData.percent,
        'coverage',
        segment ? `有效字词时间码覆盖率：${coverageData.coveredCharacters}/${coverageData.totalCharacters}` : '等待可靠时间码映射',
      );
      const reuse = document.createElement('span');
      U.renderTimedTextEditMetric(
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



  function refreshTimedTextEditTrackOptions(kind = U.currentTimedTextEditKind()) {
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
    U.cancelTimedTextEditReport();
    const nextKind = refreshTimedTextEditTrackOptions(kind);
    const selection = U.timedTextEditSourceSelection(nextKind, showDisabled);
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
    MaweDom.timedTextEditSourceInfo.textContent = `${U.timedTextEditTrackLabel(nextKind)} · ${sourceSegments.length} 条${hiddenDisabledCount ? `（已隐藏 ${hiddenDisabledCount} 条禁用字幕）` : ''}`;
    renderTimedTextEditRows();
    renderTimedTextEditView();
    U.updateTimedTextEditReport();
  }



  function refreshTimedTextEditButton() {
    if (!MaweDom.timedTextEditButton) return;
    const hasMain = MaweBoot.DATA.segments.length > 0;
    const hasExtension = Boolean(MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments?.length);
    MaweDom.timedTextEditButton.disabled = !hasMain && !hasExtension;
  }



  function closeTimedTextEdit() {
    U.cancelTimedTextEditReport();
    MaweDom.timedTextEditModal.classList.remove('show');
    MaweDom.timedTextEditDraft = null;
    MaweDom.timedTextEditRows.replaceChildren();
    MaweDom.timedTextEditReturnFocus?.focus();
    MaweDom.timedTextEditReturnFocus = null;
  }



  function requestCloseTimedTextEdit() {
    if (U.timedTextEditHasUnappliedChanges()
        && !window.confirm('当前有未应用的文本修改，确定关闭编辑窗口吗？')) return false;
    closeTimedTextEdit();
    return true;
  }



  function openTimedTextEdit() {
    if (!MaweBoot.DATA.segments.length && !MaweMultiSubtitleCore.getActiveExtensionTrack()?.segments?.length) {
      MaweHint.flashHint('当前没有可编辑的字幕', 'invalid');
      return;
    }
    if (MaweInlineEdit.editingState) MaweInlineEdit.finishEdit(true);
    MaweDom.timedTextEditReturnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    loadTimedTextEditTrack(U.currentTimedTextEditKind());
    MaweDom.timedTextEditModal.classList.add('show');
    setTimeout(() => (MaweDom.timedTextEditDraft?.view === 'single'
      ? MaweDom.timedTextEditSingleTextarea : MaweDom.timedTextEditRows.querySelector('textarea'))?.focus(), 50);
  }

  Object.assign(U, {
    renderTimedTextEditRows,
    timedTextEditCanUseSingleView,
    renderTimedTextEditView,
    refreshTimedTextEditTrackOptions,
    loadTimedTextEditTrack,
    refreshTimedTextEditButton,
    openTimedTextEdit,
    closeTimedTextEdit,
    requestCloseTimedTextEdit,
  });
})(typeof window !== 'undefined' ? window : globalThis);
