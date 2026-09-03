// 把草稿应用回段落：与隐藏字幕合并后重建 items 时序。
// 自 web/editor/text/timed-edit.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweText；
// 兼容出口 window.MaweTimedTextEdit 仍由 editor/text/timed-edit/compat-surface.js 统一组装。
(function initMaweTimedEditApply(global) {
  'use strict';

  const U = global.MaweText;



  function mergeTimedTextEditSegmentsWithHidden(
    allSourceSegments,
    sourceSegmentIndexes,
    nextSegments,
    report,
  ) {
    const all = Array.isArray(allSourceSegments) ? allSourceSegments : [];
    const visibleIndexes = Array.isArray(sourceSegmentIndexes) ? sourceSegmentIndexes : [];
    const outputBySourceIndex = new Map();
    const unassigned = [];
    const structural = report?.structure?.valid === true;
    const sourceIndexById = new Map();
    visibleIndexes.forEach((sourceIndex) => {
      const id = all[sourceIndex]?.id;
      if (id) sourceIndexById.set(id, sourceIndex);
    });
    const fixedOutputSourceIndexes = structural ? [] : (report?.rows || [])
      .map((row, index) => (row?.deleted ? -1 : index))
      .filter((index) => index >= 0);
    (nextSegments || []).forEach((segment, outputIndex) => {
      const sourceIndexes = structural
        ? report.structure.outputMeta?.[outputIndex]?.sourceIndexes
        : null;
      let sourceIndex = null;
      if (segment?.id && sourceIndexById.has(segment.id)) {
        sourceIndex = sourceIndexById.get(segment.id);
      } else {
        const visibleIndex = Number.isInteger(sourceIndexes?.[0])
          ? sourceIndexes[0] : (fixedOutputSourceIndexes[outputIndex] ?? outputIndex);
        sourceIndex = visibleIndexes[visibleIndex];
      }
      if (!Number.isInteger(sourceIndex)) {
        unassigned.push(segment);
        return;
      }
      const outputs = outputBySourceIndex.get(sourceIndex) || [];
      outputs.push(segment);
      outputBySourceIndex.set(sourceIndex, outputs);
    });

    const visibleSet = new Set(visibleIndexes);
    const merged = [];
    all.forEach((segment, sourceIndex) => {
      if (!visibleSet.has(sourceIndex)) {
        merged.push(JSON.parse(JSON.stringify(segment)));
        return;
      }
      (outputBySourceIndex.get(sourceIndex) || []).forEach((output) => merged.push(output));
    });
    // 正常的结构计划每个输出都应能追溯到至少一个可见来源行；保留兜底，
    // 避免异常数据被静默丢掉，且不影响默认的可见字幕编辑路径。
    unassigned.forEach((segment) => merged.push(segment));
    return merged;
  }



  function applyTimedTextEditSegments(
    kind,
    sourceSegments,
    targetSegments,
    nextSegments,
    report,
    texts,
    sourceSegmentIndexes = null,
  ) {
    const visibleSourceIndexes = Array.isArray(sourceSegmentIndexes)
      ? sourceSegmentIndexes : (sourceSegments || []).map((_, index) => index);
    const filtered = visibleSourceIndexes.length !== targetSegments.length
      || visibleSourceIndexes.some((sourceIndex, index) => sourceIndex !== index);
    const allSourceSegments = filtered ? targetSegments : sourceSegments;
    const publishedSegments = filtered
      ? mergeTimedTextEditSegmentsWithHidden(
        allSourceSegments,
        visibleSourceIndexes,
        nextSegments,
        report,
      )
      : nextSegments;
    const nextIds = new Set((nextSegments || []).map((segment) => segment?.id).filter(Boolean));
    const removedVisibleIndexes = new Set((sourceSegments || []).map((segment, index) => {
      if (segment?.id) return nextIds.has(segment.id) ? -1 : index;
      const row = report?.rows?.[index];
      return row?.changed && !String(row.after || '') ? index : -1;
    }).filter((index) => index >= 0));
    (report?.structure?.removedSourceIndexes || []).forEach((index) => removedVisibleIndexes.add(index));
    const removedIndexes = new Set([...removedVisibleIndexes]
      .map((index) => visibleSourceIndexes[index])
      .filter((index) => Number.isInteger(index)));
    const structureChanged = Boolean(report?.structure?.valid
      && (report.structure.affectedSourceIndexes?.length || nextSegments.length !== sourceSegments.length));
    if (!removedIndexes.size && !structureChanged) {
      targetSegments.splice(0, targetSegments.length, ...publishedSegments);
      return 0;
    }

    const removedIndexList = [...removedIndexes].sort((a, b) => a - b);
    const removeSet = new Set(removedIndexList);
    const removedIds = removedIndexList.map((index) => allSourceSegments[index]?.id).filter(Boolean);
    const affectedIndexes = new Set((report?.structure?.affectedSourceIndexes || [])
      .map((index) => visibleSourceIndexes[index])
      .filter((index) => Number.isInteger(index)));
    removedIndexList.forEach((index) => affectedIndexes.add(index));
    const affectedIds = [...affectedIndexes].map((index) => allSourceSegments[index]?.id).filter(Boolean);
    const pairedExtensionIndices = new Set();
    let extensionTrack = null;
    let bindingsChanged = false;

    if (kind === 'extension') {
      const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
      const beforeBindingCount = (multi.bindings || []).length;
      MaweMultiSubtitleCore.removeBindingsForSegmentIds([], affectedIds);
      bindingsChanged = (multi.bindings || []).length !== beforeBindingCount;
    } else {
      const multi = MaweMultiSubtitleCore.getMultiSubtitleState();
      extensionTrack = MaweMultiSubtitleCore.multiSubtitleVisible() && removedIds.length ? MaweMultiSubtitleCore.getActiveExtensionTrack() : null;
      if (extensionTrack) {
        (multi.bindings || []).forEach((binding) => {
          if (!binding.main_segment_ids?.some((id) => removedIds.includes(id))) return;
          (binding.extension_segment_ids || []).forEach((id) => {
            const index = extensionTrack.segments.findIndex((segment) => segment?.id === id);
            if (index >= 0) pairedExtensionIndices.add(index);
          });
        });
      }
      const beforeBindingCount = (multi.bindings || []).length;
      MaweMultiSubtitleCore.removeBindingsForSegmentIds(
        affectedIds,
        extensionTrack
          ? [...pairedExtensionIndices].map((index) => extensionTrack.segments[index]?.id)
          : [],
      );
      bindingsChanged = (multi.bindings || []).length !== beforeBindingCount;

      if (removedIndexList.length) {
        // 与删除字幕相同的分组语义：来源行离开后，颜色 / 表情包组在切点处拆开。
        MaweSegmentOps.splitGroupsAtCutPoints(removeSet, 'sticker', 'sticker_ref');
        MaweSegmentOps.splitGroupsAtCutPoints(removeSet, 'color', 'color_ref');
        MaweBoot.DATA.segments.forEach((segment, index) => {
          if (removeSet.has(index)) return;
          if (segment.sticker_ref && removeSet.has(segment.sticker_ref.headIdx)) {
            segment.sticker_ref = null;
          }
          if (segment.color_ref && removeSet.has(segment.color_ref.headIdx)) {
            segment.color_ref = null;
          }
        });
      }
    }

    // 结构发生变化后，旧下标选中态和字幕编辑面板都必须失效，避免渲染后指向相邻字幕。
    MaweSelection.clearSelection({ silent: true });
    MaweCuePanelState.currentCuePanelKind = 'main';
    MaweCuePanelState.currentCuePanelIdx = -1;
    MaweCuePanelState.currentCuePanelTrackId = null;
    MaweSelection.lastClickedIdx = -1;
    MaweSelection.lastClickedExtensionIdx = -1;
    MawePlaybackLoop.lastActive = -1;
    targetSegments.splice(0, targetSegments.length, ...publishedSegments);

    if (kind !== 'extension') {
      const shiftHeadIdx = (ref) => {
        let shift = 0;
        for (const removedIndex of removedIndexList) {
          if (removedIndex < ref.headIdx) shift += 1;
          else break;
        }
        if (shift) ref.headIdx -= shift;
      };
      MaweBoot.DATA.segments.forEach((segment) => {
        if (segment.sticker_ref) shiftHeadIdx(segment.sticker_ref);
        if (segment.color_ref) shiftHeadIdx(segment.color_ref);
      });
      window.AsrEditorUtils.repairGroupReferenceIndices(MaweBoot.DATA.segments);
      if (extensionTrack && pairedExtensionIndices.size) {
        [...pairedExtensionIndices].sort((a, b) => b - a)
          .forEach((index) => extensionTrack.segments.splice(index, 1));
      }
    }
    if (bindingsChanged || pairedExtensionIndices.size) MaweMultiSubtitleCore.markMultiSubtitleDirty();
    return removedIndexes.length;
  }

  Object.assign(U, {
    mergeTimedTextEditSegmentsWithHidden,
    applyTimedTextEditSegments,
  });
})(typeof window !== 'undefined' ? window : globalThis);
