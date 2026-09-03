// 联动拆分弹窗的打开、关闭与预览刷新。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitModal(global) {
  'use strict';

  const U = global.MaweSplit;



  function updateLinkedSplitPreview(offset, lane = 'extension') {
    const state = U.pendingLinkedSplit;
    if (!state) return false;
    const track = MaweMultiSubtitleCore.getExtensionTrack(state.trackId);
    const main = state.mainIndex >= 0 ? MaweBoot.DATA.segments[state.mainIndex] : null;
    const extension = MaweMultiSubtitleCore.extensionSegmentById(state.extensionId, track);
    const mainOnly = state.kind === 'main';
    const extensionOnly = state.kind === 'extension';
    if ((!mainOnly && !extensionOnly && !main) || (!mainOnly && !extension)) return false;

    if (lane === 'main' && main) {
      const requestedOffset = Math.max(0, Math.min(String(main.text || '').length, Math.round(Number(offset) || 0)));
      const legalOffsets = window.AsrEditorUtils.subtitleSplitOffsets(main.text, state.mainMode);
      if (!legalOffsets.length) return false;
      state.mainOffset = legalOffsets.reduce((best, candidate) => (
        Math.abs(candidate - requestedOffset) < Math.abs(best - requestedOffset) ? candidate : best
      ), legalOffsets[0]);
      const mainHasWordTimestamps = window.AsrEditorUtils.hasUsableSplitTimestamps(main);
      state.mainCutMs = Number.isFinite(state.fixedCutMs)
        ? state.fixedCutMs
        : mainHasWordTimestamps
          ? U.splitTimeForTextOffset(main, state.mainOffset)
          : U.splitCutTime(main, state.mainOffset, false);
    } else if (extension) {
      const requestedOffset = Math.max(
        0,
        Math.min(String(extension.text || '').length, Math.round(Number(offset) || 0)),
      );
      const legalOffsets = window.AsrEditorUtils.subtitleSplitOffsets(extension.text, state.extensionMode);
      if (!legalOffsets.length) return false;
      state.offset = legalOffsets.reduce((best, candidate) => (
        Math.abs(candidate - requestedOffset) < Math.abs(best - requestedOffset) ? candidate : best
      ), legalOffsets[0]);
      state.extensionCutMs = Number.isFinite(state.fixedCutMs)
        ? state.fixedCutMs : U.splitCutTime(extension, state.offset, false);
    }

    if (state.kind === 'linked') U.syncLinkedSplitTime(state, lane, main, extension);

    const mainMode = state.mainMode || (main && MaweMultiSubtitleCore.getMainSubtitleSplitMode(main));
    const mainParts = main
      ? window.AsrEditorUtils.splitSubtitleText(main.text, state.mainOffset, mainMode)
      : null;
    const extensionParts = extension
      ? window.AsrEditorUtils.splitSubtitleText(extension.text, state.offset, state.extensionMode)
      : null;
    const mainTextValid = !main || Boolean(mainParts);
    const extensionTextValid = !extension || Boolean(extensionParts);
    const mainTimingValid = !main || Boolean(mainParts
      && state.mainCutMs - main.start >= MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS
      && main.end - state.mainCutMs >= MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS);
    const extensionTimingValid = !extension || Boolean(extensionParts
      && state.extensionCutMs - extension.start >= MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS
      && extension.end - state.extensionCutMs >= MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS);
    const mainValid = mainTextValid && mainTimingValid;
    const extensionValid = extensionTextValid && extensionTimingValid;
    const valid = mainValid && extensionValid;
    const textValid = mainTextValid && extensionTextValid;
    const forceSegments = [main, extension].filter(Boolean);
    state.cutMs = extensionOnly ? state.extensionCutMs : state.mainCutMs;
    state.textValid = textValid;
    state.timingValid = mainTimingValid && extensionTimingValid;
    state.mainTimingValid = Boolean(mainTimingValid);
    state.forceCutMs = textValid
      ? U.forceSplitCutForSegments(forceSegments, state.cutMs)
      : null;
    state.forceEligible = textValid && !state.timingValid && Number.isFinite(state.forceCutMs);
    // 联动模式下，副轨无法形成合法拆分（文本断点非法，或最短 100ms 钳制也救不回来）、
    // 而主轨自身仍可拆时，允许降级为「只拆主轨并解除绑定」，避免主轨被副轨阻塞。
    state.mainOnlyFallbackEligible = false;
    if (state.kind === 'linked' && main && extension && mainTextValid && !valid && !state.forceEligible) {
      const mainRescuable = mainTimingValid
        || Number.isFinite(U.forceSplitCutForSegments([main], state.mainCutMs));
      const extensionRescuable = extensionTextValid && (extensionTimingValid
        || Number.isFinite(U.forceSplitCutForSegments([extension], state.extensionCutMs)));
      state.mainOnlyFallbackEligible = mainRescuable && !extensionRescuable;
    }
    if (valid) state.forceSplitArmed = false;
    state.valid = valid;
    U.updateSplitLaneVisual(state, 'main');
    U.updateSplitLaneVisual(state, 'extension');
    if (MaweDom.multiSubtitleSplitMeta) {
      if (mainOnly) {
        U.renderSplitMeta(`主轨：${MaweMultiSubtitleCore.splitModeLabel(state.mainMode)} · 切点 ${MaweCueElements.fmtShort(state.mainCutMs)} · 字符位置 ${state.mainOffset ?? '—'}`, state);
      } else if (extensionOnly) {
        U.renderSplitMeta(`副轨：${MaweMultiSubtitleCore.splitModeLabel(state.extensionMode)} · 切点 ${MaweCueElements.fmtShort(state.extensionCutMs)}`, state);
      } else {
        const mainLabel = state.mainTimestampLocked
          ? `⌚️主轨时间码锚点 ${MaweCueElements.fmtShort(state.mainCutMs)}`
          : state.mainInteractive
            ? `主轨文字断点 ${state.mainOffset ?? '—'}`
            : `主轨字词锚点 ${MaweCueElements.fmtShort(state.mainCutMs)}`;
        U.renderSplitMeta(`${mainLabel} · 副轨文字断点 ${state.offset ?? '—'} · 共用绝对切点 ${MaweCueElements.fmtShort(state.cutMs)}`, state);
      }
    }
    if (MaweDom.multiSubtitleSplitPreview) {
      MaweDom.multiSubtitleSplitPreview.replaceChildren();
      if (mainParts && !extensionOnly) U.setSplitPreviewLine('主', mainParts);
      if (extensionParts && !mainOnly) U.setSplitPreviewLine('副', extensionParts);
      if (!mainValid || !extensionValid) {
        const error = document.createElement('div');
        error.textContent = '当前断点无法形成两段合法文本';
        MaweDom.multiSubtitleSplitPreview.appendChild(error);
      }
    }
    if (MaweDom.multiSubtitleSplitError) {
      MaweDom.multiSubtitleSplitError.textContent = valid ? '' : (state.mainOnlyFallbackEligible
        ? '副字幕无法在当前切点形成合法拆分；确认后只拆分主字幕，并解除与副字幕的绑定。'
        : extensionOnly
          ? '副字幕切点必须为两侧各留至少 100ms。'
          : '主字幕和副字幕切点都必须为两侧各留至少 100ms。');
    }
    if (MaweDom.multiSubtitleSplitConfirm) {
      MaweDom.multiSubtitleSplitConfirm.disabled = !valid && !state.mainOnlyFallbackEligible;
    }
    U.updateLinkedSplitLockVisual();
    return valid;
  }



  function closeLinkedSplitModal() {
    MaweDom.multiSubtitleSplitModal?.classList.remove('show');
    [MaweDom.multiSubtitleSplitMainText, MaweDom.multiSubtitleSplitText].forEach((textEl) => {
      textEl?.classList.remove('locked');
      textEl?.removeAttribute('title');
    });
    MaweDom.multiSubtitleSplitPreview?.classList.remove('locked');
    U.pendingLinkedSplit = null;
  }



  function openMainWaveformSplitModal(mainIndex, timeMs) {
    const state = U.mainWaveformSplitState(mainIndex, { timeMs });
    if (!state) {
      MaweHint.flashHint('这条字幕没有可用的文字边界', 'invalid');
      return false;
    }
    state.feedbackPoint = MaweCoreState.waveformEditor?.getSplitPointAtTime?.(timeMs, 'main') || null;
    U.pendingLinkedSplit = state;
    MaweDom.multiSubtitleSplitModal?.classList.add('show');
    U.renderLinkedSplitText(state);
    return true;
  }



  function openExtensionSplitModal(
    extensionIndex,
    timeMs,
    track = MaweMultiSubtitleCore.getActiveExtensionTrack(),
    initial = {},
  ) {
    const state = U.extensionOnlySplitState(extensionIndex, track, { timeMs, ...initial });
    if (!state) {
      MaweHint.flashHint('这条副字幕没有可用的文字边界', 'invalid');
      return false;
    }
    state.feedbackPoint = state.feedbackPoint
      || MaweCoreState.waveformEditor?.getSplitPointAtTime?.(timeMs, 'extension') || null;
    U.pendingLinkedSplit = state;
    MaweDom.multiSubtitleSplitModal?.classList.add('show');
    U.renderLinkedSplitText(state);
    return true;
  }

  Object.assign(U, {
    updateLinkedSplitPreview,
    closeLinkedSplitModal,
    openMainWaveformSplitModal,
    openExtensionSplitModal,
  });
})(typeof window !== 'undefined' ? window : globalThis);
