// 拆分轨道绘制、预览线与锁定态视觉刷新。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitLaneRender(global) {
  'use strict';

  const U = global.MaweSplit;



  function setSplitPreviewLine(label, parts) {
    const row = document.createElement('div');
    row.className = 'multi-subtitle-split-preview-line';
    const labelEl = document.createElement('span');
    labelEl.className = 'multi-subtitle-split-preview-label';
    labelEl.textContent = `${label}：`;
    const left = document.createElement('span');
    left.className = 'multi-subtitle-split-preview-left';
    left.textContent = parts.left;
    const separator = document.createElement('span');
    separator.className = 'multi-subtitle-split-preview-separator';
    separator.textContent = ' / ';
    const right = document.createElement('span');
    right.className = 'multi-subtitle-split-preview-right';
    right.textContent = parts.right;
    row.append(labelEl, left, separator, right);
    MaweDom.multiSubtitleSplitPreview.appendChild(row);
  }



  function updateSplitLaneVisual(state, lane) {
    const { textEl } = U.splitLaneElements(lane);
    if (!textEl) return;
    const offset = lane === 'main' ? state?.mainOffset : state?.offset;
    const timestampLocked = U.splitLaneUsesMainTimestamp(state, lane);
    textEl.classList.toggle('timestamp-locked', timestampLocked);
    textEl.querySelectorAll('.multi-subtitle-split-char').forEach((character) => {
      const charOffset = Number(character.dataset.offset || 0);
      character.classList.toggle('split-left', charOffset <= offset);
      character.classList.toggle('split-right', charOffset > offset);
    });
    textEl.querySelectorAll('.multi-subtitle-split-gap').forEach((gap) => {
      gap.classList.toggle('active', Number(gap.dataset.offset) === offset);
      gap.classList.toggle('timestamp-locked', timestampLocked);
    });
  }



  function renderSplitLane(state, lane) {
    const { laneEl, textEl } = U.splitLaneElements(lane);
    if (!laneEl || !textEl) return;
    const main = MaweBoot.DATA.segments[state?.mainIndex];
    const track = MaweMultiSubtitleCore.getExtensionTrack(state?.trackId);
    const extension = MaweMultiSubtitleCore.extensionSegmentById(state?.extensionId, track);
    const isMain = lane === 'main';
    const displaySegment = isMain ? main : extension;
    const displayMode = isMain ? state?.mainMode : state?.extensionMode;
    const timestampLocked = U.splitLaneUsesMainTimestamp(state, lane);
    const heading = laneEl.querySelector('h4');
    if (heading) {
      const headingText = timestampLocked
        ? '⌚️ 主字幕按时间码会拆在这里'
        : isMain ? '主字幕拆分' : '副字幕拆分';
      heading.textContent = window.MAWE_I18N?.translateText?.(headingText) || headingText;
    }
    laneEl.classList.toggle('timestamp-locked-lane', timestampLocked);
    const visible = Boolean(displaySegment) && (isMain
      ? state?.kind === 'main' || state?.mainInteractive || timestampLocked
      : state?.kind !== 'main');
    laneEl.hidden = !visible;
    if (!visible) return;
    textEl.replaceChildren();
    textEl.classList.toggle('timestamp-locked', timestampLocked);
    const legalOffsets = new Set(window.AsrEditorUtils.subtitleSplitOffsets(displaySegment.text, displayMode));
    const characters = Array.from(displaySegment.text || '');
    let offset = 0;
    const appendCharacter = (character, characterOffset) => {
      const characterSpan = document.createElement('span');
      characterSpan.className = 'multi-subtitle-split-char';
      characterSpan.dataset.offset = String(characterOffset);
      characterSpan.textContent = character;
      textEl.appendChild(characterSpan);
    };
    const appendGap = (splitOffset, whitespace = '', extraClass = '') => {
      const gap = document.createElement('span');
      gap.className = 'multi-subtitle-split-gap';
      if (extraClass) gap.classList.add(extraClass);
      gap.dataset.offset = String(splitOffset);
      if (timestampLocked) {
        gap.setAttribute('aria-disabled', 'true');
      } else {
        gap.setAttribute('role', 'button');
        gap.setAttribute('aria-label', `在第 ${splitOffset} 个字符后拆分`);
      }
      // 保留原始空白；只有当前选中的断点通过 CSS 将这个空白替换成剪刀。
      gap.textContent = whitespace;
      textEl.appendChild(gap);
    };
    for (let index = 0; index < characters.length; index += 1) {
      const character = characters[index];
      if (/\s/u.test(character)) {
        let runEnd = index;
        let runOffset = offset + character.length;
        while (runEnd + 1 < characters.length && /\s/u.test(characters[runEnd + 1])) {
          runEnd += 1;
          runOffset += characters[runEnd].length;
        }
        if (legalOffsets.has(runOffset)) {
          appendGap(runOffset, characters.slice(index, runEnd + 1).join(''));
        }
        else {
          for (let whitespaceIndex = index; whitespaceIndex <= runEnd; whitespaceIndex += 1) {
            offset += characters[whitespaceIndex].length;
            appendCharacter(characters[whitespaceIndex], offset);
          }
        }
        if (legalOffsets.has(runOffset)) offset = runOffset;
        else offset = runOffset;
        index = runEnd;
        continue;
      }
      if (displayMode === 'word' && window.AsrEditorUtils.isWordSplitConnector(character)) {
        let runEnd = index;
        let runOffset = offset + character.length;
        while (
          runEnd + 1 < characters.length
          && window.AsrEditorUtils.isWordSplitConnector(characters[runEnd + 1])
        ) {
          runEnd += 1;
            runOffset += characters[runEnd].length;
        }
        if (!legalOffsets.has(offset) && !legalOffsets.has(runOffset)) {
          for (let connectorIndex = index; connectorIndex <= runEnd; connectorIndex += 1) {
            offset += characters[connectorIndex].length;
            appendCharacter(characters[connectorIndex], offset);
          }
        } else {
          // 符号本身是独立 token；前一个普通字符后的 gap 已由上方逻辑插入，
          // 这里保留符号，并在符号之后插入另一个零宽断点。
          for (let connectorIndex = index; connectorIndex <= runEnd; connectorIndex += 1) {
            offset += characters[connectorIndex].length;
            appendCharacter(characters[connectorIndex], offset);
          }
          if (legalOffsets.has(runOffset)) appendGap(runOffset, '', 'connector-gap');
        }
        offset = runOffset;
        index = runEnd;
        continue;
      }
      offset += character.length;
      appendCharacter(character, offset);
      if (legalOffsets.has(offset)) {
        const nextCharacter = characters[index + 1];
        const connectorGap = displayMode === 'word'
          && window.AsrEditorUtils.isWordSplitConnector(nextCharacter);
        appendGap(offset, '', connectorGap ? 'connector-gap' : '');
      }
    }
    if (timestampLocked) {
      textEl.setAttribute('aria-label', '主字幕按时间码拆分位置，不可交互');
      textEl.setAttribute('aria-readonly', 'true');
      textEl.setAttribute('aria-disabled', 'true');
      textEl.setAttribute('tabindex', '-1');
      textEl.title = '主字幕按时间码拆分于此处，不可交互';
      textEl.onmousemove = null;
      textEl.onclick = null;
    } else {
      textEl.removeAttribute('aria-readonly');
      textEl.removeAttribute('aria-disabled');
      textEl.setAttribute('tabindex', '0');
      textEl.setAttribute('aria-label', isMain ? '选择主字幕拆分点' : '选择副字幕断点');
      textEl.title = '鼠标移动选择拆分点，左键点击锁定；也可用 WASD/方向键移动，空格确认或取消';
      textEl.onmousemove = (event) => {
        if (U.splitLaneLocked(U.pendingLinkedSplit, lane)) return;
        const target = event.target;
        const gap = target?.closest?.('.multi-subtitle-split-gap');
        if (gap && textEl.contains(gap)) {
          U.updateLinkedSplitPreview(Number(gap.dataset.offset), lane);
          return;
        }
        const rawOffset = MaweInlineEdit.caretCharFromPoint(textEl, event.clientX, event.clientY);
        if (rawOffset != null) U.updateLinkedSplitPreview(rawOffset, lane);
      };
      textEl.onclick = (event) => {
        const current = U.pendingLinkedSplit;
        if (!current) return;
        if (U.splitLaneLocked(current, lane)) {
          current.lockedLanes[lane] = false;
          updateLinkedSplitLockVisual();
          return;
        }
        const target = event.target;
        const gap = target?.closest?.('.multi-subtitle-split-gap');
        const rawOffset = gap && textEl.contains(gap)
          ? Number(gap.dataset.offset)
          : MaweInlineEdit.caretCharFromPoint(textEl, event.clientX, event.clientY);
        if (rawOffset != null) U.updateLinkedSplitPreview(rawOffset, lane);
        current.lockedLanes[lane] = true;
        updateLinkedSplitLockVisual();
        U.maybeAutoSubmitLinkedSplit(current);
      };
    }
    updateSplitLaneVisual(state, lane);
  }



  function renderLinkedSplitText(state) {
    if (!state) return;
    state.lockedLanes = { main: false, extension: false };
    if (MaweDom.multiSubtitleSplitTimestampHint) {
      MaweDom.multiSubtitleSplitTimestampHint.hidden = state.mainTimestampLocked !== true;
    }
    if (MaweDom.multiSubtitleSplitTitle) {
      MaweDom.multiSubtitleSplitTitle.textContent = state.kind === 'main'
        ? '选择主字幕拆分点'
        : state.kind === 'extension'
          ? '选择副字幕拆分点'
          : state.mainInteractive
            ? '分别选择主字幕和副字幕拆分点'
            : '主字幕按时间码定位，选择副字幕拆分点';
    }
    renderSplitLane(state, 'main');
    renderSplitLane(state, 'extension');
    const initialLane = state.initialLane || (state.kind === 'main'
      ? 'main'
      : state.kind === 'extension'
        ? 'extension'
        : state.mainInteractive ? 'main' : 'extension');
    U.updateLinkedSplitPreview(
      state.kind === 'main' ? state.mainOffset
        : state.kind === 'extension' ? state.offset : state.mainOffset,
      initialLane,
    );
    // 弹窗打开即聚焦初始 lane，让 WASD/方向键/Space 直接可用；
    // ⌚️ 时间码锚定的主轨不可交互，回落到副轨。
    state.keyboardLane = U.splitLaneUsesMainTimestamp(state, initialLane) ? 'extension' : initialLane;
    U.focusSplitLane(state, state.keyboardLane);
  }



  function updateLinkedSplitLockVisual() {
    const state = U.pendingLinkedSplit;
    const mainLocked = U.splitLaneLocked(state, 'main');
    const extensionLocked = U.splitLaneLocked(state, 'extension');
    MaweDom.multiSubtitleSplitMainText?.classList.toggle('locked', mainLocked);
    MaweDom.multiSubtitleSplitText?.classList.toggle('locked', extensionLocked);
    [
      ['main', MaweDom.multiSubtitleSplitMainText],
      ['extension', MaweDom.multiSubtitleSplitText],
    ].forEach(([lane, textEl]) => {
      if (!textEl) return;
      const timestampLocked = U.splitLaneUsesMainTimestamp(state, lane);
      textEl.classList.toggle('locked', !timestampLocked && U.splitLaneLocked(state, lane));
      textEl.title = timestampLocked
        ? '主字幕按时间码拆分于此处，不可交互'
        : U.splitLaneLocked(state, lane)
          ? '拆分点已锁定，点击或按空格解锁'
          : '鼠标移动选择拆分点，左键点击锁定；也可用 WASD/方向键移动，空格确认或取消';
      textEl.querySelectorAll('.multi-subtitle-split-gap').forEach((gap) => {
        gap.classList.toggle(
          'locked',
          !timestampLocked && U.splitLaneLocked(state, lane) && gap.classList.contains('active'),
        );
      });
    });
    MaweDom.multiSubtitleSplitPreview?.classList.toggle('locked', mainLocked || extensionLocked);
  }

  Object.assign(U, {
    setSplitPreviewLine,
    updateSplitLaneVisual,
    renderSplitLane,
    renderLinkedSplitText,
    updateLinkedSplitLockVisual,
  });
})(typeof window !== 'undefined' ? window : globalThis);
