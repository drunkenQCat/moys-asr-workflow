// 各设置面板的定位与开合控制（编辑器/合并拆分/修剪/预览/列表/波形/字幕编辑）。
// 由 split-cluster codemod 自 editor.js 拆出：状态为本模块私有，外部仅经
// window.MaweSettingsPanels 冻结门面访问（可变状态为访问器属性，赋值语义不变）。
// 清单位置在 editor.js 之前；editor.js 全局仅在延迟执行的回调中访问。
(function initMaweSettingsPanels(global) {
  'use strict';



  function setEditorSettingsPanelOpen(open) {
    if (!MaweDom.editorSettingsPanel || !MaweDom.editorSettingsToggle) return;
    if (!open) {
      setMergeJoinSettingsPanelOpen(false);
      setSplitTrimSettingsPanelOpen(false);
    }
    MaweDom.editorSettingsToggle.classList.toggle('active', open);
    MaweDom.editorSettingsToggle.setAttribute('aria-expanded', String(open));
    // 先让按钮状态绘制出来，再展开/收起文档流中的大面板，避免布局重排把高亮拖后。
    cancelAnimationFrame(MaweCuePanelState.editorSettingsPanelFrame);
    MaweCuePanelState.editorSettingsPanelFrame = requestAnimationFrame(() => {
      MaweCuePanelState.editorSettingsPanelFrame = requestAnimationFrame(() => {
        MaweCuePanelState.editorSettingsPanelFrame = 0;
        if (MaweDom.editorSettingsToggle.getAttribute('aria-expanded') !== String(open)) return;
        MaweDom.editorSettingsPanel.hidden = !open;
      });
    });
  }



  function positionAnchoredSettingsPanel(panel, toggle) {
    if (!panel || panel.hidden || !toggle) return;
    const buttonRect = toggle.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, buttonRect.right - panelWidth),
      Math.max(margin, window.innerWidth - panelWidth - margin),
    );
    const belowTop = buttonRect.bottom + 6;
    const aboveTop = buttonRect.top - panelHeight - 6;
    let top = belowTop;
    if (belowTop + panelHeight > window.innerHeight - margin && aboveTop >= margin) {
      top = aboveTop;
    } else if (belowTop + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - panelHeight - margin);
    }
    panel.style.left = String(left) + 'px';
    panel.style.top = String(top) + 'px';
  }



  function positionMergeJoinSettingsPanel() {
    positionAnchoredSettingsPanel(MaweDom.mergeJoinSettingsPanel, MaweDom.mergeJoinSettingsToggle);
  }



  function setMergeJoinSettingsPanelOpen(open) {
    if (!MaweDom.mergeJoinSettingsPanel || !MaweDom.mergeJoinSettingsToggle) return;
    MaweDom.mergeJoinSettingsPanel.hidden = !open;
    MaweDom.mergeJoinSettingsToggle.classList.toggle('active', open);
    MaweDom.mergeJoinSettingsToggle.setAttribute('aria-expanded', String(open));
    if (open) positionMergeJoinSettingsPanel();
  }



  function positionSplitTrimSettingsPanel() {
    positionAnchoredSettingsPanel(MaweDom.splitTrimSettingsPanel, MaweDom.splitTrimSettingsToggle);
  }



  function setSplitTrimSettingsPanelOpen(open) {
    if (!MaweDom.splitTrimSettingsPanel || !MaweDom.splitTrimSettingsToggle) return;
    MaweDom.splitTrimSettingsPanel.hidden = !open;
    MaweDom.splitTrimSettingsToggle.classList.toggle('active', open);
    MaweDom.splitTrimSettingsToggle.setAttribute('aria-expanded', String(open));
    if (open) positionSplitTrimSettingsPanel();
  }



  function setSettingsPanelOwnerOpen(panel, open) {
    const owner = panel?.closest('.player-wrap, .current-cue-panel, .cues-container, .waveform-pane');
    owner?.classList.toggle('settings-panel-owner-open', open);
  }



  function positionSubtitlePreviewSettingsPanel() {
    positionAnchoredSettingsPanel(MaweDom.subtitlePreviewSettingsPanel, MaweDom.subtitlePreviewSettingsToggle);
  }



  function setSubtitlePreviewSettingsPanelOpen(open) {
    if (!MaweDom.subtitlePreviewSettingsPanel || !MaweDom.subtitlePreviewSettingsToggle) return;
    MaweDom.subtitlePreviewSettingsPanel.hidden = !open;
    setSettingsPanelOwnerOpen(MaweDom.subtitlePreviewSettingsPanel, open);
    MaweDom.subtitlePreviewSettingsToggle.classList.toggle('active', open);
    MaweDom.subtitlePreviewSettingsToggle.setAttribute('aria-expanded', String(open));
    if (open) positionSubtitlePreviewSettingsPanel();
  }



  function positionCueListSettingsPanel() {
    positionAnchoredSettingsPanel(MaweDom.cueListSettingsPanel, MaweDom.cueListSettingsToggle);
  }



  function setCueListSettingsPanelOpen(open) {
    if (!MaweDom.cueListSettingsPanel || !MaweDom.cueListSettingsToggle) return;
    MaweDom.cueListSettingsPanel.hidden = !open;
    setSettingsPanelOwnerOpen(MaweDom.cueListSettingsPanel, open);
    MaweDom.cueListSettingsToggle.classList.toggle('active', open);
    MaweDom.cueListSettingsToggle.setAttribute('aria-expanded', String(open));
    if (open) positionCueListSettingsPanel();
  }



  function positionCueEditorSettingsPanel() {
    positionAnchoredSettingsPanel(MaweDom.cueEditorSettingsPanel, MaweDom.cueEditorSettingsToggle);
  }



  function setCueEditorSettingsPanelOpen(open) {
    if (!MaweDom.cueEditorSettingsPanel || !MaweDom.cueEditorSettingsToggle) return;
    MaweDom.cueEditorSettingsPanel.hidden = !open;
    setSettingsPanelOwnerOpen(MaweDom.cueEditorSettingsPanel, open);
    MaweDom.cueEditorSettingsToggle.classList.toggle('active', open);
    MaweDom.cueEditorSettingsToggle.setAttribute('aria-expanded', String(open));
    if (open) positionCueEditorSettingsPanel();
  }



  function positionWaveformSettingsPanel() {
    positionAnchoredSettingsPanel(MaweDom.waveformSettingsPanel, MaweDom.waveformSettingsToggle);
  }



  function setWaveformSettingsPanelOpen(open) {
    if (!MaweDom.waveformSettingsPanel || !MaweDom.waveformSettingsToggle) return;
    MaweDom.waveformSettingsPanel.hidden = !open;
    setSettingsPanelOwnerOpen(MaweDom.waveformSettingsPanel, open);
    MaweDom.waveformSettingsToggle.classList.toggle('active', open);
    MaweDom.waveformSettingsToggle.setAttribute('aria-expanded', String(open));
    if (open) positionWaveformSettingsPanel();
  }

  global.MaweSettingsPanels = Object.freeze({
    setEditorSettingsPanelOpen,
    positionAnchoredSettingsPanel,
    positionMergeJoinSettingsPanel,
    setMergeJoinSettingsPanelOpen,
    positionSplitTrimSettingsPanel,
    setSplitTrimSettingsPanelOpen,
    setSettingsPanelOwnerOpen,
    positionSubtitlePreviewSettingsPanel,
    setSubtitlePreviewSettingsPanelOpen,
    positionCueListSettingsPanel,
    setCueListSettingsPanelOpen,
    positionCueEditorSettingsPanel,
    setCueEditorSettingsPanelOpen,
    positionWaveformSettingsPanel,
    setWaveformSettingsPanelOpen
  });
})(typeof window !== 'undefined' ? window : globalThis);
