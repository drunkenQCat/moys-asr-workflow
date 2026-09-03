// 点击行为、键盘参照、悬停预览、吸附，以及查找替换与文本处理弹窗。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsInteractionSettings(global) {
  'use strict';

  const U = global.MaweElements;



  const clickBehaviorSelect = document.getElementById('click-behavior');


  const clickTargetField = document.getElementById('click-target-field');


  const clickTargetSelect = document.getElementById('click-target');


  const keyboardOperationReferenceSelect = document.getElementById('keyboard-operation-reference');


  const keyboardOperationReferenceHint = document.getElementById('keyboard-operation-reference-hint');


  const hoverSeekPreviewToggle = document.getElementById('hover-seek-preview');


  const cueMoveStepInput = document.getElementById('cue-move-step');


  const autoSnapAdjacentCuesToggle = document.getElementById('auto-snap-adjacent-cues');


  const replaceModal = document.getElementById('replace-modal');


  const textProcessModal = document.getElementById('text-process-modal');

  Object.assign(U, {
    clickBehaviorSelect,
    clickTargetField,
    clickTargetSelect,
    keyboardOperationReferenceSelect,
    keyboardOperationReferenceHint,
    hoverSeekPreviewToggle,
    cueMoveStepInput,
    autoSnapAdjacentCuesToggle,
    replaceModal,
    textProcessModal,
  });
})(typeof window !== 'undefined' ? window : globalThis);
