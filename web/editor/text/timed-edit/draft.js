// 草稿行与 DOM 的同步，以及差异报告的调度与重算。
// 自 web/editor/text/timed-edit.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweText；
// 兼容出口 window.MaweTimedTextEdit 仍由 editor/text/timed-edit/compat-surface.js 统一组装。
(function initMaweTimedEditDraft(global) {
  'use strict';

  const U = global.MaweText;



  function timedTextEditRowFilterKey(row) {
    return row.changed ? row.mappingStatus : 'unchanged';
  }



  function timedTextEditDraftRowReports(report, texts) {
    const source = Array.isArray(texts) ? texts : [];
    if (!report?.structure?.valid) {
      return source.map((_, index) => report?.rows?.[index] || null);
    }
    const outputByDraftIndex = new Map(
      (report.outputRows || [])
        .filter((row) => Number.isInteger(row?.draftIndex))
        .map((row) => [row.draftIndex, row]),
    );
    const deletedRows = (report.rows || []).filter((row) => row?.deleted);
    let deletedIndex = 0;
    return source.map((text, index) => {
      const output = outputByDraftIndex.get(index);
      if (output) return output;
      if (!String(text == null ? '' : text).trim()) return deletedRows[deletedIndex++] || null;
      return null;
    });
  }



  function normalizeTimedTextEditDraftLines(texts) {
    const lines = (Array.isArray(texts) ? texts : [])
      .map((text) => String(text == null ? '' : text));
    // 整体编辑末尾的换行只是输入习惯，不额外创建一条空字幕；真正清空的
    // 中间行仍保留到预览中，并在应用时按删除字幕处理。
    while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return lines.length ? lines : [''];
  }



  function syncTimedTextEditDraftFromDom() {
    if (!MaweDom.timedTextEditDraft || MaweDom.timedTextEditDraft.view !== 'single'
        || !MaweDom.timedTextEditSingleTextarea) return;
    const normalized = MaweDom.timedTextEditSingleTextarea.value.replace(/\r\n?/g, '\n');
    MaweDom.timedTextEditDraft.texts = normalizeTimedTextEditDraftLines(normalized.split('\n'));
    MaweDom.timedTextEditDraft.singleText = MaweDom.timedTextEditDraft.texts.join('\n');
    MaweDom.timedTextEditDraft.singleLineError = '';
  }



  function cancelTimedTextEditReport() {
    if (MaweDom.timedTextEditReportTimer === null) return;
    clearTimeout(MaweDom.timedTextEditReportTimer);
    MaweDom.timedTextEditReportTimer = null;
  }



  function flushTimedTextEditReport() {
    cancelTimedTextEditReport();
    updateTimedTextEditReport();
  }



  function scheduleTimedTextEditReport() {
    cancelTimedTextEditReport();
    MaweDom.timedTextEditReportTimer = setTimeout(() => {
      MaweDom.timedTextEditReportTimer = null;
      updateTimedTextEditReport();
    }, MaweDom.TIMED_TEXT_EDIT_REPORT_DEBOUNCE_MS);
  }



  function updateTimedTextEditReport() {
    if (!MaweDom.timedTextEditDraft) return;
    const report = window.AsrEditorUtils.buildTimedTextEditReport(
      MaweDom.timedTextEditDraft.sourceSegments,
      MaweDom.timedTextEditDraft.texts,
    );
    MaweDom.timedTextEditDraft.report = report;
    const { stats } = report;
    if (MaweDom.timedTextEditRows.childElementCount !== MaweDom.timedTextEditDraft.texts.length) {
      U.renderTimedTextEditRows();
    }
    MaweDom.timedTextEditReportSummary.replaceChildren();
    U.appendTimedTextEditStat(
      MaweDom.timedTextEditReportSummary,
      '字幕行',
      report.structure?.valid ? `${stats.totalSegments} → ${report.previewSegments.length} 条` : `${stats.totalSegments} 条`,
    );
    U.appendTimedTextEditStat(
      MaweDom.timedTextEditReportSummary,
      '修改内容',
      `${stats.changedSegments} 条（未修改 ${stats.unchangedSegments} 条）`,
    );
    U.appendTimedTextEditStat(
      MaweDom.timedTextEditReportSummary,
      '字符变化',
      `+${stats.addedCharacters} / -${stats.removedCharacters}`,
    );

    MaweDom.timedTextEditReportMapping.replaceChildren();
    U.appendTimedTextEditDivider(MaweDom.timedTextEditReportMapping);
    U.appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '未修改（原样保留）', `${stats.unchangedSegments} 条`, 'unchanged', stats.unchangedSegments);
    U.appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '修改后完整映射', `${stats.fullMappedCues} 条`, 'full', stats.fullMappedCues);
    U.appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '部分保留', `${stats.partialMappedCues} 条`, 'partial', stats.partialMappedCues);
    U.appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '边界移动（转移时间码）', `${stats.boundaryMappedCues} 条`, 'boundary', stats.boundaryMappedCues);
    if (stats.structureMappedCues > 0) {
      U.appendTimedTextEditStat(
        MaweDom.timedTextEditReportMapping,
        '结构调整（重新分配时间码）',
        `${stats.structureMappedCues} 条`,
        'structure',
        stats.structureMappedCues,
      );
    }
    U.appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '时间码丢失', `${stats.lostMappedCues} 条`, 'lost', stats.lostMappedCues);
    U.appendTimedTextEditStat(MaweDom.timedTextEditReportMapping, '原本没有字词码', `${stats.unavailableMappedCues} 条`, 'unavailable', stats.unavailableMappedCues);
    MaweDom.timedTextEditShowAll.hidden = !MaweDom.timedTextEditDraft.filter;
    MaweDom.timedTextEditShowAll.textContent = '显示全部';

    MaweDom.timedTextEditReportHint.classList.remove('warning');
    if (report.structure && !report.structure.valid && report.structure.error) {
      MaweDom.timedTextEditReportHint.classList.add('warning');
      MaweDom.timedTextEditReportHint.textContent = report.structure.error;
    } else if (stats.estimatedTimingCues) {
      MaweDom.timedTextEditReportHint.classList.add('warning');
      MaweDom.timedTextEditReportHint.textContent = `有 ${stats.estimatedTimingCues} 条字幕缺少可复用的字词时间码，应用后将按原字幕范围/文字长度自动估算时间；不会伪造精确字词时间码。`;
    } else if (!stats.changedSegments) {
      MaweDom.timedTextEditReportHint.textContent = '修改后会保持当前字幕段的开始、结束时间不变。';
    } else if (stats.lostMappedCues) {
      MaweDom.timedTextEditReportHint.classList.add('warning');
      MaweDom.timedTextEditReportHint.textContent = '部分字幕无法可靠映射原字词时间码；应用后只保留字幕段整体时间范围。';
    } else if (stats.partialMappedCues) {
      MaweDom.timedTextEditReportHint.classList.add('warning');
      MaweDom.timedTextEditReportHint.textContent = '修改范围内的字词会合并为较粗的时间码，未受影响的字词仍会保留。';
    } else if (stats.boundaryMoves) {
      MaweDom.timedTextEditReportHint.textContent = '检测到相邻字幕之间的开头/结尾移动；对应字词时间码会一起转移，并更新字幕段范围。';
    } else if (stats.structureMappedCues) {
      MaweDom.timedTextEditReportHint.textContent = '检测到字幕行结构变化；应用后会按字词时间码拆分、合并或删除字幕行，并解除受影响的多字幕绑定。';
    } else {
      MaweDom.timedTextEditReportHint.textContent = '当前修改可以完整复用原字词时间码；字幕段整体时间范围不会改变。';
    }

    const draftRowReports = timedTextEditDraftRowReports(report, MaweDom.timedTextEditDraft.texts);
    draftRowReports.forEach((rowReport, index) => {
      const rowElement = MaweDom.timedTextEditRows.querySelector(`.timed-text-edit-row[data-index="${index}"]`);
      if (!rowElement) return;
      rowElement.classList.toggle('changed', Boolean(rowReport?.changed));
      rowElement.classList.toggle('deleted', Boolean(rowReport?.deleted));
      rowElement.hidden = Boolean(MaweDom.timedTextEditDraft.filter)
        && (!rowReport || timedTextEditRowFilterKey(rowReport) !== MaweDom.timedTextEditDraft.filter);
      if (rowReport) U.renderTimedTextEditRowDiff(rowElement, rowReport);
    });
    MaweDom.timedTextEditDraft.texts.forEach((text, index) => {
      const rowElement = MaweDom.timedTextEditRows.querySelector(`.timed-text-edit-row[data-index="${index}"]`);
      const coverage = rowElement?.querySelector('.timed-text-edit-coverage');
      const reuse = rowElement?.querySelector('.timed-text-edit-reuse');
      const rowReport = draftRowReports[index];
      const preview = report.structure?.valid && Number.isInteger(rowReport?.draftIndex)
        ? report.previewSegments[rowReport.index]
        : (!report.structure?.valid ? report.rows[index]?.items : null);
      const items = report.structure?.valid ? preview?.items : preview;
      const coverageData = rowReport?.itemCoverageData
        || window.AsrEditorUtils.timedTextItemCoverage(text, items);
      const reuseData = rowReport?.itemReuseData || {
        percent: 0,
        reusedCharacters: 0,
        totalCharacters: Array.from(String(text == null ? '' : text)).length,
      };
      U.renderTimedTextEditMetric(
        coverage,
        coverageData.percent,
        'coverage',
        `有效字词时间码覆盖率：${coverageData.coveredCharacters}/${coverageData.totalCharacters}`,
      );
      U.renderTimedTextEditMetric(
        reuse,
        reuseData.percent,
        'reuse',
        `原始时间码复用率：${reuseData.reusedCharacters}/${reuseData.totalCharacters}`,
      );
    });
    U.renderTimedTextEditChangeList(report);
    const singleHint = report.structure?.valid ? '' : (report.structure?.error || MaweDom.timedTextEditDraft.singleLineError || '');
    MaweDom.timedTextEditSingleHint.textContent = singleHint;
    MaweDom.timedTextEditSingleHint.hidden = MaweDom.timedTextEditDraft.view !== 'single' || !singleHint;
    if (!MaweDom.timedTextEditDraft.sourceSegments.length && MaweDom.timedTextEditDraft.allSourceSegments.length) {
      MaweDom.timedTextEditReportHint.textContent = '当前没有显示中的字幕；打开“显示已禁用字幕”后才能编辑。';
    }
    MaweDom.timedTextEditApply.disabled = !report.valid;
  }

  Object.assign(U, {
    timedTextEditRowFilterKey,
    timedTextEditDraftRowReports,
    normalizeTimedTextEditDraftLines,
    syncTimedTextEditDraftFromDom,
    scheduleTimedTextEditReport,
    flushTimedTextEditReport,
    cancelTimedTextEditReport,
    updateTimedTextEditReport,
  });
})(typeof window !== 'undefined' ? window : globalThis);
