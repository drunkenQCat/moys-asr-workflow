// 联动拆分弹窗的当前状态槽：整个拆分块共享的那一份可变状态。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitPendingState(global) {
  'use strict';

  const U = global.MaweSplit;



  // === 拆分 ===
  let pendingLinkedSplit = null;

  // pendingLinkedSplit 是本模块可变状态且会被其他模块写入：以 get/set 访问器发布，
  // 语义与拆分前整个闭包共享同一个 let 完全一致。
  Object.defineProperty(U, 'pendingLinkedSplit', { enumerable: true, configurable: true,
    get: () => pendingLinkedSplit, set: (value) => { pendingLinkedSplit = value; } });
})(typeof window !== 'undefined' ? window : globalThis);
