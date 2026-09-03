// 主轨/副轨拆分状态的推导与联动时间同步。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitLaneState(global) {
  'use strict';

  const U = global.MaweSplit;



   function linkedSplitState(mainIndex, initial = {}) {
    const main = MaweBoot.DATA.segments[mainIndex];
    const binding = MaweMultiSubtitleCore.bindingForMainIndex(mainIndex);
    const track = binding ? MaweMultiSubtitleCore.getExtensionTrack(binding.track_id) : null;
    const extension = binding ? MaweMultiSubtitleCore.extensionSegmentById(binding.extension_segment_ids?.[0], track) : null;
    if (!main || !binding || !track || !extension) return null;
    // 联动拆分要求主副两侧在共同切点的两边各保留最小时长。副字幕总时长不足、
    // 或两段重叠区间放不下合法切点时，不再直接拒绝：弹窗内会走「只拆主字幕并
    // 解除绑定」的降级路径（仅在主字幕自身可拆时启用）；只有主字幕总时长不足
    // （降级也无从谈起）才提前给出原因。
    const linkedMinSpanMs = MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS * 2;
    if (main.end - main.start < linkedMinSpanMs) {
      MaweHint.flashHint('主字幕总时长不足 200ms，无法联动拆分', 'warning');
      return null;
    }
    const mainMode = MaweMultiSubtitleCore.getMainSubtitleSplitMode(main);
    const extensionMode = MaweMultiSubtitleCore.getExtensionSubtitleSplitMode(track, extension);
    const hasMainWordTimestamps = window.AsrEditorUtils.hasUsableSplitTimestamps(main);
    const initialTime = Number.isFinite(initial.timeMs)
      ? initial.timeMs
      : U.splitTimeForTextOffset(main, initial.mainOffset ?? Math.floor(String(main.text || '').length / 2));
    const useMainWordTimestamps = U.shouldUseMainSplitTimestamps(main);
    // 关闭自动时间码拆分后，波形入口传入的时间仍是绝对切点；没有波形指针时，
    // 有可用时间码就把初始断点定位到最近的字词边界，但之后仍允许用户自由调整。
    const fixedCutMs = !useMainWordTimestamps && Number.isFinite(initial.timeMs)
      ? Math.round(initial.timeMs) : null;
    // 字幕列表传入的是用户实际指向的文字位置；即使工程有字词时间码，
    // 也不能再用时间反推一次文字位置，否则「就是｜这颗」可能漂移成「就是这｜颗」。
    // 没有列表文字位置时（例如波形/播放头入口）才按时间寻找最近合法断点。
    const hasInitialTextPosition = Number.isFinite(initial.mainOffset);
    const initialMainOffset = hasInitialTextPosition
      ? U.splitOffsetNearTextPosition(main.text, initial.mainOffset, mainMode)
      : U.splitOffsetNearTime(main, initialTime, mainMode);
    const initialMainCutMs = fixedCutMs ?? (hasMainWordTimestamps
      ? U.splitTimeForTextOffset(main, initialMainOffset)
      : splitCutTime(main, initialMainOffset, false));
    const initialOffset = window.AsrEditorUtils.nearestSubtitleSplitOffset(
      extension.text, initialMainCutMs, extension.start, extension.end, extensionMode,
    );
    return {
      kind: 'linked',
      mainIndex,
      mainId: main.id,
      extensionId: extension.id,
      trackId: track.id,
      mainMode,
      mainInteractive: !useMainWordTimestamps,
      mainTimestampLocked: useMainWordTimestamps,
      mainOffset: initialMainOffset,
      mainCutMs: initialMainCutMs,
      offset: initialOffset,
      // 联动拆分只有一个绝对切点；副轨的 offset 只负责选择文字边界。
      cutMs: initialMainCutMs,
      extensionCutMs: initialMainCutMs,
      extensionMode,
      fixedCutMs,
      feedbackPoint: initial.feedbackPoint || null,
      // 列表/编辑区唤起的弹窗提交后，刀光保留在列表原位置而不是波形切点。
      ninjaFromList: initial.ninjaFromList === true,
      cutSource: fixedCutMs != null
        ? 'pointer'
        : useMainWordTimestamps
          ? 'word-timestamps'
          : hasMainWordTimestamps ? 'word-timestamps-default' : 'text-estimate',
      initialLane: hasInitialTextPosition ? 'main' : null,
      locked: false,
    };
  }



  function mainWaveformSplitState(mainIndex, initial = {}) {
    const main = MaweBoot.DATA.segments[mainIndex];
    if (!main) return null;
    const mainMode = MaweMultiSubtitleCore.getMainSubtitleSplitMode(main);
    const hasMainWordTimestamps = window.AsrEditorUtils.hasUsableSplitTimestamps(main);
    const initialTime = Number.isFinite(initial.timeMs)
      ? initial.timeMs
      : U.splitTimeForTextOffset(main, initial.mainOffset ?? Math.floor(String(main.text || '').length / 2));
    const fixedCutMs = Number.isFinite(initial.timeMs) ? Math.round(initial.timeMs) : null;
    const initialOffset = U.splitOffsetNearTime(main, initialTime, mainMode);
    if (initialOffset == null) return null;
    return {
      kind: 'main',
      mainIndex,
      mainId: main.id,
      offset: initialOffset,
      mainOffset: initialOffset,
      mainCutMs: fixedCutMs ?? (hasMainWordTimestamps
        ? U.splitTimeForTextOffset(main, initialOffset)
        : splitCutTime(main, initialOffset, false)),
      feedbackPoint: initial.feedbackPoint || null,
      mainMode,
      fixedCutMs,
      cutSource: fixedCutMs != null
        ? 'pointer'
        : hasMainWordTimestamps ? 'word-timestamps-default' : 'text-estimate',
      locked: false,
    };
  }



  function extensionOnlySplitState(extensionIndex, track, initial = {}) {
    const extension = track?.segments?.[extensionIndex];
    if (!extension || !track) return null;
    // 副字幕独立拆分同样要求总时长能容纳两侧各 100ms；不足时提交必然失败，
    // 直接提示原因，不再打开只会静默失败的弹窗。
    if (extension.end - extension.start < MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS * 2) {
      MaweHint.flashHint('副字幕总时长不足 200ms，无法拆分', 'warning');
      return null;
    }
    const extensionMode = MaweMultiSubtitleCore.getExtensionSubtitleSplitMode(track, extension);
    const hasInitialTextPosition = Number.isFinite(initial.extensionOffset);
    const initialTime = Number.isFinite(initial.timeMs)
      ? initial.timeMs
      : U.splitTimeForTextOffset(extension, initial.extensionOffset ?? Math.floor(String(extension.text || '').length / 2));
    const fixedCutMs = Number.isFinite(initial.timeMs) ? Math.round(initial.timeMs) : null;
    const initialOffset = hasInitialTextPosition
      ? U.splitOffsetNearTextPosition(extension.text, initial.extensionOffset, extensionMode)
      : window.AsrEditorUtils.nearestSubtitleSplitOffset(
        extension.text, initialTime, extension.start, extension.end, extensionMode,
      );
    if (!Number.isInteger(initialOffset)) return null;
    return {
      kind: 'extension',
      mainIndex: -1,
      extensionIndex,
      extensionId: extension.id,
      trackId: track.id,
      offset: initialOffset,
      extensionCutMs: fixedCutMs ?? U.splitTimeForTextOffset(extension, initialOffset),
      feedbackPoint: initial.feedbackPoint || null,
      // 列表/编辑区唤起的弹窗提交后，刀光保留在列表原位置而不是波形切点。
      ninjaFromList: initial.ninjaFromList === true,
      extensionMode,
      fixedCutMs,
      cutSource: fixedCutMs != null ? 'pointer' : 'text-estimate',
      locked: false,
    };
  }



  function syncLinkedSplitTime(state, activeLane, main, extension) {
    if (state?.kind !== 'linked' || !main || !extension) return;

    // 默认的主轨字词时间码是固定锚点；关闭该设置后，未锁定的当前 lane
    // 才能推动共享切点。另一条 lane 的文字 offset 随共享时间吸附到最近合法边界。
    const absoluteFixed = Number.isFinite(state.fixedCutMs);
    const mainFixed = !state.mainInteractive || U.splitLaneLocked(state, 'main');
    const extensionFixed = U.splitLaneLocked(state, 'extension');
    let cutMs = state.cutMs;
    if (absoluteFixed) {
      cutMs = state.fixedCutMs;
    } else if (mainFixed) {
      cutMs = state.mainCutMs;
    } else if (extensionFixed) {
      cutMs = state.extensionCutMs;
    } else {
      const source = activeLane === 'main' ? main : extension;
      const sourceOffset = activeLane === 'main' ? state.mainOffset : state.offset;
      cutMs = activeLane === 'main'
        && window.AsrEditorUtils.hasUsableSplitTimestamps(main)
        ? U.splitTimeForTextOffset(main, sourceOffset)
        : splitCutTime(source, sourceOffset, false);
    }
    if (!Number.isFinite(cutMs)) return;

    const sharedCutMs = Math.round(cutMs);
    state.cutMs = sharedCutMs;
    state.mainCutMs = sharedCutMs;
    state.extensionCutMs = sharedCutMs;

    if (!absoluteFixed && activeLane === 'main' && !extensionFixed) {
      const extensionOffset = window.AsrEditorUtils.nearestSubtitleSplitOffset(
        extension.text, sharedCutMs, extension.start, extension.end, state.extensionMode,
      );
      if (Number.isInteger(extensionOffset)) state.offset = extensionOffset;
    } else if (!absoluteFixed && activeLane === 'extension' && !mainFixed) {
      const mainOffset = window.AsrEditorUtils.nearestSubtitleSplitOffset(
        main.text, sharedCutMs, main.start, main.end, state.mainMode,
      );
      if (Number.isInteger(mainOffset)) state.mainOffset = mainOffset;
    }
  }



  function splitCutTime(segment, offset, useWordTimestamps = false) {
    if (useWordTimestamps) return Math.round(U.splitTimeForTextOffset(segment, offset));
    const textLength = Math.max(1, String(segment?.text || '').length);
    return Math.round(Number(segment?.start || 0)
      + ((Number(segment?.end || 0) - Number(segment?.start || 0)) * Number(offset || 0)) / textLength);
  }

  Object.assign(U, {
    linkedSplitState,
    mainWaveformSplitState,
    extensionOnlySplitState,
    splitCutTime,
    syncLinkedSplitTime,
  });
})(typeof window !== 'undefined' ? window : globalThis);
