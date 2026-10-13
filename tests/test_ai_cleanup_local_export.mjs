import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { loadEditorModule } from './helpers/editor-module-loader.mjs';
import { compileEditorFixture } from './helpers/editor-module-loader.mjs';

const plain = (value) => JSON.parse(JSON.stringify(value));
const source = () => ({ id: 'main-001', start: 0, end: 2000, text: '啊，我这……我这个功能呢',
  items: [{ text: '啊，', start: 0, end: 210 }, { text: '我这……', start: 220, end: 770 }, { text: '我这个功能呢', start: 900, end: 2000 }] });
const localGap = () => ({ detector: 'audio_gate', provenance: { sources: { ai_cleanup: [{ start: 0, end: 770,
  cleanup_scope: { segment_id: 'main-001', item_start: 0, item_end: 2, text: '啊，我这……' } }] } } });

test('ASS cache retains raw identity but invalidates equal-text selections with different item boundaries', () => {
  const script = fs.readFileSync(new URL('../web/editor/styles/editor-wiring-ass-preview.js', import.meta.url), 'utf8');
  const start = script.indexOf('const assStackCueSnapshots =');
  const end = script.indexOf("document.fonts?.addEventListener('loadingdone'", start);
  const context = {};
  vm.runInNewContext(`${script.slice(start, end)}; globalThis.revision = assStackInputRevision;`, context);
  const raw = { id: 'repeated', start: 0, end: 2000, text: '正文啊正文啊正文' };
  const first = { ...raw, text: '正文正文啊正文', items: [{ text: '正文', start: 0, end: 300 }, { text: '正文啊正文', start: 500, end: 2000 }] };
  const second = { ...first, items: [{ text: '正文啊正文', start: 0, end: 1500 }, { text: '正文', start: 1700, end: 2000 }] };
  const identities = [[raw], [], []];
  const initial = context.revision([[first], [], []], identities);
  assert.equal(context.revision([[plain(first)], [], []], identities), initial, 'per-frame projection clones do not rebuild');
  const changed = context.revision([[second], [], []], identities);
  assert.equal(changed, initial + 1, 'equal cue text/timing still observes retained item selection');
  assert.equal(context.revision(identities, identities), changed + 1, 'restoration invalidates projected plan');
});

function runtime() {
  const neutralElement = () => {
    const element = { style: new Proxy({ setProperty() {}, removeProperty() {} }, { get: (t, k) => t[k] ?? (() => '') }),
      setAttribute() {}, removeAttribute() {}, toggleAttribute() {},
      appendChild() {}, append() {}, removeChild() {}, replaceChildren() {}, replaceWith() {}, insertAdjacentHTML() {},
      addEventListener() {}, removeEventListener() {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false, replace() {} },
      dataset: {}, textContent: '', innerHTML: '', hidden: false, value: '', id: '', title: '', tabIndex: 0,
      children: [], childNodes: [], firstChild: null, lastChild: null,
      querySelector: () => neutralElement(), querySelectorAll: () => [],
      closest: () => element, contains: () => false,
      getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
      focus() {}, blur() {}, click() {}, remove() {}, scrollIntoView() {},
      getContext: () => ({ fillRect() {}, clearRect() {}, drawImage() {}, getImageData: () => ({ data: [] }),
        putImageData() {}, createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 0 }) }) };
    element.closest = () => element;
    element.attachShadow = () => { const root = neutralElement(); element.shadowRoot = root; return root; };
    element.shadowRoot = null;
    return element;
  };
  const neutralById = new Map();
  const neutralByIdGet = (id) => (neutralById[id] ??= neutralElement());
  const testDocument = { addEventListener() {}, querySelector: neutralByIdGet, querySelectorAll: () => [],
    getElementById: neutralByIdGet, createTreeWalker: () => ({ nextNode: () => null }),
    createElement: () => ({ style: { setProperty() {} }, setAttribute() {}, appendChild() {}, append() {}, removeChild() {}, replaceChildren() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, textContent: '' }),
    createTextNode: (t) => ({ textContent: t }), dispatchEvent() {}, documentElement: { lang: '', setAttribute() {}, style: { setProperty() {} }, dataset: {} },
    body: { appendChild() {} }, fonts: { addEventListener() {}, removeEventListener() {} },
  };
  const context = {
    document: testDocument,
    window: {
      document: testDocument,
      addEventListener() {}, removeEventListener() {},
      MAWE: { register() {}, resolve(name) { return {}; } },
      ASR_EDITOR_PALETTE: [{ name: '默认', colors: ['#ffffff', '#ffff00', '#00ff00', '#00ffff', '#ff00ff'] }],
      location: { search: '', href: 'file://test' },
      URLSearchParams, URL, setTimeout, clearTimeout,
      MutationObserver: class { observe() {} disconnect() {} }, CustomEvent: class { constructor(t, i) { this.type = t; Object.assign(this, i ?? {}); } },
      NodeFilter: { SHOW_ALL: 0xFFFFFFFF }, Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    },
  };
  context.document = context.window.document;
  context.testDocument = testDocument;
  // 域前置：utils 工厂最先（AsrEditorUtils 门面），随后 settings/dom/multi-subtitle/context-menus
  context.window.MaweState = {
    preferences: { editor: {}, assMode: {}, exportSpeakerLabels: {} },
    changes: { projectImportDirty: false, gapRemoveDirty: false, previewGeometryDirty: false, markersDirty: false },
    selection: { clear() {}, add() {}, remove() {} },
    project: {},
    markSaved() {}, segmentsFingerprint: () => '',
  };
  context.MaweState = context.window.MaweState;
  // 其余门面一次性前置（后续 Object.assign 再覆写为行为桩）
  const earlyFacades = {
    MaweBoot: { DATA: { segments: [], gap_remove: {} }, maweDomContractCheck: () => [], maweDebug() {},
      PROJECT_NAME: 'test', FILENAME_BASE: 'test', STICKERS: [], STICKER_ROOT: '', STICKER_URL_PREFIX: '',
      SERVER_CONFIG: {}, NINJA_SFX_BASE_URL: '', MAWE_DEBUG_ENABLED: false },
    MaweSettings: { EDITOR_SETTINGS: {} },
    MaweDom: new Proxy({}, { get: (t, k) => t[k] ?? neutralElement(), has: () => true }),
    MaweHint: { flashHint() {} },
    MaweTimeline: { normalizeMediaMetadata: (m) => m },
    MaweColors: { COLOR_PALETTE: [], COLOR_BY_NAME: {} },
    MaweCueElements: { fmtSrtTime: (ms) => new Date(ms).toISOString().slice(11, 23).replace('.', ',') },
    MaweSpeakerLabels: { speakerLabelExportOptions: () => ({}), subtitleExportText: (s2) => s2.text, getSpeakerLabelSettings: () => ({}) },
    MaweAppearance: { getSubtitleAppearance: () => ({}) },
    MaweGapRemoveData: { getRemovedGapRanges: () => [] },
    MaweMultiSubtitleCore: { getActiveExtensionTrack: () => ({ segments: [] }), getMultiSubtitleState: () => ({ enabled: true }) },
    MaweCoreState: { waveformEditor: null, player: null },
    MaweCommands: { run: (_n, fn) => fn({}) },
    MaweHistory: { captureSegmentsRecord: () => ({ segs: [] }), commitRecord() {}, applyHistoryRecord() {}, snapshotEditorSelection: () => null },
    MaweViewUpdates: { invalidate() {} },
    MaweSelection: { clearSelection() {}, selection: new Set() },
    MaweCueListAnchor: { restoreCueListVisualAnchor() {}, rememberCueListMutation() {}, cueListScroll: {} },
    MaweServerSave: { scheduleAutoSaveFlush() {} },
    MawePlaybackLoop: { update() {}, updateWithoutCueListAutoScroll() {}, refreshSubtitlePreview() {} },
    MaweTextCleanup: { cleanPunctuation() {}, seekFromWaveform() {} },
    MaweContextMenus: { registerContextMenus() {}, showContextMenu() {}, hideContextMenu() {} },
    MaweSplitCore: {}, MaweSplitMode: {}, MaweSplitTrim: {},
    MaweSegmentOps: {}, MaweFindReplace: { findNext() {}, replaceAll() {} },
    MaweSearch: { applySearch() {}, clearSearch() {} },
    MaweColorFilter: { applyColorFilter() {}, clearColorFilter() {} },
    MaweBoundDrag: {}, MaweMergeAdjacent: { mergeAdjacent() {} },
    MaweAddCue: { addCue() {} }, MaweTimedTextEdit: {},
    MaweMediaPlayback: { hasLoadedMedia: () => false, isAuditioning: false },
    MaweMediaLoad: {}, MaweMediaStep: {}, MawePreviewGeometry: {}, MaweNavPreview: {},
    MaweCueEvents: {}, MaweWorkspaces: {}, MaweHelpPanel: {}, MaweBehaviorHints: {},
    MaweTheme: {}, MaweJsonRepair: {}, MaweStickerOverlay: {}, MaweStickerPicker: {},
    MaweStickerRoot: {}, MaweStickerOtioExport: {}, MaweDisplaySettings: {},
    MaweSettingsPanels: {}, MaweSettingsSearch: {}, MaweShortcuts: {},
    MaweCueListAnchorExport: {}, MaweDynamicExports: {}, MaweExportMenus: {},
    MaweLoadingProgress: {}, MaweDragDrop: {}, MaweServerConnection: {},
    MaweProjectLoad: {}, MaweProjectSave: {}, MaweProjectMediaInputs: {},
    MaweMultiSubtitleUi: {}, MaweAssStyleManager: {}, MaweAssExport: {},
    MaweWaveformInit: {}, MaweCueList: {}, MaweCueListCount: {},
    MaweStickerPicker: { renderStickerGrid() {}, clearStickerOnTargets() {} },
    MaweInlineEdit: { editingState: null },
    MaweKeyboardTargets: { isSpaceKey: () => false },
    MaweJklPlayback: { stopJklReversePlayback() {}, isJklDirectionMode: () => false },
    MaweWordTiming: { clearSelection() {} },
    MaweMarkerEditing: { afterExternalMarkersChange() {} },
    MaweExportSrt: {},
    MaweExportTimeline: {},
    MaweAssPreview: {},
    MaweHost: {},
    AsrEditorUtils: {},
    AsrGapRemoveCore: {},
    AsrWaveform: {},
    ASS_STYLE_LIBRARY: [],
  };
  for (const [key, value] of Object.entries(earlyFacades)) {
    context.window[key] = context.window[key] ?? value;
    context[key] = context[key] ?? value;
  }
  // dom/settings 域前置所需的最小门面（后续 stubs 会再覆写）
  context.window.MaweSettings = { EDITOR_SETTINGS: {} };
  context.MaweSettings = context.window.MaweSettings;
  context.MaweState.changes = context.window.MaweState.changes;
  // 门面镜像：classic 裸名在 vm 全局解析，须先于任何 fixture 求值
  const mirrorFacades = () => {
    for (const key of Object.keys(context.window)) {
      if (/^(Mawe|MAWE|Asr)/.test(key) && !(key in context)) context[key] = context.window[key];
    }
  };
  mirrorFacades();
  loadEditorModule(context, 'shared/editor-utils.js');
  // editor-state 是工厂：产品经 registry 挂 window.MaweState；单模块链给最小桩
    vm.runInNewContext(compileEditorFixture('editor/state/editor-settings.js'), context);
  vm.runInNewContext(compileEditorFixture('editor/ui/editor-dom.js'), context);
  vm.runInNewContext(compileEditorFixture('editor/ui/editor-context-menus.js'), context);
  vm.runInNewContext(compileEditorFixture('editor/state/editor-multi-subtitle-core.js'), context);
  // provider 链前置：multi-subtitle-core 门面（export-context 消费它的方法）
  const core = context.window.AsrGapRemoveCore;
  const utils = context.window.AsrEditorUtils;
  const main = [source()];
  const extension = [{ id: 'ext-001', start: 0, end: 2000, text: 'translated body' }];
  const overlay = [{ id: 'main-001', start: 0, end: 2000, text: 'overlay untouched' }];
  Object.assign(context, {
    ASS_STYLE_LIBRARY: {},
    MaweBoot: { DATA: { segments: main, gap_remove: localGap(), media: 'synthetic.mp4', waveform: { duration_ms: 2000 } },
      maweDomContractCheck: () => [], maweDebug() {}, PROJECT_NAME: 'test', FILENAME_BASE: 'test',
      STICKERS: [], STICKER_ROOT: '', STICKER_URL_PREFIX: '', SERVER_CONFIG: {},
      NINJA_SFX_BASE_URL: '', MAWE_DEBUG_ENABLED: false },
    MaweSettings: { EDITOR_SETTINGS: {} },
    MaweCoreState: { waveformEditor: { durationMs: 2000 }, player: { duration: 2, tagName: 'VIDEO' } },
    MaweGapRemoveData: { getRemovedGapRanges: () => core.getRemovedGapRanges(core.normalizeGapRemoveData(context.MaweBoot.DATA.gap_remove).gaps) },
    MaweSpeakerLabels: { speakerLabelExportOptions: () => ({}), subtitleExportText: (segment) => segment.text, getSpeakerLabelSettings: () => ({}) },
    MaweCueElements: { fmtSrtTime: (ms) => new Date(ms).toISOString().slice(11, 23).replace('.', ',') },
    MaweAppearance: { getSubtitleAppearance: () => ({}) },
    MaweColors: { COLOR_PALETTE: [], COLOR_BY_NAME: {} },
    MaweMultiSubtitleCore: { getActiveExtensionTrack: () => ({ segments: extension }), getMultiSubtitleState: () => ({ enabled: true }) },
    MaweDom: { overlayToggle: { checked: true }, extensionOverlayToggle: { checked: true } },
    MaweHint: { flashHint: () => {} },
    MaweTimeline: { normalizeMediaMetadata: utils.normalizeMediaMetadata },
    activeExtensionSegments: () => extension,
    mergedExportSegments: () => ({ segments: [...main, ...overlay], overlaySet: new Set(overlay), overlaySegments: overlay }),
    exportColorContextResolver: () => () => main,
  });
  // classic 转换体裸名解析走 vm 全局：把 window 上的门面镜像到顶层
  for (const key of Object.keys(context.window)) {
    if (/^(Mawe|MAWE|Asr)/.test(key) && !(key in context)) context[key] = context.window[key];
  }
    mirrorFacades();
  for (const file of ['editor-export-srt.js', 'editor-export-timeline.js']) {
    vm.runInNewContext(compileEditorFixture('editor/io/' + file), context);
  }
  context.MaweExportSrt = context.window.MaweExportSrt;
  return { context, core, utils, main, extension, overlay, srt: context.window.MaweExportSrt, timeline: context.window.MaweExportTimeline };
}

test('trusted scope projects exact words/items, saves/reopens and safely restores with gap history', () => {
  const { core, main, context } = runtime();
  const gap = core.normalizeGapRemoveData(context.MaweBoot.DATA.gap_remove);
  const before = JSON.stringify(main);
  const reopened = plain({ segments: main, gap_remove: gap });
  const project = () => core.projectCleanupRetainedSegments(reopened.segments, reopened.gap_remove)[0];
  assert.equal(project().text, '我这个功能呢');
  assert.deepEqual(plain(project().items), [{ text: '我这个功能呢', start: 900, end: 2000 }]);
  assert.equal(JSON.stringify(main), before);
  for (const start of [0.2, '0', -0.2, false]) {
    const inexact = localGap();
    inexact.provenance.sources.ai_cleanup[0].start = start;
    assert.equal(core.projectCleanupRetainedSegments(main, inexact)[0], main[0], 'normalization cannot manufacture exact scope endpoints');
    assert.equal(core.normalizeGapRemoveData(inexact).provenance.sources.ai_cleanup[0].cleanup_scope, undefined);
  }
  const active = plain(reopened.gap_remove);
  reopened.gap_remove.provenance.manual_overrides.push({ start: 0, end: 770, removed: false });
  assert.equal(project().text, main[0].text);
  reopened.gap_remove = active; // same gap-only undo/redo state contract
  assert.equal(project().text, '我这个功能呢');
  reopened.gap_remove.provenance.sources.ai_cleanup = [];
  reopened.gap_remove.provenance.sources.audio_gate = [{ start: 0, end: 770 }];
  assert.equal(project().text, main[0].text, 'other sources cannot authorize old AI removal');
});

test('legacy AI/manual gaps and stale scope never hide enabled subtitle words', () => {
  const { core, main } = runtime();
  for (const gap of [
    { gaps: [{ start: 0, end: 770, removed: true }] },
    { provenance: { sources: { ai_cleanup: [{ start: 0, end: 770 }] } } },
    { provenance: { sources: { ai_cleanup_review: [{ start: 0, end: 770, review_marker_id: 'm-1' }] } } },
  ]) assert.equal(core.projectCleanupRetainedSegments(main, gap)[0].text, main[0].text);
  for (const mutation of [
    (g) => { g.provenance.sources.ai_cleanup[0].cleanup_scope.segment_id = 'wrong'; },
    (g) => { g.provenance.sources.ai_cleanup[0].cleanup_scope.text = 'wrong'; },
    (g) => { g.provenance.sources.ai_cleanup[0].start = 1; },
    (g) => { g.provenance.sources.ai_cleanup[0].cleanup_scope.item_end = 9; },
  ]) {
    const gap = localGap(); mutation(gap);
    assert.equal(core.projectCleanupRetainedSegments(main, gap)[0].text, main[0].text);
  }
  const edited = plain(main); edited[0].items[0].text = '改'; edited[0].text = '改我这……我这个功能呢';
  assert.equal(core.projectCleanupRetainedSegments(edited, localGap())[0].text, edited[0].text);
});

test('default built-in punctuation cleanup migrates only already-exact local scopes', () => {
  const { context, core, main } = runtime();
  const stale = { start: 0, end: 770, cleanup_scope: { segment_id: 'main-001', item_start: 0, item_end: 2, text: 'stale' } };
  context.MaweBoot.DATA.gap_remove.provenance.sources.ai_cleanup.push(stale);
  vm.runInNewContext(compileEditorFixture('editor/cues/editor-text-cleanup.js'), context);
  context.window.MaweTextCleanup.cleanPunctuation();
  const ranges = context.MaweBoot.DATA.gap_remove.provenance.sources.ai_cleanup;
  assert.equal(ranges[0].cleanup_scope.text, '啊  我这……');
  assert.equal(ranges[1].cleanup_scope.text, 'stale');
  assert.equal(core.projectCleanupRetainedSegments(main, context.MaweBoot.DATA.gap_remove)[0].text, '我这个功能呢');
  ranges[0].cleanup_scope.text = 'edit mismatch';
  context.window.MaweTextCleanup.cleanPunctuation();
  assert.equal(ranges[0].cleanup_scope.text, 'edit mismatch');
  assert.equal(core.projectCleanupRetainedSegments(main, context.MaweBoot.DATA.gap_remove)[0].text, main[0].text);
});

function neutralNormalizationRuntime() {
  const setup = runtime();
  const { main, context } = setup;
  const rows = [['我', 0, 110], ['我这个', 130, 400], ['，', 410, 430], ['功能', 500, 800],
    ['嗯', 810, 930], ['很好', 1000, 1200], ['呢', 1300, 2000]];
  main[0] = { id: 'main-001', start: 0, end: 2000, text: rows.map(([text]) => text).join(''),
    items: rows.map(([text, start, end]) => ({ text, start, end })) };
  context.MaweBoot.DATA.gap_remove = { provenance: { sources: { ai_cleanup: [
    { start: 0, end: 110, cleanup_scope: { segment_id: 'main-001', item_start: 0, item_end: 1, text: '我' } },
    { start: 810, end: 930, cleanup_scope: { segment_id: 'main-001', item_start: 4, item_end: 5, text: '嗯' } },
  ] } } };
  vm.runInNewContext(compileEditorFixture('editor/io/editor-json-repair.js'), context);
  return setup;
}

test('timing repair migrates exact scopes collectively through neutral roots and retains real selected endpoints', () => {
  const { context, core, main } = neutralNormalizationRuntime();
  context.window.MaweJsonRepair.normalizeProjectTimings(context.MaweBoot.DATA);
  const scopes = context.MaweBoot.DATA.gap_remove.provenance.sources.ai_cleanup;
  assert.equal(main[0].items.length, 6);
  assert.equal(scopes[1].cleanup_scope.item_start, 3);
  assert.equal(core.projectCleanupRetainedSegments(main, context.MaweBoot.DATA.gap_remove)[0].text, '我这个，功能很好呢');
  assert.deepEqual(scopes.map(({ start, end }) => [start, end]), [[0, 110], [810, 930]]);

  const tail = [{ text: '正文', start: 0, end: 1000 }, { text: '呃', start: 1100, end: 1800 }, { text: '。', start: 1800, end: 2000 }];
  main[0] = { id: 'main-001', start: 0, end: 2000, text: '正文呃。', items: tail };
  context.MaweBoot.DATA.gap_remove.provenance.sources.ai_cleanup = [{ start: 1100, end: 2000,
    cleanup_scope: { segment_id: 'main-001', item_start: 1, item_end: 3, text: '呃。' } }];
  context.window.MaweJsonRepair.repairTimingGroup(main);
  assert.equal(main[0].items[1].end, 2000, 'only the exact originally selected endpoint is restored');
  assert.equal(context.MaweBoot.DATA.gap_remove.provenance.sources.ai_cleanup[0].end, 2000);
  assert.equal(core.projectCleanupRetainedSegments(main, context.MaweBoot.DATA.gap_remove)[0].text, '正文');
});

test('neutral migration cannot reauthorize stale/bad boundaries or newly mixed unselected words/symbols', () => {
  for (const failure of ['stale', 'boundary', 'accidental', 'word', 'timing', 'symbol']) {
    const { context, core, main, utils } = neutralNormalizationRuntime();
    const ranges = context.MaweBoot.DATA.gap_remove.provenance.sources.ai_cleanup;
    if (failure === 'stale') ranges[1].cleanup_scope.text = 'stale';
    if (failure === 'boundary') ranges[1].start = 810.2;
    if (failure === 'accidental') {
      ranges[1].cleanup_scope.item_start = 3;
      ranges[1].cleanup_scope.item_end = 4;
    }
    if (failure === 'symbol') {
      main[0].items[2].text = '🙂';
      main[0].text = main[0].items.map((item) => item.text).join('');
      ranges[0].end = 400;
      ranges[0].cleanup_scope.item_end = 2;
      ranges[0].cleanup_scope.text = '我我这个';
    }
    if (failure === 'word' || failure === 'timing') {
      const normalize = utils.normalizeSegmentTimings;
      context.window.AsrEditorUtils = { ...utils, normalizeSegmentTimings: (segments) => {
        const count = normalize(segments);
        if (segments === main) {
          if (failure === 'word') segments[0].items[3].text += '未选正文';
          else segments[0].items[3].start += 1;
          segments[0].text = segments[0].items.map((item) => item.text).join('');
        }
        return count;
      } };
    }
    if (failure === 'word' || failure === 'timing') {
      context.MaweBoot.DATA.gap_remove.provenance.sources.audio_gate = [{ start: 810, end: 930 }];
      context.MaweBoot.DATA.gap_remove.provenance.manual_overrides = [{ id: 'manual-gap', start: 400, end: 800, removed: true }];
      context.MaweBoot.DATA.markers = { schema: 'moy.asr.markers.v1', items: [
        { id: 'user', start: 810, end: 930, name: 'user', color: '#ffffff', note: 'manual' },
        { id: 'ai', start: 810, end: 930, name: 'AI', color: '#8e4ec6', note: '[AI] 删除：局部口吃' },
      ] };
    }
    context.window.MaweJsonRepair.normalizeProjectTimings(context.MaweBoot.DATA);
    if (['stale', 'boundary', 'accidental'].includes(failure)) assert.equal(ranges[1].cleanup_scope, undefined, failure);
    const output = core.projectCleanupRetainedSegments(main, context.MaweBoot.DATA.gap_remove)[0].text;
    if (failure !== 'symbol') assert.match(output, /嗯/, failure);
    if (failure === 'word' || failure === 'timing') {
      if (failure === 'word') assert.match(output, /未选正文/);
      assert.equal(context.MaweBoot.DATA.gap_remove.provenance.sources.ai_cleanup.length, 0);
      assert.equal(context.MaweBoot.DATA.gap_remove.provenance.sources.audio_gate.length, 1);
      assert.ok(context.MaweBoot.DATA.gap_remove.gaps.some((gap) => gap.start === 810));
      assert.equal(context.MaweBoot.DATA.gap_remove.provenance.manual_overrides[0].id, 'manual-gap');
      const markers = context.MaweBoot.DATA.markers.items;
      assert.equal(markers.find((marker) => marker.id === 'user').note, 'manual');
      assert.equal(markers.find((marker) => marker.id === 'ai').review.status, 'pending');
      assert.equal(markers.filter((marker) => marker.review?.status === 'pending').length, 2);
    }
    if (failure === 'symbol') {
      assert.match(output, /🙂/);
      assert.doesNotMatch(output, /嗯/);
      assert.equal(main[0].items.find((item) => item.text === '🙂').start, 410, 'unselected symbol retains its own original timing');
      const again = context.window.MaweJsonRepair.repairTimingGroup(main);
      assert.equal(again.fixed, 0, 'preserved anchors do not report a new timing repair on each save');
      assert.equal(again.changed.length, 0);
    }
  }
});

test('failed first cue cannot replace the live ranges of a later successful cue', () => {
  const { context, core, main } = neutralNormalizationRuntime();
  const second = plain(main[0]); second.id = 'second'; second.start += 4000; second.end += 4000;
  second.items.forEach((item) => { item.start += 4000; item.end += 4000; });
  main.push(second);
  main.unshift({ id: 'lead', start: 0, end: 2000, text: '前文', items: [{ text: '前文', start: 0, end: 2000 }] });
  const state = context.MaweBoot.DATA;
  const ranges = state.gap_remove.provenance.sources.ai_cleanup;
  ranges.push(...plain(ranges).map((range) => ({ ...range, start: range.start + 4000, end: range.end + 4000,
    cleanup_scope: { ...range.cleanup_scope, segment_id: 'second' } })));
  state.markers = [{ id: 'user', start: 0, end: 110, name: 'manual', note: 'manual', color: '#ffffff' }];
  context.window.MaweJsonRepair.normalizeProjectTimings(state);
  assert.ok(Array.isArray(state.markers));
  assert.equal(state.markers.filter((marker) => marker.review?.status === 'pending').length, 2);
  assert.equal(state.markers.find((marker) => marker.id === 'user').note, 'manual');
  assert.equal(state.gap_remove.provenance.sources.ai_cleanup.length, 2);
  assert.equal(state.gap_remove.provenance.sources.ai_cleanup[1].cleanup_scope.item_start, 3);
  assert.equal(core.projectCleanupRetainedSegments(main, state.gap_remove)[2].text, '我这个，功能很好呢');
  const reopened = plain(state);
  context.window.MaweJsonRepair.normalizeProjectTimings(reopened);
  assert.equal(core.projectCleanupRetainedSegments(reopened.segments, reopened.gap_remove)[2].text, '我这个，功能很好呢');
  assert.equal(reopened.gap_remove.provenance.sources.ai_cleanup.length, 2);
});

test('production ordinary/gap SRT and ASS builders remove local words while independent tracks survive', () => {
  const { context, srt, main, extension, overlay } = runtime();
  const before = JSON.stringify(main);
  for (const output of [srt.buildSrt(), srt.buildGapRemovedSrt(), srt.buildBilingualSrt(), srt.buildAss(), srt.buildGapRemovedAss()]) {
    assert.match(output, /我这个功能呢/);
    assert.doesNotMatch(output, /啊，|我这……/);
    assert.match(output, /overlay untouched/);
  }
  assert.match(srt.buildSrt(), /00:00:00,900 --> 00:00:02,000/);
  assert.match(srt.buildGapRemovedSrt(), /00:00:00,130 --> 00:00:01,230/);
  assert.match(srt.buildExtensionSrt(), /translated body/);
  assert.equal(JSON.stringify(main), before);
  assert.equal(extension[0].disabled, undefined);
  assert.equal(overlay[0].disabled, undefined);
  context.MaweBoot.DATA.gap_remove.provenance.manual_overrides = [{ start: 0, end: 770, removed: false }];
  assert.match(srt.buildSrt(), /我这……/);
});

test('dynamic caption plans use surviving items and geometry receives surviving text', () => {
  const { context, utils, srt, main, extension } = runtime();
  for (const compressed of [false, true]) {
    const data = srt.buildDynamicCaptionExportData(main, compressed);
    assert.equal(data.segments[0].text, '我这个功能呢');
    assert.deepEqual(Array.from(data.segments[0].items, (item) => item.text), ['我这个功能呢']);
    assert.equal(data.segments[0].start, compressed ? 130 : 900);
    const extensionData = srt.buildDynamicCaptionExportData(extension, compressed);
    assert.equal(extensionData.segments[0].text, 'translated body');
  }
  const data = srt.buildDynamicCaptionExportData(main, true);
  const ass = utils.buildAssPayload(data.segments);
  assert.doesNotMatch(ass, /我这……/);
  const projected = srt.cleanupMainSegments();
  assert.equal(utils.buildPlainTextPayload(projected), '我这个功能呢');
  assert.equal(context.MaweBoot.DATA.segments[0].items.length, 3);
});

test('source/gap OTIO subtitle marker names and FCP/XML plans use exact retained main text', () => {
  const { context, timeline, utils, main, overlay, extension } = runtime();
  for (const interval of [{ start: 0, end: 2000 }, { start: 770, end: 2000 }]) {
    const markers = timeline.buildGapRemovedSubtitleMarkers(interval);
    assert.equal(markers[0].name, '我这个功能呢');
    assert.equal(markers[0].marked_range.start_time.value, 54);
    assert.equal(timeline.buildGapRemovedSubtitleMarkers(interval, 0, overlay, overlay)[0].name, 'overlay untouched');
  }
  for (const timelineMode of ['source', 'gap_removed']) {
    const plan = utils.buildProjectExportPlan({ ...context.MaweBoot.DATA,
      overlay_track: { enabled: true, segments: overlay }, multi_subtitle: { enabled: true, tracks: [{ segments: extension }] } }, { timelineMode });
    assert.equal(plan.cues.main[0].text, '我这个功能呢');
    assert.equal(plan.cues.extension[0].text, 'translated body');
    const [artifact] = utils.buildFcp7ExportArtifacts(plan, { subtitleTracks: 'all', nativeTextObjects: true });
    assert.match(artifact.content, /我这个功能呢/);
    assert.doesNotMatch(artifact.content, /我这……/);
  }
  assert.equal(main[0].text, source().text);
});
