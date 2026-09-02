// 媒体跳转步进输入的提交/滚轮调整。
// 由 split-cluster codemod 自 editor.js 拆出：状态为本模块私有，外部仅经
// window.MaweMediaStep 冻结门面访问（可变状态为访问器属性，赋值语义不变）。
// 清单位置在 editor.js 之前；editor.js 全局仅在延迟执行的回调中访问。
(function initMaweMediaStep(global) {
  'use strict';


  function refreshMediaSeekInputStep(value = MaweSettings.EDITOR_SETTINGS.mediaSeekStepMs) {
    if (MaweDom.mediaSeekStepInput) MaweDom.mediaSeekStepInput.step = String(MaweSettings.mediaSeekStepForValue(value));
  }



  function commitMediaSeekStepInput(value, { rewriteInput = true } = {}) {
    const normalized = MaweSettings.clampMediaSeekStepMs(value);
    if (rewriteInput && MaweDom.mediaSeekStepInput) MaweDom.mediaSeekStepInput.value = String(normalized);
    MaweDom.mediaSeekInputLastValue = normalized;
    MaweSettings.updateEditorSettings({ mediaSeekStepMs: normalized });
    refreshMediaSeekInputStep(normalized);
    MaweMediaPlayback.refreshMediaSeekStepHelp();
    MaweMediaPlayback.refreshMediaSeekControlLabels();
  }



  function adjustMediaSeekStepInput(direction) {
    if (!MaweDom.mediaSeekStepInput) return;
    const current = MaweSettings.clampMediaSeekStepMs(MaweDom.mediaSeekStepInput.value);
    commitMediaSeekStepInput(MaweSettings.nextMediaSeekStepValue(current, direction));
  }

  global.MaweMediaStep = Object.freeze({
    refreshMediaSeekInputStep,
    commitMediaSeekStepInput,
    adjustMediaSeekStepInput
  });
})(typeof window !== 'undefined' ? window : globalThis);
