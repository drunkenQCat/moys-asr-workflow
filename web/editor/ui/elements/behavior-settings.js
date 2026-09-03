// 切分、合并、字幕列表与编辑面板的行为开关。
// 自 web/editor/ui/elements.js 的单个巨型 IIFE 拆出。内部符号发布到 window.MaweElements；
// 兼容出口 window.MaweDom 仍由 editor/ui/elements/compat-surface.js 统一组装。
(function initMaweElementsBehaviorSettings(global) {
  'use strict';

  const U = global.MaweElements;


  const splitKeySel = document.getElementById('split-key');


  const splitUseWordTimestampsToggle = document.getElementById('split-use-word-timestamps');


  const mergeJoinTextContinuousInput = document.getElementById('merge-join-text-continuous');


  const mergeJoinTextWordInput = document.getElementById('merge-join-text-word');


  const cueListShowIndexToggle = document.getElementById('cue-list-show-index');


  const cueListShowTimeToggle = document.getElementById('cue-list-show-time');


  const cueListShowStickerToggle = document.getElementById('cue-list-show-sticker');


  const cueListShowCharcountToggle = document.getElementById('cue-list-show-charcount');


  const cueListAutoScrollOnClickToggle = document.getElementById('cue-list-auto-scroll-on-click');


  const cueListKeepSplitVisibleToggle = document.getElementById('cue-list-keep-split-visible');


  const cueListCharcountThresholdInput = document.getElementById('charcount-threshold');


  const cueListSettings = document.getElementById('cue-list-settings');


  const cueListSettingsToggle = document.getElementById('cue-list-settings-toggle');


  const cueListSettingsPanel = document.getElementById('cue-list-settings-panel');


  const hideDisabledToggle = document.getElementById('hide-disabled-toggle');


  let hideDisabled = false;

    // 「隐藏禁用项」开关状态
  const cueEditorShowNavigationToggle = document.getElementById('cue-editor-show-navigation');


  const cueEditorShowTimeActionsToggle = document.getElementById('cue-editor-show-time-actions');


  const cueEditorShowStickerToggle = document.getElementById('cue-editor-show-sticker');


  const cueEditorCancelOnEscapeToggle = document.getElementById('cue-editor-cancel-on-escape');


  const selectGroupMembersToggle = document.getElementById('select-group-members');

  Object.assign(U, {
    splitKeySel,
    splitUseWordTimestampsToggle,
    mergeJoinTextContinuousInput,
    mergeJoinTextWordInput,
    cueListShowIndexToggle,
    cueListShowTimeToggle,
    cueListShowStickerToggle,
    cueListShowCharcountToggle,
    cueListAutoScrollOnClickToggle,
    cueListKeepSplitVisibleToggle,
    cueListCharcountThresholdInput,
    cueListSettings,
    cueListSettingsToggle,
    cueListSettingsPanel,
    hideDisabledToggle,
    cueEditorShowNavigationToggle,
    cueEditorShowTimeActionsToggle,
    cueEditorShowStickerToggle,
    cueEditorCancelOnEscapeToggle,
    selectGroupMembersToggle,
  });
  // hideDisabled 是本模块可变状态且兼容出口为它提供 setter（外部经出口赋值）：以 get/set 访问器发布，
  // 语义与拆分前整个闭包共享同一个 let 完全一致。
  Object.defineProperty(U, 'hideDisabled', { enumerable: true, configurable: true,
    get: () => hideDisabled, set: (value) => { hideDisabled = value; } });
})(typeof window !== 'undefined' ? window : globalThis);
