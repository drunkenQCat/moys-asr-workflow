// 内置工作区：布局树、右侧栏默认比例与各工作区的字幕预览显示预设。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformWorkspaces(global) {
  'use strict';

  const U = global.MaweWaveform;
  const DEFAULT_RIGHT_LAYOUT_TREE = {
    type: 'split', direction: 'row', ratio: 30,
    children: [
      {
        type: 'split', direction: 'column', ratio: 42,
        children: [
          { type: 'module', id: 'player' },
          {
            type: 'split', direction: 'column', ratio: 20,
            children: [{ type: 'module', id: 'panel' }, { type: 'module', id: 'cues' }],
          },
        ],
      },
      { type: 'module', id: 'wave' },
    ],
  };
  // 大荧幕布局：左上大视频区、右上当前字幕/字幕列表、底部整行波形；以 custom 渲染器渲染。
  const CINEMA_SCREEN_LAYOUT_TREE = {
    type: 'split', direction: 'column', ratio: 72.711956653046,
    children: [
      {
        type: 'split', direction: 'row', ratio: 55.207499921561244,
        children: [
          { type: 'module', id: 'player' },
          {
            type: 'split', direction: 'column', ratio: 20,
            children: [{ type: 'module', id: 'panel' }, { type: 'module', id: 'cues' }],
          },
        ],
      },
      { type: 'module', id: 'wave' },
    ],
  };
  // 字幕列表编辑（内置 classic 工作区）：左侧上「视频|当前字幕」、下多行波形，右侧整列字幕列表。
  const SUBTITLE_LIST_EDIT_LAYOUT_TREE = {
    type: 'split', direction: 'row', ratio: 55,
    children: [
      {
        type: 'split', direction: 'column', ratio: 43,
        children: [
          {
            type: 'split', direction: 'row', ratio: 63,
            children: [{ type: 'module', id: 'player' }, { type: 'module', id: 'panel' }],
          },
          { type: 'module', id: 'wave' },
        ],
      },
      { type: 'module', id: 'cues' },
    ],
  };
  // 三折叠布局：左侧上下为当前字幕/视频，右侧上下为字幕列表/波形。
  const THREE_FOLD_LAYOUT_TREE = {
    type: 'split', direction: 'row', ratio: 28.32664152704568,
    children: [
      {
        type: 'split', direction: 'column', ratio: 29.702416354679702,
        children: [{ type: 'module', id: 'panel' }, { type: 'module', id: 'player' }],
      },
      {
        type: 'split', direction: 'row', ratio: 34.57890198332854,
        children: [{ type: 'module', id: 'cues' }, { type: 'module', id: 'wave' }],
      },
    ],
  };
  const CLASSIC_LAYOUT_EDIT_TREE = {
    type: 'split', direction: 'column', ratio: 38,
    children: [
      { type: 'module', id: 'player' },
      {
        type: 'split', direction: 'column', ratio: 24,
        children: [
          { type: 'module', id: 'panel' },
          {
            type: 'split', direction: 'row', ratio: 50,
            children: [{ type: 'module', id: 'wave' }, { type: 'module', id: 'cues' }],
          },
        ],
      },
    ],
  };
  // 右侧整列波形布局：当前字幕编辑区略收紧，把空间让给字幕列表。
  const DEFAULT_LAYOUT_ROWS = [42, 16, 42];
  const DEFAULT_SETTINGS = {
    mode: 'multi',
    layout: 'wave-right',
    visibleSeconds: 20,
    secondsPerRow: 10,
    rowHeight: 120,
    side: 'left',
    splitPercent: 60,
    layoutColumnPercent: 30,
    layoutRows: [...DEFAULT_LAYOUT_ROWS],
    layoutTree: DEFAULT_RIGHT_LAYOUT_TREE,
    layoutEditing: false,
    waveformScale: 1,
    disabledDisplay: 'dim',
    showGroupBadges: true,
    dragPlayhead: true,
    spectralColor: false,
  };
  // 内置工作区默认的列表/编辑区显示开关：列表默认显示表情包列。
  const DEFAULT_EDITOR_DISPLAY = {
    cueListShowIndex: true, cueListShowTime: true, cueListShowSticker: true, cueListShowCharcount: true,
    cueEditorShowNavigation: false, cueEditorShowTimeActions: false, cueEditorShowSticker: false,
  };
  const SUBTITLE_LIST_EDITOR_DISPLAY = {
    ...DEFAULT_EDITOR_DISPLAY,
    cueEditorShowNavigation: true, cueEditorShowTimeActions: true, cueEditorShowSticker: true,
  };
  const CINEMA_SCREEN_EDITOR_DISPLAY = {
    ...DEFAULT_EDITOR_DISPLAY,
    cueEditorShowTimeActions: true,
  };
  const THREE_FOLD_EDITOR_DISPLAY = {
    ...DEFAULT_EDITOR_DISPLAY,
    cueListShowTime: false,
    cueEditorShowNavigation: true, cueEditorShowTimeActions: true, cueEditorShowSticker: true,
  };
  const BUILTIN_WORKSPACES = {
    // 字幕列表编辑（界面显示名）：聚焦右侧整列字幕列表，以 custom 渲染器渲染。
    classic: {
      preset: 'custom', waveformMode: 'multi', splitPercent: 60, columnPercent: 36,
      rows: [42, 18, 40], tree: SUBTITLE_LIST_EDIT_LAYOUT_TREE,
      editorDisplay: SUBTITLE_LIST_EDITOR_DISPLAY,
    },
    'wave-right': {
      preset: 'wave-right', waveformMode: 'multi', splitPercent: 60, columnPercent: 30,
      rows: [42, 16, 42], tree: DEFAULT_RIGHT_LAYOUT_TREE,
      editorDisplay: DEFAULT_EDITOR_DISPLAY,
    },
    'three-fold': {
      preset: 'custom', waveformMode: 'multi',
      waveformSettings: {
        visibleSeconds: 20, secondsPerRow: 10, rowHeight: 120, waveformScale: 4,
        side: 'left', disabledDisplay: 'dim', showGroupBadges: true, dragPlayhead: true,
      },
      splitPercent: 60, columnPercent: 30, rows: [42, 16, 42], tree: THREE_FOLD_LAYOUT_TREE,
      editorDisplay: THREE_FOLD_EDITOR_DISPLAY,
    },
    // 大荧幕布局：左上大视频区、右上当前字幕/字幕列表、底部整行单行波形；以 custom 渲染器渲染。
    cinema: {
      preset: 'custom', waveformMode: 'basic',
      waveformSettings: {
        visibleSeconds: 20, secondsPerRow: 10, rowHeight: 120, waveformScale: 5.5,
        side: 'left', disabledDisplay: 'dim', showGroupBadges: true, dragPlayhead: true,
      },
      splitPercent: 60, columnPercent: 36, rows: [42, 18, 40], tree: CINEMA_SCREEN_LAYOUT_TREE,
      editorDisplay: CINEMA_SCREEN_EDITOR_DISPLAY,
    },
  };

  Object.assign(U, {
    DEFAULT_LAYOUT_ROWS,
    DEFAULT_RIGHT_LAYOUT_TREE,
    CINEMA_SCREEN_LAYOUT_TREE,
    SUBTITLE_LIST_EDIT_LAYOUT_TREE,
    THREE_FOLD_LAYOUT_TREE,
    CLASSIC_LAYOUT_EDIT_TREE,
    DEFAULT_SETTINGS,
    DEFAULT_EDITOR_DISPLAY,
    SUBTITLE_LIST_EDITOR_DISPLAY,
    CINEMA_SCREEN_EDITOR_DISPLAY,
    THREE_FOLD_EDITOR_DISPLAY,
    BUILTIN_WORKSPACES,
  });
})(typeof window !== 'undefined' ? window : globalThis);
