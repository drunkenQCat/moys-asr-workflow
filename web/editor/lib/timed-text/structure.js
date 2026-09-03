// 带时间字幕的结构方案：锚点选取、整段重排与结构差异报告。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibTimedTextStructure(global) {
  'use strict';

  const U = global.MaweLib;

  function emptyTimedTextStructurePlan(error = '') {
    return {
      valid: false,
      type: null,
      error,
      mode: null,
      segments: [],
      outputMeta: [],
      sourceOutputIndexes: [],
      affectedSourceIndexes: [],
      removedSourceIndexes: [],
    };
  }

  function findTimedTextTokenSequence(sourceTokens, targetTokens, fromIndex) {
    if (!targetTokens.length) return -1;
    for (let index = Math.max(0, fromIndex); index + targetTokens.length <= sourceTokens.length; index += 1) {
      if (sameTimedTextTokens(
        sourceTokens.slice(index, index + targetTokens.length),
        targetTokens,
      )) return index;
    }
    return -1;
  }

  function findTimedTextTokenSequences(sourceTokens, targetTokens) {
    if (!targetTokens.length) return [];
    const matches = [];
    for (let index = 0; index + targetTokens.length <= sourceTokens.length; index += 1) {
      if (sameTimedTextTokens(
        sourceTokens.slice(index, index + targetTokens.length),
        targetTokens,
      )) matches.push({ start: index, end: index + targetTokens.length });
    }
    return matches;
  }

  function findTimedTextNeutralAwareSequences(sourceTokens, targetTokens) {
    const sourcePositions = [];
    const sourceAnchors = [];
    sourceTokens.forEach((token, index) => {
      if (U.isTimedTextNeutralToken(token, true)) return;
      sourcePositions.push(index);
      sourceAnchors.push(token);
    });
    const targetAnchors = targetTokens.filter((token) => !U.isTimedTextNeutralToken(token, true));
    if (!targetAnchors.length) return [];
    const matches = [];
    for (let index = 0; index + targetAnchors.length <= sourceAnchors.length; index += 1) {
      if (!sameTimedTextTokens(
        sourceAnchors.slice(index, index + targetAnchors.length),
        targetAnchors,
      )) continue;
      let rangeStart = sourcePositions[index];
      let rangeEnd = sourcePositions[index + targetAnchors.length - 1] + 1;
      while (rangeStart > 0 && U.isTimedTextNeutralToken(sourceTokens[rangeStart - 1], true)) {
        rangeStart -= 1;
      }
      while (rangeEnd < sourceTokens.length && U.isTimedTextNeutralToken(sourceTokens[rangeEnd], true)) {
        rangeEnd += 1;
      }
      matches.push({ start: rangeStart, end: rangeEnd });
    }
    return matches;
  }

  function timedTextAnchorCandidates(sourceTokens, lineTokens, sourceOffsets) {
    const boundaries = new Set([0]);
    sourceOffsets.forEach((range) => {
      boundaries.add(range.start);
      boundaries.add(range.end);
    });
    const candidates = [];
    lineTokens.forEach((tokens, lineIndex) => {
      const seen = new Set();
      const append = (range, neutralAware = false) => {
        if (!range || range.start >= range.end || seen.has(`${range.start}:${range.end}`)) return;
        const startsAtBoundary = boundaries.has(range.start);
        const endsAtBoundary = boundaries.has(range.end);
        // 内部片段太容易把真正的后续字幕误认成锚点；拆分/合并只接受
        // 至少一侧落在原字幕边界上的匹配。完全内部的片段留给区间估算。
        if (!startsAtBoundary && !endsAtBoundary) return;
        const wholeSource = !neutralAware && sourceOffsets.some((sourceRange) => (
          sourceRange.start === range.start && sourceRange.end === range.end
        ));
        const boundaryScore = wholeSource
          ? 100000000
          : (startsAtBoundary && endsAtBoundary ? 1000000 : 10000);
        seen.add(`${range.start}:${range.end}`);
        candidates.push({
          lineIndex,
          start: range.start,
          end: range.end,
          score: boundaryScore + Math.min(tokens.length, 10000),
        });
      };
      findTimedTextTokenSequences(sourceTokens, tokens).forEach((range) => append(range));
      findTimedTextNeutralAwareSequences(sourceTokens, tokens)
        .forEach((range) => append(range, true));
    });
    return candidates;
  }

  function selectTimedTextAnchors(sourceTokens, lineTokens, sourceOffsets) {
    const candidates = timedTextAnchorCandidates(sourceTokens, lineTokens, sourceOffsets);
    if (!candidates.length) return [];
    const states = candidates.map((candidate) => ({
      score: candidate.score,
      count: 1,
      coveredLength: candidate.end - candidate.start,
      previous: -1,
    }));
    const isBetter = (left, right) => {
      if (!right) return true;
      if (left.score !== right.score) return left.score > right.score;
      if (left.count !== right.count) return left.count > right.count;
      if (left.coveredLength !== right.coveredLength) return left.coveredLength > right.coveredLength;
      return left.previous < right.previous;
    };
    for (let current = 0; current < candidates.length; current += 1) {
      const candidate = candidates[current];
      for (let previous = 0; previous < current; previous += 1) {
        const previousCandidate = candidates[previous];
        if (previousCandidate.lineIndex >= candidate.lineIndex
            || previousCandidate.end > candidate.start) continue;
        const proposal = {
          score: states[previous].score + candidate.score,
          count: states[previous].count + 1,
          coveredLength: states[previous].coveredLength + candidate.end - candidate.start,
          previous,
        };
        if (isBetter(proposal, states[current])) states[current] = proposal;
      }
    }
    let last = -1;
    for (let index = 0; index < states.length; index += 1) {
      if (last < 0 || isBetter(states[index], states[last])) last = index;
    }
    const selected = [];
    while (last >= 0) {
      selected.push(candidates[last]);
      last = states[last].previous;
    }
    return selected.reverse();
  }

  function buildTimedTextStructurePlan(segments, draftTexts) {
    const source = Array.isArray(segments) ? segments : [];
    const texts = Array.isArray(draftTexts) ? draftTexts : [];
    if (!U.timedTextStructureRequested(source, texts)) return emptyTimedTextStructurePlan();
    // 空行表示用户清空了对应字幕；纯文本视图不再保留空字幕行，直接将其视为删除标记。
    const lineEntries = U.timedTextDraftLineEntries(texts)
      .filter((entry) => String(entry.text).trim() !== '');
    const lines = lineEntries.map((entry) => entry.text);

    const sourceTokens = source.map((segment) => U.timedTextTokens(segment?.text));
    const sourceOffsets = [];
    let totalCharacters = 0;
    sourceTokens.forEach((tokens) => {
      sourceOffsets.push({ start: totalCharacters, end: totalCharacters + tokens.length });
      totalCharacters += tokens.length;
    });
    if (!totalCharacters) return emptyTimedTextStructurePlan('当前字幕没有可用于拆分的文字。');
    const flattenedSource = sourceTokens.flat();
    const lineTokens = lines.map((line) => U.timedTextTokens(line));
    const lineRanges = [];
    let exactCursor = 0;
    let exact = true;
    for (const tokens of lineTokens) {
      const start = findTimedTextTokenSequence(flattenedSource, tokens, exactCursor);
      if (start < 0) {
        exact = false;
        break;
      }
      lineRanges.push({ start, end: start + tokens.length });
      exactCursor = start + tokens.length;
    }

    let mode = 'exact';
    if (exact) {
      const gaps = [];
      let previous = 0;
      lineRanges.forEach((range) => {
        if (range.start > previous) gaps.push({ start: previous, end: range.start });
        previous = range.end;
      });
      if (previous < totalCharacters) gaps.push({ start: previous, end: totalCharacters });
      const boundaries = new Set([0, ...sourceOffsets.flatMap((range) => [range.start, range.end])]);
      if (gaps.some((gap) => (
        (!boundaries.has(gap.start) || !boundaries.has(gap.end))
        && !U.timedTextRangeIsWhitespace(flattenedSource, gap)
      ))) {
        return emptyTimedTextStructurePlan('删除字幕时只能删除完整字幕行，不能只删除其中一部分文字。');
      }
    } else {
      // 某些前面的句子被改写后，仍尝试从后面的未改文字建立锚点。
      // 锚点之间的新增/改写区域只允许走字幕段级估算，不能再按原始 index 猜。
      const anchors = Array.from({ length: lineTokens.length }, () => null);
      // 不再按草稿顺序贪心地拿每一个“看起来能匹配”的片段。一个较短的
      // 内部片段可能会抢先消耗真正属于后面字幕的文字，之后所有行只能按
      // 比例估算，最终表现为“一句错、句句错”。先收集全局候选，再选择一组
      // 顺序一致且尽量覆盖完整原字幕的锚点，让未改字幕优先成为稳定边界。
      const selectedAnchors = selectTimedTextAnchors(flattenedSource, lineTokens, sourceOffsets);
      selectedAnchors.forEach((anchor) => {
        anchors[anchor.lineIndex] = { start: anchor.start, end: anchor.end };
      });
      const anchorCount = selectedAnchors.length;
      if (!anchorCount) {
        return emptyTimedTextStructurePlan('无法根据原文重新匹配拆句结果；请保留至少一段未改文字作为匹配锚点。');
      }
      mode = 'anchor';
      let previousLineIndex = -1;
      let previousSourceEnd = 0;
      const anchorIndexes = anchors
        .map((anchor, index) => (anchor ? index : -1))
        .filter((index) => index >= 0);
      for (const nextLineIndex of [...anchorIndexes, lineTokens.length]) {
        const nextAnchor = nextLineIndex < lineTokens.length ? anchors[nextLineIndex] : null;
        const sourceEnd = nextAnchor?.start ?? totalCharacters;
        const missingIndexes = [];
        for (let index = previousLineIndex + 1; index < nextLineIndex; index += 1) {
          if (!anchors[index]) missingIndexes.push(index);
        }
        const targetLength = missingIndexes.reduce((sum, index) => sum + lineTokens[index].length, 0);
        const sourceLength = sourceEnd - previousSourceEnd;
        if (missingIndexes.length && (targetLength <= 0 || sourceLength <= 0)) {
          return emptyTimedTextStructurePlan('无法根据原文重新匹配拆句结果；改写区域缺少可用时间范围。');
        }
        let targetOffset = 0;
        missingIndexes.forEach((index) => {
          const start = previousSourceEnd + Math.round((sourceLength * targetOffset) / targetLength);
          targetOffset += lineTokens[index].length;
          const end = previousSourceEnd + Math.round((sourceLength * targetOffset) / targetLength);
          if (end <= start) {
            lineRanges.length = 0;
            return;
          }
          lineRanges[index] = { start, end };
        });
        if (nextAnchor) {
          lineRanges[nextLineIndex] = nextAnchor;
          previousLineIndex = nextLineIndex;
          previousSourceEnd = nextAnchor.end;
        } else {
          previousLineIndex = lineTokens.length - 1;
          previousSourceEnd = totalCharacters;
        }
      }
      if (lineRanges.length !== lineTokens.length || lineRanges.some((range) => !range)) {
        return emptyTimedTextStructurePlan('无法根据原文重新匹配拆句结果；请减少连续改写的字幕行。');
      }
    }

    const layouts = source.map((segment) => U.timedTextItemLayout(segment?.text, segment?.items));
    const outputSegments = [];
    const outputMeta = [];
    const sourceOutputIndexes = Array.from({ length: source.length }, () => []);
    let previousOutputEnd = null;
    for (const [outputIndex, range] of lineRanges.entries()) {
      const overlaps = sourceOffsets
        .map((sourceRange, sourceIndex) => ({ sourceRange, sourceIndex }))
        .filter(({ sourceRange }) => range.start < sourceRange.end && range.end > sourceRange.start);
      if (!overlaps.length) return emptyTimedTextStructurePlan('无法找到新字幕对应的原始时间范围。');

      const first = overlaps[0].sourceIndex;
      const last = overlaps[overlaps.length - 1].sourceIndex;
      const firstLocal = range.start - sourceOffsets[first].start;
      const lastLocal = range.end - sourceOffsets[last].start;
      const isWholeUnchangedSource = overlaps.length === 1
        && firstLocal === 0
        && lastLocal === sourceTokens[first].length
        && lines[outputIndex] === String(source[first]?.text || '');
      let items = null;
      let timingEstimated = false;
      if (isWholeUnchangedSource) {
        // 末尾多出的空行等不会改变字幕结构；没有字词时间码时也可以安全地保留这个无变化行。
        items = Array.isArray(source[first]?.items) ? U.cloneJsonValue(source[first].items) : null;
      } else {
        const originalItems = [];
        let canReuseItems = true;
        for (const { sourceRange, sourceIndex } of overlaps) {
          const localStart = Math.max(0, range.start - sourceRange.start);
          const localEnd = Math.min(sourceRange.end - sourceRange.start, range.end - sourceRange.start);
          if (localStart >= localEnd) continue;
          if (!layouts[sourceIndex]) {
            canReuseItems = false;
            break;
          }
          const slice = U.timedTextItemsSlice(layouts[sourceIndex], localStart, localEnd);
          if (!slice?.length) {
            canReuseItems = false;
            break;
          }
          originalItems.push(...slice);
        }
        items = canReuseItems ? U.retimeTimedTextSlice(originalItems, lines[outputIndex]) : null;
        if (!items?.length || !U.timedTextItemsOrdered(items)) {
          // 没有完整字词时间码时仍允许拆句，但只生成字幕段级时间范围，
          // 并在报告中明确标记为按范围/字数估算，绝不伪造精确 items。
          items = null;
          timingEstimated = true;
        }
      }
      let start = items?.length
        ? (firstLocal === 0 ? Number(source[first]?.start) : Number(items[0].start))
        : U.timedTextSegmentBoundary(source[first], firstLocal, sourceTokens[first].length);
      let end = items?.length
        ? (lastLocal === sourceTokens[last].length
          ? Number(source[last]?.end) : Number(items[items.length - 1].end))
        : U.timedTextSegmentBoundary(source[last], lastLocal, sourceTokens[last].length);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        timingEstimated = true;
        start = Number.isFinite(previousOutputEnd) ? previousOutputEnd : 0;
        end = start + U.timedTextEstimatedDuration(lines[outputIndex]);
      } else if (timingEstimated) {
        if (Number.isFinite(previousOutputEnd) && start < previousOutputEnd) start = previousOutputEnd;
        end = Math.max(end, start + U.TIMED_TEXT_ESTIMATED_MIN_MS);
      }
      const nextSourceStart = Number(source[last + 1]?.start);
      if (timingEstimated && Number.isFinite(nextSourceStart)) {
        if (start >= nextSourceStart) {
          return emptyTimedTextStructurePlan('自动估算的字幕时间范围没有足够空间，不能越过下一条字幕的开头。');
        }
        end = Math.min(end, nextSourceStart);
        if (end - start < U.TIMED_TEXT_ESTIMATED_MIN_MS) {
          return emptyTimedTextStructurePlan('自动估算的字幕时间范围不足 100ms，且不能越过下一条字幕的开头。');
        }
      }
      if (end <= start) {
        return emptyTimedTextStructurePlan('拆句后产生了无效的字幕时间范围。');
      }
      const segment = U.cloneJsonValue(source[first] || {});
      segment.start = start;
      segment.end = end;
      segment.text = lines[outputIndex];
      if (!isWholeUnchangedSource) {
        if (items?.length) segment.items = items;
        else delete segment.items;
      }
      outputSegments.push(segment);
      outputMeta.push({
        sourceIndexes: overlaps.map(({ sourceIndex }) => sourceIndex),
        range,
        timingEstimated,
        draftIndex: lineEntries[outputIndex]?.draftIndex,
      });
      overlaps.forEach(({ sourceIndex }) => sourceOutputIndexes[sourceIndex].push(outputIndex));
      previousOutputEnd = end;
    }

    const usedSegments = [...source];
    outputMeta.forEach((meta, outputIndex) => {
      const sourceIndex = meta.sourceIndexes[0];
      const sourceSegment = source[sourceIndex] || {};
      const sourceRange = sourceOffsets[sourceIndex];
      const firstOutputForSource = sourceOutputIndexes[sourceIndex][0] === outputIndex;
      const canKeepSourceId = firstOutputForSource && meta.range.start === sourceRange.start;
      if (canKeepSourceId && sourceSegment.id) {
        outputSegments[outputIndex].id = sourceSegment.id;
      } else {
        const baseId = `${sourceSegment.id || `segment-${sourceIndex + 1}`}-text-${outputIndex + 1}`;
        outputSegments[outputIndex].id = U.uniqueStableSegmentId(usedSegments, baseId, 'segment');
      }
      usedSegments.push(outputSegments[outputIndex]);
      if (sourceSegment.sticker && !firstOutputForSource) {
        outputSegments[outputIndex].sticker = null;
        outputSegments[outputIndex].sticker_ref = {
          name: sourceSegment.sticker.name,
          headIdx: sourceOutputIndexes[sourceIndex][0],
        };
      }
      if (sourceSegment.color && !firstOutputForSource) {
        outputSegments[outputIndex].color = null;
        outputSegments[outputIndex].color_ref = {
          name: sourceSegment.color.name,
          headIdx: sourceOutputIndexes[sourceIndex][0],
        };
      }
    });

    const affectedSourceIndexes = [];
    sourceOutputIndexes.forEach((outputIndexes, sourceIndex) => {
      if (outputIndexes.length !== 1) {
        affectedSourceIndexes.push(sourceIndex);
        return;
      }
      const meta = outputMeta[outputIndexes[0]];
      const range = sourceOffsets[sourceIndex];
      const output = outputSegments[outputIndexes[0]];
      if (meta.sourceIndexes.length !== 1
          || meta.range.start !== range.start
          || meta.range.end !== range.end
          || output.text !== source[sourceIndex]?.text) affectedSourceIndexes.push(sourceIndex);
    });

    const removedSourceIndexes = sourceOutputIndexes
      .map((outputIndexes, sourceIndex) => outputIndexes.length ? -1 : sourceIndex)
      .filter((index) => index >= 0);
    const hasSplit = sourceOutputIndexes.some((indexes) => indexes.length > 1);
    const hasMerge = outputMeta.some((meta) => meta.sourceIndexes.length > 1);
    const hasDelete = removedSourceIndexes.length > 0;
    const type = [hasSplit ? 'split' : '', hasMerge ? 'merge' : '', hasDelete ? 'delete' : '']
      .filter(Boolean).join('+');
    return {
      valid: true,
      type: type || 'resegment',
      error: '',
      mode,
      segments: outputSegments,
      outputMeta,
      sourceOutputIndexes,
      affectedSourceIndexes,
      removedSourceIndexes,
    };
  }

  function sameTimedTextTokens(left, right) {
    return left.length === right.length && left.every((token, index) => token === right[index]);
  }

  function hasTimedTextContent(tokens) {
    return tokens.some((token) => token.trim() !== '');
  }

  function timedTextStructureSourceSlice(source, range) {
    const sourceSegments = Array.isArray(source) ? source : [];
    const requestedStart = Math.max(0, Math.round(Number(range?.start) || 0));
    const requestedEnd = Math.max(requestedStart, Math.round(Number(range?.end) || 0));
    const textParts = [];
    const items = [];
    let offset = 0;
    sourceSegments.forEach((segment) => {
      const tokens = U.timedTextTokens(segment?.text);
      const sourceStart = offset;
      const sourceEnd = offset + tokens.length;
      offset = sourceEnd;
      const localStart = Math.max(0, requestedStart - sourceStart);
      const localEnd = Math.min(tokens.length, requestedEnd - sourceStart);
      if (localStart >= localEnd) return;
      textParts.push(tokens.slice(localStart, localEnd).join(''));
      const layout = U.timedTextItemLayout(segment?.text, segment?.items);
      if (layout) {
        const sliced = U.timedTextItemsSlice(layout, localStart, localEnd);
        if (sliced) items.push(...sliced);
      }
    });
    return { text: textParts.join(''), items };
  }

  function buildTimedTextStructureReport(source, texts, plan) {
    const outputRows = plan.segments.map((output, outputIndex) => {
      const meta = plan.outputMeta[outputIndex] || { sourceIndexes: [], range: null };
      const sourceSlice = timedTextStructureSourceSlice(source, meta.range);
      const sourceIndexes = Array.isArray(meta.sourceIndexes) ? meta.sourceIndexes : [];
      const structural = sourceIndexes.some((index) => plan.affectedSourceIndexes.includes(index))
        || sourceIndexes.length !== 1;
      // 结构拆分时，每个输出行只对应原字幕的一段时间范围，但“修改前”
      // 应该展示用户实际拆分的整条原字幕，而不是展示与“修改后”相同的切片。
      // 例如「超高速摄影机」拆成「超高速」/「摄影机」时，两行都以整句为 before。
      const fullSourceText = sourceIndexes
        .map((index) => String(source[index]?.text == null ? '' : source[index].text))
        .join('');
      const before = structural && fullSourceText ? fullSourceText : sourceSlice.text;
      const after = String(output?.text || '');
      const mappingStatus = structural
        ? 'structure'
        : U.reconcileTimedTextItems(before, sourceSlice.items, after).status;
      const coverage = U.timedTextItemCoverage(after, output?.items);
      const reuse = U.timedTextItemReuse(
        before,
        sourceSlice.items,
        after,
        output?.items,
        before === after ? 'full' : mappingStatus,
      );
      return {
        index: outputIndex,
        draftIndex: meta.draftIndex,
        sourceIndexes,
        before,
        after,
        changed: before !== after || structural,
        deleted: false,
        structureChanged: structural,
        diff: U.buildTimedTextDiff(before, after),
        mappingStatus,
        beforeItemCount: sourceSlice.items.length,
        afterItemCount: Array.isArray(output?.items) ? output.items.length : 0,
        preservedItems: Array.isArray(output?.items) ? output.items.length : 0,
        affectedItems: Array.isArray(output?.items) ? output.items.length : 0,
        items: output?.items,
        itemCoverage: coverage.percent,
        itemCoverageData: coverage,
        itemReuse: reuse.percent,
        itemReuseData: reuse,
        beforeStart: sourceSlice.items[0]?.start ?? Number(output?.start),
        beforeEnd: sourceSlice.items[sourceSlice.items.length - 1]?.end ?? Number(output?.end),
        afterStart: Number(output?.start),
        afterEnd: Number(output?.end),
        timingChanged: structural,
        timingEstimated: meta.timingEstimated === true,
      };
    });
    const rows = source.map((segment, index) => {
      const outputIndexes = plan.sourceOutputIndexes[index] || [];
      const outputs = outputIndexes.map((outputIndex) => plan.segments[outputIndex]).filter(Boolean);
      const before = String(segment?.text == null ? '' : segment.text);
      const after = outputs.map((output) => String(output?.text || '')).join('');
      const affected = plan.affectedSourceIndexes.includes(index);
      const diff = U.buildTimedTextDiff(before, after);
      const items = outputs.flatMap((output) => Array.isArray(output?.items) ? output.items : []);
      const mappingStatus = affected ? 'structure' : U.reconcileTimedTextItems(before, segment?.items, after).status;
      const coverage = U.timedTextItemCoverage(after, items);
      const reuse = U.timedTextItemReuse(
        before, segment?.items, after, items, mappingStatus,
      );
      const firstOutput = outputs[0];
      const lastOutput = outputs[outputs.length - 1];
      const afterStart = firstOutput ? Number(firstOutput.start) : Number(segment?.start);
      const afterEnd = lastOutput ? Number(lastOutput.end) : Number(segment?.end);
      return {
        index,
        before,
        after,
        displayAfter: outputs.map((output) => String(output?.text || '')).join('\n'),
        changed: before !== after || affected,
        deleted: Boolean(before.trim() && !after.trim()),
        structureChanged: affected,
        diff,
        mappingStatus,
        beforeItemCount: Array.isArray(segment?.items) ? segment.items.length : 0,
        afterItemCount: items.length,
        preservedItems: items.length,
        affectedItems: items.length,
        items,
        itemCoverage: coverage.percent,
        itemCoverageData: coverage,
        itemReuse: reuse.percent,
        itemReuseData: reuse,
        beforeStart: Number(segment?.start),
        beforeEnd: Number(segment?.end),
        afterStart,
        afterEnd,
        timingChanged: affected
          || afterStart !== Number(segment?.start) || afterEnd !== Number(segment?.end),
      };
    });
    const changedRows = rows.filter((row) => row.changed);
    const stats = {
      ...U.buildTimedTextEditReportFixed(source, source.map((segment) => segment?.text || '')).stats,
      totalSegments: source.length,
      changedSegments: changedRows.length,
      unchangedSegments: rows.length - changedRows.length,
      beforeCharacters: rows.reduce((sum, row) => sum + U.timedTextTokens(row.before).length, 0),
      afterCharacters: rows.reduce((sum, row) => sum + U.timedTextTokens(row.after).length, 0),
      addedCharacters: changedRows.reduce((sum, row) => sum + row.diff.addedCharacters, 0),
      removedCharacters: changedRows.reduce((sum, row) => sum + row.diff.removedCharacters, 0),
      fullMappedCues: changedRows.filter((row) => row.mappingStatus === 'full').length,
      partialMappedCues: changedRows.filter((row) => row.mappingStatus === 'partial').length,
      lostMappedCues: changedRows.filter((row) => row.mappingStatus === 'lost').length,
      unavailableMappedCues: changedRows.filter((row) => row.mappingStatus === 'unavailable').length,
      boundaryMappedCues: 0,
      boundaryMoves: 0,
      timingChangedCues: rows.filter((row) => row.timingChanged).length,
      preservedItems: changedRows.reduce((sum, row) => sum + row.preservedItems, 0),
      affectedItems: changedRows.reduce((sum, row) => sum + row.affectedItems, 0),
      structureMappedCues: changedRows.filter((row) => row.mappingStatus === 'structure').length,
      estimatedTimingCues: outputRows.filter((row) => row.timingEstimated).length,
    };
    return {
      valid: true,
      rows,
      changedRows,
      stats,
      boundaryMoves: [],
      structure: plan,
      previewSegments: plan.segments,
      outputRows,
    };
  }

  Object.assign(U, {
    emptyTimedTextStructurePlan,
    findTimedTextTokenSequence,
    findTimedTextTokenSequences,
    findTimedTextNeutralAwareSequences,
    timedTextAnchorCandidates,
    selectTimedTextAnchors,
    buildTimedTextStructurePlan,
    sameTimedTextTokens,
    hasTimedTextContent,
    timedTextStructureSourceSlice,
    buildTimedTextStructureReport,
  });
})(typeof window !== 'undefined' ? window : globalThis);
