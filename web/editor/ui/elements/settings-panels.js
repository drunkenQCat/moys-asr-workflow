// 编辑器设置分组面板、自动保存与最近工程菜单。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsSettingsPanels(global) {
  'use strict';

  const U = global.MaweElements;


  const editorSettingsToggle = document.getElementById('editor-settings-toggle');


  const editorSettingsPanel = document.getElementById('editor-settings-panel');


  const mergeJoinSettings = document.getElementById('merge-join-settings');


  const mergeJoinSettingsToggle = document.getElementById('merge-join-settings-toggle');


  const mergeJoinSettingsPanel = document.getElementById('merge-join-settings-panel');


  const splitTrimSettings = document.getElementById('split-trim-settings');


  const splitTrimSettingsToggle = document.getElementById('split-trim-settings-toggle');


  const splitTrimSettingsPanel = document.getElementById('split-trim-settings-panel');


  const subtitlePreviewSettings = document.getElementById('subtitle-preview-settings');


  const subtitlePreviewSettingsToggle = document.getElementById('subtitle-preview-settings-toggle');


  const subtitlePreviewSettingsPanel = document.getElementById('subtitle-preview-settings-panel');


  const cueEditorSettings = document.getElementById('cue-editor-settings');


  const cueEditorSettingsToggle = document.getElementById('cue-editor-settings-toggle');


  const cueEditorSettingsPanel = document.getElementById('cue-editor-settings-panel');


  const waveformSettings = document.getElementById('waveform-settings');


  const waveformSettingsToggle = document.getElementById('waveform-settings-toggle');


  const waveformSettingsPanel = document.getElementById('waveform-settings-panel');


  const exportStartAtZeroToggle = document.getElementById('export-start-at-zero');


  const serverAutoSaveSettings = document.getElementById('server-auto-save-settings');


  const autoSaveProjectToggle = document.getElementById('auto-save-project');


  const autoSaveIntervalField = document.getElementById('auto-save-interval-field');


  const autoSaveIntervalInput = document.getElementById('auto-save-interval');


  const recentProjectsEl = document.getElementById('recent-projects');


  const recentProjectsToggle = document.getElementById('recent-projects-toggle');


  const recentProjectsMenu = document.getElementById('recent-projects-menu');


  const recentProjectsList = document.getElementById('recent-projects-list');


  const recentProjectsSeparator = document.getElementById('recent-projects-separator');


  const serverProjectSettingsEl = document.getElementById('server-project-settings');


  const autoOpenLastProjectToggle = document.getElementById('auto-open-last-project');


  const waveformShapeSourceSelect = document.getElementById('waveform-shape-source');

  Object.assign(U, {
    editorSettingsToggle,
    editorSettingsPanel,
    mergeJoinSettings,
    mergeJoinSettingsToggle,
    mergeJoinSettingsPanel,
    splitTrimSettings,
    splitTrimSettingsToggle,
    splitTrimSettingsPanel,
    subtitlePreviewSettings,
    subtitlePreviewSettingsToggle,
    subtitlePreviewSettingsPanel,
    cueEditorSettings,
    cueEditorSettingsToggle,
    cueEditorSettingsPanel,
    waveformSettings,
    waveformSettingsToggle,
    waveformSettingsPanel,
    exportStartAtZeroToggle,
    serverAutoSaveSettings,
    autoSaveProjectToggle,
    autoSaveIntervalField,
    autoSaveIntervalInput,
    recentProjectsEl,
    recentProjectsToggle,
    recentProjectsMenu,
    recentProjectsList,
    recentProjectsSeparator,
    serverProjectSettingsEl,
    autoOpenLastProjectToggle,
    waveformShapeSourceSelect,
  });
})(typeof window !== 'undefined' ? window : globalThis);
