// 整轨文本编辑面板的 DOM 引用与草稿/报告状态。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsTimedEditRefs(global) {
  'use strict';

  const U = global.MaweElements;


  const timedTextEditButton = document.getElementById('timed-text-edit-btn');


  const timedTextEditModal = document.getElementById('timed-text-edit-modal');


  const timedTextEditClose = document.getElementById('timed-text-edit-close');


  const timedTextEditCancel = document.getElementById('timed-text-edit-cancel');


  const timedTextEditApply = document.getElementById('timed-text-edit-apply');


  const timedTextEditTrackControl = document.getElementById('timed-text-edit-track-control');


  const timedTextEditTrack = document.getElementById('timed-text-edit-track');


  const timedTextEditView = document.getElementById('timed-text-edit-view');


  const timedTextEditSourceInfo = document.getElementById('timed-text-edit-source-info');


  const timedTextEditCharcountThresholdControl = document.getElementById('timed-text-edit-charcount-control');


  const timedTextEditCharcountThresholdInput = document.getElementById('timed-text-edit-charcount-threshold');


  const timedTextEditShowDisabledToggle = document.getElementById('timed-text-edit-show-disabled');


  const timedTextEditRows = document.getElementById('timed-text-edit-rows');


  const timedTextEditSingleEditor = document.getElementById('timed-text-edit-single-editor');


  const timedTextEditSingleTextarea = document.getElementById('timed-text-edit-single-textarea');


  const timedTextEditSingleHint = document.getElementById('timed-text-edit-single-hint');


  const timedTextEditReportSummary = document.getElementById('timed-text-edit-report-summary');


  const timedTextEditReportMapping = document.getElementById('timed-text-edit-report-mapping');


  const timedTextEditShowAll = document.getElementById('timed-text-edit-show-all');


  const timedTextEditReportHint = document.getElementById('timed-text-edit-report-hint');


  const timedTextEditChangeDetails = document.getElementById('timed-text-edit-change-details');


  const timedTextEditChangeList = document.getElementById('timed-text-edit-change-list');


  const TIMED_TEXT_EDIT_REPORT_DEBOUNCE_MS = 160;


  let timedTextEditDraft = null;


  let timedTextEditReturnFocus = null;


  let timedTextEditReportTimer = null;

  Object.assign(U, {
    timedTextEditButton,
    timedTextEditModal,
    timedTextEditClose,
    timedTextEditCancel,
    timedTextEditApply,
    timedTextEditTrackControl,
    timedTextEditTrack,
    timedTextEditView,
    timedTextEditSourceInfo,
    timedTextEditCharcountThresholdControl,
    timedTextEditCharcountThresholdInput,
    timedTextEditShowDisabledToggle,
    timedTextEditRows,
    timedTextEditSingleEditor,
    timedTextEditSingleTextarea,
    timedTextEditSingleHint,
    timedTextEditReportSummary,
    timedTextEditReportMapping,
    timedTextEditShowAll,
    timedTextEditReportHint,
    timedTextEditChangeDetails,
    timedTextEditChangeList,
    TIMED_TEXT_EDIT_REPORT_DEBOUNCE_MS,
  });
  // timedTextEditDraft 是本模块可变状态且兼容出口为它提供 setter（外部经出口赋值）：以 get/set 访问器发布，
  // 语义与拆分前整个闭包共享同一个 let 完全一致。
  Object.defineProperty(U, 'timedTextEditDraft', { enumerable: true, configurable: true,
    get: () => timedTextEditDraft, set: (value) => { timedTextEditDraft = value; } });
  // timedTextEditReturnFocus 是本模块可变状态且兼容出口为它提供 setter（外部经出口赋值）：以 get/set 访问器发布，
  // 语义与拆分前整个闭包共享同一个 let 完全一致。
  Object.defineProperty(U, 'timedTextEditReturnFocus', { enumerable: true, configurable: true,
    get: () => timedTextEditReturnFocus, set: (value) => { timedTextEditReturnFocus = value; } });
  // timedTextEditReportTimer 是本模块可变状态且兼容出口为它提供 setter（外部经出口赋值）：以 get/set 访问器发布，
  // 语义与拆分前整个闭包共享同一个 let 完全一致。
  Object.defineProperty(U, 'timedTextEditReportTimer', { enumerable: true, configurable: true,
    get: () => timedTextEditReportTimer, set: (value) => { timedTextEditReportTimer = value; } });
})(typeof window !== 'undefined' ? window : globalThis);
