// 拆分轨道的元素定位、锁定判定、键盘焦点与微调步进。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitLaneControls(global) {
  'use strict';

  const U = global.MaweSplit;



  function splitLaneElements(lane) {
    return lane === 'main'
      ? { laneEl: MaweDom.multiSubtitleSplitMainLane, textEl: MaweDom.multiSubtitleSplitMainText }
      : { laneEl: MaweDom.multiSubtitleSplitExtensionLane, textEl: MaweDom.multiSubtitleSplitText };
  }



  function splitLaneLocked(state, lane) {
    return state?.lockedLanes?.[lane] === true;
  }



  function splitLaneUsesMainTimestamp(state, lane) {
    return lane === 'main' && state?.kind === 'linked' && state.mainTimestampLocked === true;
  }



  // 键盘可交互：⌚️ 时间码锚定的主轨和已用 Space/点击锁定的 lane 不响应移动键。
  function splitLaneKeyboardInteractive(state, lane) {
    return !splitLaneUsesMainTimestamp(state, lane) && !splitLaneLocked(state, lane);
  }



  function splitLaneSegment(state, lane) {
    if (lane === 'main') return state?.mainIndex >= 0 ? MaweBoot.DATA.segments[state.mainIndex] : null;
    return MaweMultiSubtitleCore.extensionSegmentById(state?.extensionId, MaweMultiSubtitleCore.getExtensionTrack(state?.trackId));
  }



  // 左右移动：在当前 lane 的合法断点序列中前进/后退一步。
  function stepSplitLaneOffset(state, lane, direction) {
    const segment = splitLaneSegment(state, lane);
    const mode = lane === 'main' ? state?.mainMode : state?.extensionMode;
    const current = lane === 'main' ? state?.mainOffset : state?.offset;
    const offsets = window.AsrEditorUtils.subtitleSplitOffsets(segment?.text || '', mode);
    if (!offsets.length) return null;
    if (direction < 0) {
      for (let index = offsets.length - 1; index >= 0; index -= 1) {
        if (offsets[index] < current) return offsets[index];
      }
      return null;
    }
    return offsets.find((offset) => offset > current) ?? null;
  }



  // 上下移动：按渲染后的视觉行定位。gap 元素样式一致，同一行的 top 相同；
  // 行距约等于 line-height（36px），用远小于行距的容差聚类即可。
  const SPLIT_LANE_LINE_TOLERANCE_PX = 10;



  function splitLaneGapLines(textEl) {
    return Array.from(textEl.querySelectorAll('.multi-subtitle-split-gap'))
      .map((gap) => {
        const rect = gap.getBoundingClientRect();
        return { gap, midX: rect.left + rect.width / 2, midY: rect.top + rect.height / 2 };
      })
      .sort((left, right) => left.midY - right.midY || left.midX - right.midX)
      .reduce((lines, entry) => {
        const current = lines[lines.length - 1];
        if (current && Math.abs(entry.midY - current.midY) <= SPLIT_LANE_LINE_TOLERANCE_PX) {
          current.entries.push(entry);
          return lines;
        }
        lines.push({ midY: entry.midY, entries: [entry] });
        return lines;
      }, []);
  }



  // 上下移动：目标行上取与当前断点水平距离最近的 gap；单行或越界时返回 null。
  function verticalSplitLaneOffset(state, lane, direction) {
    const { textEl } = splitLaneElements(lane);
    if (!textEl) return null;
    const lines = splitLaneGapLines(textEl);
    if (lines.length < 2) return null;
    const currentOffset = lane === 'main' ? state?.mainOffset : state?.offset;
    let anchor = lines.flatMap((line) => line.entries)
      .find((entry) => Number(entry.gap.dataset.offset) === currentOffset);
    if (!anchor) {
      // 当前断点没有 gap 元素（如文字开头）时退回字符锚点，用行中点估算所在行。
      const charRect = Array.from(textEl.querySelectorAll('.multi-subtitle-split-char'))
        .find((char) => Number(char.dataset.offset) === currentOffset)
        ?.getBoundingClientRect();
      if (!charRect) return null;
      const anchorMidY = charRect.top + charRect.height / 2;
      const nearestLine = lines.reduce((best, line) => (
        Math.abs(line.midY - anchorMidY) < Math.abs(best.midY - anchorMidY) ? line : best
      ), lines[0]);
      const target = lines[lines.indexOf(nearestLine) + direction];
      if (!target) return null;
      const anchorMidX = charRect.left + charRect.width / 2;
      const picked = target.entries.reduce((best, entry) => (
        Math.abs(entry.midX - anchorMidX) < Math.abs(best.midX - anchorMidX) ? entry : best
      ), target.entries[0]);
      return picked ? Number(picked.gap.dataset.offset) : null;
    }
    const target = lines[lines.findIndex(
      (line) => line.entries.includes(anchor),
    ) + direction];
    if (!target) return null;
    const picked = target.entries.reduce((best, entry) => (
      Math.abs(entry.midX - anchor.midX) < Math.abs(best.midX - anchor.midX) ? entry : best
    ), target.entries[0]);
    return picked ? Number(picked.gap.dataset.offset) : null;
  }



  // 键盘操作的 lane：优先看真实焦点，失焦（如点到复选框）时回退到上次记录。
  function splitKeyboardActiveLane(state) {
    if (document.activeElement === MaweDom.multiSubtitleSplitMainText) return 'main';
    if (document.activeElement === MaweDom.multiSubtitleSplitText) return 'extension';
    return state?.keyboardLane || null;
  }



  function splitLaneVisible(lane) {
    const { laneEl } = splitLaneElements(lane);
    return Boolean(laneEl && !laneEl.hidden);
  }



  function focusSplitLane(state, lane) {
    const { textEl } = splitLaneElements(lane);
    if (!textEl || !splitLaneVisible(lane)) return false;
    textEl.focus({ preventScroll: true });
    if (state) state.keyboardLane = lane;
    return true;
  }



  // Tab 在主/副 lane 间切换：仅在联动模式且主轨可交互时可用。
  function splitKeyboardSwitchLane(state, current) {
    if (state?.kind !== 'linked') return null;
    if (splitLaneUsesMainTimestamp(state, 'main')) return null;
    if (current === 'main') return 'extension';
    if (current === 'extension') return 'main';
    return 'main';
  }



  // Space 与鼠标点击同语义：锁定当前断点；再按一次解锁以便继续移动。
  function toggleSplitLaneKeyboardLock(state, lane) {
    if (state !== U.pendingLinkedSplit || !state.lockedLanes) return;
    if (splitLaneUsesMainTimestamp(state, lane)) return;
    state.lockedLanes[lane] = !splitLaneLocked(state, lane);
    U.updateLinkedSplitLockVisual();
    if (!splitLaneLocked(state, lane)) return;
    const submitted = U.maybeAutoSubmitLinkedSplit(state);
    // 键盘锁定后自动聚焦下一条未锁定的 lane（若有），WASD/空格 可连续操作；
    // 自动提交已接管或弹窗已关闭（提交成功）时不再移动焦点。
    if (submitted || state !== U.pendingLinkedSplit) return;
    const nextLane = splitKeyboardSwitchLane(state, lane);
    if (nextLane && !splitLaneLocked(state, nextLane)) focusSplitLane(state, nextLane);
  }



  // 已锁定的 lane 上按移动键：闪烁边缘并提示先解锁再移动。
  function flashSplitLaneBlockedFeedback(lane) {
    const { textEl } = splitLaneElements(lane);
    if (textEl) {
      textEl.classList.remove('lane-move-blocked');
      void textEl.offsetWidth; // 强制重排，让动画可以重新触发
      textEl.classList.add('lane-move-blocked');
      textEl.addEventListener('animationend', () => {
        textEl.classList.remove('lane-move-blocked');
      }, { once: true });
    }
    MaweHint.flashHint('请先按空格解除锁定，然后再进行移动', 'invalid');
  }

  Object.assign(U, {
    splitLaneElements,
    splitLaneLocked,
    splitLaneUsesMainTimestamp,
    splitLaneKeyboardInteractive,
    splitLaneSegment,
    stepSplitLaneOffset,
    SPLIT_LANE_LINE_TOLERANCE_PX,
    splitLaneGapLines,
    verticalSplitLaneOffset,
    splitKeyboardActiveLane,
    splitLaneVisible,
    focusSplitLane,
    splitKeyboardSwitchLane,
    toggleSplitLaneKeyboardLock,
    flashSplitLaneBlockedFeedback,
  });
})(typeof window !== 'undefined' ? window : globalThis);
