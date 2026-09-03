// 键盘微调选中字幕的时刻与吸附边界。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformKeyboardAdjust(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    adjustSelectedByKeyboard(deltaMs, altKey = false, track = 'main') {
      const segments = this.options.getSegments(track);
      const indices = U.normalizedIndices(segments, this.options.getSelection?.(track));
      if (!indices.length) return false;
      const plan = U.planMoveStep(
        segments,
        indices,
        deltaMs,
        this.cueDragDurationMs(),
        { sticky: !this.isAdjacentCueAdjustmentIndependent(altKey) },
      );
      if (!plan.changed) return false;
      this.options.onBeginEdit?.('移动字幕时间');
      const result = U.applyMoveStep(
        segments,
        indices,
        deltaMs,
        this.cueDragDurationMs(),
        { sticky: !this.isAdjacentCueAdjustmentIndependent(altKey) },
      );
      result.affectedIndices.forEach((idx) => { segments[idx]._dirty = true; });
      this.options.onCommitEdit?.(result.indices, 'move', track);
      this.refreshCueOverlay();
      return true;
    },

    adjustSelectedBoundaryByKeyboard(deltaMs, edge, altKey = false, track = 'main') {
      const segments = this.options.getSegments(track);
      const indices = U.normalizedIndices(segments, this.options.getSelection?.(track));
      if (!indices.length || (edge !== 'start' && edge !== 'end')) return false;
      const index = edge === 'start' ? indices[0] : indices[indices.length - 1];
      const options = { sticky: !this.isAdjacentCueAdjustmentIndependent(altKey) };
      const plan = U.planBoundaryStep(segments, index, edge, deltaMs, this.cueDragDurationMs(), options);
      if (!plan.changed) return false;
      this.options.onBeginEdit?.(`${edge === 'start' ? '调整字幕起点' : '调整字幕终点'}`);
      const result = U.applyBoundaryStep(
        segments,
        index,
        edge,
        deltaMs,
        this.cueDragDurationMs(),
        options,
      );
      result.affectedIndices.forEach((idx) => { segments[idx]._dirty = true; });
      this.options.onCommitEdit?.(
        result.affectedIndices,
        result.linked ? 'resize-boundary' : 'resize-boundary-independent',
        track,
      );
      this.refreshCueOverlay();
      return true;
    },

    // 把单条字幕的一个边界直接定位到波形指针时间。与方向键微调一样，
    // 保留最短时长和同轨不重叠约束，但不联动同轨邻居；跨轨绑定由编辑器
    // 的提交回调处理。targetIndex 用于“当前没有选中字幕但指针命中字幕”的路径。
    setCueBoundaryToTime(timeMs, edge, track = 'main', targetIndex = null) {
      const segments = this.options.getSegments(track);
      const selectedIndices = U.normalizedIndices(segments, this.options.getSelection?.(track));
      const hasExplicitTarget = targetIndex !== null && targetIndex !== undefined;
      const index = hasExplicitTarget ? Number(targetIndex)
        : selectedIndices.length === 1 ? selectedIndices[0] : -1;
      if (!Number.isInteger(index) || !segments[index]
          || (!hasExplicitTarget && selectedIndices.length !== 1)
          || (edge !== 'start' && edge !== 'end')) return false;

      const segment = segments[index];
      const current = Number(segment[edge]);
      const requested = Number(timeMs);
      if (!Number.isFinite(current) || !Number.isFinite(requested)) return false;

      const previous = segments[index - 1];
      const next = segments[index + 1];
      let lower;
      let upper;
      if (edge === 'start') {
        lower = Number(previous?.end ?? 0);
        upper = Number(segment.end) - U.MIN_CUE_MS;
      } else {
        lower = Number(segment.start) + U.MIN_CUE_MS;
        upper = Number(next?.start ?? this.cueDragDurationMs());
        if (!Number.isFinite(upper) || upper <= 0) upper = Infinity;
      }
      if (!Number.isFinite(lower) || lower > upper) return true;

      const target = U.clamp(U.roundMs(requested), lower, upper);
      if (!Number.isFinite(target) || target === current) return true;

      const original = U.snapshotTiming(segment);
      this.options.onBeginEdit?.(edge === 'start' ? '定位字幕起点' : '定位字幕终点');
      if (edge === 'start') {
        segment.start = target;
      } else {
        segment.end = target;
      }
      segment.items = U.remapItems(
        original.items,
        original.start,
        original.end,
        segment.start,
        segment.end,
      );
      segment._dirty = true;
      this.options.onCommitEdit?.(
        [index],
        'resize-boundary-pointer',
        track,
        false,
        { edge, targetIndex: index, targetTimeMs: target, original },
      );
      this.refreshCueOverlay();
      return true;
    },

    snapSelectedCueBoundaryByKeyboard(direction, track = 'main') {
      const segments = this.options.getSegments(track);
      const indices = U.normalizedIndices(segments, this.options.getSelection?.(track));
      if (!indices.length || (direction !== -1 && direction !== 1)) return false;

      const index = direction < 0 ? indices[0] : indices[indices.length - 1];
      const neighborIndex = direction < 0 ? index - 1 : index + 1;
      const segment = segments[index];
      const neighbor = segments[neighborIndex];
      // 与按住字幕块时的 Shift+A/D 一样，边界不存在或无法贴合时也消费按键，
      // 避免 Shift+方向键继续触发浏览器默认行为。
      if (!segment || !neighbor) return true;

      const edge = direction < 0 ? 'start' : 'end';
      const current = Number(segment[edge]);
      const target = U.roundMs(direction < 0 ? neighbor.end : neighbor.start);
      const lower = edge === 'start' ? 0 : Number(segment.start) + U.MIN_CUE_MS;
      const upper = edge === 'start'
        ? Number(segment.end) - U.MIN_CUE_MS
        : this.cueDragDurationMs();
      if (!Number.isFinite(current) || !Number.isFinite(target)
          || target < lower || target > upper || target === current) return true;

      const result = U.applyBoundaryStep(
        segments,
        index,
        edge,
        target - current,
        this.cueDragDurationMs(),
        { sticky: false },
      );
      if (!result.changed) return true;
      this.options.onBeginEdit?.('贴近字幕边界');
      result.affectedIndices.forEach((idx) => { segments[idx]._dirty = true; });
      this.options.onCommitEdit?.(result.affectedIndices, 'resize-boundary-independent', track);
      this.refreshCueOverlay();
      return true;
    },

    adjustActiveCueDragBy(deltaMs, altKey = false) {
      const drag = this.drag;
      if (!drag) return false;
      const segments = this.options.getSegments(drag.track || 'main');
      const durationMs = this.cueDragDurationMs();
      let plan;
      let apply;
      if (drag.kind === 'move') {
        const options = { sticky: !this.isAdjacentCueAdjustmentIndependent(altKey) };
        plan = U.planMoveStep(segments, drag.indices, deltaMs, durationMs, options);
        apply = () => U.applyMoveStep(segments, drag.indices, deltaMs, durationMs, options);
      } else {
        const edge = drag.kind === 'resize-left' || drag.kind === 'resize-boundary-independent'
          ? 'start' : 'end';
        const options = {
          sticky: drag.kind !== 'resize-boundary-independent'
            && !this.isAdjacentCueAdjustmentIndependent(altKey),
        };
        plan = U.planBoundaryStep(segments, drag.index, edge, deltaMs, durationMs, options);
        apply = () => U.applyBoundaryStep(segments, drag.index, edge, deltaMs, durationMs, options);
      }
      // A held drag consumes A/D even when the current edge is already at a
      // limit, so the key never falls through to subtitle navigation.
      if (!plan.changed) return true;
      if (!drag.started) {
        drag.started = true;
        const label = drag.kind === 'move' ? '移动字幕时间'
          : drag.kind === 'resize-boundary-independent' ? '独立调整字幕边界'
            : '调整字幕边界';
        this.options.onBeginEdit?.(label);
      }
      const result = apply();
      result.affectedIndices.forEach((idx) => drag.commitIndices.add(idx));
      drag.changed = true;
      this.captureCueDragOriginals(drag);
      drag.startClientX = drag.currentClientX;
      this.scheduleRefreshCueBlocks();
      return true;
    },

    handleHeldCueKey(direction, deltaMs, { shiftKey = false, altKey = false, snap = false } = {}) {
      if (!this.drag) return false;
      if (shiftKey) {
        // Shift 是显式的边界贴合命令，不受自动吸附默认值影响；Alt
        // 只反转普通 A/D 微调的自动联动模式。
        if (snap) this.snapActiveCueBoundaryByKeyboard(direction);
        // 按住字幕块时即使吸附不可用也要消费按键，不能穿透成普通导航。
        return true;
      }
      this.adjustActiveCueDragBy(deltaMs, altKey);
      return true;
    },

    snapActiveCueBoundaryByKeyboard(direction) {
      const drag = this.drag;
      if (!drag || drag.kind !== 'move' || (direction !== -1 && direction !== 1)) return false;
      const segments = this.options.getSegments(drag.track || 'main');
      const indices = U.normalizedIndices(segments, drag.indices);
      if (!indices.length) return true;

      const index = direction < 0 ? indices[0] : indices[indices.length - 1];
      const neighborIndex = direction < 0 ? index - 1 : index + 1;
      const segment = segments[index];
      const neighbor = segments[neighborIndex];
      // 与普通 A/D 一样，按住字幕块时即使已经到达边界也要消费按键，
      // 避免 Shift+A/D 穿透成“选择前后字幕”。
      if (!segment || !neighbor) return true;

      const edge = direction < 0 ? 'start' : 'end';
      const current = Number(segment[edge]);
      const target = U.roundMs(direction < 0 ? neighbor.end : neighbor.start);
      const lower = edge === 'start' ? 0 : Number(segment.start) + U.MIN_CUE_MS;
      const upper = edge === 'start'
        ? Number(segment.end) - U.MIN_CUE_MS
        : this.cueDragDurationMs();
      if (!Number.isFinite(current) || !Number.isFinite(target)
          || target < lower || target > upper || target === current) return true;

      if (!drag.started) {
        drag.started = true;
        this.options.onBeginEdit?.('贴近字幕边界');
      }
      const original = U.snapshotTiming(segment);
      segment[edge] = target;
      segment.items = U.remapItems(
        original.items,
        original.start,
        original.end,
        segment.start,
        segment.end,
      );
      drag.commitIndices.add(index);
      drag.changed = true;
      this.captureCueDragOriginals(drag);
      drag.startClientX = drag.currentClientX;
      this.scheduleRefreshCueBlocks();
      return true;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
