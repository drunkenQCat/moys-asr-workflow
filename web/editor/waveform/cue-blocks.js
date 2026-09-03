// 字幕块与空隙块的 DOM 行构建、布局和局部刷新。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformCueBlocks(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    createMultiRow(index, rowDurationMs, groupBadges = null) {
      const startMs = index * rowDurationMs;
      const endMs = Math.min(this.durationMs, startMs + rowDurationMs);
      const row = this.createRow(startMs, endMs, index, false, groupBadges);
      row.style.top = `${index * (this.settings.rowHeight + U.ROW_GAP)}px`;
      row.style.height = `${this.settings.rowHeight}px`;
      // 最后一行只代表媒体剩余的真实时长；缩短容器不会减少采样量，
      // 但能避免把不存在的尾部时间误画成整行波形。
      row.style.right = 'auto';
      row.style.width = `${Math.max(0.01, Math.min(1, (endMs - startMs) / rowDurationMs) * 100)}%`;
      return row;
    },

    createRow(startMs, endMs, rowIndex, basic, groupBadges = null) {
      const row = document.createElement('div');
      row.className = 'waveform-row';
      const multiLane = this.options.multiSubtitleVisible?.() === true;
      if (multiLane) {
        row.classList.add('multi-subtitle-row');
        if (this.options.showTrackBadges?.() === true) row.classList.add('show-track-badges');
      }
      row.dataset.startMs = String(startMs);
      row.dataset.endMs = String(endMs);
      row.dataset.rowIndex = String(rowIndex);
      if (basic) row.dataset.basic = 'true';

      const canvas = document.createElement('canvas');
      row.appendChild(canvas);

      const time = document.createElement('div');
      time.className = 'waveform-row-time';
      time.textContent = `${U.formatCompact(startMs)} → ${U.formatCompact(endMs)}`;
      row.appendChild(time);

      const playhead = document.createElement('div');
      playhead.className = 'waveform-playhead';
      playhead.hidden = true;
      row.appendChild(playhead);
      row._waveformPlayhead = playhead;

      const pointerLine = document.createElement('div');
      pointerLine.className = 'waveform-pointer-line';
      pointerLine.hidden = true;
      pointerLine.setAttribute('aria-hidden', 'true');
      row.appendChild(pointerLine);

      const splitFlash = document.createElement('div');
      splitFlash.className = 'waveform-split-flash';
      splitFlash.hidden = true;
      row.appendChild(splitFlash);

      this.appendGapBlocks(row, startMs, endMs);
      this.appendCueBlocks(row, startMs, endMs, groupBadges || U.computeGroupBadges(this.options.getSegments('main')));

      row.addEventListener('pointerdown', (event) => {
        // 每次按下时读取最新模式；设置切换会重绘空隙块，但不会重建仍在
        // 可视区内的行，不能使用 createRow 时捕获的旧值。
        if (event.button === 1 && U.gapOperationAllowsMiddle(this.options.getGapOperationMode?.())) {
          this.beginGapRangeDrag(event, row);
          return;
        }
        // Alt+左键拖动空白处：用与中键增加静音相同的范围操作，
        // 这样不需要切换到“中键拖动”模式也能快速新增空隙。
        if (
          event.button === 0 &&
          event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.target.closest('.waveform-cue-block, .waveform-gap-block')
        ) {
          this.beginGapRangeDrag(event, row, { removed: true });
          return;
        }
        // Ctrl(Cmd)+左键拖动空白处：按拖动范围创建一条指定时长字幕。
        // 命中字幕块或静音空隙时保留各自已有的选择/边界操作。
        if (
          event.button === 0 &&
          (event.ctrlKey || event.metaKey) &&
          !event.shiftKey &&
          !event.altKey &&
          !event.target.closest('.waveform-cue-block, .waveform-gap-block')
        ) {
          const track = this.trackAtPoint(event.clientX, event.clientY, row);
          if (this.isCueTimeOccupied(this.timeFromPointer(event, row), track)) {
            event.preventDefault();
            event.stopPropagation();
            this.options.onCueCreateRejected?.('occupied');
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          this.beginCreateCueDrag(event, row, track);
          return;
        }
        // Shift+左键在空白处拖动：框选字幕块（追加进现有多选），
        // 不进入下方的清除选中/seek/播放头拖拽路径
        if (
          event.button === 0 &&
          event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.target.closest('.waveform-cue-block, .waveform-gap-block') &&
          !this.isCustomLayout()
        ) {
          event.preventDefault();
          this.beginMarqueeDrag(event);
          return;
        }
        if (event.button !== 0 || event.target.closest('.waveform-cue-block, .waveform-gap-block')) return;
        event.preventDefault();
        // 清除选中会提交当前字幕面板编辑，而提交可能同步重建虚拟行。
        // 在调用外部回调前保存坐标，后续 seek 不依赖可能已脱离 DOM 的 row。
        const geometry = this.captureRowGeometry(row);
        // 普通左键点击空白波形：清除字幕选中并跳转播放头
        this.options.clearSelection?.();
        // 「允许拖动指针」开启时，继续按住左键拖动则指针跟随鼠标位置
        if (this.settings.dragPlayhead) this.beginPlayheadDrag(event, row, geometry);
        this.seekFromPointer(event, row, false, geometry);
      });
      row.addEventListener('pointerenter', (event) => this.showPointerLine(event, row, pointerLine));
      row.addEventListener('pointermove', (event) => {
        this.showPointerLine(event, row, pointerLine);
        this.scheduleHoverSeekPreview(event, row);
      });
      row.addEventListener('pointerleave', () => {
        this.hidePointerLine(pointerLine);
        this.cancelHoverSeekPreview();
      });
      row.addEventListener('auxclick', (event) => {
        if (event.button === 1 && U.gapOperationAllowsMiddle(this.options.getGapOperationMode?.())) {
          event.preventDefault();
        }
      });
      row.addEventListener('dblclick', (event) => {
        if (event.target.closest('.waveform-cue-block, .waveform-gap-block')) return;
        if (event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        this.options.togglePlayback();
      });
      row.addEventListener('contextmenu', (event) => {
        if (event.target.closest('.waveform-cue-block, .waveform-gap-block')) return;
        event.preventDefault();
        event.stopPropagation();
        const time = this.timeFromPointer(event, row);
        const track = this.trackAtPoint(event.clientX, event.clientY, row);
        this.options.showBlankWaveformMenu?.(time, event.clientX, event.clientY, track);
      });
      return row;
    },

    appendGapBlocks(row, startMs, endMs) {
      // Editor/Align 提供的 getter 已经返回共享的最终显示投影；这里不要
      // 对每一行再次做投影，避免多行波形重复扫描同一组 Gap。
      const gaps = this.options.getGapRemoveGaps?.() || [];
      const gapOperationMode = this.options.getGapOperationMode?.() || 'boundary_drag';
      const boundaryEnabled = U.gapOperationAllowsBoundary(gapOperationMode);
      const middleEnabled = U.gapOperationAllowsMiddle(gapOperationMode);
      const firstGapIndex = U.firstCueIndexOverlapping(gaps, startMs);
      for (let index = firstGapIndex; index < gaps.length; index += 1) {
        const gap = gaps[index];
        if (!gap) continue;
        if (gap.start >= endMs) break;
        if (gap.end <= startMs) continue;
        const block = document.createElement('div');
        block.className = 'waveform-gap-block';
        block.dataset.gapIndex = String(index);
        block.classList.toggle('restored', gap.removed === false);
        if (gap.removed !== false) {
          block.classList.toggle(
            'protected',
            window.AsrGapRemoveCore.isGapRemoveDisplayProtected(gap),
          );
        }
        block.classList.toggle('boundary-editable', boundaryEnabled);
        block.title = U.gapRemoveDisplayLabel(gap);
        block.setAttribute('aria-label', block.title);
        const label = document.createElement('span');
        label.className = 'waveform-gap-label';
        label.textContent = gap.removed === false ? '空隙（未激活）' : '空隙';
        block.appendChild(label);
        if (boundaryEnabled) {
          if (gap.start >= startMs) {
            const leftHandle = document.createElement('span');
            leftHandle.className = 'waveform-gap-handle left';
            block.appendChild(leftHandle);
          }
          if (gap.end <= endMs) {
            const rightHandle = document.createElement('span');
            rightHandle.className = 'waveform-gap-handle right';
            block.appendChild(rightHandle);
          }
        }
        this.layoutGapBlock(block, gap, startMs, endMs);
        block.addEventListener('pointerdown', (event) => {
          const handle = event.target.closest('.waveform-gap-handle');
          if (event.button === 0 && !handle) {
            this.beginGapMoveDrag(
              event,
              index,
              row,
              event.ctrlKey || event.metaKey ? 'copy' : 'move',
            );
            return;
          }
          if (!handle || event.altKey || event.ctrlKey || event.metaKey) return;
          this.beginGapBoundaryDrag(
            event,
            index,
            row,
            handle.classList.contains('left') ? 'start' : 'end',
          );
        });
        block.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (Date.now() < this.suppressGapClickUntil) return;
          if (event.altKey) {
            this.options.toggleGapRemoved?.(index);
            return;
          }
          const timeMs = this.timeFromPointer(event, row);
          this.options.previewGapAt?.(index, timeMs);
          this.options.seek(timeMs / 1000);
          this.updatePlayback();
        });
        block.addEventListener('dblclick', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        block.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.options.showGapContextMenu?.(event.clientX, event.clientY, index);
        });
        row.appendChild(block);
      }
    },

    appendCueBlocks(row, startMs, endMs, groupBadges = null) {
      const multiLane = this.options.multiSubtitleVisible?.() === true;
      const segments = this.options.getSegments('main');
      const selected = this.options.getSelection('main');
      const bindingMarkerTargets = this.options.getBindingMarkerTargets?.() || {};
      const mainBindingMarkers = bindingMarkerTargets.main;
      const now = this.currentTimeMs();
      const activeMainIndex = U.findActiveCueIndex(segments, now);
      const badgesByIndex = groupBadges || U.computeGroupBadges(segments);
      const firstMainIndex = U.firstCueIndexOverlapping(segments, startMs);
      for (let index = firstMainIndex; index < segments.length; index += 1) {
        const segment = segments[index];
        if (segment.start >= endMs) break;
        if (segment.end <= startMs) continue;
        if (segment.disabled && (this.options.getHideDisabled?.() || this.settings.disabledDisplay === 'hidden')) continue;
        const block = document.createElement('div');
        block.className = 'waveform-cue-block';
        block.dataset.idx = String(index);
        block.dataset.start = String(segment.start);
        block.dataset.end = String(segment.end);
        block.style.setProperty('--cue-color', U.colorForSegment(segment));
        if (selected.has(index)) block.classList.add('selected');
        if (segment.disabled) block.classList.add('disabled');
        // 空隙中沿用的当前字幕不点亮 active 轮廓（仅视觉；逻辑语义不变）。
        if (index === activeMainIndex && U.isActiveCueVisualHit(segments, index, now)) block.classList.add('active');

        const label = document.createElement('span');
        label.className = 'waveform-cue-label';
        label.textContent = segment.text.replace(/\s+/g, ' ');
        block.appendChild(label);
        this.setBindingMarker(block, mainBindingMarkers?.has?.(index) === true);
        // 短块内文字会被截断，悬浮 title 给出完整字幕文本
        block.title = label.textContent;
        const badges = this.settings.showGroupBadges !== false ? badgesByIndex.get(index) : null;
        if (badges?.length) {
          // 徽章挂在行上、块上方（不遮挡块内文字）；短字幕也保留最小显示空间，
          // 让分组提示可以正常出现。
          const badgeDuration = Math.max(1, endMs - startMs);
          const badgeVisibleStart = Math.max(startMs, segment.start);
          const badgeVisibleEnd = Math.min(endMs, segment.end);
          // 行创建时还未挂载（clientWidth=0），用容器宽度估算块像素宽（行宽=容器宽）
          const blockWidthPx = ((badgeVisibleEnd - badgeVisibleStart) / badgeDuration) * this.content.clientWidth;
          if (blockWidthPx >= 24) badges.forEach((badge, badgeIndex) => {
            const badgeEl = document.createElement('span');
            badgeEl.className = `waveform-cue-badge ${badge.type}`;
            badgeEl.textContent = badge.type === 'sticker' && badge.total === 1
              ? '🦊'
              : `${badge.type === 'color' ? '🎨' : '🦊'} ${badge.ordinal}/${badge.total}`;
            badgeEl.style.left = `${((badgeVisibleStart - startMs) / badgeDuration) * 100}%`;
            badgeEl.style.setProperty('--badge-stack-index', String(badgeIndex));
            row.appendChild(badgeEl);
          });
        }
        if (segment.start >= startMs) {
          const leftHandle = document.createElement('span');
          leftHandle.className = 'waveform-cue-handle left';
          block.appendChild(leftHandle);
        }
        if (segment.end <= endMs) {
          const rightHandle = document.createElement('span');
          rightHandle.className = 'waveform-cue-handle right';
          block.appendChild(rightHandle);
        }
        this.layoutBlock(block, segment, startMs, endMs, row);
        block.dataset.track = 'main';
        block.addEventListener('pointerdown', (event) => this.beginCueDrag(event, index, row, 'main'));
        block.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const timeMs = this.timeFromPointer(event, row);
          this.options.showContextMenu?.(event.clientX, event.clientY, index, timeMs);
        });
        block.addEventListener('dblclick', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.ctrlKey || event.metaKey) return;
          if (this.options.enterCueEditor) this.options.enterCueEditor(index);
          else this.options.activateCue?.(index);
        });
        row.appendChild(block);
      }

      if (!multiLane) return;
      const extensionSegments = this.options.getExtensionSegments?.() || [];
      const extensionSelected = this.options.getExtensionSelection?.() || new Set();
      const extensionBindingMarkers = bindingMarkerTargets.extension;
      const activeExtensionIndex = U.findActiveCueIndex(extensionSegments, now);
      const firstExtensionIndex = U.firstCueIndexOverlapping(extensionSegments, startMs);
      for (let index = firstExtensionIndex; index < extensionSegments.length; index += 1) {
        const segment = extensionSegments[index];
        if (segment.start >= endMs) break;
        if (segment.end <= startMs) continue;
        if (segment.disabled && (this.options.getHideDisabled?.() || this.settings.disabledDisplay === 'hidden')) continue;
        const block = document.createElement('div');
          block.className = 'waveform-cue-block';
          block.dataset.track = 'extension';
          block.dataset.extIdx = String(index);
          block.dataset.start = String(segment.start);
          block.dataset.end = String(segment.end);
          block.style.setProperty('--cue-color', '#7a9fc5');
        if (extensionSelected.has(index)) block.classList.add('selected');
        if (segment.disabled) block.classList.add('disabled');
        // 空隙中沿用的当前字幕不点亮 active 轮廓（仅视觉；逻辑语义不变）。
        if (index === activeExtensionIndex && U.isActiveCueVisualHit(extensionSegments, index, now)) block.classList.add('active');
        const label = document.createElement('span');
        label.className = 'waveform-cue-label';
        label.textContent = String(segment.text || '').replace(/\s+/g, ' ');
        block.title = label.textContent;
        block.appendChild(label);
        this.setBindingMarker(block, extensionBindingMarkers?.has?.(index) === true);
        if (segment.start >= startMs) {
          const leftHandle = document.createElement('span');
          leftHandle.className = 'waveform-cue-handle left';
          block.appendChild(leftHandle);
        }
        if (segment.end <= endMs) {
          const rightHandle = document.createElement('span');
          rightHandle.className = 'waveform-cue-handle right';
          block.appendChild(rightHandle);
        }
        this.layoutBlock(block, segment, startMs, endMs, row);
        block.addEventListener('pointerdown', (event) => this.beginCueDrag(event, index, row, 'extension'));
        block.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const timeMs = this.timeFromPointer(event, row);
          this.options.showExtensionContextMenu?.(event.clientX, event.clientY, index, timeMs);
        });
        block.addEventListener('dblclick', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.ctrlKey || event.metaKey) return;
          if (this.options.enterExtensionCueEditor) this.options.enterExtensionCueEditor(index);
          else this.options.activateExtensionCue?.(index);
        });
        row.appendChild(block);
      }
    },

    setBindingMarker(block, visible) {
      block.classList.toggle('has-binding-marker', visible);
      const marker = block.querySelector('.waveform-binding-marker');
      if (!visible) {
        marker?.remove();
        return;
      }
      if (marker) return;
      const next = document.createElement('span');
      next.className = 'waveform-binding-marker';
      next.textContent = '🔗';
      next.title = '已绑定字幕';
      next.setAttribute('aria-label', '已绑定字幕');
      block.appendChild(next);
    },

    layoutBlock(block, segment, startMs, endMs, ownerRow = null) {
      const duration = Math.max(1, endMs - startMs);
      const visibleStart = Math.max(startMs, segment.start);
      const visibleEnd = Math.min(endMs, segment.end);
      const left = ((visibleStart - startMs) / duration) * 100;
      const width = Math.max(0.25, ((visibleEnd - visibleStart) / duration) * 100);
      block.style.left = `${left}%`;
      block.style.width = `${width}%`;
      block.hidden = visibleEnd <= visibleStart;
      const row = ownerRow || block.closest('.waveform-row');
      // 时间上的多行模式与“多重字幕”双轨不是同一个概念；普通多行波形也
      // 必须在行边界清除相接侧圆角。基础模式的单行窗口则保留完整圆角。
      const isMultiRow = Boolean(row && row.dataset.basic !== 'true');
      const continuation = U.cueBlockContinuationEdges(segment, startMs, endMs);
      block.classList.toggle('continues-from-previous-row', isMultiRow && continuation.fromPreviousRow);
      block.classList.toggle('continues-to-next-row', isMultiRow && continuation.toNextRow);
    },

    layoutGapBlock(block, gap, startMs, endMs) {
      const duration = Math.max(1, endMs - startMs);
      const visibleStart = Math.max(startMs, gap.start);
      const visibleEnd = Math.min(endMs, gap.end);
      const left = ((visibleStart - startMs) / duration) * 100;
      const width = Math.max(0.25, ((visibleEnd - visibleStart) / duration) * 100);
      block.style.left = `${left}%`;
      block.style.width = `${width}%`;
      block.hidden = visibleEnd <= visibleStart;
    },

    refreshGapOverlay() {
      if (!this.payload) return;
      this.content.querySelectorAll('.waveform-row').forEach((row) => {
        row.querySelectorAll('.waveform-gap-block').forEach((element) => element.remove());
        this.appendGapBlocks(row, Number(row.dataset.startMs), Number(row.dataset.endMs));
      });
      this.positionPlayheads();
    },

    refreshCueOverlay() {
      if (!this.payload) return;
      const rows = [...this.content.querySelectorAll('.waveform-row')];
      if (!rows.length) return;
      const groupBadges = U.computeGroupBadges(this.options.getSegments('main'));
      rows.forEach((row) => {
        // 绑定、解绑和字幕时间变化只影响覆盖层；保留已有行与 Canvas，
        // 避免重新采样/绘制波形导致操作出现一帧卡顿。
        row.querySelectorAll('.waveform-cue-block, .waveform-cue-badge')
          .forEach((element) => element.remove());
        this.appendCueBlocks(
          row,
          Number(row.dataset.startMs),
          Number(row.dataset.endMs),
          groupBadges,
        );
      });
      this.updatePlayback(false);
    },

    refreshCueBlocks() {
      const segments = this.options.getSegments('main');
      const extensionSegments = this.options.getExtensionSegments?.() || [];
      this.content.querySelectorAll('.waveform-cue-block').forEach((block) => {
        const isExtension = block.dataset.track === 'extension';
        const segment = isExtension
          ? extensionSegments[Number(block.dataset.extIdx)]
          : segments[Number(block.dataset.idx)];
        const row = block.closest('.waveform-row');
        if (!segment || !row) return;
        this.layoutBlock(block, segment, Number(row.dataset.startMs), Number(row.dataset.endMs));
        block.classList.toggle('selected', isExtension
          ? this.options.getExtensionSelection?.().has(Number(block.dataset.extIdx))
          : this.options.getSelection('main').has(Number(block.dataset.idx)));
        const bindingMarkerTargets = this.options.getBindingMarkerTargets?.() || {};
        this.setBindingMarker(block, isExtension
          ? bindingMarkerTargets.extension?.has?.(Number(block.dataset.extIdx)) === true
          : bindingMarkerTargets.main?.has?.(Number(block.dataset.idx)) === true);
      });
      this.positionPlayheads();
    },

    refreshCueLabel(index) {
      const segment = this.options.getSegments('main')[index];
      if (!segment) return;
      this.content.querySelectorAll(`.waveform-cue-block[data-track="main"][data-idx="${index}"] .waveform-cue-label`)
        .forEach((label) => { label.textContent = segment.text.replace(/\s+/g, ' '); });
    },

    refreshExtensionCueLabel(index, trackId = null) {
      const segment = this.options.getExtensionSegments?.(trackId)?.[index];
      if (!segment) return;
      this.content.querySelectorAll(`.waveform-cue-block[data-track="extension"][data-ext-idx="${index}"] .waveform-cue-label`)
        .forEach((label) => { label.textContent = String(segment.text || '').replace(/\s+/g, ' '); });
    },

    updateSelection() {
      const selected = this.options.getSelection('main');
      const extensionSelected = this.options.getExtensionSelection?.() || new Set();
      const bindingMarkerTargets = this.options.getBindingMarkerTargets?.() || {};
      this.content.querySelectorAll('.waveform-cue-block').forEach((block) => {
        const isExtension = block.dataset.track === 'extension';
        const index = Number(isExtension ? block.dataset.extIdx : block.dataset.idx);
        block.classList.toggle('selected', isExtension
          ? extensionSelected.has(index)
          : selected.has(index));
        this.setBindingMarker(block, isExtension
          ? bindingMarkerTargets.extension?.has?.(index) === true
          : bindingMarkerTargets.main?.has?.(index) === true);
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
