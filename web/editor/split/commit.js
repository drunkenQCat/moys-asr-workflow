// 各条提交路径：主轨、仅主文本、副轨与确认联动拆分。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitCommit(global) {
  'use strict';

  const U = global.MaweSplit;



  function commitMainWaveformSplit(state, { force = false, successMessage = '已按选择的断点拆分主字幕' } = {}) {
    // 波形入口可能是在当前字幕面板仍有未提交编辑时触发；先完成面板编辑，
    // 再为“拆分”建立快照，确保一次撤销能回到拆分前的完整字幕状态。
    MaweCuePanel.commitCuePanelEdit();
    const mainIndex = state.mainIndex;
    const main = MaweBoot.DATA.segments[mainIndex];
    if (!main) return false;
    const splitMs = force
      ? U.forceSplitCutForSegments([main], state.cutMs)
      : state.cutMs;
    if (!Number.isFinite(splitMs)) {
      MaweHint.flashHint('字幕总时长不足 200ms，无法让拆分后的两侧都达到 100ms', 'warning');
      return false;
    }
    const pair = U.buildSplitPair(
      main,
      state.mainOffset,
      splitMs,
      main.id || `main-${mainIndex}`,
      true,
      state.mainMode,
      {
        preserveCutMs: force || Number.isFinite(state.fixedCutMs),
        forceCut: force,
      },
    );
    if (!pair) return false;
    const oldMainId = main.id;
    MaweHistory.pushUndo('拆分字幕', { captureView: true });
    MaweSelection.clearSelection({ commitCuePanel: false });
    MaweMultiSubtitleCore.removeBindingsForSegmentIds([oldMainId], []);
    MaweBoot.DATA.segments.splice(mainIndex, 1, pair.left, pair.right);
    for (let index = mainIndex + 2; index < MaweBoot.DATA.segments.length; index++) {
      const segment = MaweBoot.DATA.segments[index];
      if (segment.sticker_ref?.headIdx > mainIndex) segment.sticker_ref.headIdx += 1;
      if (segment.color_ref?.headIdx > mainIndex) segment.color_ref.headIdx += 1;
    }
    if (pair.left.sticker) pair.right.sticker_ref = { name: pair.left.sticker.name, headIdx: mainIndex };
    if (pair.left.color) pair.right.color_ref = { name: pair.left.color.name, headIdx: mainIndex };
    MaweMultiSubtitleCore.markMainSegmentsDirty([pair.left, pair.right]);
    MaweCueElements.rememberTemporaryVisibleSplitCues({ mainSegments: [pair.left, pair.right] });
    U.closeLinkedSplitModal();
    MaweCuePanel.renderAll();
    MaweSelection.selectOnly(mainIndex + 1);
    MaweSelection.lastClickedIdx = mainIndex + 1;
    MawePlaybackLoop.updateWithoutCueListAutoScroll();
    U.flashSplitFeedback({
      index: mainIndex,
      track: 'main',
      splitMs,
      feedbackPoint: null,
      listFeedback: false,
    });

    // 弹窗提交的刀光位置由唤起来源决定：列表唤起留在列表，其余落在波形最终切点。
    MaweNinja.triggerNinjaSplitFeedback(MaweNinja.ninjaModalSplitPoint(state, splitMs, 'main'));
    if (successMessage) MaweHint.flashHint(successMessage, 'success');
    return true;
  }



  // 降级路径：副轨无法形成合法拆分时，只拆主轨并解除与副字幕的绑定。
  function commitLinkedSplitMainOnly(state) {
    const main = MaweBoot.DATA.segments[state.mainIndex];
    if (!main) return false;
    let force = false;
    if (!state.mainTimingValid) {
      const mainForceCutMs = U.forceSplitCutForSegments([main], state.mainCutMs);
      if (!Number.isFinite(mainForceCutMs)) {
        MaweHint.flashHint('字幕总时长不足 200ms，无法让拆分后的两侧都达到 100ms', 'warning');
        return false;
      }
      if (!state.forceSplitArmed) {
        state.forceSplitArmed = true;
        MaweHint.flashHint(U.forcedSplitRetryHint(), 'warning');
        return false;
      }
      force = true;
      state.cutMs = mainForceCutMs;
      state.mainCutMs = mainForceCutMs;
    }
    const committed = commitMainWaveformSplit(state, { force, successMessage: null });
    if (!committed) return false;
    MaweMultiSubtitleCore.markMultiSubtitleDirty();
    MaweHint.flashHint('由于副字幕无法在当前切点形成合法拆分，为了拆分主字幕，已解除绑定', 'warning');
    return true;
  }



  function commitExtensionSplit(state, { force = false } = {}) {
    const track = MaweMultiSubtitleCore.getExtensionTrack(state.trackId);
    const extensionIndex = track?.segments?.findIndex((segment) => segment.id === state.extensionId) ?? -1;
    const extension = track?.segments?.[extensionIndex];
    if (!track || extensionIndex < 0 || !extension) return false;
    const splitMs = force
      ? U.forceSplitCutForSegments([extension], state.extensionCutMs)
      : state.extensionCutMs;
    if (!Number.isFinite(splitMs)) {
      MaweHint.flashHint('字幕总时长不足 200ms，无法让拆分后的两侧都达到 100ms', 'warning');
      return false;
    }
    const pair = U.buildSplitPair(
      extension,
      state.offset,
      splitMs,
      extension.id || `${track.id}-segment-${extensionIndex}`,
      true,
      state.extensionMode,
      {
        preserveCutMs: force || Number.isFinite(state.fixedCutMs),
        forceCut: force,
      },
    );
    if (!pair) return false;

    const oldExtensionId = extension.id;
    const wasBound = Boolean(MaweMultiSubtitleCore.bindingForExtensionIndex(extensionIndex, track));
    MaweHistory.pushUndo('拆分副字幕', { captureView: true });
    // 一对一绑定无法让一个主段同时指向拆出的两条副轨段；独立拆分后
    // 保留两条副字幕，但解除旧关系，等待用户按需要重新绑定。
    MaweMultiSubtitleCore.removeBindingsForSegmentIds([], [oldExtensionId]);
    track.segments.splice(extensionIndex, 1, pair.left, pair.right);
    MaweMultiSubtitleCore.markMultiSubtitleDirty();
    MaweCueElements.rememberTemporaryVisibleSplitCues({
      extensionSegments: [pair.left, pair.right],
      extensionTrackId: track.id,
    });
    U.closeLinkedSplitModal();
    MaweSelection.clearSelection({ commitCuePanel: false });
    MaweCuePanel.renderAll();
    MaweSelection.selectOnlyExtension(extensionIndex + 1);
    MaweSelection.lastClickedExtensionIdx = extensionIndex + 1;
    MawePlaybackLoop.updateWithoutCueListAutoScroll();
    U.flashSplitFeedback({
      index: extensionIndex,
      track: 'extension',
      splitMs,
      feedbackPoint: null,
      listFeedback: false,
    });
    // 弹窗提交的刀光位置由唤起来源决定：列表唤起留在列表，其余落在波形最终切点。
    MaweNinja.triggerNinjaSplitFeedback(MaweNinja.ninjaModalSplitPoint(state, splitMs, 'extension'));
    MaweHint.flashHint(
      wasBound
        ? '已独立拆分副字幕并解除原绑定'
        : '已按选择的断点拆分副字幕',
      'success',
    );
    return true;
  }



  function confirmLinkedSplit() {
    const state = U.pendingLinkedSplit;
    if (!state) return;
    const previewLane = state.kind === 'main' ? 'main' : 'extension';
    const previewOffset = state.kind === 'main' ? state.mainOffset : state.offset;
    const previewValid = U.updateLinkedSplitPreview(previewOffset, previewLane);
    let force = false;
    if (!previewValid) {
      // 副轨救不回来而主轨可拆：降级为只拆主轨并解除绑定，主轨不被副轨阻塞。
      if (state.kind === 'linked' && state.mainOnlyFallbackEligible) {
        commitLinkedSplitMainOnly(state);
        return;
      }
      if (!state.textValid) {
        MaweHint.flashHint('当前断点无法把主副字幕文本各拆成两段', 'warning');
        return;
      }
      if (!state.forceEligible) {
        MaweHint.flashHint('字幕总时长不足 200ms，无法让拆分后的两侧都达到 100ms', 'warning');
        return;
      }
      if (!state.forceSplitArmed) {
        U.armForcedSplit(state);
        return;
      }
      force = true;
      state.cutMs = state.forceCutMs;
      state.mainCutMs = state.forceCutMs;
      state.extensionCutMs = state.forceCutMs;
    }
    if (state.kind === 'main') {
      commitMainWaveformSplit(state, { force });
      return;
    }
    if (state.kind === 'extension') {
      commitExtensionSplit(state, { force });
      return;
    }
    const track = MaweMultiSubtitleCore.getExtensionTrack(state.trackId);
    const mainIndex = state.mainIndex;
    const extensionIndex = track?.segments?.findIndex((segment) => segment.id === state.extensionId) ?? -1;
    const main = MaweBoot.DATA.segments[mainIndex];
    const extension = track?.segments?.[extensionIndex];
    const sharedCutMs = Number(state.cutMs);
    if (!Number.isFinite(sharedCutMs)
        || sharedCutMs !== Number(state.mainCutMs)
        || sharedCutMs !== Number(state.extensionCutMs)) {
      MaweHint.flashHint('主字幕和副字幕必须使用同一个绝对切点', 'warning');
      return;
    }
    const mainPair = U.buildSplitPair(
      main,
      state.mainOffset,
      sharedCutMs,
      main.id || `main-${mainIndex}`,
      true,
      state.mainMode,
      { preserveCutMs: true, forceCut: force },
    );
    const extensionPair = U.buildSplitPair(
      extension,
      state.offset,
      sharedCutMs,
      extension.id || `extension-${extensionIndex}`,
      true,
      state.extensionMode,
      { preserveCutMs: true, forceCut: force },
    );
    if (!mainPair || !extensionPair || extensionIndex < 0) {
      // 前置时长检查已拦截常见不可拆场景；这里兜底提示，避免弹窗内按键完全无反应。
      MaweHint.flashHint('当前切点无法同时拆分主副字幕，请调整断点位置', 'warning');
      return;
    }
    const oldMainId = main.id;
    const oldExtensionId = extension.id;
    MaweHistory.pushUndo('联动拆分字幕', { captureView: true });
    MaweMultiSubtitleCore.removeBindingsForSegmentIds([oldMainId], [oldExtensionId]);
    MaweBoot.DATA.segments.splice(mainIndex, 1, mainPair.left, mainPair.right);
    if (track) track.segments.splice(extensionIndex, 1, extensionPair.left, extensionPair.right);
    // 主轨数组增加了一项，沿用原有表情包/颜色 headIdx 维护规则。
    for (let index = mainIndex + 2; index < MaweBoot.DATA.segments.length; index++) {
      const segment = MaweBoot.DATA.segments[index];
      if (segment.sticker_ref?.headIdx > mainIndex) segment.sticker_ref.headIdx += 1;
      if (segment.color_ref?.headIdx > mainIndex) segment.color_ref.headIdx += 1;
    }
    if (mainPair.left.sticker) mainPair.right.sticker_ref.headIdx = mainIndex;
    if (mainPair.left.color) mainPair.right.color_ref.headIdx = mainIndex;
    const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
    multi.bindings.push(
      window.AsrEditorUtils.buildSubtitleBinding(mainPair.left, extensionPair.left, track.id),
      window.AsrEditorUtils.buildSubtitleBinding(mainPair.right, extensionPair.right, track.id),
    );
    multi.enabled = true;
    MaweMultiSubtitleCore.markMainSegmentsDirty([mainPair.left, mainPair.right]);
    MaweMultiSubtitleCore.markMultiSubtitleDirty();
    MaweCueElements.rememberTemporaryVisibleSplitCues({
      mainSegments: [mainPair.left, mainPair.right],
      extensionSegments: [extensionPair.left, extensionPair.right],
      extensionTrackId: track.id,
    });
    U.closeLinkedSplitModal();
    MaweSelection.clearSelection({ commitCuePanel: false });
    MaweCuePanel.renderAll();
    MaweSelection.selectOnly(mainIndex);
    MaweSelection.lastClickedIdx = mainIndex;
    MawePlaybackLoop.updateWithoutCueListAutoScroll();
    U.flashSplitFeedback({
      index: mainIndex,
      track: 'main',
      splitMs: sharedCutMs,
      feedbackPoint: null,
      listFeedback: false,
    });
    U.flashSplitFeedback({
      index: extensionIndex,
      track: 'extension',
      splitMs: sharedCutMs,
      feedbackPoint: null,
      listFeedback: false,
    });
    // 联动拆分刀光位置由唤起来源决定：列表唤起留在列表，其余落在主轨波形切点。
    MaweNinja.triggerNinjaSplitFeedback(MaweNinja.ninjaModalSplitPoint(state, sharedCutMs, 'main'));
    MaweHint.flashHint('已按同一绝对时间切点联动拆分', 'success');
  }

  Object.assign(U, {
    commitMainWaveformSplit,
    commitLinkedSplitMainOnly,
    commitExtensionSplit,
    confirmLinkedSplit,
  });
})(typeof window !== 'undefined' ? window : globalThis);
