// 布局树纯函数：克隆、规范化、换入换出、边缘插入与拖放落点判定。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformLayoutTree(global) {
  'use strict';

  const U = global.MaweWaveform;

  function normalizeModuleOrder(value) {
    return Array.isArray(value) && value.length === U.MODULE_IDS.length
      && value.every((id) => U.MODULE_IDS.includes(id))
      && new Set(value).size === U.MODULE_IDS.length
      ? [...value] : [...U.DEFAULT_MODULE_ORDER];
  }

  function moduleLayoutNode(id) {
    return { type: 'module', id };
  }

  function splitLayoutNode(direction, ratio, first, second) {
    return {
      type: 'split',
      direction: direction === 'column' ? 'column' : 'row',
      ratio: U.clamp(Number(ratio) || 50, 20, 80),
      children: [first, second],
    };
  }

  function cloneLayoutTree(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'module') return moduleLayoutNode(node.id);
    return splitLayoutNode(
      node.direction,
      node.ratio,
      cloneLayoutTree(node.children?.[0]),
      cloneLayoutTree(node.children?.[1]),
    );
  }

  function collectLayoutModules(node, result = []) {
    if (!node) return result;
    if (node.type === 'module') {
      result.push(node.id);
      return result;
    }
    collectLayoutModules(node.children?.[0], result);
    collectLayoutModules(node.children?.[1], result);
    return result;
  }

  function normalizeLayoutTree(value) {
    if (!value || typeof value !== 'object') return null;
    if (value.type === 'module' && U.MODULE_IDS.includes(value.id)) return moduleLayoutNode(value.id);
    if (value.type !== 'split' || !Array.isArray(value.children) || value.children.length !== 2) return null;
    const first = normalizeLayoutTree(value.children[0]);
    const second = normalizeLayoutTree(value.children[1]);
    if (!first || !second) return null;
    return splitLayoutNode(value.direction, value.ratio, first, second);
  }

  function isCompleteLayoutTree(tree) {
    const modules = collectLayoutModules(tree);
    return modules.length === U.MODULE_IDS.length
      && modules.every((id) => U.MODULE_IDS.includes(id))
      && new Set(modules).size === U.MODULE_IDS.length;
  }

  function replaceLayoutModule(tree, moduleId, replacement) {
    if (!tree) return null;
    if (tree.type === 'module') return tree.id === moduleId ? replacement : tree;
    return splitLayoutNode(
      tree.direction,
      tree.ratio,
      replaceLayoutModule(tree.children[0], moduleId, replacement),
      replaceLayoutModule(tree.children[1], moduleId, replacement),
    );
  }

  function removeLayoutModule(tree, moduleId) {
    if (!tree) return null;
    if (tree.type === 'module') return tree.id === moduleId ? null : tree;
    const first = removeLayoutModule(tree.children[0], moduleId);
    const second = removeLayoutModule(tree.children[1], moduleId);
    if (!first) return second;
    if (!second) return first;
    return splitLayoutNode(tree.direction, tree.ratio, first, second);
  }

  function swapLayoutTreeModules(tree, sourceId, targetId) {
    if (!isCompleteLayoutTree(tree) || sourceId === targetId) return cloneLayoutTree(tree);
    const marked = replaceLayoutModule(tree, sourceId, moduleLayoutNode('__swap__'));
    const targetSwapped = replaceLayoutModule(marked, targetId, moduleLayoutNode(sourceId));
    return replaceLayoutModule(targetSwapped, '__swap__', moduleLayoutNode(targetId));
  }

  function insertLayoutModuleAtEdge(tree, sourceId, targetId, direction) {
    if (!isCompleteLayoutTree(tree) || sourceId === targetId || !U.LAYOUT_DIRECTIONS.includes(direction)) {
      return cloneLayoutTree(tree);
    }
    const withoutSource = removeLayoutModule(cloneLayoutTree(tree), sourceId);
    if (!withoutSource) return cloneLayoutTree(tree);
    const source = moduleLayoutNode(sourceId);
    const target = moduleLayoutNode(targetId);
    const splitDirection = direction === 'left' || direction === 'right' ? 'row' : 'column';
    const replacement = direction === 'left' || direction === 'top'
      ? splitLayoutNode(splitDirection, 50, source, target)
      : splitLayoutNode(splitDirection, 50, target, source);
    return replaceLayoutModule(withoutSource, targetId, replacement);
  }

  function insertLayoutModuleAtRootEdge(tree, sourceId, direction) {
    if (!isCompleteLayoutTree(tree) || !U.LAYOUT_DIRECTIONS.includes(direction)) {
      return cloneLayoutTree(tree);
    }
    const withoutSource = removeLayoutModule(cloneLayoutTree(tree), sourceId);
    if (!withoutSource) return cloneLayoutTree(tree);
    const source = moduleLayoutNode(sourceId);
    const splitDirection = direction === 'left' || direction === 'right' ? 'row' : 'column';
    return direction === 'left' || direction === 'top'
      ? splitLayoutNode(splitDirection, 50, source, withoutSource)
      : splitLayoutNode(splitDirection, 50, withoutSource, source);
  }

  function layoutDropIntent(rect, clientX, clientY) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return { mode: 'swap' };
    const x = U.clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = U.clamp((clientY - rect.top) / rect.height, 0, 1);
    const distances = { left: x, right: 1 - x, top: y, bottom: 1 - y };
    const nearest = Object.entries(distances).sort((a, b) => a[1] - b[1])[0];
    return nearest[1] <= U.MODULE_EDGE_DROP_RATIO
      ? { mode: 'insert', direction: nearest[0] }
      : { mode: 'swap' };
  }

  function layoutRootEdgeSize(rect, direction) {
    const length = direction === 'left' || direction === 'right' ? rect.width : rect.height;
    return U.clamp(length * U.ROOT_EDGE_DROP_RATIO, U.ROOT_EDGE_DROP_MIN_PX, U.ROOT_EDGE_DROP_MAX_PX);
  }

  function layoutRootDropIntent(rect, clientX, clientY) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const x = U.clamp(clientX - rect.left, 0, rect.width);
    const y = U.clamp(clientY - rect.top, 0, rect.height);
    const candidates = [
      ['left', x],
      ['right', rect.width - x],
      ['top', y],
      ['bottom', rect.height - y],
    ].map(([direction, distance]) => ({
      direction,
      distance,
      size: layoutRootEdgeSize(rect, direction),
    })).filter((candidate) => candidate.distance <= candidate.size);
    if (!candidates.length) return null;
    candidates.sort((a, b) => (a.distance / a.size) - (b.distance / b.size));
    return { mode: 'root-insert', direction: candidates[0].direction };
  }

  function layoutDropPreviewRect(rect, intent) {
    const edge = intent?.mode === 'insert' || intent?.mode === 'root-insert'
      ? intent.direction : null;
    const edgeSize = intent?.mode === 'root-insert'
      ? layoutRootEdgeSize(rect, edge)
      : edge === 'left' || edge === 'right'
        ? rect.width * U.MODULE_EDGE_DROP_RATIO
        : edge === 'top' || edge === 'bottom'
          ? rect.height * U.MODULE_EDGE_DROP_RATIO
          : 0;
    const width = edge === 'left' || edge === 'right' ? edgeSize : rect.width;
    const height = edge === 'top' || edge === 'bottom' ? edgeSize : rect.height;
    return {
      left: edge === 'right' ? rect.left + rect.width - width : rect.left,
      top: edge === 'bottom' ? rect.top + rect.height - height : rect.top,
      width,
      height,
    };
  }

  function directionLabel(direction) {
    return { left: '左侧', right: '右侧', top: '上方', bottom: '下方' }[direction] || '';
  }

  function normalizeLayoutRows(value) {
    const rows = Array.isArray(value) && value.length === 3
      ? value.map(Number) : [...U.DEFAULT_LAYOUT_ROWS];
    const top = U.clamp(Number.isFinite(rows[0]) ? rows[0] : 42, 12, 76);
    const maxMiddle = Math.max(6, 88 - top);
    const middle = U.clamp(Number.isFinite(rows[1]) ? rows[1] : U.DEFAULT_LAYOUT_ROWS[1], 6, maxMiddle);
    const bottom = Math.max(12, 100 - top - middle);
    return [top, middle, bottom];
  }

  function normalizeLayoutData(value) {
    const source = value && typeof value === 'object' ? value : {};
    const preset = U.RENDERER_PRESETS.includes(source.preset) ? source.preset : U.DEFAULT_SETTINGS.layout;
    const rows = normalizeLayoutRows(source.rows);
    const columnPercent = U.clamp(Number(source.columnPercent) || U.DEFAULT_SETTINGS.layoutColumnPercent, 30, 75);
    const splitPercent = U.clamp(Number(source.splitPercent) || U.DEFAULT_SETTINGS.splitPercent, 35, 75);
    const waveformMode = ['basic', 'multi'].includes(source.waveformMode) ? source.waveformMode : null;
    const rawWaveformSettings = source.waveformSettings;
    const waveformSettings = rawWaveformSettings && typeof rawWaveformSettings === 'object' ? {
      ...(U.ZOOM_PRESETS.includes(Number(rawWaveformSettings.visibleSeconds))
        ? { visibleSeconds: Number(rawWaveformSettings.visibleSeconds) } : {}),
      ...(U.ROW_PRESETS.includes(Number(rawWaveformSettings.secondsPerRow))
        ? { secondsPerRow: Number(rawWaveformSettings.secondsPerRow) } : {}),
      ...(U.ROW_HEIGHT_PRESETS.includes(Number(rawWaveformSettings.rowHeight))
        ? { rowHeight: Number(rawWaveformSettings.rowHeight) } : {}),
      ...(Number.isFinite(Number(rawWaveformSettings.waveformScale))
        ? { waveformScale: U.clampWaveformScale(Number(rawWaveformSettings.waveformScale)) } : {}),
      ...(rawWaveformSettings.side === 'left' || rawWaveformSettings.side === 'right'
        ? { side: rawWaveformSettings.side } : {}),
      ...(rawWaveformSettings.disabledDisplay === 'hidden' || rawWaveformSettings.disabledDisplay === 'dim'
        ? { disabledDisplay: rawWaveformSettings.disabledDisplay } : {}),
      ...(typeof rawWaveformSettings.showGroupBadges === 'boolean'
        ? { showGroupBadges: rawWaveformSettings.showGroupBadges } : {}),
      ...(typeof rawWaveformSettings.dragPlayhead === 'boolean'
        ? { dragPlayhead: rawWaveformSettings.dragPlayhead } : {}),
    } : null;
    const candidateTree = normalizeLayoutTree(source.tree);
    const tree = isCompleteLayoutTree(candidateTree)
      ? candidateTree
      : cloneLayoutTree(preset === 'classic' ? U.CLASSIC_LAYOUT_EDIT_TREE : U.DEFAULT_RIGHT_LAYOUT_TREE);
    return {
      schema: U.WORKSPACE_SCHEMA,
      preset,
      waveformMode,
      waveformSettings,
      splitPercent,
      columnPercent,
      rows,
      tree,
    };
  }

  function swapLayoutModuleOrder(order, sourceId, targetId) {
    const next = normalizeModuleOrder(order);
    const sourceIndex = next.indexOf(sourceId);
    const targetIndex = next.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return next;
    [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
    return next;
  }

  Object.assign(U, {
    normalizeModuleOrder,
    moduleLayoutNode,
    splitLayoutNode,
    cloneLayoutTree,
    collectLayoutModules,
    normalizeLayoutTree,
    isCompleteLayoutTree,
    replaceLayoutModule,
    removeLayoutModule,
    swapLayoutTreeModules,
    insertLayoutModuleAtEdge,
    insertLayoutModuleAtRootEdge,
    layoutDropIntent,
    layoutRootEdgeSize,
    layoutRootDropIntent,
    layoutDropPreviewRect,
    directionLabel,
    normalizeLayoutRows,
    normalizeLayoutData,
    swapLayoutModuleOrder,
  });
})(typeof window !== 'undefined' ? window : globalThis);
