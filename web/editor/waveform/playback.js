// 播放帧更新与导航快照的读取/恢复。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。
// 这些方法按原顺序原样搬到 WaveformEditor.prototype 上；方法体内的 this.* 调用不变。
// 必须在 core.js 之后加载：它在加载期就要拿到类。

(function initMaweWaveformPlayback(global) {
  'use strict';

  const U = global.MaweWaveform;

  U.defineMethods(U.WaveformEditor.prototype, {

    updatePlayback(allowFollow = true) {
      if (!this.payload) return;
      const now = this.currentTimeMs();
      const segments = this.options.getSegments('main');
      const activeIndex = U.findActiveCueIndex(segments, now);
      const activeVisualHit = activeIndex >= 0 && U.isActiveCueVisualHit(segments, activeIndex, now);
      if (activeIndex !== this.activeIndex || activeVisualHit !== this.activeVisualHit) {
        this.activeIndex = activeIndex;
        this.activeVisualHit = activeVisualHit;
        this.content.querySelectorAll('.waveform-cue-block[data-track="main"]').forEach((block) => {
          block.classList.toggle('active', Number(block.dataset.idx) === activeIndex && activeVisualHit);
        });
      }
      const extensionSegments = this.options.getExtensionSegments?.() || [];
      const activeExtensionIndex = U.findActiveCueIndex(extensionSegments, now);
      const activeExtensionVisualHit = activeExtensionIndex >= 0
        && U.isActiveCueVisualHit(extensionSegments, activeExtensionIndex, now);
      if (activeExtensionIndex !== this.activeExtensionIndex
          || activeExtensionVisualHit !== this.activeExtensionVisualHit) {
        this.activeExtensionIndex = activeExtensionIndex;
        this.activeExtensionVisualHit = activeExtensionVisualHit;
        this.content.querySelectorAll('.waveform-cue-block[data-track="extension"]')
          .forEach((block) => {
            block.classList.toggle('active', Number(block.dataset.extIdx) === activeExtensionIndex && activeExtensionVisualHit);
          });
      }

      if (allowFollow && this.settings.mode === 'basic' && !this.navigationRestoring) {
        const windowMs = this.settings.visibleSeconds * 1000;
        const relative = (now - this.basicWindowStartMs) / Math.max(1, windowMs);
        if (now < this.basicWindowStartMs || now > this.basicWindowStartMs + windowMs ||
            (this.player && !this.player.paused && Date.now() > this.manualFollowUntil && (relative < 0.2 || relative > 0.8))) {
          this.centerBasicOnCurrentTime();
          this.renderBasic();
          return;
        }
      }

      if (allowFollow && this.isMultiMode() && !this.navigationRestoring
          && this.player && !this.player.paused && Date.now() > this.manualFollowUntil) {
        const rowIndex = Math.floor(now / (this.settings.secondsPerRow * 1000));
        const shouldCheckFollow = this.multiFollowCheckPending || rowIndex !== this.multiFollowRowIndex;
        if (!shouldCheckFollow) {
          this.positionPlayheads();
          return;
        }
        this.multiFollowRowIndex = rowIndex;
        this.multiFollowCheckPending = false;
        const viewportHeight = this.scroll.clientHeight;
        const rowInComfortZone = viewportHeight > 0 && U.isMultiRowInComfortZone(
          rowIndex, this.scroll.scrollTop, viewportHeight, this.settings.rowHeight,
        );
        const stride = this.settings.rowHeight + U.ROW_GAP;
        const targetScrollTop = U.clamp(
          rowIndex * stride - viewportHeight * 0.35,
          0,
          Math.max(0, this.scroll.scrollHeight - viewportHeight),
        );
        const currentScrollTop = this.scroll.scrollTop;
        const targetChanged = this.autoScrollTarget === null
          || Math.abs(targetScrollTop - this.autoScrollTarget) > 0.5;
        const needsScroll = Math.abs(targetScrollTop - currentScrollTop) > 0.5;
        if (!rowInComfortZone && needsScroll && targetChanged) {
          this.autoScrolling = true;
          this.autoScrollTarget = targetScrollTop;
          this.scroll.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
          requestAnimationFrame(() => { this.autoScrolling = false; });
          // 滚动事件会在新的可视范围稳定后增量补行；播放热路径不应在
          // 每次跨行时强制重建当前整组 DOM/Canvas。
          this.scheduleMultiVisible();
        }
        if (!needsScroll) this.autoScrollTarget = null;
      }
      this.positionPlayheads();
    },

    getNavigationSnapshot() {
      return {
        cueListScrollTop: Math.max(0, Math.round(Number(this.cues?.scrollTop) || 0)),
        waveformTopEdgeMs: U.waveformTopEdgeMs({
          mode: this.settings.mode,
          basicWindowStartMs: this.basicWindowStartMs,
          scrollTop: this.scroll?.scrollTop,
          rowHeight: this.settings.rowHeight,
          rowGap: U.ROW_GAP,
          secondsPerRow: this.settings.secondsPerRow,
        }),
      };
    },

    restoreNavigation(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') return false;
      if (!this.payload) {
        this.pendingNavigation = snapshot;
        if (typeof snapshot.cueListScrollTop === 'number' && Number.isFinite(snapshot.cueListScrollTop)) {
          const maxTop = Math.max(0, this.cues.scrollHeight - this.cues.clientHeight);
          this.cues.scrollTop = U.clamp(Math.round(snapshot.cueListScrollTop), 0, maxTop);
        }
        return true;
      }
      const topEdgeMs = U.restoreWaveformTopEdgeMs({
        mode: this.settings.mode,
        durationMs: this.durationMs,
        visibleSeconds: this.settings.visibleSeconds,
        secondsPerRow: this.settings.secondsPerRow,
      }, snapshot.waveformTopEdgeMs);
      this.navigationRestoring = true;
      if (topEdgeMs !== null) {
        if (this.settings.mode === 'basic') {
          this.basicWindowStartMs = topEdgeMs;
          this.renderBasic();
        } else {
          const rowDurationMs = Math.max(1, this.settings.secondsPerRow * 1000);
          const stride = this.settings.rowHeight + U.ROW_GAP;
          const rowTop = Math.floor(topEdgeMs / rowDurationMs) * stride;
          const maxTop = Math.max(0, this.scroll.scrollHeight - this.scroll.clientHeight);
          this.scroll.scrollTop = U.clamp(rowTop, 0, maxTop);
          this.renderMultiVisible();
        }
      }
      if (typeof snapshot.cueListScrollTop === 'number' && Number.isFinite(snapshot.cueListScrollTop)) {
        const maxTop = Math.max(0, this.cues.scrollHeight - this.cues.clientHeight);
        this.cues.scrollTop = U.clamp(Math.round(snapshot.cueListScrollTop), 0, maxTop);
      }
      this.manualFollowUntil = Date.now() + 5000;
      this.autoScrolling = false;
      this.autoScrollTarget = null;
      requestAnimationFrame(() => { this.navigationRestoring = false; });
      return topEdgeMs !== null || typeof snapshot.cueListScrollTop === 'number';
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
