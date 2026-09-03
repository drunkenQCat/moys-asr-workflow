// 按字符位置切分 items、强制拆点与拆分重试提示。
// 自 web/editor/split/core.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweSplit；
// 兼容出口 window.MaweSplitCore 仍由 editor/split/compat-surface.js 统一组装。
(function initMaweSplitItemCut(global) {
  'use strict';

  const U = global.MaweSplit;



  function cleanSplitItems(items, side) {
    const source = Array.isArray(items) ? items : [];
    return source
      .map((item) => ({ ...item, text: String(item?.text || '') }))
      .map((item, index, list) => ({
        ...item,
        text: side === 'left' && index === list.length - 1
          ? window.AsrEditorUtils.applySplitEdgeTrim(item.text, 'end')
          : side === 'right' && index === 0
            ? window.AsrEditorUtils.applySplitEdgeTrim(item.text, 'start')
            : item.text,
      }))
      .filter((item) => item.text && Number.isFinite(item.start)
        && Number.isFinite(item.end) && item.end > item.start);
  }



  function forceSplitCutForSegments(segments, requestedCutMs) {
    const ranges = (Array.isArray(segments) ? segments : [segments])
      .map((segment) => ({
        start: Number(segment?.start),
        end: Number(segment?.end),
      }))
      .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end));
    if (!ranges.length || ranges.some((range) => range.end - range.start < MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS * 2)) {
      return null;
    }
    const lower = Math.max(...ranges.map((range) => range.start + MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS));
    const upper = Math.min(...ranges.map((range) => range.end - MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS));
    if (lower > upper) return null;
    const requested = Number(requestedCutMs);
    const cut = Number.isFinite(requested) ? Math.round(requested) : lower;
    return Math.min(upper, Math.max(lower, cut));
  }



  function forcedSplitRetryHint() {
    return '当前切点会产生不足 100ms 的一侧；请再次按 B 或 Enter 强制拆分，切点将调整为两侧各至少 100ms';
  }



  function armForcedSplit(state) {
    if (!state) return false;
    if (!Number.isFinite(state.forceCutMs)) {
      MaweHint.flashHint('字幕总时长不足 200ms，无法让拆分后的两侧都达到 100ms', 'warning');
      return false;
    }
    if (state.forceSplitArmed) return true;
    state.forceSplitArmed = true;
    MaweHint.flashHint(forcedSplitRetryHint(), 'warning');
    return false;
  }



  function splitItemsAtChar(
    segment,
    cursorChar,
    requestedCutMs = null,
    { preserveCutMs = false, forceCut = false } = {},
  ) {
    const text = String(segment?.text || '');
    const safeOffset = Math.max(0, Math.min(text.length, Math.round(Number(cursorChar) || 0)));
    const segmentStart = Number(segment?.start);
    const segmentEnd = Number(segment?.end);
    const safeSegmentStart = Number.isFinite(segmentStart) ? segmentStart : 0;
    const safeSegmentEnd = Number.isFinite(segmentEnd) && segmentEnd >= safeSegmentStart
      ? segmentEnd : safeSegmentStart;
    const items = Array.isArray(segment?.items) ? segment.items : [];
    const hasItems = items.some((item) => String(item?.text || ''));

    // 用原文查找 item 文本，处理 item 不包含词间空格的常见工程格式。
    // 如果上游 item 文本无法和字幕原文对齐，则退回旧的顺序长度映射，
    // 但后面的时间钳制和副本分组仍然保持一致。
    let searchFrom = 0;
    let aligned = true;
    const records = [];
    for (const item of items) {
      const itemText = String(item?.text || '');
      if (!itemText) continue;
      const textStart = text.indexOf(itemText, searchFrom);
      if (textStart < 0) {
        aligned = false;
        break;
      }
      records.push({ item, textStart, textEnd: textStart + itemText.length, itemText });
      searchFrom = textStart + itemText.length;
    }
    if (!aligned) {
      records.length = 0;
      let textStart = 0;
      for (const item of items) {
        const itemText = String(item?.text || '');
        if (!itemText) continue;
        records.push({ item, textStart, textEnd: textStart + itemText.length, itemText });
        textStart += itemText.length;
      }
    }

    const timeRangeFor = (item) => {
      const rawStart = Number(item?.start);
      const rawEnd = Number(item?.end);
      const start = Math.max(
        safeSegmentStart,
        Number.isFinite(rawStart) ? rawStart : safeSegmentStart,
      );
      const end = Math.min(
        safeSegmentEnd,
        Number.isFinite(rawEnd) ? rawEnd : safeSegmentEnd,
      );
      if (end > start) return { start, end };
      // item 时间完全落在段范围之外（上游工程的病态时间码）：钳制后区间
      // 倒置。丢弃会让词文本从 items 里消失，这里压到越界最近一侧的
      // 最小可表达区间，保留词数据；分配循环仍按文本对齐决定归属侧。
      return Number.isFinite(rawStart) && rawStart >= safeSegmentEnd
        ? { start: Math.max(safeSegmentStart, safeSegmentEnd - 1), end: safeSegmentEnd }
        : { start: safeSegmentStart, end: Math.min(safeSegmentEnd, safeSegmentStart + 1) };
    };
    const previous = [...records].reverse().find((record) => record.textEnd <= safeOffset);
    const next = records.find((record) => record.textStart >= safeOffset);
    const inside = records.find((record) => (
      safeOffset > record.textStart && safeOffset < record.textEnd
    ));
    const requested = Number(requestedCutMs);
    let splitMs = Number.isFinite(requested) ? Math.round(requested) : null;
    // 切点两侧相邻 item 的实际时间区间；else 分支填充，供下方非对称边界使用。
    let previousRange = null;
    let nextRange = null;

    if (inside) {
      const range = timeRangeFor(inside.item);
      const fraction = (safeOffset - inside.textStart) / Math.max(1, inside.textEnd - inside.textStart);
      const interpolated = Math.round(range.start + (range.end - range.start) * fraction);
      if (!preserveCutMs || !Number.isFinite(splitMs)
          || (!forceCut && (splitMs < range.start || splitMs > range.end))) {
        splitMs = interpolated;
      }
    } else {
      if (!records.length && Number.isFinite(splitMs)) {
        splitMs = Math.round(splitMs);
      }
      // 文字切点在 item 边界或词间空白时，吸附到相邻 item 的真实边界：
      // 优先跟随左侧词尾，这会把“模型”后的手工切点从 26526 吸附到
      // “模型”的 end 26680，避免左字幕范围先于完整 item 结束。
      // （连续 item 上两侧相等；有静音空隙时由下方非对称边界接管。）
      previousRange = previous ? timeRangeFor(previous.item) : null;
      nextRange = next ? timeRangeFor(next.item) : null;
      if (records.length && (!preserveCutMs || !Number.isFinite(splitMs))) {
        splitMs = previousRange?.end ?? nextRange?.start ?? null;
      }
    }

    if (!Number.isFinite(splitMs)) {
      const ratio = safeOffset / Math.max(1, text.length);
      splitMs = Math.round(safeSegmentStart + (safeSegmentEnd - safeSegmentStart) * ratio);
    }
    splitMs = Math.max(safeSegmentStart, Math.min(safeSegmentEnd, Math.round(splitMs)));

    // 非对称拆分边界：切点两词之间存在真实静音空隙（如本地 ASR 的
    // “型、”6160-6480 与下一词 6720 起）时，左段停在自家最后一个词的
    // end，右段从自家第一个词的 start 开始，保留真实空隙，而不是把一侧
    // 硬拉过静音。仅在两侧候选都有效且严格正序（timeRangeFor 对病态时间
    // 的钳制可能倒挂）时启用；缺词或缺时间码时落回单一共享切点。
    let leftEndMs = splitMs;
    let rightStartMs = splitMs;
    const prevEdgeMs = previousRange?.end ?? null;
    const nextEdgeMs = nextRange?.start ?? null;
    if (Number.isFinite(prevEdgeMs) && Number.isFinite(nextEdgeMs)
        && nextEdgeMs - prevEdgeMs > 0) {
      leftEndMs = prevEdgeMs;
      rightStartMs = nextEdgeMs;
    }

    const leftItems = [];
    const rightItems = [];
    for (const record of records) {
      const range = timeRangeFor(record.item);
      if (range.end <= range.start) continue;
      const { itemText, textStart, textEnd } = record;
      if (inside === record) {
        const localOffset = Math.max(0, Math.min(itemText.length, safeOffset - textStart));
        const leftText = itemText.slice(0, localOffset);
        const rightText = itemText.slice(localOffset);
        const itemSplitMs = preserveCutMs
          && (forceCut || (splitMs >= range.start && splitMs <= range.end))
          ? splitMs
          : Math.round(range.start + (range.end - range.start)
            * localOffset / Math.max(1, itemText.length));
        if (leftText && rightText && itemSplitMs > range.start && itemSplitMs < range.end) {
          leftItems.push({ ...record.item, text: leftText, start: range.start, end: itemSplitMs });
          rightItems.push({ ...record.item, text: rightText, start: itemSplitMs, end: range.end });
        } else if (leftText && rightText) {
          // 取整后不足以给两侧各留出一个毫秒时，保留完整 item 到更接近
          // 光标的一侧，避免为了制造 0 长 item 而丢失词文本。
          const keepLeft = splitMs >= range.end || localOffset >= itemText.length / 2;
          if (keepLeft) {
            leftItems.push({ ...record.item, text: itemText, start: range.start, end: range.end });
          } else {
            rightItems.push({ ...record.item, text: itemText, start: range.start, end: range.end });
          }
        } else if (leftText && itemSplitMs > range.start) {
          leftItems.push({ ...record.item, text: leftText, start: range.start, end: itemSplitMs });
        } else if (rightText && range.end > itemSplitMs) {
          rightItems.push({ ...record.item, text: rightText, start: itemSplitMs, end: range.end });
        }
        continue;
      }
      if (textEnd <= safeOffset) {
        const end = Math.min(range.end, leftEndMs);
        if (end > range.start) leftItems.push({ ...record.item, start: range.start, end });
      } else if (textStart >= safeOffset) {
        const start = Math.max(range.start, rightStartMs);
        if (range.end > start) rightItems.push({ ...record.item, start, end: range.end });
      } else if (splitMs >= range.start && splitMs <= range.end) {
        // 退回顺序映射或异常 item 文本对齐时，仍不得让 item 穿过字幕边界。
        const end = Math.min(range.end, leftEndMs);
        if (end > range.start) leftItems.push({ ...record.item, start: range.start, end });
      }
    }
    // 病态时间码被钳制到段尾/段头时，可能与相邻 item 挤占同一毫秒槽。
    // 从后往前把前一项的 end 压到后一项的 start，保证 items 递增不重叠；
    // 压到 0 长度的极端病态保留原样，交由保存前的校验暴露问题。
    for (const items of [leftItems, rightItems]) {
      for (let i = items.length - 1; i > 0; i--) {
        if (items[i - 1].end > items[i].start && items[i - 1].start < items[i].start) {
          items[i - 1].end = items[i].start;
        }
      }
    }
    return { leftItems, rightItems, splitMs, leftEndMs, rightStartMs, hasItems };
  }



  function buildSplitPair(
    segment,
    offset,
    cutMs,
    idBase,
    includeItems = true,
    splitMode = null,
    { preserveCutMs = false, forceCut = false } = {},
  ) {
    const text = String(segment?.text || '');
    const mode = window.AsrEditorUtils.MULTI_SUBTITLE_SPLIT_MODES.has(splitMode)
      ? splitMode : window.AsrEditorUtils.detectSubtitleSplitMode(text);
    const parts = window.AsrEditorUtils.splitSubtitleText(text, offset, mode);
    if (!parts) return null;
    const itemParts = splitItemsAtChar(
      includeItems ? segment : { ...segment, items: [] },
      parts.offset,
      cutMs,
      { preserveCutMs, forceCut },
    );
    const leftItems = cleanSplitItems(itemParts.leftItems, 'left');
    const rightItems = cleanSplitItems(itemParts.rightItems, 'right');
    const splitMs = Number.isFinite(itemParts.splitMs) ? itemParts.splitMs : Math.round(cutMs);
    // 左右两段可各自贴合自家词边界（词间有静音空隙时非对称）。
    const leftEnd = Number.isFinite(itemParts.leftEndMs) ? itemParts.leftEndMs : splitMs;
    const rightStart = Number.isFinite(itemParts.rightStartMs) ? itemParts.rightStartMs : splitMs;
    const segmentStart = Number(segment?.start);
    const segmentEnd = Number(segment?.end);
    if (!Number.isFinite(splitMs)
        || !Number.isFinite(segmentStart)
        || !Number.isFinite(segmentEnd)
        || segmentEnd - segmentStart < MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS * 2
        || leftEnd - segmentStart < MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS
        || segmentEnd - rightStart < MaweMultiSubtitleCore.SUBTITLE_MIN_DURATION_MS
        || rightStart < leftEnd) return null;
    const left = {
      ...segment,
      id: window.AsrEditorUtils.uniqueStableSegmentId([segment], `${idBase}-a`, 'segment'),
      start: segment.start,
      end: leftEnd,
      text: parts.left,
      items: leftItems.length ? leftItems : null,
      _dirty: true,
    };
    const right = {
      ...segment,
      id: window.AsrEditorUtils.uniqueStableSegmentId([segment, left], `${idBase}-b`, 'segment'),
      start: rightStart,
      end: segment.end,
      text: parts.right,
      items: rightItems.length ? rightItems : null,
      _dirty: true,
    };
    if (segment.sticker) {
      right.sticker = null;
      right.sticker_ref = { name: segment.sticker.name, headIdx: 0 };
    }
    if (segment.color) {
      right.color = null;
      right.color_ref = { name: segment.color.name, headIdx: 0 };
    }
    return { left, right, parts, splitMs };
  }

  Object.assign(U, {
    cleanSplitItems,
    forceSplitCutForSegments,
    forcedSplitRetryHint,
    armForcedSplit,
    splitItemsAtChar,
    buildSplitPair,
  });
})(typeof window !== 'undefined' ? window : globalThis);
