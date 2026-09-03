// 历史记录的纯数据构造与撤销/重做栈容器。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibHistoryRecord(global) {
  'use strict';

  const U = global.MaweLib;

  const HISTORY_RECORD_DEFAULT_LABELS = Object.freeze({
    segments: '编辑', layout: '调整工作区', gap_remove: '空隙移除', preview: '预览',
  });
  function buildSegmentsHistorySnapshot(segments, multiSubtitle) {
    return { segments: U.cloneJsonValue(segments), multi_subtitle: U.cloneJsonValue(multiSubtitle) };
  }
  function buildHistoryRecord(kind, label, payload, view = null) {
    const recordKind = Object.prototype.hasOwnProperty.call(HISTORY_RECORD_DEFAULT_LABELS, kind)
      ? kind : 'segments';
    const record = { kind: recordKind, label: label || HISTORY_RECORD_DEFAULT_LABELS[recordKind] };
    if (recordKind === 'segments') {
      record.segs = U.cloneJsonValue(payload);
      if (view) record.view = U.cloneJsonValue(view);
    } else if (recordKind === 'layout') record.layout = payload || null;
    else if (recordKind === 'gap_remove') {
      record.gapRemove = U.cloneJsonValue(payload?.gapRemove ?? null);
      record.gapRemoveDirty = payload?.gapRemoveDirty === true;
    } else record.preview = U.cloneJsonValue(payload);
    return record;
  }

  // 统一撤销/重做栈：管理两个不透明记录数组。
  // - push(record)：压入 undo 栈，清空 redo 栈，按 limit 裁剪。
  // - popUndo(currentSnapshot)：从 undo 弹出一条记录，把当前快照压入 redo，
  //   返回被弹出的记录供调用方应用。空栈返回 null。
  // - popRedo(currentSnapshot)：对称地从 redo 弹出，把当前快照压入 undo。
  // 调用方负责按记录的 kind 生成 currentSnapshot 与应用记录。
  function createHistoryStack(limit = 100) {
    const max = Math.max(1, Math.round(Number(limit) || 100));
    const undo = [];
    const redo = [];
    const trim = () => { while (undo.length > max) undo.shift(); };
    return {
      undoLength: () => undo.length,
      redoLength: () => redo.length,
      canUndo: () => undo.length > 0,
      canRedo: () => redo.length > 0,
      peekUndo: () => undo[undo.length - 1] || null,
      peekRedo: () => redo[redo.length - 1] || null,
      push: (record) => {
        undo.push(record);
        trim();
        redo.length = 0;
      },
      popUndo: (currentSnapshot) => {
        if (!undo.length) return null;
        const record = undo.pop();
        redo.push(currentSnapshot);
        return record;
      },
      popRedo: (currentSnapshot) => {
        if (!redo.length) return null;
        const record = redo.pop();
        undo.push(currentSnapshot);
        trim();
        return record;
      },
      clear: () => { undo.length = 0; redo.length = 0; },
      clearRedo: () => { redo.length = 0; },
    };
  }

  Object.assign(U, {
    HISTORY_RECORD_DEFAULT_LABELS,
    buildSegmentsHistorySnapshot,
    buildHistoryRecord,
    createHistoryStack,
  });
})(typeof window !== 'undefined' ? window : globalThis);
