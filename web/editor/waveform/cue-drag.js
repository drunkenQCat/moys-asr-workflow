// 字幕拖动与改边：移动、缩放、共享边界与结束提交。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformCueDrag(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    beginCueDrag(event, index, row, track = 'main') {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      // 字幕块会阻止 pointerdown 冒泡到 pane；主动接管焦点，确保按住
      // 字幕块/边界后，左手 A/D 不会仍被设置输入框等控件拦截。
      this.focusWaveform();
      // Ctrl(Cmd)+点击字幕仍保留多选；只有真正移动形成拖动时才视为
      // “在已有字幕上创建”，并直接拒绝，不启动普通字幕拖动或创建预览。
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        return this.beginBlockedCueCreateDrag(event, index, track);
      }
      // 剃刀工具：无修饰键左键点击字幕块（非手柄）时，在指针位置安全拆分。
      // 修饰键（Alt/Ctrl(Cmd)/Shift）仍走原行为，便于拆分后立即多选/禁用。
      const targetHandle = event.target.closest('.waveform-cue-handle');
      const adjacentCueAdjustmentIndependent = this.isAdjacentCueAdjustmentIndependent(event.altKey);
      if (track === 'main' && this.tool === 'razor' && !targetHandle
          && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const timeMs = this.timeFromPointer(event, row);
        this.options.splitCueAtTime?.(index, timeMs);
        return;
      }
      // 相邻字幕独立调整：命中共享边界手柄时拆开为单侧拖动；Alt 会
      // 根据“自动吸附调整相邻字幕”开关临时反转这一模式。
      if (adjacentCueAdjustmentIndependent && targetHandle) {
        const sharedLeft = targetHandle.classList.contains('left')
          && index > 0 && this.isSharedBoundary(event, index - 1, index, row, track);
        const sharedRight = targetHandle.classList.contains('right')
          && index + 1 < this.options.getSegments(track).length
          && this.isSharedBoundary(event, index, index + 1, row, track);
        if (sharedLeft || sharedRight) {
          return this.beginIndependentEdgeDrag(event, index, row, targetHandle, track);
        }
      }
      // Ctrl(Cmd)+click toggles selection without starting a drag
      if (event.ctrlKey || event.metaKey) {
        if (track === 'extension') this.options.toggleExtensionSelection?.(index);
        else this.options.toggleCueSelection?.(index);
        return;
      }
      // Shift+click selects a range from lastClickedIdx to index
      if (event.shiftKey) {
        if (track === 'extension') this.options.selectExtensionRange?.(index);
        else this.options.selectCueRange?.(index);
        return;
      }
      let boundaryIndex = index;
      const kind = targetHandle?.classList.contains('left')
        ? (index > 0 && this.isSharedBoundary(event, index - 1, index, row, track)
          ? (boundaryIndex = index - 1, 'resize-boundary') : 'resize-left')
        : targetHandle?.classList.contains('right')
          ? (index + 1 < this.options.getSegments(track).length && this.isSharedBoundary(event, index, index + 1, row, track)
            ? 'resize-boundary' : 'resize-right')
          : 'move';
      // 选中字幕会更新列表、面板以及波形块状态；其中任一步都可能触发
      // 虚拟行重建。先保存按下瞬间的几何数据，避免 pointerup 使用已脱离
      // DOM 的旧行并把比例钳到该行末尾（也就是下一行开头）。
      const geometry = this.captureRowGeometry(row);
      const selected = this.options.getSelection(track);
      if (!selected.has(index)) {
        if (track === 'extension') this.options.selectExtensionCue?.(index);
        else this.options.selectCue(index);
      } else if (track === 'extension') {
        this.options.activateExtensionCue?.(index);
      } else {
        this.options.activateCue?.(index);
      }
      const liveSelection = this.options.getSelection(track);
      const indices = kind === 'move' && liveSelection.has(index)
        ? [...liveSelection].sort((a, b) => a - b) : [index];
      const segments = this.options.getSegments(track);
      const dragIndices = kind === 'resize-boundary' ? [boundaryIndex, boundaryIndex + 1] : indices;
      const originals = new Map(dragIndices.map((idx) => [idx, {
        start: segments[idx].start,
        end: segments[idx].end,
        items: Array.isArray(segments[idx].items)
          ? segments[idx].items.map((item) => ({ ...item })) : segments[idx].items,
      }]));
      const cancelIndices = new Set(dragIndices);
      if (kind === 'move') {
        dragIndices.forEach((idx) => {
          if (segments[idx - 1] && U.isAttached(segments[idx - 1], segments[idx])) cancelIndices.add(idx - 1);
          if (segments[idx + 1] && U.isAttached(segments[idx], segments[idx + 1])) cancelIndices.add(idx + 1);
        });
      }
      const allOriginals = kind === 'move'
        ? new Map(segments.map((segment, idx) => [idx, U.snapshotTiming(segment)]))
        : null;
      const cancelOriginals = new Map([...cancelIndices].map((idx) => [idx, U.snapshotTiming(segments[idx])]));
      if (allOriginals) {
        allOriginals.forEach((original, idx) => cancelOriginals.set(idx, original));
      }
      this.drag = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        currentClientX: event.clientX,
        rangeMs: geometry.endMs - geometry.startMs,
        rowWidth: geometry.width,
        geometry,
        kind,
        track,
        index: kind === 'resize-boundary' ? boundaryIndex : index,
        indices: dragIndices,
        row,
        originals,
        cancelOriginals,
        commitIndices: new Set(dragIndices),
        started: false,
        changed: false,
        // Alt+副字幕拖动临时解除主副联动；Alt+主字幕拖动仍带着绑定的
        // 副字幕一起走，但允许先挤压主轨相邻字幕。
        independent: Boolean(event.altKey && track === 'extension'),
        allowSqueeze: false,
        squeezeOriginals: allOriginals,
        altToggleDisabledOnClick: Boolean(
          event.altKey && !targetHandle
            && !event.shiftKey && !event.ctrlKey && !event.metaKey,
        ),
        seekedOnPointerDown: false,
      };
      event.currentTarget.classList.add('dragging');
      this.pane.classList.add('cue-drag-active');
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
      window.addEventListener('pointermove', this._dragMove = (moveEvent) => this.moveCueDrag(moveEvent));
      window.addEventListener('pointerup', this._dragEnd = (upEvent) => this.endCueDrag(upEvent), { once: true });
      window.addEventListener('pointercancel', this._dragEnd, { once: true });

      // 普通字幕块点击的跳转与波形空白区保持一致：在按下时立即移动播放头。
      // 只有普通 move 点击进入此路径；修饰键和边界手柄仍只执行选择/拖动操作。
      const clickBehavior = this.options.getClickBehavior?.();
      if (kind === 'move' && clickBehavior !== 'select-only' && !event.altKey) {
        this.seekFromCue(event, row, index, clickBehavior === 'select-and-play', geometry, track);
        this.drag.seekedOnPointerDown = true;
      }
    },

    isSharedBoundary(event, leftIndex, rightIndex, row, track = 'main') {
      const segments = this.options.getSegments(track);
      const left = segments[leftIndex];
      const right = segments[rightIndex];
      if (!left || !right || Math.abs(left.end - right.start) > U.SNAP_MS) return false;
      const pointerMs = this.timeFromPointer(event, row);
      return Math.abs(pointerMs - left.end) <= U.SNAP_MS || Math.abs(pointerMs - right.start) <= U.SNAP_MS;
    },

    // Alt-drag 命中共享边界手柄：只拖动被命中一侧，邻居的相反边保持不动。
    // 默认（非 Alt）拖动共享边界会把两侧一起联动；本方法是该联动的独立拆开版本。
    beginIndependentEdgeDrag(event, index, row, targetHandle, track = 'main') {
      const segments = this.options.getSegments(track);
      const isLeftHandle = targetHandle.classList.contains('left');
      // left 手柄命中 index-1|index 共享边界 → 移动 index 段的 start；
      // right 手柄命中 index|index+1 共享边界 → 移动 index 段的 end。
      const movedIndex = isLeftHandle ? index : index;
      const edge = isLeftHandle ? 'start' : 'end';
      const dragIndex = isLeftHandle ? index - 1 : index; // 左侧段索引，用于 applyIndependentEdge
      const originals = new Map([[movedIndex, {
        start: segments[movedIndex].start,
        end: segments[movedIndex].end,
        items: Array.isArray(segments[movedIndex].items)
          ? segments[movedIndex].items.map((item) => ({ ...item })) : segments[movedIndex].items,
      }]]);
      const geometry = this.captureRowGeometry(row);
      this.drag = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        currentClientX: event.clientX,
        rangeMs: geometry.endMs - geometry.startMs,
        rowWidth: geometry.width,
        geometry,
        kind: 'resize-boundary-independent',
        track,
        index: movedIndex,
        edge,
        dragIndex,
        indices: [movedIndex],
        row,
        originals,
        cancelOriginals: new Map([[movedIndex, U.snapshotTiming(segments[movedIndex])]]),
        commitIndices: new Set([movedIndex]),
        started: false,
        changed: false,
        independent: true,
      };
      event.currentTarget.classList.add('dragging');
      this.pane.classList.add('cue-drag-active');
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
      window.addEventListener('pointermove', this._dragMove = (moveEvent) => this.moveCueDrag(moveEvent));
      window.addEventListener('pointerup', this._dragEnd = (upEvent) => this.endCueDrag(upEvent), { once: true });
      window.addEventListener('pointercancel', this._dragEnd, { once: true });
    },

    cueDragDurationMs() {
      return Number(this.durationMs) > 0 ? Number(this.durationMs) : Infinity;
    },

    captureCueDragOriginals(drag) {
      const segments = this.options.getSegments(drag.track || 'main');
      drag.originals = new Map(drag.indices.map((idx) => [idx, U.snapshotTiming(segments[idx])]));
    },

    cancelCueDrag() {
      if (this.createCueDrag?.finish) {
        this.createCueDrag.finish(false);
        this.setStatus('已取消新增字幕');
        return true;
      }
      const drag = this.drag;
      if (!drag) return false;
      window.removeEventListener('pointermove', this._dragMove);
      window.removeEventListener('pointerup', this._dragEnd);
      window.removeEventListener('pointercancel', this._dragEnd);
      const segments = this.options.getSegments(drag.track || 'main');
      drag.cancelOriginals.forEach((original, idx) => {
        const segment = segments[idx];
        if (!segment) return;
        segment.start = original.start;
        segment.end = original.end;
        segment.items = Array.isArray(original.items)
          ? original.items.map((item) => ({ ...item })) : original.items;
      });
      this.content.querySelectorAll('.waveform-cue-block.dragging')
        .forEach((block) => block.classList.remove('dragging'));
      this.pane.classList.remove('cue-drag-active');
      this.drag = null;
      this.refreshCueOverlay();
      this.setStatus('已取消字幕调整');
      return true;
    },

    applyIndependentBoundaryDrag(drag, rawDelta) {
      const segments = this.options.getSegments(drag.track);
      const original = drag.originals.get(drag.index);
      if (!original) return;
      const base = drag.edge === 'start' ? original.start : original.end;
      const value = base + rawDelta;
      U.applyIndependentEdge(segments, drag.dragIndex, drag.edge, value, U.MIN_CUE_MS);
      const seg = segments[drag.index];
      this.setStatus(`${drag.edge === 'start' ? '起点' : '终点'} ${U.formatCompact(drag.edge === 'start' ? seg.start : seg.end)}`);
    },

    moveCueDrag(event) {
      const drag = this.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      drag.currentClientX = event.clientX;
      const deltaMs = ((event.clientX - drag.startClientX) / drag.rowWidth) * drag.rangeMs;
      if (!drag.started && Math.abs(deltaMs) < 2) return;
      if (!drag.started) {
        drag.started = true;
        const label = drag.kind === 'move' ? '移动字幕时间'
          : drag.kind === 'resize-boundary-independent' ? '独立调整字幕边界'
          : '调整字幕边界';
        this.options.onBeginEdit(label);
      }
      // 一旦在本次拖动中进入相邻字幕独立模式，松开 Alt 也不要把已经
      // 调整过的字幕重新吸回邻居；下一次拖动再按设置决定默认模式。
      const adjacentCueAdjustmentIndependent = this.isAdjacentCueAdjustmentIndependent(event.altKey);
      if (drag.kind === 'move' && adjacentCueAdjustmentIndependent) drag.allowSqueeze = true;
      // 主字幕/副字幕绑定的独立调整仍只由 Alt 临时触发，不受同轨自动吸附开关影响。
      if (drag.track === 'extension' && event.altKey) drag.independent = true;
      const disableSnap = drag.independent === true;
      if (drag.kind === 'move') this.applyMoveDrag(drag, deltaMs, disableSnap, drag.allowSqueeze);
      else if (drag.kind === 'resize-boundary') this.applyBoundaryDrag(drag, deltaMs, drag.independent);
      else if (drag.kind === 'resize-boundary-independent') this.applyIndependentBoundaryDrag(drag, deltaMs);
      else this.applyResizeDrag(drag, deltaMs, drag.independent);
      this.options.syncBoundCueDrag?.(drag);
      drag.changed = true;
      this.scheduleRefreshCueBlocks();
    },

    applyMoveDrag(drag, rawDelta, disableSnap, allowSqueeze = false) {
      const segments = this.options.getSegments(drag.track);
      const moved = new Set(drag.indices);
      const originalFor = (idx) => drag.squeezeOriginals?.get(idx)
        || drag.originals.get(idx) || U.snapshotTiming(segments[idx]);
      const restoreSegment = (idx, original) => {
        const segment = segments[idx];
        if (!segment || !original) return;
        segment.start = original.start;
        segment.end = original.end;
        segment.items = Array.isArray(original.items)
          ? original.items.map((item) => ({ ...item })) : original.items;
      };
      if (allowSqueeze && drag.squeezeOriginals) {
        drag.squeezeOriginals.forEach((original, idx) => {
          if (!moved.has(idx)) restoreSegment(idx, original);
        });
      }
      let minDelta = -Infinity;
      let maxDelta = Infinity;
      for (const idx of drag.indices) {
        const original = drag.originals.get(idx);
        minDelta = Math.max(minDelta, -original.start);
        maxDelta = Math.min(maxDelta, this.durationMs - original.end);
        if (allowSqueeze) {
          let previousIndex = idx - 1;
          while (previousIndex >= 0 && moved.has(previousIndex)) previousIndex -= 1;
          if (previousIndex >= 0) {
            const previous = originalFor(previousIndex);
            minDelta = Math.max(minDelta, previous.start + U.MIN_CUE_MS - original.start);
          }
          let nextIndex = idx + 1;
          while (nextIndex < segments.length && moved.has(nextIndex)) nextIndex += 1;
          if (nextIndex < segments.length) {
            const next = originalFor(nextIndex);
            maxDelta = Math.min(maxDelta, next.end - U.MIN_CUE_MS - original.end);
          }
        } else {
          if (idx > 0 && !moved.has(idx - 1)) minDelta = Math.max(minDelta, segments[idx - 1].end - original.start);
          if (idx + 1 < segments.length && !moved.has(idx + 1)) {
            maxDelta = Math.min(maxDelta, segments[idx + 1].start - original.end);
          }
        }
      }
      let delta = rawDelta;
      if (!disableSnap) {
        const candidates = [];
        const playhead = this.currentTimeMs();
        const crossTrackTargets = this.options.getCrossTrackSnapTargets?.(drag.track) || [];
        for (const idx of drag.indices) {
          const original = drag.originals.get(idx);
          candidates.push(playhead - original.start, playhead - original.end);
          if (!allowSqueeze) {
            if (idx > 0 && !moved.has(idx - 1)) candidates.push(segments[idx - 1].end - original.start);
            if (idx + 1 < segments.length && !moved.has(idx + 1)) {
              candidates.push(segments[idx + 1].start - original.end);
            }
          }
          crossTrackTargets.forEach((target) => {
            candidates.push(target - original.start, target - original.end);
          });
        }
        const nearest = candidates.reduce((best, value) => (
          Math.abs(value - delta) < Math.abs(best - delta) ? value : best
        ), Infinity);
        if (Number.isFinite(nearest) && Math.abs(nearest - delta) <= U.SNAP_MS) delta = nearest;
      }
      delta = U.clamp(U.roundMs(delta), minDelta, maxDelta);
      for (const idx of drag.indices) {
        const original = drag.originals.get(idx);
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
      }
      if (allowSqueeze) {
        for (const idx of drag.indices) {
          const segment = segments[idx];
          let previousIndex = idx - 1;
          while (previousIndex >= 0 && moved.has(previousIndex)) previousIndex -= 1;
          if (previousIndex >= 0) {
            const previous = segments[previousIndex];
            const previousOriginal = originalFor(previousIndex);
            if (previous && previous.end > segment.start) {
              const nextEnd = Math.max(previousOriginal.start + U.MIN_CUE_MS, segment.start);
              if (nextEnd < previous.end) {
                previous.end = nextEnd;
                previous.items = U.remapItems(
                  previousOriginal.items,
                  previousOriginal.start,
                  previousOriginal.end,
                  previous.start,
                  previous.end,
                );
                drag.commitIndices.add(previousIndex);
              }
            }
          }
          let nextIndex = idx + 1;
          while (nextIndex < segments.length && moved.has(nextIndex)) nextIndex += 1;
          if (nextIndex < segments.length) {
            const next = segments[nextIndex];
            const nextOriginal = originalFor(nextIndex);
            if (next && segment.end > next.start) {
              const nextStart = Math.min(nextOriginal.end - U.MIN_CUE_MS, segment.end);
              if (nextStart > next.start) {
                next.start = nextStart;
                next.items = U.remapItems(
                  nextOriginal.items,
                  nextOriginal.start,
                  nextOriginal.end,
                  next.start,
                  next.end,
                );
                drag.commitIndices.add(nextIndex);
              }
            }
          }
        }
      }
      this.setStatus(`${allowSqueeze ? '挤压移动' : '移动'} ${drag.indices.length} 条 · ${delta >= 0 ? '+' : ''}${delta} ms`);
    },

    applyResizeDrag(drag, rawDelta, disableSnap) {
      const segments = this.options.getSegments(drag.track);
      const segment = segments[drag.index];
      const original = drag.originals.get(drag.index);
      let newStart = original.start;
      let newEnd = original.end;
      if (drag.kind === 'resize-left') {
        const lower = drag.index > 0 ? segments[drag.index - 1].end : 0;
        const upper = original.end - U.MIN_CUE_MS;
        newStart = original.start + rawDelta;
        if (!disableSnap) {
          const targets = [lower, this.currentTimeMs(), ...(
            this.options.getCrossTrackSnapTargets?.(drag.track) || []
          )];
          const nearest = targets.reduce((best, value) => (
            Math.abs(value - newStart) < Math.abs(best - newStart) ? value : best
          ), Infinity);
          if (Number.isFinite(nearest) && Math.abs(nearest - newStart) <= U.SNAP_MS) newStart = nearest;
        }
        newStart = U.clamp(U.roundMs(newStart), lower, upper);
      } else {
        const lower = original.start + U.MIN_CUE_MS;
        const upper = drag.index + 1 < segments.length ? segments[drag.index + 1].start : this.durationMs;
        newEnd = original.end + rawDelta;
        if (!disableSnap) {
          const targets = [upper, this.currentTimeMs(), ...(
            this.options.getCrossTrackSnapTargets?.(drag.track) || []
          )];
          const nearest = targets.reduce((best, value) => (
            Math.abs(value - newEnd) < Math.abs(best - newEnd) ? value : best
          ), Infinity);
          if (Number.isFinite(nearest) && Math.abs(nearest - newEnd) <= U.SNAP_MS) newEnd = nearest;
        }
        newEnd = U.clamp(U.roundMs(newEnd), lower, upper);
      }
      segment.start = newStart;
      segment.end = newEnd;
      segment.items = U.remapItems(original.items, original.start, original.end, newStart, newEnd);
      this.setStatus(`${U.formatCompact(newStart)} → ${U.formatCompact(newEnd)}`);
    },

    applyBoundaryDrag(drag, rawDelta, disableSnap) {
      const segments = this.options.getSegments(drag.track);
      const left = drag.originals.get(drag.index);
      const right = drag.originals.get(drag.index + 1);
      if (!left || !right) return;
      let boundary = left.end + rawDelta;
      const lower = left.start + U.MIN_CUE_MS;
      const upper = right.end - U.MIN_CUE_MS;
      if (!disableSnap) {
        const candidates = [this.currentTimeMs(), ...(
          this.options.getCrossTrackSnapTargets?.(drag.track) || []
        )];
        if (drag.index > 0) candidates.push(segments[drag.index - 1].end);
        if (drag.index + 2 < segments.length) candidates.push(segments[drag.index + 2].start);
        const nearest = candidates.reduce((best, value) => (
          Math.abs(value - boundary) < Math.abs(best - boundary) ? value : best
        ), Infinity);
        if (Number.isFinite(nearest) && Math.abs(nearest - boundary) <= U.SNAP_MS) boundary = nearest;
      }
      boundary = U.clamp(U.roundMs(boundary), lower, upper);
      const leftSegment = segments[drag.index];
      const rightSegment = segments[drag.index + 1];
      leftSegment.end = boundary;
      rightSegment.start = boundary;
      leftSegment.items = U.remapItems(left.items, left.start, left.end, left.start, boundary);
      rightSegment.items = U.remapItems(right.items, right.start, right.end, boundary, right.end);
      this.setStatus(`共享边界 ${U.formatCompact(boundary)} · ${this.adjacentSnapModeStatusHint()}`);
      // 吸附模式提示只挂在「共享边界」状态上：共享边界拖动正是自动吸附
      // 默认联动/独立两种模式的直接体现，Alt 可随时临时反转。
    },

    endCueDrag(event) {
      const drag = this.drag;
      if (!drag || event.pointerId !== drag.pointerId) return;
      window.removeEventListener('pointermove', this._dragMove);
      window.removeEventListener('pointerup', this._dragEnd);
      window.removeEventListener('pointercancel', this._dragEnd);
      this.content.querySelectorAll('.waveform-cue-block.dragging').forEach((block) => block.classList.remove('dragging'));
      this.pane.classList.remove('cue-drag-active');
      this.drag = null;
      if (event.type === 'pointercancel') {
        drag.cancelOriginals.forEach((original, idx) => {
          const segment = this.options.getSegments(drag.track || 'main')[idx];
          if (!segment) return;
          segment.start = original.start;
          segment.end = original.end;
          segment.items = Array.isArray(original.items)
            ? original.items.map((item) => ({ ...item })) : original.items;
        });
        this.refreshCueOverlay();
        return;
      }
      if (!drag.changed) {
        if (drag.altToggleDisabledOnClick) {
          this.options.toggleDisabled?.([drag.index], drag.track || 'main');
          return;
        }
        // select-only 只选中；两个跳转模式按设置跳到字幕开头或鼠标位置。
        const clickBehavior = this.options.getClickBehavior?.();
        if (clickBehavior !== 'select-only' && !drag.seekedOnPointerDown) {
          this.seekFromCue(event, drag.row, drag.index, clickBehavior === 'select-and-play', drag.geometry, drag.track);
        }
        return;
      }
      const commitIndices = [...(drag.commitIndices || drag.indices)];
      const segments = this.options.getSegments(drag.track || 'main');
      commitIndices.forEach((idx) => { if (segments[idx]) segments[idx]._dirty = true; });
      this.options.onCommitEdit(commitIndices, drag.kind, drag.track || 'main', drag.independent === true);
      this.refreshCueOverlay();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
