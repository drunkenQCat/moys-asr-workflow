// 忍者模式、剃刀工具与斜杠特效控件。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsNinja(global) {
  'use strict';

  const U = global.MaweElements;


  const ninjaModeToggle = document.getElementById('ninja-mode');


  const ninjaSoundToggle = document.getElementById('ninja-sound');


  const ninjaSoundField = document.getElementById('ninja-sound-field');


  const ninjaSlashEffectToggle = document.getElementById('ninja-slash-effect');


  const ninjaSlashEffectField = document.getElementById('ninja-slash-effect-field');


  const ninjaSlashParamsField = document.getElementById('ninja-slash-params-field');


  const ninjaSlashLengthInput = document.getElementById('ninja-slash-length');


  const ninjaSlashRotateInput = document.getElementById('ninja-slash-rotate');


  const razorToolButton = document.querySelector('[data-waveform-tool="razor"]');


  const razorToolSvg = razorToolButton?.querySelector('svg');


  const ninjaRazorIcon = razorToolButton?.querySelector('.ninja-razor-icon');


  const ninjaSlashFlash = document.getElementById('ninja-slash-flash');


  const exportColorUnifiedToggle = document.getElementById('export-color-unified');

  Object.assign(U, {
    ninjaModeToggle,
    ninjaSoundToggle,
    ninjaSoundField,
    ninjaSlashEffectToggle,
    ninjaSlashEffectField,
    ninjaSlashParamsField,
    ninjaSlashLengthInput,
    ninjaSlashRotateInput,
    razorToolButton,
    razorToolSvg,
    ninjaRazorIcon,
    ninjaSlashFlash,
    exportColorUnifiedToggle,
  });
})(typeof window !== 'undefined' ? window : globalThis);
