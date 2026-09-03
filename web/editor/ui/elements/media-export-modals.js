// 贴纸、工程媒体与 FCP7/Lottie/Ograf 导出弹窗。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsMediaExportModals(global) {
  'use strict';

  const U = global.MaweElements;


  const stickerModal = document.getElementById('sticker-modal');


  const stickerPreviewModal = document.getElementById('sticker-preview-modal');


  const projectMediaModal = document.getElementById('project-media-modal');


  const projectMediaSelectButton = document.getElementById('project-media-select');


  const projectMediaLaterButton = document.getElementById('project-media-later');


  const fcp7ExportModal = document.getElementById('fcp7-export-modal');


  const fcp7ExportTimelineMode = document.getElementById('fcp7-export-timeline-mode');


  const fcp7ExportFps = document.getElementById('fcp7-export-fps');


  const fcp7ExportSubtitleTracks = document.getElementById('fcp7-export-subtitle-tracks');


  const fcp7ExportNativeText = document.getElementById('fcp7-export-native-text');


  const fcp7ExportCancel = document.getElementById('fcp7-export-cancel');


  const fcp7ExportConfirm = document.getElementById('fcp7-export-confirm');


  const lottieExportModal = document.getElementById('lottie-export-modal');


  const lottieExportTrack = document.getElementById('lottie-export-track');


  const lottieExportGapRemoved = document.getElementById('lottie-export-gap-removed');


  const lottieExportResolution = document.getElementById('lottie-export-resolution');


  const lottieExportFps = document.getElementById('lottie-export-fps');


  const lottieExportRenderMode = document.getElementById('lottie-export-render-mode');


  const lottieExportCancel = document.getElementById('lottie-export-cancel');


  const lottieExportConfirm = document.getElementById('lottie-export-confirm');


  const ografExportModal = document.getElementById('ograf-export-modal');


  const ografExportTrack = document.getElementById('ograf-export-track');


  const ografExportGapRemoved = document.getElementById('ograf-export-gap-removed');


  const ografExportResolution = document.getElementById('ograf-export-resolution');


  const ografExportFps = document.getElementById('ograf-export-fps');


  const ografExportCancel = document.getElementById('ograf-export-cancel');


  const ografExportConfirm = document.getElementById('ograf-export-confirm');

  Object.assign(U, {
    stickerModal,
    stickerPreviewModal,
    projectMediaModal,
    projectMediaSelectButton,
    projectMediaLaterButton,
    fcp7ExportModal,
    fcp7ExportTimelineMode,
    fcp7ExportFps,
    fcp7ExportSubtitleTracks,
    fcp7ExportNativeText,
    fcp7ExportCancel,
    fcp7ExportConfirm,
    lottieExportModal,
    lottieExportTrack,
    lottieExportGapRemoved,
    lottieExportResolution,
    lottieExportFps,
    lottieExportRenderMode,
    lottieExportCancel,
    lottieExportConfirm,
    ografExportModal,
    ografExportTrack,
    ografExportGapRemoved,
    ografExportResolution,
    ografExportFps,
    ografExportCancel,
    ografExportConfirm,
  });
})(typeof window !== 'undefined' ? window : globalThis);
