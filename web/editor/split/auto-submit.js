// 自动提交判定、拆点来源提示与元信息渲染。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitAutoSubmit(global) {
  'use strict';

  const U = global.MaweSplit;



  function isSplitAutoSubmitEnabled() {
    return MaweDom.multiSubtitleSplitAutoSubmit
      ? MaweDom.multiSubtitleSplitAutoSubmit.checked
      : MaweSettings.EDITOR_SETTINGS.splitAutoSubmit;
  }



  function splitAutoSubmitReady(state) {
    if (!state?.valid) return false;
    if (state.kind === 'main') return U.splitLaneLocked(state, 'main');
    if (state.kind === 'extension') return U.splitLaneLocked(state, 'extension');
    // 字词时间码已固定主轨切点时，主轨没有可交互的确认步骤。
    const mainReady = !state.mainInteractive || U.splitLaneLocked(state, 'main');
    return mainReady && U.splitLaneLocked(state, 'extension');
  }



  function maybeAutoSubmitLinkedSplit(state) {
    if (state !== U.pendingLinkedSplit || !isSplitAutoSubmitEnabled() || !splitAutoSubmitReady(state)) {
      return false;
    }
    U.confirmLinkedSplit();
    return true;
  }



  function splitCutSourceHint(state) {
    if (state?.cutSource === 'pointer') return '当前切分位置固定为波形指针位置';
    if (state?.cutSource === 'word-timestamps') return '当前切分位置由字词时间码推定';
    if (state?.cutSource === 'word-timestamps-default') return '默认位置参考主字幕字词时间码，可继续调整';
    return '';
  }



  function renderSplitMeta(text, state) {
    if (!MaweDom.multiSubtitleSplitMeta) return;
    MaweDom.multiSubtitleSplitMeta.replaceChildren();
    MaweDom.multiSubtitleSplitMeta.appendChild(document.createTextNode(text));
    const hint = splitCutSourceHint(state);
    if (!hint) return;
    const hintEl = document.createElement('span');
    hintEl.className = 'multi-subtitle-split-cut-hint';
    const translatedHint = window.MAWE_I18N?.translateText?.(hint) || hint;
    hintEl.textContent = `（${translatedHint}）`;
    MaweDom.multiSubtitleSplitMeta.appendChild(hintEl);
  }

  Object.assign(U, {
    isSplitAutoSubmitEnabled,
    splitAutoSubmitReady,
    maybeAutoSubmitLinkedSplit,
    splitCutSourceHint,
    renderSplitMeta,
  });
})(typeof window !== 'undefined' ? window : globalThis);
