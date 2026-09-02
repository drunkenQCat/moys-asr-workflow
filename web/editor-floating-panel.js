// 可拖动浮动面板通用工厂（各设置/工具面板共用）。
// 由 split-cluster codemod 自 editor.js 拆出：状态为本模块私有，外部仅经
// window.MaweFloatingPanel 冻结门面访问（可变状态为访问器属性，赋值语义不变）。
// 清单位置在 editor.js 之前；editor.js 全局仅在延迟执行的回调中访问。
(function initMaweFloatingPanel(global) {
  'use strict';



  // 可拖动非模态工具窗（移除静音空隙 / 拼合字幕共用模式）：
  // 负责显示/隐藏、工具栏按钮 active 态、标题栏拖动与位置持久化、窗口缩放回钳、Esc 关闭。
  function createFloatingPanel({ panel, dragHandle, manageButton, anchorButton, positionKey, onOpen }) {
    if (!panel) return { open() {}, close() {}, toggle() {}, isOpen: () => false };
    let drag = null;

    function isOpen() { return panel.classList.contains('show'); }

    function setPosition(left, top, { persist = false } = {}) {
      const rect = panel.getBoundingClientRect();
      const margin = 6;
      const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
      const nextLeft = Math.min(maxLeft, Math.max(margin, Math.round(left)));
      const nextTop = Math.min(maxTop, Math.max(margin, Math.round(top)));
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
      panel.style.right = 'auto';
      if (persist) {
        try {
          localStorage.setItem(positionKey, JSON.stringify({ left: nextLeft, top: nextTop }));
        } catch (_) {
          // file:// 隐私模式可能拒绝 localStorage；拖动本身仍保持可用。
        }
      }
    }

    function restorePosition() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
      } catch (_) {
        saved = null;
      }
      if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
        setPosition(saved.left, saved.top);
        return true;
      }
      return false;
    }

    function positionNearAnchor() {
      if (!anchorButton) return false;
      const anchorRect = anchorButton.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const margin = 6;
      const gap = 6;
      let left = anchorRect.left;
      if (left + panelRect.width > window.innerWidth - margin) {
        left = anchorRect.right - panelRect.width;
      }
      let top = anchorRect.bottom + gap;
      if (top + panelRect.height > window.innerHeight - margin) {
        top = anchorRect.top - panelRect.height - gap;
      }
      setPosition(left, top);
      return true;
    }

    function open() {
      if (typeof onOpen === 'function') onOpen();
      panel.classList.add('show');
      panel.setAttribute('aria-hidden', 'false');
      manageButton?.classList.add('active');
      manageButton?.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => {
        if (!restorePosition()) positionNearAnchor();
      });
    }

    function close() {
      panel.classList.remove('show', 'dragging');
      panel.setAttribute('aria-hidden', 'true');
      drag = null;
      manageButton?.classList.remove('active');
      manageButton?.setAttribute('aria-expanded', 'false');
    }

    function toggle() { if (isOpen()) close(); else open(); }

    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try {
        dragHandle?.releasePointerCapture?.(event.pointerId);
      } catch (_) {
        // 指针在浏览器窗口外释放时，capture 可能已由浏览器自动清理。
      }
      drag = null;
      panel.classList.remove('dragging');
      const rect = panel.getBoundingClientRect();
      setPosition(rect.left, rect.top, { persist: true });
    }

    dragHandle?.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const rect = panel.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      panel.classList.add('dragging');
      dragHandle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    dragHandle?.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      setPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
    });
    dragHandle?.addEventListener('pointerup', finishDrag);
    dragHandle?.addEventListener('pointercancel', finishDrag);
    manageButton?.addEventListener('click', toggle);
    window.addEventListener('resize', () => {
      if (!isOpen()) return;
      const rect = panel.getBoundingClientRect();
      setPosition(rect.left, rect.top, { persist: true });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !isOpen() || MaweInlineEdit.editingState) return;
      event.preventDefault();
      close();
    });
    return { open, close, toggle, isOpen };
  }


  // 拼合字幕工具窗：参数即时持久化；number 输入 change 时把显示值回钳到合法区间。
  const autoMergeFloatingPanel = createFloatingPanel({
    panel: MaweDom.autoMergePanel,
    dragHandle: MaweDom.autoMergeDragHandle,
    manageButton: MaweDom.autoMergeManageButton,
    anchorButton: MaweDom.autoMergeManageButton,
    positionKey: MaweDom.AUTO_MERGE_PANEL_POSITION_KEY,
    onOpen: MaweSegmentOps.syncAutoMergePanelInputs,
  });


  const subtitleExtendFloatingPanel = createFloatingPanel({
    panel: MaweDom.subtitleExtendPanel,
    dragHandle: MaweDom.subtitleExtendDragHandle,
    manageButton: MaweDom.subtitleExtendManageButton,
    anchorButton: MaweDom.subtitleExtendManageButton,
    positionKey: MaweDom.SUBTITLE_EXTEND_PANEL_POSITION_KEY,
  });

  global.MaweFloatingPanel = Object.freeze({
    autoMergeFloatingPanel,
    subtitleExtendFloatingPanel,
    createFloatingPanel
  });
})(typeof window !== 'undefined' ? window : globalThis);
