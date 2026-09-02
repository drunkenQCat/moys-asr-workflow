// 字幕列表滚动视觉锚定与滚动定位。
// 由 split-cluster codemod 自 editor.js 拆出：状态为本模块私有，外部仅经
// window.MaweCueListAnchor 冻结门面访问（可变状态为访问器属性，赋值语义不变）。
// 清单位置在 editor.js 之前；editor.js 全局仅在延迟执行的回调中访问。
(function initMaweCueListAnchor(global) {
  'use strict';



  // === 滚动 ===
  function cueListVisibleBounds() {
    const containerRect = MaweCoreState.container.getBoundingClientRect();
    const toolbar = MaweCoreState.container.querySelector(':scope > .cue-list-toolbar');
    const toolbarRect = toolbar?.getBoundingClientRect();
    const top = toolbarRect
      ? Math.min(containerRect.bottom, Math.max(containerRect.top, toolbarRect.bottom))
      : containerRect.top;
    return { containerRect, top, bottom: containerRect.bottom };
  }



  let cueListVisualAnchorGeneration = 0;



  // 重绘后的补偿只服务于这一轮布局稳定；用户一旦开始新的指针、滚轮或
  // 键盘操作，就让出滚动控制权，避免延迟的 content-visibility 补偿把用户
  // 刚滚到的目标行又拉回旧位置。
  function invalidateCueListVisualAnchorRestore() {
    cueListVisualAnchorGeneration += 1;
  }



  function captureCueListVisualAnchor(cueEl) {
    if (!cueEl?.isConnected || cueEl.classList.contains('hidden')) return null;
    const top = cueEl.getBoundingClientRect().top;
    return Number.isFinite(top) ? { top } : null;
  }



  function captureVisibleCueListVisualAnchor(cueEl) {
    if (!cueEl?.isConnected || cueEl.classList.contains('hidden')) return null;
    const rect = cueEl.getBoundingClientRect();
    const { top, bottom } = cueListVisibleBounds();
    if (rect.bottom <= top || rect.top >= bottom) return null;
    return captureCueListVisualAnchor(cueEl);
  }



  function captureCueListRenderAnchor() {
    if (!MaweCoreState.container?.isConnected) return null;
    const { top, bottom } = cueListVisibleBounds();
    const candidates = [...MaweCoreState.container.querySelectorAll(':scope > .cue:not(.hidden)')];
    const visibleCandidates = candidates.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.height > 0 && rect.bottom > top && rect.top < bottom;
    });
    const panelIndex = Number(MaweCuePanelState.currentCuePanelIdx);
    const panelSelector = MaweCuePanelState.currentCuePanelKind === 'extension'
      ? `.cue[data-ext-idx="${panelIndex}"]`
      : `.cue[data-idx="${panelIndex}"]`;
    const panelCue = Number.isInteger(panelIndex) && panelIndex >= 0
      ? MaweCoreState.container.querySelector(panelSelector) : null;
    const cueEl = visibleCandidates.includes(panelCue) ? panelCue : visibleCandidates[0];
    const visual = captureCueListVisualAnchor(cueEl);
    if (!visual) return { scrollTop: MaweCoreState.container.scrollTop };

    const mainIndex = cueEl.dataset.mainIdx ?? cueEl.dataset.idx;
    if (mainIndex !== undefined) {
      const index = Number(mainIndex);
      const segment = Number.isInteger(index) ? MaweBoot.DATA.segments[index] : null;
      return {
        ...visual,
        scrollTop: MaweCoreState.container.scrollTop,
        kind: 'main',
        index,
        segmentId: segment?.id || null,
      };
    }

    const index = Number(cueEl.dataset.extIdx);
    const track = MaweMultiSubtitleCore.getActiveExtensionTrack();
    const segment = Number.isInteger(index) ? track?.segments?.[index] : null;
    return {
      ...visual,
      scrollTop: MaweCoreState.container.scrollTop,
      kind: 'extension',
      index,
      segmentId: segment?.id || null,
      trackId: track?.id || null,
    };
  }



  function findCueListRenderAnchor(anchor) {
    if (!anchor || !MaweCoreState.container?.isConnected) return null;
    if (anchor.kind === 'extension') {
      const track = MaweMultiSubtitleCore.getExtensionTrack(anchor.trackId) || MaweMultiSubtitleCore.getActiveExtensionTrack();
      const index = anchor.segmentId
        ? track?.segments?.findIndex((segment) => segment?.id === anchor.segmentId)
        : anchor.index;
      if (!Number.isInteger(index) || index < 0) return null;
      return MaweCoreState.container.querySelector(`:scope > .cue[data-ext-idx="${index}"]`);
    }

    const index = anchor.segmentId
      ? MaweBoot.DATA.segments.findIndex((segment) => segment?.id === anchor.segmentId)
      : anchor.index;
    if (!Number.isInteger(index) || index < 0) return null;
    return MaweCoreState.container.querySelector(`:scope > .cue[data-idx="${index}"]`);
  }



  function restoreCueListRenderAnchor(anchor) {
    if (!anchor) return;
    restoreCueListVisualAnchor(findCueListRenderAnchor(anchor), anchor);
  }



  function restoreCueListVisualAnchor(cueEl, anchor) {
    const readVisualTop = () => {
      if (!cueEl?.isConnected || cueEl.classList.contains('hidden') || !Number.isFinite(anchor?.top)) {
        return null;
      }
      const rect = cueEl.getBoundingClientRect();
      return rect.height > 0 && Number.isFinite(rect.top) ? rect.top : null;
    };
    if (readVisualTop() === null && !Number.isFinite(anchor?.scrollTop)) return;
    const generation = ++cueListVisualAnchorGeneration;
    const maxFrames = 12;
    const epsilon = 0.75;
    let frameCount = 0;
    let lastManagedScrollTop = MaweCoreState.container.scrollTop;

    const restore = () => {
      if (generation !== cueListVisualAnchorGeneration) return;
      // renderAll() 的调用方可能在返回后立即设置 scrollTop（例如显式恢复
      // 用户位置或执行导航）。这不是 content-visibility 的布局误差，不能
      // 被后续稳定帧补偿覆盖。
      if (frameCount > 0 && Math.abs(MaweCoreState.container.scrollTop - lastManagedScrollTop) > epsilon) return;
      const visualTop = readVisualTop();
      if (visualTop !== null) {
        const delta = visualTop - anchor.top;
        if (!Number.isFinite(delta)) return;
        if (Math.abs(delta) > epsilon) {
          const previousScrollTop = MaweCoreState.container.scrollTop;
          MaweCoreState.container.scrollTop += delta;
          // 到达列表边界、无法继续补偿时无需再占用后续动画帧。
          if (Math.abs(MaweCoreState.container.scrollTop - previousScrollTop) < epsilon) return;
        }
        lastManagedScrollTop = MaweCoreState.container.scrollTop;
      } else if (Number.isFinite(anchor.scrollTop)) {
        const maxScrollTop = Math.max(0, MaweCoreState.container.scrollHeight - MaweCoreState.container.clientHeight);
        MaweCoreState.container.scrollTop = Math.min(Math.max(0, anchor.scrollTop), maxScrollTop);
        lastManagedScrollTop = MaweCoreState.container.scrollTop;
      }
      frameCount += 1;
      // content-visibility 可能先稳定几帧，再因滚动到新的行而继续回填真实
      // 高度；短暂覆盖完整观察窗口，避免连续拆分时出现延迟的二次位移。
      if (frameCount < maxFrames) requestAnimationFrame(restore);
    };

    restore();
  }



  function scrollCueToCenter(cueEl, { behavior = 'smooth' } = {}) {
    // 显式导航优先于重绘后的延迟补偿；否则一次点击/键盘导航可能刚把目标
    // 行滚到位，就被上一轮 content-visibility 稳定帧拉回旧锚点。
    invalidateCueListVisualAnchorRestore();
    if (!cueEl || cueEl.classList.contains('hidden')) return;
    const { containerRect: cRect, top: visibleTop, bottom: visibleBottom } = cueListVisibleBounds();
    const eRect = cueEl.getBoundingClientRect();
    const visibleHeight = Math.max(1, visibleBottom - visibleTop);
    const comfortInset = Math.min(120, Math.max(48, visibleHeight * 0.2));
    // 目标已经处于列表中间的舒适区域时，不再制造一次多余的滚动动画。
    // 顶部从 sticky 工具栏底部开始计算，避免把字幕滚到工具栏下面。
    const containerComfortTop = cRect.top + comfortInset;
    const containerComfortBottom = cRect.bottom - comfortInset;
    if (
      eRect.top >= containerComfortTop
      && eRect.bottom <= containerComfortBottom
    ) return;
    const offsetTop = (eRect.top - cRect.top) + MaweCoreState.container.scrollTop;
    const visibleTopOffset = visibleTop - cRect.top;
    const target = offsetTop + eRect.height / 2 - visibleTopOffset - visibleHeight / 2;
    MaweCoreState.container.scrollTo({ top: Math.max(0, target), behavior });
  }


  function scrollCueIntoViewIfNeeded(cueEl, options) {
    if (!cueEl || cueEl.classList.contains('hidden')) return;
    const { top, bottom } = cueListVisibleBounds();
    const eRect = cueEl.getBoundingClientRect();
    if (eRect.top < top || eRect.bottom > bottom) scrollCueToCenter(cueEl, options);
  }

  global.MaweCueListAnchor = Object.freeze({
    cueListVisibleBounds,
    get cueListVisualAnchorGeneration() { return cueListVisualAnchorGeneration; },
    set cueListVisualAnchorGeneration(v) { cueListVisualAnchorGeneration = v; },
    invalidateCueListVisualAnchorRestore,
    captureCueListVisualAnchor,
    captureVisibleCueListVisualAnchor,
    captureCueListRenderAnchor,
    findCueListRenderAnchor,
    restoreCueListRenderAnchor,
    restoreCueListVisualAnchor,
    scrollCueToCenter,
    scrollCueIntoViewIfNeeded
  });
})(typeof window !== 'undefined' ? window : globalThis);
