// 明暗主题切换与应用。
// 由 split-cluster codemod 自 editor.js 拆出：状态为本模块私有，外部仅经
// window.MaweTheme 冻结门面访问（可变状态为访问器属性，赋值语义不变）。
// 清单位置在 editor.js 之前；editor.js 全局仅在延迟执行的回调中访问。
(function initMaweTheme(global) {
  'use strict';



  // 明暗主题：令牌全部定义在 CSS（:root 暗色 / [data-theme="light"] 亮色），
  // 这里只负责写 <html data-theme>、持久化、同步按钮，以及通知波形重绘画布。
  // 按钮显示的是「目标主题」（与相邻 🌐 语言按钮同一约定）：暗色时显示 🌖（点击转亮）。
  // title 用中文源串，英文界面由 i18n 的属性 MutationObserver 自动翻译。
  function refreshThemeToggle(theme) {
    if (!MaweDom.themeToggle) return;
    const toLight = theme !== 'light';
    MaweDom.themeToggle.textContent = toLight ? '🌖' : '🌘';
    const title = toLight ? '切换到亮色主题' : '切换到暗色主题';
    MaweDom.themeToggle.title = title;
    MaweDom.themeToggle.setAttribute('aria-label', title);
  }


  function applyTheme(theme, { rerenderWaveform = true } = {}) {
    const next = theme === 'light' ? 'light' : 'dark';
    if (next === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    refreshThemeToggle(next);
    // 画布颜色是 JS 读取的令牌快照，必须全量重绘才能跟随主题
    if (rerenderWaveform && MaweCoreState.waveformEditor) MaweCoreState.waveformEditor.render();
  }

  global.MaweTheme = Object.freeze({
    refreshThemeToggle,
    applyTheme
  });
})(typeof window !== 'undefined' ? window : globalThis);
