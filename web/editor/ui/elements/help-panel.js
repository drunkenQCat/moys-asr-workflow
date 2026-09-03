// 帮助面板（含主题开关、页签与拖拽定位键）。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsHelpPanel(global) {
  'use strict';

  const U = global.MaweElements;


  const helpToggle = document.getElementById('help-toggle');


  const themeToggle = document.getElementById('theme-toggle');


  const helpPanel = document.getElementById('help-panel');


  const helpDragHandle = document.getElementById('help-drag-handle');


  const helpCloseButton = document.getElementById('help-close');


  const helpSplitKey = document.getElementById('help-split-key');


  const cueEditorSplitKey = document.getElementById('cue-editor-split-key');


  const cueEditorConfirmKey = document.getElementById('cue-editor-confirm-key');


  const helpTabButtons = Array.from(document.querySelectorAll('[data-help-tab]'));


  const helpTabPanels = Array.from(document.querySelectorAll('[data-help-tab-panel]'));


  const helpAdvancedToggle = document.getElementById('help-advanced-toggle');


  const helpAdvancedTabs = document.getElementById('help-advanced-tabs');


  const helpAdvancedTabButtons = Array.from(helpAdvancedTabs?.querySelectorAll('[data-help-tab]') || []);


  const helpOpenWaveformSettingsButtons = Array.from(document.querySelectorAll('[data-help-open-waveform-settings]'));


  const helpOpenMediaSettingsButtons = Array.from(document.querySelectorAll('[data-help-open-media-settings]'));


  const helpOpenGapRemovePanelButton = document.getElementById('help-open-gap-remove-panel');


  const contextualHelpButtons = Array.from(document.querySelectorAll('[data-help-tab-target]'));


  const helpMediaSeekStep = document.getElementById('help-media-seek-step');


  const HELP_PANEL_POSITION_KEY = 'moy.asr.help.panel.v1';


  const HELP_PANEL_SIZE_KEY = 'moy.asr.help.panel.size.v1';

  Object.assign(U, {
    helpToggle,
    themeToggle,
    helpPanel,
    helpDragHandle,
    helpCloseButton,
    helpSplitKey,
    cueEditorSplitKey,
    cueEditorConfirmKey,
    helpTabButtons,
    helpTabPanels,
    helpAdvancedToggle,
    helpAdvancedTabs,
    helpAdvancedTabButtons,
    helpOpenWaveformSettingsButtons,
    helpOpenMediaSettingsButtons,
    helpOpenGapRemovePanelButton,
    contextualHelpButtons,
    helpMediaSeekStep,
    HELP_PANEL_POSITION_KEY,
    HELP_PANEL_SIZE_KEY,
  });
})(typeof window !== 'undefined' ? window : globalThis);
