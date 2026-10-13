import { legacyBindings as __mawImportedBindings0 } from "../ui/editor-wiring-dom-panels.js";
import { legacyBindings as __mawImportedBindings1 } from "./editor-wiring-ass-storage.js";
import { legacyBindings as __mawImportedBindings2 } from "./editor-wiring-font-geometry.js";
export let legacyBindings;
export function* initialize() {
legacyBindings = Object.freeze({
get assStyleLibraryUsesServerStorage() { return assStyleLibraryUsesServerStorage; },
get setAssStyleLibraryStatus() { return setAssStyleLibraryStatus; },
get updateAssStyleLibraryStatus() { return updateAssStyleLibraryStatus; },
get assStyleManagerSetSelection() { return assStyleManagerSetSelection; },
get updateAssStylePreviewModeHints() { return updateAssStylePreviewModeHints; },
get updateAssStyleManagerLibrary() { return updateAssStyleManagerLibrary; },
get syncAssStyleForm() { return syncAssStyleForm; },
get syncAssStyleManager() { return syncAssStyleManager; },
get syncAssModeDependentControls() { return syncAssModeDependentControls; },
get syncAssModeControl() { return syncAssModeControl; }
});
yield;



const ASS_STYLE_WINDOW_POSITION_KEY = 'moy.asr.ass_style.window.v1';
let assStyleManagerSelection = { kind: 'style', id: 'ass' };
let assStyleLibraryStatusText = '';
let assStyleLibraryStatusState = 'idle';

function assStyleLibraryUsesServerStorage() {
  return Boolean(MaweBoot.SERVER_CONFIG?.assStylesUrl);
}

function setAssStyleLibraryStatus(text, state = 'idle') {
  assStyleLibraryStatusText = String(text || '');
  assStyleLibraryStatusState = state;
  updateAssStyleLibraryStatus();
}

function updateAssStyleLibraryStatus() {
  if (!__mawImportedBindings0.assStyleLibraryStatus) return;
  const usesServerStorage = assStyleLibraryUsesServerStorage();
  const fallback = usesServerStorage
    ? (__mawImportedBindings1.ASS_STYLE_LIBRARY_READY ? '已与用户级配置同步' : '使用本地副本，尚未同步')
    : '仅保存在当前浏览器（便携模式）';
  const status = assStyleLibraryStatusText || fallback;
  __mawImportedBindings0.assStyleLibraryStatus.textContent = window.MAWE_I18N?.translateText?.(status) || status;
  __mawImportedBindings0.assStyleLibraryStatus.dataset.state = !usesServerStorage && assStyleLibraryStatusState === 'success'
    ? 'local' : assStyleLibraryStatusState;
  if (__mawImportedBindings0.assStyleLibraryPathHint) {
    const pathHint = !usesServerStorage
      ? '便携 Editor 仅保存到当前浏览器；请用 server-editor 打开后，才会与 Launcher 共享。'
      : __mawImportedBindings1.ASS_STYLE_LIBRARY_READY
        ? '已保存到本机用户级配置；Launcher 与 Editor 共享。'
        : '当前使用本地副本；服务器恢复后可再次点击保存同步。';
    __mawImportedBindings0.assStyleLibraryPathHint.textContent = window.MAWE_I18N?.translateText?.(pathHint) || pathHint;
  }
}

function assStyleManagerClone(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; }
}

function assStyleManagerId(prefix, items) {
  const existing = new Set((Array.isArray(items) ? items : []).map((item) => String(item?.id || '')));
  let id = '';
  do {
    id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (existing.has(id));
  return id.slice(0, 64);
}

function selectedAssStyle() {
  const id = assStyleManagerSelection.kind === 'style' ? assStyleManagerSelection.id : '';
  return window.AsrEditorUtils.assStyleForId(__mawImportedBindings1.ASS_STYLE_LIBRARY, id || 'ass');
}

function selectedAssProfile() {
  const id = assStyleManagerSelection.kind === 'profile' ? assStyleManagerSelection.id : '';
  return window.AsrEditorUtils.assProfileForId(__mawImportedBindings1.ASS_STYLE_LIBRARY, id || 'ass');
}

function assStyleManagerSetSelection(kind, id) {
  const collection = kind === 'profile' ? __mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles : __mawImportedBindings1.ASS_STYLE_LIBRARY.styles;
  const item = (Array.isArray(collection) ? collection : []).find((candidate) => candidate?.id === id);
  if (!item) return;
  assStyleManagerSelection = { kind, id };
  syncAssStyleManager({ force: true });
}

function appendAssStyleOption(select, value, label) {
  if (!select) return;
  select.append(new Option(label, value));
}

function assStylePreviewModeHintText() {
  return `需要启用 ASS 字幕模式来预览效果。${MaweSettings.EDITOR_SETTINGS.assMode === true ? '当前已启用。' : '当前未启用。'}`;
}

function updateAssStylePreviewModeHints() {
  const enabled = MaweSettings.EDITOR_SETTINGS.assMode === true;
  const prefix = '需要启用 ASS 字幕模式来预览效果。';
  const status = enabled ? '当前已启用。' : '当前未启用。';
  const text = assStylePreviewModeHintText();
  const translated = window.MAWE_I18N?.translateText?.(text) || text;
  document.querySelectorAll('[data-ass-style-preview-hint]').forEach((element) => {
    const prefixElement = element.querySelector('.ass-style-preview-mode-hint-prefix');
    const statusElement = element.querySelector('.ass-style-preview-mode-hint-status');
    if (prefixElement && statusElement) {
      prefixElement.textContent = window.MAWE_I18N?.translateText?.(prefix) || prefix;
      statusElement.textContent = window.MAWE_I18N?.translateText?.(status) || status;
      statusElement.dataset.assPreviewMode = enabled ? 'enabled' : 'disabled';
    } else {
      element.textContent = translated;
    }
    element.dataset.assPreviewMode = enabled ? 'enabled' : 'disabled';
    element.title = translated;
    element.setAttribute('aria-label', translated);
  });
}

function renderAssStyleList(list, items, kind, selectedId) {
  if (!list) return;
  list.replaceChildren();
  list.setAttribute('aria-busy', 'false');
  // 主样式 = 当前 ASS 导出方案关联的样式；副样式 = 双语字幕启用时的副字幕槽位。
  const mainStyleId = kind === 'style'
    ? String(__mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles?.find((profile) => profile.id === (__mawImportedBindings1.ASS_STYLE_LIBRARY.assignments?.assExportProfileId || 'ass'))?.styleId || 'ass')
    : '';
  const extensionStyleId = kind === 'style'
    ? String(__mawImportedBindings1.ASS_STYLE_LIBRARY.assignments?.assExtensionStyleId || 'ass-extension')
    : '';
  const extensionActive = kind === 'style' && MaweMultiSubtitleCore.multiSubtitleVisible();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.dataset.assSelectionKind = kind;
    button.dataset.assSelectionId = String(item.id || '');
    button.setAttribute('aria-selected', String(item.id || '') === selectedId ? 'true' : 'false');
    const label = document.createElement('span');
    label.className = 'ass-style-list-label';
    label.textContent = String(item.name || item.id || '未命名');
    button.append(label);
    const appendBadge = (text, modifier = '') => {
      const badge = document.createElement('span');
      badge.className = `ass-style-list-badge${modifier ? ` ${modifier}` : ''}`;
      badge.textContent = text;
      button.append(badge);
    };
    if (item.id === mainStyleId) appendBadge('主', 'ass-style-list-badge-primary');
    if (extensionActive && item.id === extensionStyleId) appendBadge('副', 'ass-style-list-badge-extension');
    if (item.builtin) appendBadge('内置');
    button.addEventListener('click', () => assStyleManagerSetSelection(kind, item.id));
    list.append(button);
  });
}

function assStyleFormValue(field) {
  if (!field) return null;
  if (field.type === 'checkbox') return field.checked;
  if (field.type === 'radio') return field.checked ? field.value : null;
  if (field.type === 'number') return field.value === '' ? null : Number(field.value);
  return field.value;
}

function updateAssStyleManagerLibrary(mutator, { persist = true } = {}) {
  const next = assStyleManagerClone(__mawImportedBindings1.ASS_STYLE_LIBRARY);
  if (!next) return;
  mutator(next);
  __mawImportedBindings1.assStyleLibraryRevision += 1;
  __mawImportedBindings1.setAssStyleLibrary(next, { persistLocal: true });
  if (persist) __mawImportedBindings1.scheduleAssStyleLibrarySave();
  syncAssStyleManager();
  MawePlaybackLoop.refreshSubtitlePreview?.();
}

function setNestedAssProfileValue(profile, path, value) {
  const [group, field] = String(path || '').split('.', 2);
  if (!group || !field || !profile.animations?.[group]) return;
  profile.animations[group] = { ...profile.animations[group], [field]: value };
}

function updateAssStyleField(field, value) {
  const styleId = assStyleManagerSelection.kind === 'style' ? assStyleManagerSelection.id : '';
  if (!styleId) return;
  updateAssStyleManagerLibrary((library) => {
    library.styles = library.styles.map((style) => style.id === styleId
      ? { ...style, [field]: value } : style);
  });
}

function updateAssProfileField(path, value) {
  const profileId = assStyleManagerSelection.kind === 'profile' ? assStyleManagerSelection.id : '';
  if (!profileId) return;
  updateAssStyleManagerLibrary((library) => {
    library.assProfiles = library.assProfiles.map((profile) => {
      if (profile.id !== profileId) return profile;
      const next = { ...profile, animations: assStyleManagerClone(profile.animations) };
      if (path === 'name' || path === 'styleId') next[path] = value;
      else setNestedAssProfileValue(next, path, value);
      return next;
    });
  });
}

function syncAssStyleForm(style) {
  if (!__mawImportedBindings0.assStyleForm) return;
  const safeStyle = window.AsrEditorUtils.normalizeAssStyle(style);
  const borderBox = Number(safeStyle.borderStyle) === 3;
  for (const [id, text] of [
    ['ass-style-outline-color-label', borderBox ? '底框颜色' : '描边颜色'],
    ['ass-style-outline-label', borderBox ? '底框宽度' : '描边宽度'],
    ['ass-style-outline-opacity-label', borderBox ? '底框不透明度' : '描边不透明度'],
  ]) {
    const label = document.getElementById(id);
    if (label) label.textContent = window.MAWE_I18N?.translateText?.(text) || text;
  }
  if (__mawImportedBindings0.assStyleFormTitle) __mawImportedBindings0.assStyleFormTitle.textContent = safeStyle.name;
  if (__mawImportedBindings0.assStyleBuiltinBadge) __mawImportedBindings0.assStyleBuiltinBadge.hidden = !safeStyle.builtin;
  const isSrtDefault = safeStyle.id === 'default';
  if (__mawImportedBindings0.assStyleSrtHint) __mawImportedBindings0.assStyleSrtHint.hidden = !isSrtDefault;
  if (__mawImportedBindings0.assStylePreviewModeHint) __mawImportedBindings0.assStylePreviewModeHint.hidden = isSrtDefault;
  __mawImportedBindings0.assStyleForm.querySelectorAll('[data-ass-style-field]').forEach((field) => {
    if (document.activeElement === field) return;
    const value = safeStyle[field.dataset.assStyleField];
    if (field.type === 'checkbox') field.checked = value === true;
    else if (field.type === 'radio') field.checked = String(value) === field.value;
    else if (value !== undefined && value !== null) field.value = String(value);
  });
  const emphasisSection = document.getElementById('ass-style-emphasis-section');
  if (emphasisSection) emphasisSection.hidden = MaweSettings.EDITOR_SETTINGS.assMode !== true;
  const emphasisOptions = document.getElementById('ass-style-emphasis-options');
  if (emphasisOptions) emphasisOptions.hidden = MaweSettings.EDITOR_SETTINGS.assEmphasisSyntax === 'none';
  const smallTextField = document.getElementById('ass-style-small-text-field');
  const largeTextField = document.getElementById('ass-style-large-text-field');
  if (smallTextField) smallTextField.hidden = MaweSettings.EDITOR_SETTINGS.assSmallTextEnabled === false;
  if (largeTextField) largeTextField.hidden = MaweSettings.EDITOR_SETTINGS.assLargeTextEnabled === false;
  if (__mawImportedBindings0.assStylePreviewSample) {
    // 样例与视频预览共用 Canvas 光栅管线：描边/底框/阴影观感一致。
    // style.fontSize 即样例画布上的字形高度（ascent+descent 语义）。
    window.MaweAssCanvas?.renderSample(__mawImportedBindings0.assStylePreviewSample, safeStyle, 'Aa 字幕预览 / 字幕样例');
  }
  updateAssStylePreviewModeHints();
}

function syncAssProfileForm(profile) {
  if (!__mawImportedBindings0.assProfileForm) return;
  const safeProfile = window.AsrEditorUtils.normalizeAssProfile(profile);
  if (__mawImportedBindings0.assProfileFormTitle) __mawImportedBindings0.assProfileFormTitle.textContent = safeProfile.name;
  if (__mawImportedBindings0.assProfileBuiltinBadge) __mawImportedBindings0.assProfileBuiltinBadge.hidden = !safeProfile.builtin;
  __mawImportedBindings0.assProfileForm.querySelectorAll('[data-ass-profile-field]').forEach((field) => {
    if (document.activeElement === field) return;
    const value = safeProfile[field.dataset.assProfileField];
    if (value !== undefined && value !== null) field.value = String(value);
  });
  __mawImportedBindings0.assProfileForm.querySelectorAll('[data-ass-animation]').forEach((field) => {
    const path = field.dataset.assAnimation;
    const [group, key] = path.split('.', 2);
    const value = safeProfile.animations?.[group]?.[key];
    if (document.activeElement !== field && value !== undefined) {
      if (field.type === 'checkbox') field.checked = value === true;
      else field.value = String(value);
    }
    field.disabled = key !== 'enabled' && safeProfile.animations?.[group]?.enabled !== true;
  });
  if (__mawImportedBindings0.assProfilePreviewSummary) {
    const tags = window.AsrEditorUtils.assAnimationOverrideTags(safeProfile);
    const style = window.AsrEditorUtils.assStyleForId(__mawImportedBindings1.ASS_STYLE_LIBRARY, safeProfile.styleId);
    const summary = `${style.name} · ${tags || '无逐句动画'}`;
    __mawImportedBindings0.assProfilePreviewSummary.textContent = window.MAWE_I18N?.translateText?.(summary) || summary;
  }
}

function syncAssStyleManager({ force = false } = {}) {
  if (!__mawImportedBindings0.assStyleWindow) return;
  __mawImportedBindings1.ASS_STYLE_LIBRARY = window.AsrEditorUtils.normalizeAssStyleLibrary(__mawImportedBindings1.ASS_STYLE_LIBRARY);
  const styles = __mawImportedBindings1.ASS_STYLE_LIBRARY.styles || [];
  const profiles = __mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles || [];
  const selectedCollection = assStyleManagerSelection.kind === 'profile' ? profiles : styles;
  if (!selectedCollection.some((item) => item.id === assStyleManagerSelection.id)) {
    assStyleManagerSelection = assStyleManagerSelection.kind === 'profile'
      ? { kind: 'profile', id: profiles[0]?.id || 'ass' }
      : { kind: 'style', id: styles[0]?.id || 'ass' };
  }
  if (__mawImportedBindings0.assStyleCount) __mawImportedBindings0.assStyleCount.textContent = String(styles.length);
  if (__mawImportedBindings0.assProfileCount) __mawImportedBindings0.assProfileCount.textContent = String(profiles.length);
  __mawImportedBindings1.updateAssStyleLibrarySummary();
  renderAssStyleList(__mawImportedBindings0.assStyleList, styles, 'style', assStyleManagerSelection.kind === 'style' ? assStyleManagerSelection.id : '');
  renderAssStyleList(__mawImportedBindings0.assProfileList, profiles, 'profile', assStyleManagerSelection.kind === 'profile' ? assStyleManagerSelection.id : '');
  if (__mawImportedBindings0.assSrtDefaultStyleSelect) {
    const active = __mawImportedBindings1.ASS_STYLE_LIBRARY.assignments?.srtBurnStyleId || 'default';
    __mawImportedBindings0.assSrtDefaultStyleSelect.replaceChildren();
    styles.forEach((style) => appendAssStyleOption(__mawImportedBindings0.assSrtDefaultStyleSelect, style.id, style.name));
    __mawImportedBindings0.assSrtDefaultStyleSelect.value = active;
  }
  if (__mawImportedBindings0.assDefaultProfileSelect) {
    const active = __mawImportedBindings1.ASS_STYLE_LIBRARY.assignments?.assExportProfileId || 'ass';
    __mawImportedBindings0.assDefaultProfileSelect.replaceChildren();
    profiles.forEach((profile) => appendAssStyleOption(__mawImportedBindings0.assDefaultProfileSelect, profile.id, profile.name));
    __mawImportedBindings0.assDefaultProfileSelect.value = active;
  }
  // 副字幕样式入口随多重字幕开合显隐：现在挂在方案表单里，与主字幕样式并排。
  const extensionSlotVisible = MaweMultiSubtitleCore.multiSubtitleVisible();
  if (__mawImportedBindings0.assProfileExtensionStyleField) __mawImportedBindings0.assProfileExtensionStyleField.hidden = !extensionSlotVisible;
  if (__mawImportedBindings0.assProfileExtensionStyleSelect) {
    __mawImportedBindings0.assProfileExtensionStyleSelect.replaceChildren();
    styles.forEach((style) => appendAssStyleOption(__mawImportedBindings0.assProfileExtensionStyleSelect, style.id, style.name));
    __mawImportedBindings0.assProfileExtensionStyleSelect.value = __mawImportedBindings1.ASS_STYLE_LIBRARY.assignments?.assExtensionStyleId || 'ass-extension';
  }
  if (__mawImportedBindings0.assProfileStyleSelect) {
    const selectedProfile = selectedAssProfile();
    __mawImportedBindings0.assProfileStyleSelect.replaceChildren();
    styles.forEach((style) => appendAssStyleOption(__mawImportedBindings0.assProfileStyleSelect, style.id, style.name));
    __mawImportedBindings0.assProfileStyleSelect.value = selectedProfile.styleId;
  }
  const isStyle = assStyleManagerSelection.kind === 'style';
  if (__mawImportedBindings0.assStyleEditorEmpty) __mawImportedBindings0.assStyleEditorEmpty.hidden = selectedCollection.length > 0;
  if (__mawImportedBindings0.assStyleForm) __mawImportedBindings0.assStyleForm.hidden = !isStyle;
  if (__mawImportedBindings0.assProfileForm) __mawImportedBindings0.assProfileForm.hidden = isStyle;
  const deleteSlot = isStyle ? __mawImportedBindings0.assStyleDeleteSlot : __mawImportedBindings0.assProfileDeleteSlot;
  if (deleteSlot && __mawImportedBindings0.assStyleDeleteButton && __mawImportedBindings0.assStyleDeleteButton.parentElement !== deleteSlot) {
    deleteSlot.append(__mawImportedBindings0.assStyleDeleteButton);
  }
  if (__mawImportedBindings0.assStyleDeleteButton) {
    const selected = selectedCollection.find((item) => item.id === assStyleManagerSelection.id);
    __mawImportedBindings0.assStyleDeleteButton.disabled = !selected || selected.builtin === true;
    __mawImportedBindings0.assStyleDeleteButton.title = selected?.builtin ? '内置条目不能删除' : '删除当前条目';
  }
  if (isStyle) syncAssStyleForm(selectedAssStyle());
  else syncAssProfileForm(selectedAssProfile());
  updateAssStyleLibraryStatus();
  // 样式库变化后，设置页「字幕样式」里的 ASS 样式选择器同步刷新。
  syncSubtitleStyleAssControls();
  if (force) __mawImportedBindings0.assStyleWindow.querySelector('.ass-style-editor')?.scrollTo({ top: 0 });
}

function createAssStyle() {
  if ((__mawImportedBindings1.ASS_STYLE_LIBRARY.styles || []).length >= 64) {
    MaweHint.flashHint('样式数量已达到上限（64 个）', 'warning');
    return;
  }
  const id = assStyleManagerId('style', __mawImportedBindings1.ASS_STYLE_LIBRARY.styles);
  updateAssStyleManagerLibrary((library) => {
    library.styles.push({
      ...assStyleManagerClone(window.AsrEditorUtils.ASS_DEFAULT_ASS_STYLE),
      id, name: '新样式', builtin: false,
    });
  }, { persist: false });
  assStyleManagerSelection = { kind: 'style', id };
  __mawImportedBindings1.scheduleAssStyleLibrarySave();
  syncAssStyleManager({ force: true });
}

function duplicateAssStyle() {
  const source = selectedAssStyle();
  if (!source || (__mawImportedBindings1.ASS_STYLE_LIBRARY.styles || []).length >= 64) {
    MaweHint.flashHint('无法复制样式：已达到数量上限', 'warning');
    return;
  }
  const id = assStyleManagerId('style', __mawImportedBindings1.ASS_STYLE_LIBRARY.styles);
  updateAssStyleManagerLibrary((library) => {
    library.styles.push({ ...assStyleManagerClone(source), id, name: `${source.name} 副本`, builtin: false });
  }, { persist: false });
  assStyleManagerSelection = { kind: 'style', id };
  __mawImportedBindings1.scheduleAssStyleLibrarySave();
  syncAssStyleManager({ force: true });
}

function duplicateAssProfile() {
  const source = selectedAssProfile();
  if (!source || (__mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles || []).length >= 64) {
    MaweHint.flashHint('无法复制方案：已达到数量上限', 'warning');
    return;
  }
  const id = assStyleManagerId('profile', __mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles);
  updateAssStyleManagerLibrary((library) => {
    library.assProfiles.push({
      ...assStyleManagerClone(source),
      id, name: `${source.name} 副本`, builtin: false,
    });
  }, { persist: false });
  assStyleManagerSelection = { kind: 'profile', id };
  __mawImportedBindings1.scheduleAssStyleLibrarySave();
  syncAssStyleManager({ force: true });
}

function createAssProfile() {
  if ((__mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles || []).length >= 64) {
    MaweHint.flashHint('ASS 方案数量已达到上限（64 个）', 'warning');
    return;
  }
  const id = assStyleManagerId('profile', __mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles);
  updateAssStyleManagerLibrary((library) => {
    library.assProfiles.push({
      ...assStyleManagerClone(window.AsrEditorUtils.ASS_DEFAULT_PROFILE),
      id, name: '新 ASS 方案', builtin: false,
      animations: assStyleManagerClone(window.AsrEditorUtils.ASS_DEFAULT_ANIMATIONS),
    });
  }, { persist: false });
  assStyleManagerSelection = { kind: 'profile', id };
  __mawImportedBindings1.scheduleAssStyleLibrarySave();
  syncAssStyleManager({ force: true });
}

function deleteSelectedAssEntry() {
  const { kind, id } = assStyleManagerSelection;
  const collection = kind === 'profile' ? __mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles : __mawImportedBindings1.ASS_STYLE_LIBRARY.styles;
  const item = collection?.find((candidate) => candidate.id === id);
  if (!item || item.builtin) {
    MaweHint.flashHint('内置条目不能删除；可以直接修改其参数', 'warning');
    return;
  }
  if (!confirm(`确定删除“${item.name}”吗？`)) return;
  updateAssStyleManagerLibrary((library) => {
    if (kind === 'profile') {
      library.assProfiles = library.assProfiles.filter((profile) => profile.id !== id);
      if (library.assignments.assExportProfileId === id) library.assignments.assExportProfileId = 'ass';
    } else {
      library.styles = library.styles.filter((style) => style.id !== id);
      library.assProfiles = library.assProfiles.map((profile) => ({
        ...profile, styleId: profile.styleId === id ? 'ass' : profile.styleId,
      }));
      if (library.assignments.srtBurnStyleId === id) library.assignments.srtBurnStyleId = 'default';
    }
  });
  assStyleManagerSelection = kind === 'profile' ? { kind: 'profile', id: 'ass' } : { kind: 'style', id: 'ass' };
  syncAssStyleManager({ force: true });
}

function updateAssStyleAssignment(slot, value) {
  updateAssStyleManagerLibrary((library) => {
    library.assignments = { ...(library.assignments || {}), [slot]: value };
  });
  MawePlaybackLoop.refreshSubtitlePreview?.();
}

const assStyleFloatingPanel = MaweFloatingPanel.createFloatingPanel({
  panel: __mawImportedBindings0.assStyleWindow,
  dragHandle: __mawImportedBindings0.assStyleDragHandle,
  manageButton: __mawImportedBindings0.assStyleManagerOpenButton,
  anchorButton: __mawImportedBindings0.assStyleManagerOpenButton,
  positionKey: ASS_STYLE_WINDOW_POSITION_KEY,
  onOpen: () => {
    syncAssStyleManager({ force: true });
    void __mawImportedBindings1.loadAssStyleLibrary({ force: true });
  },
});
document.getElementById('ass-frame-style-edit')?.addEventListener('click', () => assStyleFloatingPanel.open());
__mawImportedBindings0.assStyleWindowClose?.addEventListener('click', () => assStyleFloatingPanel.close());
__mawImportedBindings0.assStyleWindowCloseFooter?.addEventListener('click', () => assStyleFloatingPanel.close());
__mawImportedBindings0.assStyleNewButton?.addEventListener('click', createAssStyle);
__mawImportedBindings0.assStyleDuplicateButton?.addEventListener('click', duplicateAssStyle);
__mawImportedBindings0.assProfileNewButton?.addEventListener('click', createAssProfile);
__mawImportedBindings0.assStyleDeleteButton?.addEventListener('click', deleteSelectedAssEntry);
__mawImportedBindings0.assStyleSettingsLink?.addEventListener('click', (event) => {
  event.preventDefault();
  MaweSettingsPanels.openEditorSettingsAtTab('editor-settings-tab-subtitle-style');
});
__mawImportedBindings0.assStyleSaveButton?.addEventListener('click', () => {
  setAssStyleLibraryStatus(
    assStyleLibraryUsesServerStorage() ? '正在保存用户级样式库…' : '正在保存到当前浏览器…',
    'pending',
  );
  void __mawImportedBindings1.persistAssStyleLibrary();
});
__mawImportedBindings0.assSrtDefaultStyleSelect?.addEventListener('change', () => updateAssStyleAssignment('srtBurnStyleId', __mawImportedBindings0.assSrtDefaultStyleSelect.value));
__mawImportedBindings0.assDefaultProfileSelect?.addEventListener('change', () => updateAssStyleAssignment('assExportProfileId', __mawImportedBindings0.assDefaultProfileSelect.value));
__mawImportedBindings0.assProfileExtensionStyleSelect?.addEventListener('change', () => updateAssStyleAssignment('assExtensionStyleId', __mawImportedBindings0.assProfileExtensionStyleSelect.value));
// 设置页「字幕样式」的 ASS 选择器：主字幕改的是当前 ASS 输出方案关联的
// 样式（与样式库窗口中方案表单的样式下拉同步）；副字幕改库中的副字幕槽位。
__mawImportedBindings0.mainAssStyleSelect?.addEventListener('change', () => {
  updateAssStyleManagerLibrary((library) => {
    const profileId = library.assignments?.assExportProfileId || 'ass';
    const profile = (library.assProfiles || []).find((item) => item.id === profileId);
    if (profile) profile.styleId = __mawImportedBindings0.mainAssStyleSelect.value;
  });
});
__mawImportedBindings0.extensionAssStyleSelect?.addEventListener('change', () => {
  updateAssStyleAssignment('assExtensionStyleId', __mawImportedBindings0.extensionAssStyleSelect.value);
});
// 「使用 ASS 样式」旁的「编辑样式」：打开样式库窗口并定位到下拉当前选中的样式。
function openAssStyleManagerForStyle(select) {
  if (!select?.value) return;
  assStyleManagerSetSelection('style', select.value);
  assStyleFloatingPanel.open();
}
__mawImportedBindings0.mainAssStyleEditButton?.addEventListener('click', () => openAssStyleManagerForStyle(__mawImportedBindings0.mainAssStyleSelect));
document.getElementById('ass-special-style-edit')?.addEventListener('click', async () => {
  assStyleFloatingPanel.open();
  await __mawImportedBindings1.loadAssStyleLibrary({ force: true });
  if (!__mawImportedBindings0.assStyleWindow.classList.contains('show')) return;
  const profileId = __mawImportedBindings1.ASS_STYLE_LIBRARY.assignments?.assExportProfileId || 'ass';
  const profile = __mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles?.find((entry) => entry.id === profileId);
  assStyleManagerSetSelection('style', profile?.styleId || 'ass');
  requestAnimationFrame(() => {
    document.getElementById('ass-style-emphasis-section')?.scrollIntoView({ block: 'start', inline: 'nearest' });
  });
});
__mawImportedBindings0.extensionAssStyleEditButton?.addEventListener('click', () => openAssStyleManagerForStyle(__mawImportedBindings0.extensionAssStyleSelect));
// 「读取本机字体」：与设置页共用同一个本机字体扫描；扫描结果进入共享的
// subtitleLocalFontFamilies，ASS 字体下拉在下次展开时即包含这些字体。
__mawImportedBindings0.assStyleLocalFontScanButton?.addEventListener('click', async () => {
  if (__mawImportedBindings0.assStyleLocalFontScanButton.disabled) return;
  __mawImportedBindings0.assStyleLocalFontScanButton.disabled = true;
  try {
    await MaweAppearance.scanSubtitleLocalFonts();
  } finally {
    __mawImportedBindings0.assStyleLocalFontScanButton.disabled = false;
  }
  __mawImportedBindings2.rebuildAssFontNameOptions();
  const hintByState = {
    success: () => MaweHint.flashHint(`已读取 ${MaweAppearance.subtitleFontFamilyScanCount} 种本机字体`, 'success'),
    empty: () => MaweHint.flashHint('未读取到可用的本机字体', 'warning'),
    unsupported: () => MaweHint.flashHint('当前浏览器不支持该功能', 'warning'),
    denied: () => MaweHint.flashHint('未获准读取本机字体', 'warning'),
    failed: () => MaweHint.flashHint('读取本机字体失败，请重试', 'warning'),
  };
  hintByState[MaweAppearance.subtitleFontFamilyScanState]?.();
});
// 样式/方案列表右键菜单：设为主/副字幕样式 / 创建副本 / 重命名 / 删除。
function showAssListContextMenu(event, kind) {
  const button = event.target.closest(`[data-ass-selection-kind="${kind}"]`);
  if (!button) return;
  // 阻止冒泡：document 级 contextmenu 监听会关闭非 cue 上的菜单，
  // 不拦截的话刚显示的菜单会立即被吞掉。
  event.preventDefault();
  event.stopPropagation();
  assStyleManagerSetSelection(kind, button.dataset.assSelectionId);
  const collection = kind === 'profile' ? __mawImportedBindings1.ASS_STYLE_LIBRARY.assProfiles : __mawImportedBindings1.ASS_STYLE_LIBRARY.styles;
  const item = collection?.find((candidate) => candidate.id === button.dataset.assSelectionId);
  if (!item) return;
  MaweDom.ctxmenu.innerHTML = '';
  const addItem = (label, fn, { danger = false, disabled = false } = {}) => {
    const element = document.createElement('div');
    element.className = `item${danger ? ' danger' : ''}${disabled ? ' disabled' : ''}`;
    const text = document.createElement('span');
    text.textContent = label;
    element.appendChild(text);
    if (!disabled) element.addEventListener('click', () => {
      MaweDom.ctxmenu.classList.remove('show');
      fn();
    });
    MaweDom.ctxmenu.appendChild(element);
  };
  // 「设为XX」归为第一组；分隔线隔开后的第二组是对条目本身的操作。
  const addSeparator = () => {
    const separator = document.createElement('div');
    separator.className = 'sep';
    MaweDom.ctxmenu.appendChild(separator);
  };
  if (kind === 'style') {
    addItem('设为主字幕样式', () => {
      updateAssStyleManagerLibrary((library) => {
        const profileId = library.assignments?.assExportProfileId || 'ass';
        const profile = (library.assProfiles || []).find((entry) => entry.id === profileId);
        if (profile) profile.styleId = item.id;
      });
    });
    if (MaweMultiSubtitleCore.multiSubtitleVisible()) {
      addItem('设为副字幕样式', () => updateAssStyleAssignment('assExtensionStyleId', item.id));
    }
    addItem('设为 SRT 烧录样式', () => updateAssStyleAssignment('srtBurnStyleId', item.id));
  } else {
    addItem('设为 ASS 导出方案', () => updateAssStyleAssignment('assExportProfileId', item.id));
  }
  addSeparator();
  addItem('创建副本', () => (kind === 'profile' ? duplicateAssProfile() : duplicateAssStyle()));
  addItem('重命名', () => {
    const input = document.getElementById(kind === 'profile' ? 'ass-profile-name' : 'ass-style-name');
    if (!input) return;
    input.focus();
    input.select();
    input.scrollIntoView({ block: 'center', inline: 'nearest' });
  });
  addItem('删除', () => deleteSelectedAssEntry(), { danger: true, disabled: item.builtin === true });
  MaweDom.ctxmenu.classList.add('show');
  const rect = MaweDom.ctxmenu.getBoundingClientRect();
  const nx = Math.max(4, Math.min(event.clientX, window.innerWidth - rect.width - 4));
  const ny = Math.max(4, Math.min(event.clientY, window.innerHeight - rect.height - 4));
  MaweDom.ctxmenu.style.left = `${nx}px`;
  MaweDom.ctxmenu.style.top = `${ny}px`;
}
__mawImportedBindings0.assStyleList?.addEventListener('contextmenu', (event) => showAssListContextMenu(event, 'style'));
__mawImportedBindings0.assProfileList?.addEventListener('contextmenu', (event) => showAssListContextMenu(event, 'profile'));
__mawImportedBindings0.assStyleForm?.addEventListener('input', (event) => {
  const field = event.target.closest('[data-ass-style-field]');
  if (!field) return;
  if (field.type === 'radio' && !field.checked) return;
  updateAssStyleField(field.dataset.assStyleField, assStyleFormValue(field));
});
__mawImportedBindings0.assStyleForm?.addEventListener('change', (event) => {
  const field = event.target.closest('[data-ass-style-field]');
  if (field && (field.type !== 'radio' || field.checked)) {
    updateAssStyleField(field.dataset.assStyleField, assStyleFormValue(field));
  }
});
__mawImportedBindings0.assProfileForm?.addEventListener('input', (event) => {
  const field = event.target.closest('[data-ass-profile-field], [data-ass-animation]');
  if (!field) return;
  const path = field.dataset.assProfileField || field.dataset.assAnimation;
  updateAssProfileField(path, assStyleFormValue(field));
});
__mawImportedBindings0.assProfileForm?.addEventListener('change', (event) => {
  const field = event.target.closest('[data-ass-profile-field], [data-ass-animation]');
  if (field) updateAssProfileField(field.dataset.assProfileField || field.dataset.assAnimation, assStyleFormValue(field));
});

function syncSubtitleStyleAssControls() {
  // ASS 字幕模式接管预览样式后，「字幕样式」页的主/副字幕 CSS 控件换成
  // 样式库选择器；主字幕选择即当前 ASS 输出方案关联的样式，与样式库窗口
  // 中的选择同步，副字幕选择对应库中的「副字幕样式」槽位。
  const assMode = MaweSettings.EDITOR_SETTINGS.assMode === true;
  if (__mawImportedBindings0.assInlineTextSettings) __mawImportedBindings0.assInlineTextSettings.hidden = !assMode;
  if (__mawImportedBindings0.assInlineTextTitle) __mawImportedBindings0.assInlineTextTitle.hidden = !assMode;
  __mawImportedBindings0.assInlineTextToggles.forEach((input) => {
    if (input) input.disabled = !assMode;
  });
  if (__mawImportedBindings0.subtitleStyleAssModeHint) __mawImportedBindings0.subtitleStyleAssModeHint.hidden = !assMode;
  if (__mawImportedBindings0.mainSubtitleCssFields) __mawImportedBindings0.mainSubtitleCssFields.hidden = assMode;
  if (__mawImportedBindings0.mainAssStyleFields) __mawImportedBindings0.mainAssStyleFields.hidden = !assMode;
  if (__mawImportedBindings0.extensionSubtitleCssFields) __mawImportedBindings0.extensionSubtitleCssFields.hidden = assMode;
  // 副字幕 ASS 样式只在 ASS 模式 + 双语字幕（多重字幕）启用时才有意义。
  if (__mawImportedBindings0.extensionAssStyleFields) __mawImportedBindings0.extensionAssStyleFields.hidden = !assMode || !MaweMultiSubtitleCore.multiSubtitleVisible();
  const library = window.AsrEditorUtils.normalizeAssStyleLibrary(__mawImportedBindings1.ASS_STYLE_LIBRARY);
  const styles = library.styles || [];
  if (__mawImportedBindings0.mainAssStyleSelect) {
    __mawImportedBindings0.mainAssStyleSelect.replaceChildren();
    styles.forEach((style) => appendAssStyleOption(__mawImportedBindings0.mainAssStyleSelect, style.id, style.name));
    const profile = window.AsrEditorUtils.assProfileForId(
      library, library.assignments?.assExportProfileId || 'ass',
    );
    __mawImportedBindings0.mainAssStyleSelect.value = profile.styleId;
  }
  if (__mawImportedBindings0.extensionAssStyleSelect) {
    __mawImportedBindings0.extensionAssStyleSelect.replaceChildren();
    styles.forEach((style) => appendAssStyleOption(__mawImportedBindings0.extensionAssStyleSelect, style.id, style.name));
    __mawImportedBindings0.extensionAssStyleSelect.value = library.assignments?.assExtensionStyleId || 'ass-extension';
  }
}

function syncAssModeDependentControls() {
  // ASS 字幕模式接管预览样式后，「预览字幕颜色」不再参与预览，禁用并提示跳转；
  // 「颜色字幕样式」在「字幕颜色」页替代「预览颜色样式」，只在 ASS 模式下显示。
  const assMode = MaweSettings.EDITOR_SETTINGS.assMode === true;
  if (MaweDom.subtitleColorUnderlineInput) MaweDom.subtitleColorUnderlineInput.disabled = assMode;
  if (__mawImportedBindings0.subtitleColorAssModeHint) __mawImportedBindings0.subtitleColorAssModeHint.hidden = !assMode;
  if (__mawImportedBindings0.assColorStyleRow) __mawImportedBindings0.assColorStyleRow.hidden = !assMode;
  if (__mawImportedBindings0.assColorSpeakerHint) {
    __mawImportedBindings0.assColorSpeakerHint.hidden = !assMode || __mawImportedBindings0.assColorStyleSelect?.value !== 'speaker';
  }
  if (MaweDom.subtitleColorStyleControl) {
    MaweDom.subtitleColorStyleControl.hidden = assMode
      || !(MaweDom.subtitleColorUnderlineInput?.checked ?? true);
  }
  syncSubtitleStyleAssControls();
}

const assSpecialSymbolRule = document.getElementById('ass-special-symbol-rule');
function syncAssSymbolRule() {
  const rule = MaweSettings.EDITOR_SETTINGS.assSpecialSymbolRule;
  if (assSpecialSymbolRule) assSpecialSymbolRule.value = rule;
  const options = document.getElementById('ass-inline-text-options');
  if (options) options.hidden = rule === 'none';
  const formatHint = document.getElementById('ass-special-format-hint');
  if (formatHint) {
    const examples = [['*', '强调'], ['~', '删除'], ['-', '缩小'], ['+', '放大']].map(([marker, label]) => {
      const sample = (width) => `${marker.repeat(width)}${label}${marker.repeat(width)}`;
      return rule === 'both' ? `${sample(1)}/${sample(2)}` : sample(2);
    });
    // 注释是固定双符号 //，不随单双规则变化。
    examples.push('//注释//');
    const sentence = rule === 'none' ? '符号规则已关闭，字幕中的符号将保留原文。'
      : `你可以使用 ${examples.join('、')} 等符号来对特定字词添加特殊样式。`;
    // 拼接结果按整句查翻译表：英文界面下动态重建也能得到英文提示。
    formatHint.textContent = window.MAWE_I18N?.translateText?.(sentence) || sentence;
  }
  document.querySelectorAll('[data-ass-symbol]').forEach((hint) => {
    const { assSymbol: marker, assSymbolLabel: label } = hint.dataset;
    if (hint.dataset.assSymbolFixed === 'true') {
      hint.textContent = `${marker}${label}${marker}`;
      return;
    }
    const sample = (width) => `${marker.repeat(width)}${label}${marker.repeat(width)}`;
    hint.textContent = rule === 'both' ? `${sample(1)}/${sample(2)}` : sample(2);
  });
}
assSpecialSymbolRule?.addEventListener('change', () => {
  MaweSettings.updateEditorSettings({ assSpecialSymbolRule: assSpecialSymbolRule.value });
  syncAssSymbolRule();
  MawePlaybackLoop.refreshSubtitlePreview();
});
function syncAssModeControl() {
  const enabled = MaweSettings.EDITOR_SETTINGS.assMode === true;
  const quickToggle = document.getElementById('ass-mode-quick-toggle');
  if (quickToggle) {
    quickToggle.classList.toggle('active', enabled);
    quickToggle.setAttribute('aria-pressed', String(enabled));
  }
  const quickOpen = document.getElementById('ass-style-quick-open');
  if (quickOpen) quickOpen.hidden = !enabled;
  syncAssSymbolRule();
  syncAssModeDependentControls();
  updateAssStylePreviewModeHints();
  __mawImportedBindings0.assInlineTextToggles.forEach((input) => {
    const key = input.dataset.assInlineSetting;
    input.checked = key === 'assEmphasisSyntax' ? MaweSettings.EDITOR_SETTINGS[key] !== 'none' : MaweSettings.EDITOR_SETTINGS[key] !== false;
  });
  if (__mawImportedBindings0.assStyleForm && !__mawImportedBindings0.assStyleForm.hidden) syncAssStyleForm(selectedAssStyle());
  if (!__mawImportedBindings0.assModeToggle) return;
  __mawImportedBindings0.assModeToggle.checked = MaweSettings.EDITOR_SETTINGS.assMode === true;
  __mawImportedBindings0.assModeToggle.setAttribute('aria-checked', String(__mawImportedBindings0.assModeToggle.checked));
}

__mawImportedBindings0.assModeToggle?.addEventListener('change', () => {
  MaweHistory.pushPreviewUndo('切换 ASS 字幕模式', MaweHistory.snapshotPreviewState());
  MaweSettings.updateEditorSettings({ assMode: __mawImportedBindings0.assModeToggle.checked });
  syncAssModeControl();
  MawePreviewGeometry.refreshPreviewGeometryEditable();
  MawePlaybackLoop.refreshSubtitlePreview();
  MaweHint.flashHint(__mawImportedBindings0.assModeToggle.checked ? '已开启 ASS 字幕模式预览' : '已恢复原有字幕预览', 'success');
});

document.getElementById('ass-mode-quick-toggle')?.addEventListener('click', () => __mawImportedBindings0.assModeToggle?.click());
document.getElementById('ass-style-quick-open')?.addEventListener('click', () => __mawImportedBindings0.assStyleManagerOpenButton?.click());

__mawImportedBindings0.assInlineTextToggles.forEach((input) => {
  input.addEventListener('change', () => {
    const key = input.dataset.assInlineSetting;
    const value = key === 'assEmphasisSyntax' ? (input.checked ? 'both' : 'none') : input.checked;
    MaweSettings.updateEditorSettings({ [key]: value });
    syncAssStyleManager();
    MawePlaybackLoop.refreshSubtitlePreview();
  });
});

}
