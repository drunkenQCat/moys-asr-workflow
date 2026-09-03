// 带时间字幕的边界方案与落盘：diff opcode、边界计划、条目对账与脏标记。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibTimedTextBoundary(global) {
  'use strict';

  const U = global.MaweLib;

  function detectTimedTextBoundaryMoves(segments, draftTexts) {
    const source = Array.isArray(segments) ? segments : [];
    const texts = Array.isArray(draftTexts) ? draftTexts : [];
    if (source.length !== texts.length) return [];
    const candidates = [];

    // 当前字幕的开头移到上一条末尾：上一条新增的尾巴必须完整来自当前字幕开头。
    for (let index = 1; index < source.length; index += 1) {
      const previousBefore = U.timedTextTokens(source[index - 1]?.text);
      const previousAfter = U.timedTextTokens(texts[index - 1]);
      const currentBefore = U.timedTextTokens(source[index]?.text);
      if (previousAfter.length <= previousBefore.length) continue;
      const moved = previousAfter.slice(previousBefore.length);
      if (!U.hasTimedTextContent(moved)
          || !U.sameTimedTextTokens(previousAfter.slice(0, previousBefore.length), previousBefore)
          || !U.sameTimedTextTokens(currentBefore.slice(0, moved.length), moved)) continue;
      candidates.push({
        type: 'prefix-to-previous',
        sourceIndex: index,
        targetIndex: index - 1,
        movedTokens: moved,
      });
    }

    // 当前字幕的结尾移到下一条开头：下一条新增的开头必须完整来自当前字幕结尾。
    for (let index = 0; index < source.length - 1; index += 1) {
      const currentBefore = U.timedTextTokens(source[index]?.text);
      const nextBefore = U.timedTextTokens(source[index + 1]?.text);
      const nextAfter = U.timedTextTokens(texts[index + 1]);
      if (nextAfter.length <= nextBefore.length) continue;
      const moved = nextAfter.slice(0, nextAfter.length - nextBefore.length);
      if (!U.hasTimedTextContent(moved)
          || !U.sameTimedTextTokens(nextAfter.slice(moved.length), nextBefore)
          || !U.sameTimedTextTokens(currentBefore.slice(currentBefore.length - moved.length), moved)) continue;
      candidates.push({
        type: 'suffix-to-next',
        sourceIndex: index,
        targetIndex: index + 1,
        movedTokens: moved,
      });
    }
    return candidates;
  }

  function timedTextItemsOrdered(items) {
    let previousStart = -Infinity;
    let previousEnd = -Infinity;
    return (items || []).every((item) => {
      const start = Number(item?.start);
      const end = Number(item?.end);
      const valid = Number.isFinite(start) && Number.isFinite(end)
        && end >= start && start >= previousStart && start >= previousEnd && end >= previousEnd;
      if (valid) {
        previousStart = start;
        previousEnd = end;
      }
      return valid;
    });
  }

  // 逐条字幕通常很短，用 LCS 生成字符级 diff 足够可靠；过大的单条文本
  // 走保守兜底，避免编辑器因构造过大的二维表而卡住。
  function timedTextDiffOpcodes(sourceTokens, targetTokens) {
    const sourceLength = sourceTokens.length;
    const targetLength = targetTokens.length;
    const columns = targetLength + 1;
    const cellCount = (sourceLength + 1) * columns;
    if (cellCount > 2000000) return null;

    const table = new Uint32Array(cellCount);
    for (let sourceIndex = sourceLength - 1; sourceIndex >= 0; sourceIndex -= 1) {
      const row = sourceIndex * columns;
      const nextRow = (sourceIndex + 1) * columns;
      for (let targetIndex = targetLength - 1; targetIndex >= 0; targetIndex -= 1) {
        table[row + targetIndex] = sourceTokens[sourceIndex] === targetTokens[targetIndex]
          ? table[nextRow + targetIndex + 1] + 1
          : Math.max(table[nextRow + targetIndex], table[row + targetIndex + 1]);
      }
    }

    const opcodes = [];
    let sourcePosition = 0;
    let targetPosition = 0;
    let pendingSourceStart = null;
    let pendingTargetStart = null;
    const flushChanged = () => {
      if (pendingSourceStart === null) return;
      opcodes.push({
        tag: 'replace',
        sourceStart: pendingSourceStart,
        sourceEnd: sourcePosition,
        targetStart: pendingTargetStart,
        targetEnd: targetPosition,
      });
      pendingSourceStart = null;
      pendingTargetStart = null;
    };
    const appendEqual = () => {
      const previous = opcodes[opcodes.length - 1];
      if (previous?.tag === 'equal'
          && previous.sourceEnd === sourcePosition
          && previous.targetEnd === targetPosition) {
        previous.sourceEnd += 1;
        previous.targetEnd += 1;
      } else {
        opcodes.push({
          tag: 'equal',
          sourceStart: sourcePosition,
          sourceEnd: sourcePosition + 1,
          targetStart: targetPosition,
          targetEnd: targetPosition + 1,
        });
      }
    };

    while (sourcePosition < sourceLength && targetPosition < targetLength) {
      if (sourceTokens[sourcePosition] === targetTokens[targetPosition]) {
        flushChanged();
        appendEqual();
        sourcePosition += 1;
        targetPosition += 1;
        continue;
      }
      if (pendingSourceStart === null) {
        pendingSourceStart = sourcePosition;
        pendingTargetStart = targetPosition;
      }
      const skipSource = table[(sourcePosition + 1) * columns + targetPosition];
      const skipTarget = table[sourcePosition * columns + targetPosition + 1];
      if (skipSource >= skipTarget) sourcePosition += 1;
      else targetPosition += 1;
    }
    if (pendingSourceStart === null && (sourcePosition < sourceLength || targetPosition < targetLength)) {
      pendingSourceStart = sourcePosition;
      pendingTargetStart = targetPosition;
    }
    sourcePosition = sourceLength;
    targetPosition = targetLength;
    flushChanged();
    return opcodes;
  }

  function emptyTimedTextBoundaryPlan(source) {
    return {
      transfers: [],
      updates: Array.from({ length: source.length }, () => null),
    };
  }

  function buildTimedTextBoundaryPlan(segments, draftTexts) {
    const source = Array.isArray(segments) ? segments : [];
    const texts = Array.isArray(draftTexts) ? draftTexts : [];
    if (source.length !== texts.length) return emptyTimedTextBoundaryPlan(source);
    const candidates = detectTimedTextBoundaryMoves(source, texts);
    if (!candidates.length) return emptyTimedTextBoundaryPlan(source);

    const prefixCounts = Array.from({ length: source.length }, () => 0);
    const suffixCounts = Array.from({ length: source.length }, () => 0);
    const incomingPrefixes = Array.from({ length: source.length }, () => null);
    const incomingSuffixes = Array.from({ length: source.length }, () => null);
    for (const candidate of candidates) {
      const movedLength = candidate.movedTokens.length;
      if (candidate.type === 'prefix-to-previous') {
        if (prefixCounts[candidate.sourceIndex] || incomingSuffixes[candidate.targetIndex]) {
          return emptyTimedTextBoundaryPlan(source);
        }
        prefixCounts[candidate.sourceIndex] = movedLength;
        incomingSuffixes[candidate.targetIndex] = candidate;
      } else {
        if (suffixCounts[candidate.sourceIndex] || incomingPrefixes[candidate.targetIndex]) {
          return emptyTimedTextBoundaryPlan(source);
        }
        suffixCounts[candidate.sourceIndex] = movedLength;
        incomingPrefixes[candidate.targetIndex] = candidate;
      }
    }

    const partitions = Array.from({ length: source.length }, () => null);
    const affectedIndexes = new Set();
    candidates.forEach((candidate) => {
      affectedIndexes.add(candidate.sourceIndex);
      affectedIndexes.add(candidate.targetIndex);
    });

    for (const index of affectedIndexes) {
      const beforeTokens = U.timedTextTokens(source[index]?.text);
      const prefixCount = prefixCounts[index];
      const suffixCount = suffixCounts[index];
      if (prefixCount + suffixCount > beforeTokens.length) {
        return emptyTimedTextBoundaryPlan(source);
      }
      const layout = U.timedTextItemLayout(source[index]?.text, source[index]?.items);
      if (!layout) return emptyTimedTextBoundaryPlan(source);
      const partition = U.timedTextItemsPartition(layout, prefixCount, suffixCount);
      if (!partition) {
        return emptyTimedTextBoundaryPlan(source);
      }
      partitions[index] = { layout, ...partition };
    }

    for (const candidate of candidates) {
      const partition = partitions[candidate.sourceIndex];
      candidate.movedItems = candidate.type === 'prefix-to-previous'
        ? U.cloneJsonValue(partition.prefix)
        : U.cloneJsonValue(partition.suffix);
      if (!candidate.movedItems.length
          || candidate.movedItems.map((item) => item.text).join('') !== candidate.movedTokens.join('')) {
        return emptyTimedTextBoundaryPlan(source);
      }
    }

    for (const index of affectedIndexes) {
      const beforeTokens = U.timedTextTokens(source[index]?.text);
      const prefixTokens = incomingPrefixes[index]?.movedTokens || [];
      const suffixTokens = incomingSuffixes[index]?.movedTokens || [];
      const bodyTokens = beforeTokens.slice(prefixCounts[index], beforeTokens.length - suffixCounts[index]);
      const expectedTokens = [...prefixTokens, ...bodyTokens, ...suffixTokens];
      if (!U.sameTimedTextTokens(expectedTokens, U.timedTextTokens(texts[index]))) {
        return emptyTimedTextBoundaryPlan(source);
      }

      const partition = partitions[index];
      const incomingPrefixItems = incomingPrefixes[index]?.movedItems || [];
      const incomingSuffixItems = incomingSuffixes[index]?.movedItems || [];
      const nextItems = [
        ...U.cloneJsonValue(incomingPrefixItems),
        ...U.cloneJsonValue(partition.body),
        ...U.cloneJsonValue(incomingSuffixItems),
      ];
      if ((expectedTokens.length && !nextItems.length)
          || nextItems.map((item) => item.text).join('') !== expectedTokens.join('')
          || !timedTextItemsOrdered(nextItems)) {
        return emptyTimedTextBoundaryPlan(source);
      }

      const segment = source[index];
      let start = Number(segment?.start);
      let end = Number(segment?.end);
      if (nextItems.length) {
        if (prefixCounts[index] || prefixTokens.length) start = Number(nextItems[0].start);
        if (suffixCounts[index] || suffixTokens.length) end = Number(nextItems[nextItems.length - 1].end);
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return emptyTimedTextBoundaryPlan(source);
      }
      partitions[index].update = {
        text: texts[index],
        items: nextItems,
        start,
        end,
      };
    }

    const updates = Array.from({ length: source.length }, () => null);
    affectedIndexes.forEach((index) => { updates[index] = partitions[index].update; });
    return {
      transfers: candidates.map((candidate) => ({
        type: candidate.type,
        sourceIndex: candidate.sourceIndex,
        targetIndex: candidate.targetIndex,
        movedText: candidate.movedTokens.join(''),
        movedItemCount: candidate.movedItems.length,
      })),
      updates,
    };
  }

  function reconcileTimedTextItems(originalText, rawItems, newText) {
    if (!Array.isArray(rawItems) || !rawItems.length) {
      return { status: 'unavailable', items: null, preservedItems: 0, affectedItems: 0 };
    }
    const layout = U.timedTextItemLayout(originalText, rawItems);
    if (!layout) {
      const items = Array.isArray(rawItems) ? U.cloneJsonValue(rawItems) : [];
      return { status: 'lost', items: null, preservedItems: 0, affectedItems: items.length };
    }
    const { items, spans } = layout;
    if (originalText === newText) {
      return { status: 'full', items, preservedItems: items.length, affectedItems: 0 };
    }

    const originalTokens = U.timedTextTokens(originalText);
    const newTokens = U.timedTextTokens(newText);
    const neutralItems = U.timedTextNeutralInsertionItems(originalText, layout, newText);
    if (neutralItems) {
      return {
        status: 'partial',
        items: neutralItems,
        preservedItems: items.length,
        affectedItems: 0,
      };
    }
    // 等长改字是最可靠的错别字修正场景：按原 item 的字符长度重新分配文字，
    // 直接保留每个 item 的时间范围。
    if (originalTokens.length === newTokens.length) {
      let offset = 0;
      items.forEach((item, index) => {
        const length = spans[index].end - spans[index].start;
        item.text = newTokens.slice(offset, offset + length).join('');
        offset += length;
      });
      return { status: 'full', items, preservedItems: items.length, affectedItems: 0 };
    }

    const opcodes = timedTextDiffOpcodes(originalTokens, newTokens);
    if (!opcodes) {
      return { status: 'lost', items: null, preservedItems: 0, affectedItems: items.length };
    }
    const unchanged = opcodes.reduce((total, opcode) => (
      opcode.tag === 'equal' ? total + opcode.sourceEnd - opcode.sourceStart : total
    ), 0);
    const comparableLength = Math.max(1, Math.min(originalTokens.length, newTokens.length));
    const changedOriginal = originalTokens.length - unchanged;
    const changedTarget = newTokens.length - unchanged;
    const sourceFullyAnchored = unchanged === originalTokens.length;
    if (
      unchanged === 0
      || (!sourceFullyAnchored && unchanged < Math.max(1, Math.round(comparableLength * 0.25)))
      || (!sourceFullyAnchored && changedOriginal > originalTokens.length * 0.75)
      || (!sourceFullyAnchored && changedTarget > newTokens.length * 0.75)
    ) {
      return { status: 'lost', items: null, preservedItems: 0, affectedItems: items.length };
    }

    const affectedIndexes = new Set();
    const parentIndexes = Array.from({ length: items.length }, (_, index) => index);
    const findParent = (index) => {
      let root = index;
      while (parentIndexes[root] !== root) root = parentIndexes[root];
      while (parentIndexes[index] !== index) {
        const next = parentIndexes[index];
        parentIndexes[index] = root;
        index = next;
      }
      return root;
    };
    const unionItems = (left, right) => {
      const leftRoot = findParent(left);
      const rightRoot = findParent(right);
      if (leftRoot === rightRoot) return;
      parentIndexes[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
    };
    const indexesForSourceRange = (sourceStart, sourceEnd) => (
      sourceStart < sourceEnd
        ? spans
          .map((span, index) => ({ span, index }))
          .filter(({ span }) => span.end > sourceStart && span.start < sourceEnd)
          .map(({ index }) => index)
        : []
    );
    const insertionItemIndex = (position) => {
      if (position <= spans[0].start) return 0;
      const lastIndex = spans.length - 1;
      if (position >= spans[lastIndex].end) return lastIndex;
      for (let index = 0; index < spans.length; index += 1) {
        const span = spans[index];
        if (span.start < position && position < span.end) return index;
        // 插入在 item 边界时归到前一个 item，避免无关的后一个 item 也被合并。
        if (position === span.start) return Math.max(0, index - 1);
      }
      return lastIndex;
    };
    opcodes.forEach((opcode) => {
      if (opcode.tag === 'equal') return;
      const indexes = indexesForSourceRange(opcode.sourceStart, opcode.sourceEnd);
      if (!indexes.length) {
        const index = insertionItemIndex(opcode.sourceStart);
        if (Number.isInteger(index)) indexes.push(index);
      }
      indexes.forEach((index) => affectedIndexes.add(index));
      for (let index = 1; index < indexes.length; index += 1) {
        unionItems(indexes[0], indexes[index]);
      }
    });
    if (!affectedIndexes.size) {
      return { status: 'lost', items: null, preservedItems: 0, affectedItems: items.length };
    }

    const componentsByRoot = new Map();
    affectedIndexes.forEach((index) => {
      const root = findParent(index);
      const component = componentsByRoot.get(root);
      if (component) {
        component.start = Math.min(component.start, index);
        component.end = Math.max(component.end, index);
      } else {
        componentsByRoot.set(root, { start: index, end: index });
      }
    });
    const components = [...componentsByRoot.values()];
    const componentIds = new Map();
    [...componentsByRoot.keys()].forEach((root, componentId) => {
      componentIds.set(root, componentId);
    });
    const itemOwnerKey = (index) => {
      const componentId = componentIds.get(findParent(index));
      return componentId === undefined ? `item:${index}` : `affected:${componentId}`;
    };

    const targetKeys = [];
    for (const opcode of opcodes) {
      if (opcode.tag === 'equal') {
        for (let sourceIndex = opcode.sourceStart; sourceIndex < opcode.sourceEnd; sourceIndex += 1) {
          const itemIndex = spans.findIndex((span) => span.start <= sourceIndex && sourceIndex < span.end);
          if (itemIndex < 0) {
            return { status: 'lost', items: null, preservedItems: 0, affectedItems: items.length };
          }
          targetKeys.push(itemOwnerKey(itemIndex));
        }
        continue;
      }
      if (opcode.targetStart >= opcode.targetEnd) continue;
      const indexes = indexesForSourceRange(opcode.sourceStart, opcode.sourceEnd);
      if (!indexes.length) {
        const index = insertionItemIndex(opcode.sourceStart);
        if (Number.isInteger(index)) indexes.push(index);
      }
      if (!indexes.length) {
        return { status: 'lost', items: null, preservedItems: 0, affectedItems: items.length };
      }
      const ownerKey = itemOwnerKey(indexes[0]);
      for (let targetIndex = opcode.targetStart; targetIndex < opcode.targetEnd; targetIndex += 1) {
        targetKeys.push(ownerKey);
      }
    }

    const runs = [];
    targetKeys.forEach((key, index) => {
      const previous = runs[runs.length - 1];
      if (previous?.key === key) previous.end = index + 1;
      else runs.push({ key, start: index, end: index + 1 });
    });
    const usedKeys = new Set();
    const reconciled = [];
    for (const run of runs) {
      if (usedKeys.has(run.key)) {
        return { status: 'lost', items: null, preservedItems: 0, affectedItems: items.length };
      }
      usedKeys.add(run.key);
      const text = newTokens.slice(run.start, run.end).join('');
      if (!text) continue;
      let item;
      if (run.key.startsWith('item:')) {
        item = U.cloneJsonValue(items[Number(run.key.slice(5))]);
      } else {
        const component = components[Number(run.key.slice(9))];
        item = U.cloneJsonValue(items[component.start]);
        item.start = items[component.start].start;
        item.end = items[component.end].end;
      }
      item.text = text;
      reconciled.push(item);
    }
    if (reconciled.length && reconciled.map((item) => item.text).join('') === newText) {
      return {
        status: 'partial',
        items: reconciled,
        preservedItems: reconciled.length,
        affectedItems: affectedIndexes.size,
      };
    }
    return { status: 'lost', items: null, preservedItems: 0, affectedItems: items.length };
  }

  function buildTimedTextEditReportFixed(segments, draftTexts) {
    const source = Array.isArray(segments) ? segments : [];
    const texts = Array.isArray(draftTexts) ? draftTexts : [];
    const valid = source.length === texts.length;
    const boundaryPlan = buildTimedTextBoundaryPlan(source, texts);
    const rows = source.map((segment, index) => {
      const before = String(segment?.text == null ? '' : segment.text);
      const after = String(texts[index] == null ? '' : texts[index]);
      const diff = U.buildTimedTextDiff(before, after);
      const boundary = boundaryPlan.updates[index];
      const mapping = boundary
        ? {
          status: 'boundary',
          items: boundary.items,
          preservedItems: boundary.items.length,
          affectedItems: boundary.items.length,
        }
        : reconcileTimedTextItems(before, segment?.items, after);
      const afterStart = boundary ? boundary.start : Number(segment?.start);
      const afterEnd = boundary ? boundary.end : Number(segment?.end);
      const coverage = U.timedTextItemCoverage(after, mapping.items);
      const reuse = U.timedTextItemReuse(
        before, segment?.items, after, mapping.items, mapping.status,
      );
      return {
        index,
        before,
        after,
        changed: before !== after,
        deleted: Boolean(before.trim() && !after.trim()),
        diff,
        mappingStatus: mapping.status,
        beforeItemCount: Array.isArray(segment?.items) ? segment.items.length : 0,
        afterItemCount: mapping.items?.length || 0,
        preservedItems: mapping.preservedItems,
        affectedItems: mapping.affectedItems,
        items: mapping.items,
        itemCoverage: coverage.percent,
        itemCoverageData: coverage,
        itemReuse: reuse.percent,
        itemReuseData: reuse,
        beforeStart: Number(segment?.start),
        beforeEnd: Number(segment?.end),
        afterStart,
        afterEnd,
        timingChanged: afterStart !== Number(segment?.start) || afterEnd !== Number(segment?.end),
      };
    });
    const changedRows = rows.filter((row) => row.changed);
    const stats = {
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
      boundaryMappedCues: changedRows.filter((row) => row.mappingStatus === 'boundary').length,
      boundaryMoves: boundaryPlan.transfers.length,
      timingChangedCues: rows.filter((row) => row.timingChanged).length,
      preservedItems: changedRows.reduce((sum, row) => sum + row.preservedItems, 0),
      affectedItems: changedRows.reduce((sum, row) => sum + row.affectedItems, 0),
    };
    return { valid, rows, changedRows, stats, boundaryMoves: boundaryPlan.transfers };
  }

  function buildTimedTextEditReport(segments, draftTexts) {
    const source = Array.isArray(segments) ? segments : [];
    const texts = Array.isArray(draftTexts) ? draftTexts : [];
    if (U.timedTextStructureRequested(source, texts)) {
      const plan = U.buildTimedTextStructurePlan(source, texts);
      if (plan.valid) return U.buildTimedTextStructureReport(source, texts, plan);
      return {
        ...buildTimedTextEditReportFixed(source, texts),
        structure: plan,
        previewSegments: [],
      };
    }
    return buildTimedTextEditReportFixed(source, texts);
  }

  function timedTextEditComparableSegment(segment) {
    const comparable = U.cloneJsonValue(segment || {});
    if (comparable && typeof comparable === 'object') delete comparable._dirty;
    return comparable;
  }

  function timedTextEditSegmentsEquivalent(sourceSegment, outputSegment) {
    return JSON.stringify(timedTextEditComparableSegment(sourceSegment))
      === JSON.stringify(timedTextEditComparableSegment(outputSegment));
  }

  // 结构编辑会返回一组新的 segments，但不能因此把所有输出行都标成 dirty。
  // 只有内容/时间范围/结构确实发生变化的输出，或来自本来就 dirty 的来源行，
  // 才应继续显示 dirty；原样保留的一对一字幕沿用来源行的 dirty 状态。
  function timedTextEditDirtyFlags(sourceSegments, nextSegments, report) {
    const source = Array.isArray(sourceSegments) ? sourceSegments : [];
    const next = Array.isArray(nextSegments) ? nextSegments : [];
    const structure = report?.structure?.valid === true ? report.structure : null;
    if (!structure) {
      return next.map((segment, index) => {
        const sourceSegment = source[index];
        const row = report?.rows?.[index];
        if (!sourceSegment || row?.changed || row?.timingChanged) return true;
        return sourceSegment._dirty === true;
      });
    }

    const affectedSourceIndexes = new Set(structure.affectedSourceIndexes || []);
    const sourceOutputIndexes = Array.isArray(structure.sourceOutputIndexes)
      ? structure.sourceOutputIndexes : [];
    return next.map((segment, outputIndex) => {
      const meta = structure.outputMeta?.[outputIndex];
      const sourceIndexes = Array.isArray(meta?.sourceIndexes) ? meta.sourceIndexes : [];
      const sourceIndex = sourceIndexes.length === 1 ? sourceIndexes[0] : -1;
      const sourceSegment = sourceIndex >= 0 ? source[sourceIndex] : null;
      const outputIndexes = sourceIndex >= 0 ? sourceOutputIndexes[sourceIndex] || [] : [];
      const unchanged = Boolean(sourceSegment)
        && sourceIndexes.length === 1
        && outputIndexes.length === 1
        && outputIndexes[0] === outputIndex
        && !affectedSourceIndexes.has(sourceIndex)
        && timedTextEditSegmentsEquivalent(sourceSegment, segment);
      return unchanged ? sourceSegment._dirty === true : true;
    });
  }

  function applyTimedTextEdit(segments, draftTexts) {
    const source = Array.isArray(segments) ? segments : [];
    const texts = Array.isArray(draftTexts) ? draftTexts : [];
    if (U.timedTextStructureRequested(source, texts)) {
      const structurePlan = U.buildTimedTextStructurePlan(source, texts);
      return structurePlan.valid ? U.cloneJsonValue(structurePlan.segments) : null;
    }
    if (source.length !== texts.length) return null;
    const boundaryPlan = buildTimedTextBoundaryPlan(source, texts);
    return source.flatMap((segment, index) => {
      const next = U.cloneJsonValue(segment || {});
      const before = String(next.text == null ? '' : next.text);
      const after = String(texts[index] == null ? '' : texts[index]);
      if (before === after) return next;
      if (!after) return [];
      const boundary = boundaryPlan.updates[index];
      if (boundary) {
        next.text = after;
        next.start = boundary.start;
        next.end = boundary.end;
        if (boundary.items.length) next.items = U.cloneJsonValue(boundary.items);
        else delete next.items;
        return next;
      }
      const mapping = reconcileTimedTextItems(before, next.items, after);
      next.text = after;
      if (mapping.status === 'full' || mapping.status === 'partial') next.items = mapping.items;
      else if (mapping.status === 'lost') delete next.items;
      return next;
    });
  }

  Object.assign(U, {
    detectTimedTextBoundaryMoves,
    timedTextItemsOrdered,
    timedTextDiffOpcodes,
    emptyTimedTextBoundaryPlan,
    buildTimedTextBoundaryPlan,
    reconcileTimedTextItems,
    buildTimedTextEditReportFixed,
    buildTimedTextEditReport,
    timedTextEditComparableSegment,
    timedTextEditSegmentsEquivalent,
    timedTextEditDirtyFlags,
    applyTimedTextEdit,
  });
})(typeof window !== 'undefined' ? window : globalThis);
