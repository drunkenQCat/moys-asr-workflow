// 字幕字数与时长指标：字数口径由识别模式决定。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibCueMetrics(global) {
  'use strict';

  const U = global.MaweLib;

  function countTextUnits(text) {
    const normalized = String(text || '').replace(/\r\n?/g, '').replace(/\n/g, '');
    let total = 0;
    for (const ch of normalized) total += ch.codePointAt(0) < 256 ? 0.5 : 1;
    return total;
  }

  function countSubtitleUnits(text, mode = null) {
    const normalized = String(text || '').replace(/\r\n?/g, '').replace(/\n/g, '').trim();
    if (!normalized) return 0;
    const resolvedMode = mode === 'continuous' || mode === 'word'
      ? mode : U.detectSubtitleSplitMode(normalized);
    if (resolvedMode === 'continuous') {
      const matches = normalized.match(/[\p{L}\p{N}]/gu);
      return matches ? matches.length : 0;
    }
    return normalized.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  }

  function cueMetrics(text, start, end, mode = null) {
    const totalLength = mode === 'continuous' || mode === 'word'
      ? countSubtitleUnits(text, mode) : countTextUnits(text);
    const durationSeconds = Math.max(0, Number(end) - Number(start)) / 1000;
    const charsPerSecond = durationSeconds > 0
      ? Number((totalLength / durationSeconds).toFixed(2)) : 0;
    return { totalLength, charsPerSecond };
  }

  function joinSegmentTexts(segments, separator) {
    return segments.map((segment) => String(segment?.text || '')).join(separator);
  }

  // 字幕“字数/词数”计量：含 CJK 字符时按「字」计（只数字母与汉字等文字、数字，
  // 不计空白与标点），否则按空白切分计「词」数（同样要求词内至少一个文字/数字）。
  function subtitleTextLength(text) {
    return countSubtitleUnits(text);
  }

  // 短字幕判定：中文少于 threshold 个字 / 英文少于 threshold 个词。
  function isShortSubtitleText(text, threshold) {
    const limit = Math.max(1, Math.round(Number(threshold) || 3));
    return subtitleTextLength(text) < limit;
  }

  Object.assign(U, {
    countTextUnits,
    countSubtitleUnits,
    cueMetrics,
    joinSegmentTexts,
    subtitleTextLength,
    isShortSubtitleText,
  });
})(typeof window !== 'undefined' ? window : globalThis);
