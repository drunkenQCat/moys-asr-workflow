// 保存工程按钮与各导出下拉入口。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsProjectActions(global) {
  'use strict';

  const U = global.MaweElements;


  const saveProjectButton = document.getElementById('save-project');


  const saveProjectAsButton = document.getElementById('save-project-as');


  const saveProjectDropdown = document.getElementById('save-project-dropdown');


  const gapRemovedExportDropdown = document.getElementById('gap-removed-export-dropdown');


  const downloadMultiSrtButton = document.getElementById('download-multi-srt');


  const subtitleExportDropdown = document.getElementById('subtitle-export-dropdown');


  const downloadColorSrtItem = document.getElementById('download-color-srt');


  const downloadGapRemovedColorSrtItem = document.getElementById('download-gap-removed-color-srt');


  const multiSubtitleControls = document.getElementById('multi-subtitle-controls');

  Object.assign(U, {
    saveProjectButton,
    saveProjectAsButton,
    saveProjectDropdown,
    gapRemovedExportDropdown,
    downloadMultiSrtButton,
    subtitleExportDropdown,
    downloadColorSrtItem,
    downloadGapRemovedColorSrtItem,
    multiSubtitleControls,
  });
})(typeof window !== 'undefined' ? window : globalThis);
