// 字幕时刻的快照与计划/应用：共享边界、独立边、整条移动。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformCueTiming(global) {
  'use strict';

  const U = global.MaweWaveform;

  function applySharedBoundary(segments, leftIndex, boundary, minDuration = U.MIN_CUE_MS) {
    const left = segments[leftIndex];
    const right = segments[leftIndex + 1];
    if (!left || !right) return segments;
    const lower = left.start + minDuration;
    const upper = right.end - minDuration;
    const nextBoundary = U.clamp(U.roundMs(boundary), lower, upper);
    const oldLeftEnd = left.end;
    const oldRightStart = right.start;
    left.end = nextBoundary;
    right.start = nextBoundary;
    left.items = U.remapItems(left.items, left.start, oldLeftEnd, left.start, nextBoundary);
    right.items = U.remapItems(right.items, oldRightStart, right.end, nextBoundary, right.end);
    return segments;
  }

  // Alt-drag a shared resize handle moves ONLY the hit side, leaving the
  // neighboring segment's opposite edge untouched. This is the independent
  // counterpart to applySharedBoundary, which moves both sides linked.
  // edge === 'end' moves segments[leftIndex].end; 'start' moves
  // segments[leftIndex + 1].start. The moved edge is clamped to keep at
  // least minDuration inside its own segment and not cross its other edge.
  function applyIndependentEdge(segments, leftIndex, edge, valueMs, minDuration = U.MIN_CUE_MS) {
    const left = segments[leftIndex];
    const right = segments[leftIndex + 1];
    if (!left || !right || (edge !== 'end' && edge !== 'start')) return segments;
    const value = U.roundMs(valueMs);
    if (edge === 'end') {
      const lower = left.start + minDuration;
      // 右侧字幕保持不动；使用它的起点作为固定上限，不能把当前值
      // 当作上限，否则边界第一次向左拉开后就无法再向右回拖。
      const upper = Number.isFinite(right.start) ? right.start : Infinity;
      const next = U.clamp(value, lower, upper);
      const oldEnd = left.end;
      left.end = next;
      left.items = U.remapItems(left.items, left.start, oldEnd, left.start, next);
    } else {
      const upper = right.end - minDuration;
      // 左侧字幕保持不动；使用它的终点作为固定下限，同样允许边界
      // 在拉开后反向回到邻字幕边界。
      const lower = Number.isFinite(left.end) ? left.end : 0;
      const next = U.clamp(value, lower, upper);
      const oldStart = right.start;
      right.start = next;
      right.items = U.remapItems(right.items, oldStart, right.end, next, right.end);
    }
    return segments;
  }

  function snapshotTiming(segment) {
    return {
      start: Number(segment.start),
      end: Number(segment.end),
      items: Array.isArray(segment.items)
        ? segment.items.map((item) => ({ ...item })) : segment.items,
    };
  }

  function isAttached(left, right) {
    return !!left && !!right && Number(left.end) === Number(right.start);
  }

  function shouldAdjustAdjacentCuesIndependently(altKey, autoSnapAdjacentCues) {
    // Alt 始终临时反转自动吸附开关；开关关闭且未按 Alt 时也是独立调整。
    return Boolean(altKey) === Boolean(autoSnapAdjacentCues);
  }

  function normalizedIndices(segments, indices) {
    return [...new Set(Array.from(indices || [])
      .map((idx) => Number(idx))
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < segments.length))]
      .sort((a, b) => a - b);
  }

  // Keyboard movement is a small, discrete counterpart to moving a waveform
  // block. When adjacent-cue auto snapping is active and the selected range is
  // attached to a neighboring cue, the shared boundary follows the moved
  // range. The Alt modifier temporarily reverses that choice.
  function planMoveStep(segments, indices, deltaMs, durationMs, {
    sticky = true,
    minDuration = U.MIN_CUE_MS,
  } = {}) {
    const selectedIndices = normalizedIndices(segments, indices);
    if (!selectedIndices.length) {
      return { changed: false, appliedDelta: 0, indices: [], affectedIndices: [] };
    }
    const selected = new Set(selectedIndices);
    const originals = new Map(selectedIndices.map((idx) => [idx, snapshotTiming(segments[idx])]));
    const attachments = [];
    const attachmentOriginals = new Map();
    const previousAttachments = [];
    const previousAttachmentOriginals = new Map();
    let minDelta = -Infinity;
    let maxDelta = Infinity;
    const timelineDuration = Number(durationMs);

    for (const idx of selectedIndices) {
      const original = originals.get(idx);
      minDelta = Math.max(minDelta, -original.start);
      if (Number.isFinite(timelineDuration) && timelineDuration > 0) {
        maxDelta = Math.min(maxDelta, timelineDuration - original.end);
      }
      const previous = segments[idx - 1];
      if (previous && !selected.has(idx - 1)) {
        if (sticky && isAttached(previous, segments[idx])) {
          const previousOriginal = snapshotTiming(previous);
          previousAttachments.push({ index: idx, previousIndex: idx - 1 });
          previousAttachmentOriginals.set(idx - 1, previousOriginal);
          minDelta = Math.max(minDelta, previousOriginal.start + minDuration - original.start);
        } else {
          minDelta = Math.max(minDelta, Number(previous.end) - original.start);
        }
      }
      const next = segments[idx + 1];
      if (!next || selected.has(idx + 1)) continue;
      if (sticky && isAttached(segments[idx], next)) {
        const nextOriginal = snapshotTiming(next);
        attachments.push({ index: idx, nextIndex: idx + 1 });
        attachmentOriginals.set(idx + 1, nextOriginal);
        // The next cue's start follows the selected cue's end, so its end
        // and minimum duration limit how far the shared boundary can move.
        maxDelta = Math.min(maxDelta, nextOriginal.end - minDuration - original.end);
      } else {
        // An unlinked following cue stays fixed and may not be overlapped.
        maxDelta = Math.min(maxDelta, Number(next.start) - original.end);
      }
    }

    const requested = Number(deltaMs);
    const rounded = Number.isFinite(requested) ? U.roundMs(requested) : 0;
    const appliedDelta = U.clamp(rounded, minDelta, maxDelta);
    const affectedIndices = [...selectedIndices];
    attachments.forEach(({ nextIndex }) => affectedIndices.push(nextIndex));
    previousAttachments.forEach(({ previousIndex }) => affectedIndices.push(previousIndex));
    return {
      changed: appliedDelta !== 0,
      appliedDelta,
      indices: selectedIndices,
      affectedIndices: [...new Set(affectedIndices)].sort((a, b) => a - b),
      originals,
      attachments,
      attachmentOriginals,
      previousAttachments,
      previousAttachmentOriginals,
    };
  }

  function applyMoveStep(segments, indices, deltaMs, durationMs, options = {}) {
    const plan = planMoveStep(segments, indices, deltaMs, durationMs, options);
    if (!plan.changed) return plan;
    const delta = plan.appliedDelta;
    plan.indices.forEach((idx) => {
      const original = plan.originals.get(idx);
      const segment = segments[idx];
      segment.start = original.start + delta;
      segment.end = original.end + delta;
      if (Array.isArray(original.items)) {
        segment.items = original.items.map((item) => ({
          ...item,
          start: item.start + delta,
          end: item.end + delta,
        }));
      }
    });
    plan.attachments.forEach(({ nextIndex }) => {
      const original = plan.attachmentOriginals.get(nextIndex);
      const segment = segments[nextIndex];
      segment.start = original.start + delta;
      segment.items = U.remapItems(original.items, original.start, original.end, segment.start, segment.end);
    });
    plan.previousAttachments.forEach(({ previousIndex }) => {
      const original = plan.previousAttachmentOriginals.get(previousIndex);
      const segment = segments[previousIndex];
      segment.end = original.end + delta;
      segment.items = U.remapItems(original.items, original.start, original.end, segment.start, segment.end);
    });
    return plan;
  }

  function planBoundaryStep(segments, index, edge, deltaMs, durationMs, {
    sticky = true,
    minDuration = U.MIN_CUE_MS,
  } = {}) {
    const target = segments[index];
    if (!target || (edge !== 'start' && edge !== 'end')) {
      return { changed: false, appliedDelta: 0, indices: [], affectedIndices: [] };
    }
    const previous = segments[index - 1];
    const next = segments[index + 1];
    const linkedNeighbor = edge === 'start'
      ? (sticky && isAttached(previous, target) ? previous : null)
      : (sticky && isAttached(target, next) ? next : null);
    const current = edge === 'start' ? Number(target.start) : Number(target.end);
    const requested = Number(deltaMs);
    const rounded = Number.isFinite(requested) ? U.roundMs(requested) : 0;
    let lower;
    let upper;
    if (edge === 'start') {
      lower = linkedNeighbor ? Number(previous.start) + minDuration : Number(previous?.end ?? 0);
      upper = Number(target.end) - minDuration;
    } else {
      lower = Number(target.start) + minDuration;
      upper = linkedNeighbor
        ? Number(next.end) - minDuration
        : Number(next?.start ?? durationMs);
      if (!Number.isFinite(upper) || upper <= 0) upper = Infinity;
    }
    const appliedDelta = U.clamp(current + rounded, lower, upper) - current;
    const affectedIndices = linkedNeighbor
      ? [index, edge === 'start' ? index - 1 : index + 1].sort((a, b) => a - b)
      : [index];
    const snapshots = new Map(affectedIndices.map((idx) => [idx, snapshotTiming(segments[idx])]));
    return {
      changed: appliedDelta !== 0,
      appliedDelta,
      index,
      edge,
      linked: !!linkedNeighbor,
      neighborIndex: linkedNeighbor ? (edge === 'start' ? index - 1 : index + 1) : -1,
      affectedIndices,
      snapshots,
    };
  }

  function applyBoundaryStep(segments, index, edge, deltaMs, durationMs, options = {}) {
    const plan = planBoundaryStep(segments, index, edge, deltaMs, durationMs, options);
    if (!plan.changed) return plan;
    const target = segments[plan.index];
    const oldTarget = plan.snapshots.get(plan.index);
    const value = (plan.edge === 'start' ? oldTarget.start : oldTarget.end) + plan.appliedDelta;
    if (plan.edge === 'start') {
      target.start = value;
      target.items = U.remapItems(oldTarget.items, oldTarget.start, oldTarget.end, target.start, target.end);
      if (plan.linked) {
        const previous = segments[plan.neighborIndex];
        const oldPrevious = plan.snapshots.get(plan.neighborIndex);
        previous.end = value;
        previous.items = U.remapItems(oldPrevious.items, oldPrevious.start, oldPrevious.end, previous.start, previous.end);
      }
    } else {
      target.end = value;
      target.items = U.remapItems(oldTarget.items, oldTarget.start, oldTarget.end, target.start, target.end);
      if (plan.linked) {
        const next = segments[plan.neighborIndex];
        const oldNext = plan.snapshots.get(plan.neighborIndex);
        next.start = value;
        next.items = U.remapItems(oldNext.items, oldNext.start, oldNext.end, next.start, next.end);
      }
    }
    return plan;
  }

  Object.assign(U, {
    applySharedBoundary,
    applyIndependentEdge,
    snapshotTiming,
    isAttached,
    shouldAdjustAdjacentCuesIndependently,
    normalizedIndices,
    planMoveStep,
    applyMoveStep,
    planBoundaryStep,
    applyBoundaryStep,
  });
})(typeof window !== 'undefined' ? window : globalThis);
