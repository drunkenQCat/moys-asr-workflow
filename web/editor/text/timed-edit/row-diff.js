// 逐行差异的构造与渲染：统计行、分隔线、映射标签与覆盖率样式。
// 自 web/editor/text/timed-edit.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweText；
// 兼容出口 window.MaweTimedTextEdit 仍由 editor/text/timed-edit/compat-surface.js 统一组装。
(function initMaweTimedEditRowDiff(global) {
  'use strict';

  const U = global.MaweText;



  function appendTimedTextEditStat(container, label, value, filterKey = null, count = 0) {
    const row = document.createElement('div');
    row.className = 'timed-text-edit-stat-row';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = filterKey && count > 0 ? document.createElement('button') : document.createElement('strong');
    if (filterKey && count > 0) {
      valueEl.type = 'button';
      valueEl.className = 'timed-text-edit-stat-filter';
      valueEl.classList.toggle('active', MaweDom.timedTextEditDraft?.filter === filterKey);
      valueEl.addEventListener('click', () => {
        if (!MaweDom.timedTextEditDraft) return;
        MaweDom.timedTextEditDraft.filter = filterKey;
        MaweDom.timedTextEditChangeDetails.open = true;
        U.flushTimedTextEditReport();
      });
    }
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    container.appendChild(row);
  }



  function appendTimedTextEditDivider(container) {
    const divider = document.createElement('div');
    divider.className = 'timed-text-edit-report-divider';
    container.appendChild(divider);
  }



  function appendTimedTextEditDiffLine(container, label, parts, className) {
    const line = document.createElement('div');
    line.className = `timed-text-edit-diff-line ${className}`;
    const labelEl = document.createElement('span');
    labelEl.className = 'timed-text-edit-diff-label';
    labelEl.textContent = label;
    line.appendChild(labelEl);
    (parts || []).forEach((part) => {
      if (!part?.text) return;
      const text = document.createElement('span');
      text.className = `timed-text-edit-diff-part ${part.kind || 'equal'}`;
      text.textContent = part.text;
      line.appendChild(text);
    });
    container.appendChild(line);
  }



  function renderTimedTextEditRowDiff(rowElement, reportRow) {
    const diffElement = rowElement.querySelector('.timed-text-edit-row-diff');
    if (!diffElement) return;
    diffElement.replaceChildren();
    diffElement.hidden = !reportRow.changed && !reportRow.timingChanged && !reportRow.timingEstimated;
    if (reportRow.changed) {
      appendTimedTextEditDiffLine(diffElement, '修改前：', reportRow.diff.before, 'before');
      appendTimedTextEditDiffLine(diffElement, '修改后：', reportRow.diff.after, 'after');
    }
    if (reportRow.timingChanged) {
      const timing = document.createElement('div');
      timing.className = 'timed-text-edit-timing-change';
      timing.textContent = `时间范围：${MaweCueElements.fmtSrtTime(reportRow.beforeStart)} – ${MaweCueElements.fmtSrtTime(reportRow.beforeEnd)} → ${MaweCueElements.fmtSrtTime(reportRow.afterStart)} – ${MaweCueElements.fmtSrtTime(reportRow.afterEnd)}`;
      diffElement.appendChild(timing);
    }
    if (reportRow.timingEstimated) {
      const estimated = document.createElement('div');
      estimated.className = 'timed-text-edit-estimated-timing';
      estimated.textContent = '时间范围为自动估算（按原字幕范围/文字长度分配）';
      diffElement.appendChild(estimated);
    }
    if (reportRow.deleted) {
      const deleted = document.createElement('div');
      deleted.className = 'timed-text-edit-deleted-label';
      deleted.textContent = '整句删除（时间码已转移到其他字幕）';
      diffElement.appendChild(deleted);
    }
  }



  function timedTextEditMappingLabel(status) {
    return {
      full: '完整映射',
      partial: '部分映射',
      lost: '时间码丢失',
      unavailable: '原本没有字词时间码',
      boundary: '边界移动（时间码已转移）',
      structure: '结构调整（时间码已重新分配）',
      deleted: '整句删除（时间码已转移）',
    }[status] || '未分析';
  }



  function timedTextEditCoverageClass(percent) {
    if (percent <= 0) return 'none';
    return percent > 90 ? 'good' : 'partial';
  }



  function renderTimedTextEditMetric(element, percent, kind, title = '') {
    if (!element) return;
    const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const isReuse = kind === 'reuse';
    element.textContent = `${isReuse ? '♻️' : '⌚️'}${safePercent}%`;
    element.className = `timed-text-edit-${isReuse ? 'reuse' : 'coverage'} ${timedTextEditCoverageClass(safePercent)}`;
    element.title = title || `${isReuse ? '原始时间码复用率' : '有效字词时间码覆盖率'}：${safePercent}%`;
  }



  function renderTimedTextEditChangeList(report) {
    const wasOpen = MaweDom.timedTextEditChangeDetails.open;
    MaweDom.timedTextEditChangeList.replaceChildren();
    const filter = MaweDom.timedTextEditDraft?.filter || null;
    const deletedRows = report.structure?.valid
      ? (report.rows || [])
        .filter((row) => row.deleted)
        .map((row) => ({ ...row, mappingStatus: 'deleted' }))
      : [];
    const displayRows = report.structure?.valid && report.outputRows?.length
      ? [...report.outputRows, ...deletedRows]
      : report.changedRows;
    const rows = filter === 'unchanged'
      ? []
      : displayRows.filter((row) => row.changed && (!filter || row.mappingStatus === filter));
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'modal-hint';
      empty.textContent = filter ? '当前筛选没有修改内容。' : '还没有修改内容。';
      MaweDom.timedTextEditChangeList.appendChild(empty);
      MaweDom.timedTextEditChangeDetails.open = Boolean(filter && filter !== 'unchanged');
      return;
    }
    rows.forEach((row) => {
      const item = document.createElement('div');
      item.className = `timed-text-edit-change-item${row.deleted ? ' deleted' : ''}`;
      const title = document.createElement('div');
      title.className = 'timed-text-edit-change-item-title';
      title.textContent = `第 ${row.index + 1} 条 · ${timedTextEditMappingLabel(row.mappingStatus)}`;
      item.appendChild(title);
      appendTimedTextEditDiffLine(item, '前：', row.diff.before, 'before');
      appendTimedTextEditDiffLine(item, '后：', row.diff.after, 'after');
      if (row.timingChanged) {
        const timing = document.createElement('div');
        timing.className = 'timed-text-edit-timing-change';
        timing.textContent = `时间范围：${MaweCueElements.fmtSrtTime(row.beforeStart)} – ${MaweCueElements.fmtSrtTime(row.beforeEnd)} → ${MaweCueElements.fmtSrtTime(row.afterStart)} – ${MaweCueElements.fmtSrtTime(row.afterEnd)}`;
        item.appendChild(timing);
      }
      if (row.timingEstimated) {
        const estimated = document.createElement('div');
        estimated.className = 'timed-text-edit-estimated-timing';
        estimated.textContent = '时间范围为自动估算（按原字幕范围/文字长度分配）';
        item.appendChild(estimated);
      }
      if (row.deleted) {
        const deleted = document.createElement('div');
        deleted.className = 'timed-text-edit-deleted-label';
        deleted.textContent = '整句删除（时间码已转移到其他字幕）';
        item.appendChild(deleted);
      }
      MaweDom.timedTextEditChangeList.appendChild(item);
    });
    MaweDom.timedTextEditChangeDetails.open = wasOpen;
  }

  Object.assign(U, {
    appendTimedTextEditStat,
    appendTimedTextEditDivider,
    appendTimedTextEditDiffLine,
    renderTimedTextEditRowDiff,
    timedTextEditMappingLabel,
    timedTextEditCoverageClass,
    renderTimedTextEditMetric,
    renderTimedTextEditChangeList,
  });
})(typeof window !== 'undefined' ? window : globalThis);
