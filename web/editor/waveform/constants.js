// 波形运行时的协议标识、模块清单与显示常量。
// 自 web/editor/waveform/runtime.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweWaveform；
// 兼容出口 window.AsrWaveform 仍由 editor/waveform/compat-surface.js 统一组装。

(function initMaweWaveformConstants(global) {
  'use strict';

  const U = global.MaweWaveform;

  const SETTINGS_KEY = 'moy.asr.waveform.settings.v1';
  const SCHEMA = 'moy.asr.waveform.v1';
  const ENCODING = 'i8-minmax-base64';
  const SPECTRAL_SCHEMA = 'moy.asr.spectral.v1';
  const SPECTRAL_ENCODING = 'u16-freq-density-base64';
  const WORKSPACE_SCHEMA = 'moy.asr.editor.workspace.v1';

  // 渲染器预设：classic / wave-right 由专属 CSS 网格渲染；custom 由 layoutTree 渲染
  // （大荧幕布局与用户保存的自定义工作区都以树渲染）。
  const RENDERER_PRESETS = ['classic', 'wave-right', 'custom'];
  // 内置工作区 id：下拉框可选项；custom 预设都由各自的布局树渲染。
  const BUILTIN_WORKSPACE_IDS = ['classic', 'wave-right', 'three-fold', 'cinema'];
  const MODULE_IDS = ['player', 'panel', 'cues', 'wave'];
  const MODULE_LABELS = { player: '视频', panel: '当前字幕', cues: '字幕列表', wave: '波形' };
  const DEFAULT_MODULE_ORDER = ['player', 'panel', 'cues', 'wave'];
  const LAYOUT_DIRECTIONS = ['left', 'right', 'top', 'bottom'];
  const MODULE_EDGE_DROP_RATIO = 0.24;
  const ROOT_EDGE_DROP_RATIO = 0.055;
  const ROOT_EDGE_DROP_MIN_PX = 24;
  const ROOT_EDGE_DROP_MAX_PX = 48;
  const ZOOM_PRESETS = [5, 10, 20, 30, 60];
  const ROW_PRESETS = [5, 10, 20, 30];
  const ROW_HEIGHT_PRESETS = [64, 80, 96, 120, 144, 168];
  const ROW_GAP = 10;
  const SPLIT_FLASH_DURATION_MS = 720;
  // 多行波形保留视口前后少量行，字幕快捷键跨行时可以直接复用已绘制的行。
  // 行本身仍按可视区增量创建，不会把整段长媒体一次性放进 DOM。
  const MULTI_ROW_BUFFER = 2;
  const MIN_CUE_MS = 100;
  const MIN_WAVEFORM_SCALE = 0.25;
  const MAX_WAVEFORM_SCALE = 6;
  const SNAP_MS = 80;
  const ROUND_MS = 10;
  // 连续 seek 会让浏览器反复解码并触发编辑器刷新；拖动时保留约 30 FPS
  // 的定位更新，松开指针时再补一次精确 seek。
  const PLAYHEAD_DRAG_SEEK_INTERVAL_MS = 32;
  const WAVEFORM_ADJUST_DEBOUNCE_MS = 160;
  const BROWSER_DECODE_LIMIT = 512 * 1024 * 1024;
  const BROWSER_PCM_ESTIMATE_LIMIT = 768 * 1024 * 1024;
  // 调色板数值唯一来源于 maw/speaker.py，渲染时注入 window.ASR_EDITOR_PALETTE；
  // Node 测试等无注入环境回退为空表（colorForSegment 走存储值兜底）。
  const PALETTE = Object.fromEntries(
    ((typeof window !== 'undefined' && window.ASR_EDITOR_PALETTE) || []).map((c) => [c.name, c.value]),
  );

  Object.assign(U, {
    SETTINGS_KEY,
    SCHEMA,
    ENCODING,
    SPECTRAL_SCHEMA,
    SPECTRAL_ENCODING,
    WORKSPACE_SCHEMA,
    RENDERER_PRESETS,
    BUILTIN_WORKSPACE_IDS,
    MODULE_IDS,
    MODULE_LABELS,
    DEFAULT_MODULE_ORDER,
    LAYOUT_DIRECTIONS,
    MODULE_EDGE_DROP_RATIO,
    ROOT_EDGE_DROP_RATIO,
    ROOT_EDGE_DROP_MIN_PX,
    ROOT_EDGE_DROP_MAX_PX,
    ZOOM_PRESETS,
    ROW_PRESETS,
    ROW_HEIGHT_PRESETS,
    ROW_GAP,
    SPLIT_FLASH_DURATION_MS,
    MULTI_ROW_BUFFER,
    MIN_CUE_MS,
    MIN_WAVEFORM_SCALE,
    MAX_WAVEFORM_SCALE,
    SNAP_MS,
    ROUND_MS,
    PLAYHEAD_DRAG_SEEK_INTERVAL_MS,
    WAVEFORM_ADJUST_DEBOUNCE_MS,
    BROWSER_DECODE_LIMIT,
    BROWSER_PCM_ESTIMATE_LIMIT,
    PALETTE,
  });
})(typeof window !== 'undefined' ? window : globalThis);
