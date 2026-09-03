// 光标处拆分与波形/字幕列表上的拆点反馈动画。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitCursorSplit(global) {
  'use strict';

  const U = global.MaweSplit;



  function splitAtCursor(
    feedbackPoint = null,
    { listFeedback = true, cueListAnchor: suppliedCueListAnchor = null } = {},
  ) {
    if (!MaweInlineEdit.editingState) return false;
    const force = MaweInlineEdit.editingState.forceSplitArmed === true;
    const { el, idx, textEl } = MaweInlineEdit.editingState;
    const sel = window.getSelection();
    if (!sel.rangeCount) {
      MaweInlineEdit.finishEdit(false);
      return false;
    }
    const range = sel.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(textEl);
    preRange.setEnd(range.startContainer, range.startOffset);
    const cursorOffset = preRange.toString().length;
    const fullText = textEl.innerText.replace(/\r\n?/g, '\n');
    const ninjaFeedbackPoint = feedbackPoint || MaweNinja.ninjaSplitPointFromRange(
      range, textEl, cursorOffset, fullText.length,
    );
    const seg = MaweBoot.DATA.segments[idx];

    if (MaweMultiSubtitleCore.multiSubtitleVisible() && MaweMultiSubtitleCore.bindingForMainIndex(idx)) {
      MaweInlineEdit.finishEdit(false);
      U.pendingLinkedSplit = U.linkedSplitState(idx, {
        mainOffset: cursorOffset,
        feedbackPoint: ninjaFeedbackPoint,
        ninjaFromList: true,
      });
      if (!U.pendingLinkedSplit) return;
      MaweDom.multiSubtitleSplitModal?.classList.add('show');
      U.renderLinkedSplitText(U.pendingLinkedSplit);
      return;
    }

    if (cursorOffset <= 0 || cursorOffset >= fullText.length) {
      MaweInlineEdit.finishEdit(false);
      MaweHint.flashHint('光标必须在词与词之间才能拆分', 'invalid');
      return false;
    }

    let leftText = window.AsrEditorUtils.applySplitEdgeTrim(fullText.slice(0, cursorOffset), 'end');
    let rightText = window.AsrEditorUtils.applySplitEdgeTrim(fullText.slice(cursorOffset), 'start');
    if (!leftText || !rightText) {
      MaweInlineEdit.finishEdit(false);
      MaweHint.flashHint('拆分后任一段为空，已取消', 'warning');
      return false;
    }

    // 原字幕总时长不足 200ms 时，无法在原时间范围内让两侧都达到 100ms；
    // 这和“切点靠边、可通过再次按键强制钳制”的情况不同。
    if (seg.end - seg.start < 200) {
      MaweInlineEdit.finishEdit(false);
      MaweHint.flashHint('字幕时长不足 200ms，无法拆分', 'warning');
      return false;
    }

    let itemSplit = U.splitItemsAtChar(seg, cursorOffset);
    let splitMs = itemSplit.splitMs;
    if (!itemSplit.hasItems || !Number.isFinite(splitMs)) {
      const ratio = cursorOffset / fullText.length;
      const t = seg.start + (seg.end - seg.start) * ratio;
      // 无词级时间码时按光标位置拆分；第一次按键仍保留原始切点，
      // 只有第二次强制拆分才把它钳制到两侧各 100ms 的安全范围。
      splitMs = Math.round(t);
    }
    // 左右两段的结算边界：默认跟随共享切点；词级 items 提供非对称切分
    // （左段停在自家最后一词的 end，右段起自首词的 start）时分别取用。
    // 缺词或缺时间码时两者都保持 splitMs，与旧行为一致。
    let leftEnd = splitMs;
    let rightStart = splitMs;
    const resolveSplitBounds = () => {
      let leftEndMs = Number.isFinite(splitMs) ? splitMs : null;
      let rightStartMs = leftEndMs;
      if (itemSplit && itemSplit.hasItems && Number.isFinite(splitMs)
          && Number.isFinite(itemSplit.leftEndMs)) {
        leftEndMs = itemSplit.leftEndMs;
        rightStartMs = Number.isFinite(itemSplit.rightStartMs)
          ? itemSplit.rightStartMs : leftEndMs;
      }
      leftEnd = leftEndMs ?? NaN;
      rightStart = rightStartMs ?? NaN;
    };
    resolveSplitBounds();
    const timingValid = Number.isFinite(leftEnd) && Number.isFinite(rightStart)
      && leftEnd - seg.start >= MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS
      && seg.end - rightStart >= MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS;
    if (!timingValid && !force) {
      MaweInlineEdit.editingState.forceSplitArmed = true;
      MaweHint.flashHint(U.forcedSplitRetryHint(), 'warning');
      return false;
    }
    if (force) {
      const forcedCut = U.forceSplitCutForSegments([seg], splitMs);
      if (!Number.isFinite(forcedCut)) {
        MaweInlineEdit.finishEdit(false);
        MaweHint.flashHint('字幕时长不足 200ms，无法让拆分后的两侧都达到 100ms', 'warning');
        return false;
      }
      splitMs = forcedCut;
      itemSplit = U.splitItemsAtChar(
        seg,
        cursorOffset,
        splitMs,
        { preserveCutMs: true, forceCut: true },
      );
      resolveSplitBounds();
      if (Number.isFinite(forcedCut)) {
        // 强制拆分承诺两侧各 >= 100ms：当自然词边界使某一侧过短
        // （如最后一个词紧贴字幕末尾）时，该侧退回用户确认的强制切点，
        // 另一侧保留非对称自然边界。
        if (!Number.isFinite(leftEnd) || leftEnd - seg.start < MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS) {
          leftEnd = forcedCut;
        }
        if (!Number.isFinite(rightStart) || seg.end - rightStart < MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS) {
          rightStart = forcedCut;
        }
        if (rightStart < leftEnd) rightStart = leftEnd;
      }
    }
    // 字幕列表手工拆分允许用户指定任意字符位置，但时间码必须落在实际 item
    // 的安全范围内；当切点在 item 内时，splitItemsAtChar 已为两侧生成 item 副本。
    // 左右边界已在上文（含强制重试的降级调和）结算完毕，这里直接消费。
    const leftItemsClean = U.cleanSplitItems(itemSplit.leftItems, 'left');
    const rightItemsClean = U.cleanSplitItems(itemSplit.rightItems, 'right');

    const leftSeg = {
      id: window.AsrEditorUtils.uniqueStableSegmentId([seg], `${seg.id || `main-${idx}`}-a`, 'main'),
      start: seg.start, end: leftEnd, text: leftText,
      items: leftItemsClean.length ? leftItemsClean : null,
      sticker: seg.sticker || null,
      sticker_ref: seg.sticker_ref || null,
      color: seg.color || null,
      color_ref: seg.color_ref || null,
      disabled: !!seg.disabled,  // 拆分后两段都继承原禁用状态
      _dirty: true,
    };
    const rightSeg = {
      id: window.AsrEditorUtils.uniqueStableSegmentId([seg], `${seg.id || `main-${idx}`}-b`, 'main'),
      start: rightStart, end: seg.end, text: rightText,
      items: rightItemsClean.length ? rightItemsClean : null,
      sticker: null,
      // 如果原 seg 是被引用的 head，右段也成为同一表情包的延续 → 给 ref
      // 如果原 seg 自己是 ref，右段也保持 ref
      sticker_ref: seg.sticker
        ? { name: seg.sticker.name, headIdx: idx }  /* 暂用 idx，下面会修正 */
        : (seg.sticker_ref ? { ...seg.sticker_ref } : null),
      // color 同理：原 seg 是 head → 右段降级为 ref；原 seg 是 ref → 复制 ref
      color: null,
      color_ref: seg.color
        ? { name: seg.color.name, headIdx: idx }
        : (seg.color_ref ? { ...seg.color_ref } : null),
      disabled: !!seg.disabled,  // 拆分后两段都继承原禁用状态
      _dirty: true,
    };

    // renderAll() 会重建整张字幕列表。content-visibility 会在重建后先用估算
    // 行高占位，再为视口附近的行回填真实高度；只保存 scrollTop 无法阻止
    // 当前字幕被累计行高误差顶走。列表来源的拆分因此保存原行的屏幕位置，
    // 重绘后再用左半段恢复这个视觉锚点。
    const cueListAnchor = listFeedback
      ? suppliedCueListAnchor || MaweCueListAnchor.captureCueListVisualAnchor(el)
      : null;

    textEl.removeAttribute('contenteditable');
    el.classList.remove('editing');
    MaweInlineEdit.editingState = null;

    // 拆分会改变 idx；先在任何写入前保存完整快照，再静默清选中，等列表
    // 和波形块覆盖层一次性更新后再选中后半段。这样撤销会恢复原 item 时间。
    MaweHistory.pushUndo('拆分字幕', { captureView: true });
    MaweSelection.clearSelection({ silent: true });
    // 关闭多字幕模式时，绑定关系仍保存在工程中；拆分主轨后旧 ID 不再存在，
    // 只移除这条关系，保留隐藏的副字幕供用户重新绑定。
    MaweMultiSubtitleCore.removeBindingsForSegmentIds([seg.id], []);
    MaweBoot.DATA.segments.splice(idx, 1, leftSeg, rightSeg);

    // 修正所有 *_ref.headIdx：在 idx 之后的引用都右移 1
    // 但 leftSeg 在 idx 位置仍是 head（如果它有 sticker/color），rightSeg 的 ref.headIdx=idx 正好对应 leftSeg
    for (let i = idx + 2; i < MaweBoot.DATA.segments.length; i++) {
      const sref = MaweBoot.DATA.segments[i].sticker_ref;
      if (sref && sref.headIdx > idx) sref.headIdx += 1;
      const cref = MaweBoot.DATA.segments[i].color_ref;
      if (cref && cref.headIdx > idx) cref.headIdx += 1;
    }

    MaweCueElements.rememberTemporaryVisibleSplitCues({ mainSegments: [leftSeg, rightSeg] });
    MaweCuePanel.renderAll({ preserveCueListScroll: listFeedback });
    const leftEl = MaweCoreState.container.querySelector(`.cue[data-idx="${idx}"]`);
    const rightEl = MaweCoreState.container.querySelector(`.cue[data-idx="${idx + 1}"]`);
    // 列表来源的拆分（B 键悬停行、列表右键拆分、行内编辑拆分）都发生在当前
    // 可见的字幕行上，拆分后让左半段留在原字幕的视觉位置；右半段自然排在
    // 下一行。这样既保留 content-visibility，也不会被懒布局累计误差顶走。
    // 波形 / 编辑面板等其它来源的拆分结果可能不在列表视口内，仍滚动到新右半段，
    // 便于在列表中看到拆分结果。
    if (listFeedback) MaweCueListAnchor.restoreCueListVisualAnchor(leftEl, cueListAnchor);
    else if (rightEl) MaweCueListAnchor.scrollCueToCenter(rightEl);
    MaweSelection.selectOnly(idx + 1);
    // 拆分后后半段是新的视觉选中项，也必须成为 Shift+点击的范围锚点。
    MaweSelection.lastClickedIdx = idx + 1;
    // 列表来源（B 键悬停等）沿用列表光标坐标；编辑区 Ctrl+Enter 等其余来源
    // 统一回退到波形区实际切点位置，波形上找不到时才用编辑区文字坐标。
    MaweNinja.triggerNinjaSplitFeedback(
      (listFeedback ? (feedbackPoint || ninjaFeedbackPoint) : null)
        || MaweCoreState.waveformEditor?.getSplitPointAtTime?.(splitMs, 'main')
        || ninjaFeedbackPoint,
    );
    MawePlaybackLoop.updateWithoutCueListAutoScroll();
    flashSplitFeedback({
      index: idx,
      track: 'main',
      splitMs,
      feedbackPoint: listFeedback ? (feedbackPoint || ninjaFeedbackPoint) : null,
      listFeedback,
    });
    return true;
  }



  function flashCueSplitAt(idx, clientX, track = 'main') {
    if (!Number.isFinite(clientX)) return false;
    const cue = track === 'extension'
      ? MaweCoreState.container.querySelector(
        `.multi-cue-column.extension[data-ext-idx="${idx}"], .cue[data-ext-idx="${idx}"]`,
      )
      : MaweCoreState.container.querySelector(
        `.multi-cue-column.main[data-main-idx="${idx}"], .cue[data-idx="${idx}"]`,
      );
    if (!cue) return false;
    const rect = cue.getBoundingClientRect();
    const marker = document.createElement('span');
    marker.className = 'cue-split-flash';
    // .cue 的绝对定位子元素以 padding box 为坐标原点；rect.left 是 border box，
    // 还要扣掉左边的 3px 状态边框，否则光条会向右压进字形。
    marker.style.left = `${Math.max(0, Math.min(rect.width, clientX - rect.left - cue.clientLeft))}px`;
    cue.appendChild(marker);
    // 先触发布局，再加动画类，确保连续拆分时每个光条都能独立播放。
    void marker.offsetWidth;
    marker.classList.add('is-active');
    let removed = false;
    let timer = 0;
    const cleanup = () => {
      if (removed) return;
      removed = true;
      if (timer) window.clearTimeout(timer);
      marker.remove();
    };
    marker.addEventListener('animationend', cleanup, { once: true });
    timer = window.setTimeout(cleanup, 800);
    return true;
  }



  // 拆分来源可能是字幕列表、当前编辑区或弹窗；只有列表来源有可靠的列表坐标，
  // 其它来源统一回退到波形时间位置。波形反馈只创建一个短暂标记，不参与播放帧刷新。
  function flashSplitFeedback({ index, track = 'main', splitMs, feedbackPoint = null, listFeedback = false } = {}) {
    const timeMs = Number(splitMs);
    const hasListMarker = listFeedback
      && Number.isFinite(feedbackPoint?.clientX)
      && flashCueSplitAt(index, feedbackPoint.clientX, track);
    if (!hasListMarker && Number.isFinite(timeMs)) {
      MaweCoreState.waveformEditor?.flashSplitAtTime?.(timeMs, track);
    }
  }

  Object.assign(U, {
    splitAtCursor,
    flashCueSplitAt,
    flashSplitFeedback,
  });
})(typeof window !== 'undefined' ? window : globalThis);
