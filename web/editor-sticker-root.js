// 表情包根目录设置弹窗（服务器校验，不用浏览器目录选择）。
// 由 split-cluster codemod 自 editor.js 拆出：状态为本模块私有，外部仅经
// window.MaweStickerRoot 冻结门面访问（可变状态为访问器属性，赋值语义不变）。
// 清单位置在 editor.js 之前；editor.js 全局仅在延迟执行的回调中访问。
(function initMaweStickerRoot(global) {
  'use strict';



  // === 表情包根目录配置 ===
  const stickerRootModal = document.getElementById('sticker-root-modal');


  const stickerRootInput = document.getElementById('sticker-root-input');


  const stickerRootRead = document.getElementById('sticker-root-read');


  const stickerRootStatus = document.getElementById('sticker-root-status');


  const stickerRootServerEnabled = Boolean(MaweBoot.SERVER_CONFIG?.stickerRootUrl);


  let stickerRootReturnFocus = null;


  let stickerRootHintCard = null;



  function setStickerRootStatus(message) {
    stickerRootStatus.textContent = message;
  }



  function setStickerRootModalOpen(open) {
    if (open) {
      stickerRootReturnFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement : null;
      stickerRootModal.classList.add('show');
      const initialFocus = stickerRootServerEnabled
        ? stickerRootInput : document.getElementById('sticker-root-cancel');
      setTimeout(() => initialFocus.focus(), 50);
      return;
    }
    stickerRootModal.classList.remove('show');
    stickerRootReturnFocus?.focus();
    stickerRootReturnFocus = null;
  }



  function flashStickerRootHint(message, type) {
    stickerRootHintCard?.remove();
    stickerRootHintCard = MaweHint.flashHint(message, type);
  }

  global.MaweStickerRoot = Object.freeze({
    stickerRootModal,
    stickerRootInput,
    stickerRootRead,
    stickerRootStatus,
    stickerRootServerEnabled,
    get stickerRootReturnFocus() { return stickerRootReturnFocus; },
    set stickerRootReturnFocus(v) { stickerRootReturnFocus = v; },
    get stickerRootHintCard() { return stickerRootHintCard; },
    set stickerRootHintCard(v) { stickerRootHintCard = v; },
    setStickerRootStatus,
    setStickerRootModalOpen,
    flashStickerRootHint
  });
})(typeof window !== 'undefined' ? window : globalThis);
