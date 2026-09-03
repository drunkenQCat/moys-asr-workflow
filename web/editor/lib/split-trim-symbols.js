// 切分边缘裁剪符号表：符号集合变化时重建首尾裁剪正则。
// 自 web/editor/lib/utils.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweLib；
// 兼容出口 window.AsrEditorUtils 仍由 editor/lib/compat-surface.js 统一组装。
(function initMaweLibSplitTrimSymbols(global) {
  'use strict';

  const U = global.MaweLib;
  // 拆分边界符号修剪配置：勾选/填写的符号会在拆分后从两侧文本边缘移除。
  // 空格与换行永远修剪，不参与配置。
  // 仅前 5 个高频符号提供勾选 chip；其余符号由设置面板的自由文本框维护
  // （空格分隔），文本框默认预填半角逗号和句点，延续旧版行为。
  const SPLIT_TRIM_PRIMARY_SYMBOLS = Object.freeze([
    { ch: '，', name: '全角逗号' },
    { ch: '。', name: '句号' },
    { ch: '、', name: '顿号' },
    { ch: '！', name: '全角感叹号' },
    { ch: '？', name: '全角问号' },
  ]);
  const DEFAULT_EXTRA_SPLIT_TRIM_SYMBOLS = Object.freeze([',', '.']);
  const DEFAULT_SPLIT_TRIM_SYMBOLS = Object.freeze(
    [...SPLIT_TRIM_PRIMARY_SYMBOLS.map((option) => option.ch), ...DEFAULT_EXTRA_SPLIT_TRIM_SYMBOLS],
  );

  // 设置面板文本框解析：按空白拆分后把每个片段展开为单字符并去重，
  // 这样「,.」与「, .」等价，减少手动输入格式差异带来的意外。
  function parseSplitTrimSymbolInput(text) {
    const seen = new Set();
    String(text || '').split(/\s+/u).forEach((token) => {
      Array.from(token).forEach((ch) => { if (ch.trim()) seen.add(ch); });
    });
    return [...seen];
  }

  // 归一化存储值：保留单个字符的字符串项，去重并保持顺序；
  // 接受任意字符（自由文本框），显式空数组表示关闭全部符号（仅修剪空白）。
  function normalizeSplitTrimSymbols(value) {
    if (!Array.isArray(value)) return [...DEFAULT_SPLIT_TRIM_SYMBOLS];
    const seen = new Set();
    const result = [];
    value.forEach((symbol) => {
      if (typeof symbol !== 'string') return;
      const characters = Array.from(symbol);
      if (characters.length !== 1 || seen.has(characters[0])) return;
      seen.add(characters[0]);
      result.push(characters[0]);
    });
    return result;
  }

  function escapeSplitTrimPatternSource(symbol) {
    return String(symbol).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  }

  let activeSplitTrimSymbols = [...DEFAULT_SPLIT_TRIM_SYMBOLS];
  let activeEndTrimPattern = null;
  let activeStartTrimPattern = null;

  function rebuildSplitTrimPatterns() {
    const source = activeSplitTrimSymbols.map(escapeSplitTrimPatternSource).join('|');
    activeEndTrimPattern = new RegExp(`(?:${source}|\\s)+$`, 'u');
    activeStartTrimPattern = new RegExp(`^(?:${source}|\\s)+`, 'u');
  }
  rebuildSplitTrimPatterns();

  // editor 启动时把用户设置同步进来；之后拆分相关的所有修剪路径共用同一份符号表。
  function setSplitTrimSymbols(symbols) {
    activeSplitTrimSymbols = normalizeSplitTrimSymbols(symbols);
    rebuildSplitTrimPatterns();
    return [...activeSplitTrimSymbols];
  }

  function applySplitEdgeTrim(value, edge = 'end') {
    const text = String(value || '');
    if (edge === 'start') return text.replace(activeStartTrimPattern, '');
    return text.replace(activeEndTrimPattern, '');
  }

  Object.assign(U, {
    SPLIT_TRIM_PRIMARY_SYMBOLS,
    DEFAULT_EXTRA_SPLIT_TRIM_SYMBOLS,
    DEFAULT_SPLIT_TRIM_SYMBOLS,
    parseSplitTrimSymbolInput,
    normalizeSplitTrimSymbols,
    escapeSplitTrimPatternSource,
    rebuildSplitTrimPatterns,
    setSplitTrimSymbols,
    applySplitEdgeTrim,
  });
  // activeSplitTrimSymbols 是本模块可变状态：以访问器发布，外部读到的始终是最新值。
  Object.defineProperty(U, 'activeSplitTrimSymbols', { enumerable: true, configurable: true, get: () => activeSplitTrimSymbols });
  // activeEndTrimPattern 是本模块可变状态：以访问器发布，外部读到的始终是最新值。
  Object.defineProperty(U, 'activeEndTrimPattern', { enumerable: true, configurable: true, get: () => activeEndTrimPattern });
  // activeStartTrimPattern 是本模块可变状态：以访问器发布，外部读到的始终是最新值。
  Object.defineProperty(U, 'activeStartTrimPattern', { enumerable: true, configurable: true, get: () => activeStartTrimPattern });
})(typeof window !== 'undefined' ? window : globalThis);
