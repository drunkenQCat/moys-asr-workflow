from __future__ import annotations

import re
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import edit  # noqa: E402


class EditorAssetContractTests(unittest.TestCase):
    def test_editor_script_path_accepts_subdirectories_and_rejects_escapes(self) -> None:
        self.assertTrue(edit.editor_script_path("editor/lib/timed-text/core.js").is_file())
        for entry, reason in (
            ("../outside.js", "escape"),
            ("sub/../outside.js", "escape"),
            ("sub\\editor-utils.js", "backslash"),
            ("/abs/editor-utils.js", "absolute"),
            ("C:/abs/editor-utils.js", "drive"),
            ("editor-utils.mjs", "suffix"),
            ("nested/does-not-exist.js", "missing"),
        ):
            with self.subTest(entry=entry, reason=reason):
                with self.assertRaises(ValueError):
                    edit.editor_script_path(entry)

    def test_committed_blank_editor_is_regenerated_from_web_sources(self) -> None:
        # blank-editor.html 是纯生成产物；源码改动后忘记重生成会让仓库里的便携版
        # 静默落后于 web/，而且没有任何自动化能发现。这里做逐字节对照。
        committed = (ROOT / "blank-editor.html").read_text(encoding="utf-8")
        self.assertEqual(committed, edit.build_blank_html())

    def test_every_editor_source_is_listed_in_the_manifest(self) -> None:
        # web/launcher/ 用自己的 <script src>，不属于编辑器装配清单。
        listed = {str(edit.editor_script_path(entry)) for entry in edit.read_editor_script_manifest()}
        orphan_scripts = []
        for script in (ROOT / "web").rglob("*.js"):
            if "launcher" in script.relative_to(ROOT / "web").parts:
                continue
            if str(script.resolve()) not in listed:
                orphan_scripts.append(script.relative_to(ROOT / "web").as_posix())
        self.assertEqual(orphan_scripts, [], "web/ 下存在未登记到 editor-scripts.txt 的脚本")

    def test_editor_script_manifest_is_ordered_and_complete(self) -> None:
        self.assertEqual(
            edit.read_editor_script_manifest(),
            (
                "editor/boot/data.js",
                "editor/boot/registry.js",
                "shared/gap-remove-core.js",
                "editor/lib/namespace.js",
                "editor/lib/json-value.js",
                "editor/lib/audio-metadata.js",
                "editor/lib/text-processing.js",
                "editor/lib/cue-metrics.js",
                "editor/lib/cue-timings.js",
                "editor/lib/duration-format.js",
                "editor/lib/split-candidates.js",
                "editor/lib/cue-navigation.js",
                "editor/lib/split-trim-symbols.js",
                "editor/lib/settings-normalize.js",
                "editor/lib/gap-remove-bridge.js",
                "editor/lib/history-record.js",
                "editor/lib/subtitles/normalize.js",
                "editor/lib/subtitles/word-split.js",
                "editor/lib/subtitles/bindings.js",
                "editor/lib/timed-text/core.js",
                "editor/lib/timed-text/structure.js",
                "editor/lib/timed-text/boundary.js",
                "editor/lib/export/srt-payload.js",
                "editor/lib/export/plan.js",
                "editor/lib/export/fcp7.js",
                "editor/lib/export/artifacts.js",
                "editor/lib/platform.js",
                "editor/lib/preview-geometry.js",
                "editor/lib/graphics/lottie.js",
                "editor/lib/graphics/ograf.js",
                "editor/lib/compat-surface.js",
                "editor/i18n/i18n.js",
                "editor/waveform/namespace.js",
                "editor/waveform/constants.js",
                "editor/waveform/workspaces.js",
                "editor/waveform/labels.js",
                "editor/waveform/numeric.js",
                "editor/waveform/multi-row.js",
                "editor/waveform/layout-tree.js",
                "editor/waveform/settings-io.js",
                "editor/waveform/decode.js",
                "editor/waveform/spectral.js",
                "editor/waveform/scale.js",
                "editor/waveform/cue-timing.js",
                "editor/waveform/segment-split.js",
                "editor/waveform/cue-lookup.js",
                "editor/waveform/core.js",
                "editor/waveform/media.js",
                "editor/waveform/controls.js",
                "editor/waveform/hover-preview.js",
                "editor/waveform/layout.js",
                "editor/waveform/layout-edit.js",
                "editor/waveform/view.js",
                "editor/waveform/render.js",
                "editor/waveform/cue-blocks.js",
                "editor/waveform/pointer-time.js",
                "editor/waveform/pointer-create.js",
                "editor/waveform/cue-drag.js",
                "editor/waveform/keyboard-adjust.js",
                "editor/waveform/gap-drag.js",
                "editor/waveform/playback.js",
                "editor/waveform/compat-surface.js",
                "editor/playback/jkl.js",
                "editor/ui/hint.js",
                "editor/lib/multi-subtitle-core.js",
                "editor/lib/settings.js",
                "editor/lib/colors.js",
                "editor/gap/data.js",
                "editor/state/core.js",
                "editor/state/history.js",
                "editor/ui/elements/namespace.js",
                "editor/ui/elements/shell.js",
                "editor/ui/elements/subtitle-appearance.js",
                "editor/ui/elements/player.js",
                "editor/ui/elements/behavior-settings.js",
                "editor/ui/elements/ninja.js",
                "editor/ui/elements/help-panel.js",
                "editor/ui/elements/interaction-settings.js",
                "editor/ui/elements/timed-edit-refs.js",
                "editor/ui/elements/media-export-modals.js",
                "editor/ui/elements/cue-panel.js",
                "editor/ui/elements/project-actions.js",
                "editor/ui/elements/multi-subtitle.js",
                "editor/ui/elements/settings-panels.js",
                "editor/ui/elements/gap-remove-panel.js",
                "editor/ui/elements/auto-merge-panel.js",
                "editor/ui/elements/subtitle-extend-panel.js",
                "editor/ui/elements/compat-surface.js",
                "editor/state/cue-panel.js",
                "editor/stickers/ninja.js",
                "editor/ui/settings-panels.js",
                "editor/appearance/display-settings.js",
                "editor/split/mode.js",
                "editor/split/trim.js",
                "editor/cues/segment-ops.js",
                "editor/ui/floating-panel.js",
                "editor/gap/ui.js",
                "editor/cues/selection.js",
                "editor/timeline/binding-align.js",
                "editor/cues/panel.js",
                "editor/ui/cue-elements.js",
                "editor/cues/color-filter.js",
                "editor/cues/search.js",
                "editor/cues/inline-edit.js",
                "editor/split/namespace.js",
                "editor/split/pending-state.js",
                "editor/split/offset-timing.js",
                "editor/split/item-cut.js",
                "editor/split/lane-state.js",
                "editor/split/lane-controls.js",
                "editor/split/lane-render.js",
                "editor/split/auto-submit.js",
                "editor/split/modal.js",
                "editor/split/commit.js",
                "editor/split/cursor-split.js",
                "editor/split/compat-surface.js",
                "editor/split/context-menu.js",
                "editor/cues/list-anchor.js",
                "editor/timeline/nav-preview.js",
                "editor/cues/events.js",
                "editor/playback/media.js",
                "editor/input/keyboard-targets.js",
                "editor/input/shortcuts.js",
                "editor/cues/merge-adjacent.js",
                "editor/appearance/subtitle.js",
                "editor/appearance/preview-geometry.js",
                "editor/playback/loop.js",
                "editor/stickers/overlay.js",
                "editor/export/srt.js",
                "editor/export/timeline.js",
                "editor/server/save.js",
                "editor/server/workspaces.js",
                "editor/project/save.js",
                "editor/export/dynamic.js",
                "editor/ui/export-menus.js",
                "editor/project/media-inputs.js",
                "editor/lib/json-repair.js",
                "editor/project/load.js",
                "editor/ui/loading-progress.js",
                "editor/project/multi-import.js",
                "editor/project/media-load.js",
                "editor/stickers/root.js",
                "editor/text/find-replace.js",
                "editor/text/process.js",
                "editor/text/timed-edit/namespace.js",
                "editor/text/timed-edit/source-state.js",
                "editor/text/timed-edit/row-diff.js",
                "editor/text/timed-edit/view.js",
                "editor/text/timed-edit/draft.js",
                "editor/text/timed-edit/apply.js",
                "editor/text/timed-edit/compat-surface.js",
                "editor/stickers/picker.js",
                "editor/cues/add.js",
                "editor/timeline/boundary-drag.js",
                "editor/ui/context-menus.js",
                "editor/text/cleanup.js",
                "editor/timeline/waveform-init.js",
                "editor/ui/help-panel.js",
                "editor/appearance/theme.js",
                "editor/playback/step.js",
                "editor/appearance/inputs.js",
                "editor/ui/behavior-hints.js",
                "editor/server/connection.js",
                "editor/input/drag-drop.js",
                "editor/export/sticker-otio.js",
                "editor/boot/entry.js",
                "editor/onboarding/tour.js",
            ),
        )

    def test_editor_script_payload_follows_manifest_order(self) -> None:
        # 锚点不手写：逐个清单条目取自己源码里的首个非注释行，再要求这些锚点按同样的
        # 顺序出现在装配结果里。模块继续拆细、IIFE 改名都不用再维护一张对齐表。
        payload = edit.build_editor_scripts()
        manifest = edit.read_editor_script_manifest()
        previous_index = -1
        for entry in manifest:
            source = edit.editor_script_path(entry).read_text(encoding="utf-8")
            marker = next(
                line for line in source.splitlines() if line.strip() and not line.lstrip().startswith("//")
            )
            found = payload.find(marker, previous_index + 1)
            self.assertGreater(found, previous_index, f"{entry} 的起点没有出现在上一个条目之后")
            previous_index = found

    def test_waveform_prototype_mixins_load_after_the_class_and_before_the_exit(self) -> None:
        """波形块按 window.MaweWaveform 装配：混入模块在加载期就要拿到类，
        所以顺序必须是 namespace → …… → core（class 声明）→ 各混入 → 兼容出口。"""
        manifest = list(edit.read_editor_script_manifest())
        block = [e for e in manifest if e.startswith("editor/waveform/")]
        self.assertEqual(block[0], "editor/waveform/namespace.js")
        self.assertEqual(block[-1], "editor/waveform/compat-surface.js")
        class_owner = "editor/waveform/core.js"
        self.assertIn(class_owner, block)
        mixins = [
            entry
            for entry in block
            if "defineMethods(U.WaveformEditor.prototype" in edit.editor_script_path(entry).read_text(encoding="utf-8")
        ]
        self.assertGreaterEqual(len(mixins), 10, "原型混入模块数量异常，疑似装配方式被改动")
        for entry in mixins:
            self.assertGreater(manifest.index(entry), manifest.index(class_owner), f"{entry} 在类声明之前加载")

    def assert_facade_matches_modules(self, modules: list[str], surface: str, area: str) -> set[str]:
        """按内部命名空间装配的块（editor/split、editor/text/timed-edit、
        editor/ui/elements）共用这套比对：模块发布到 U 的符号不许重名，兼容出口的
        门面键集合必须与发布集合完全相等——多一个键说明有人把内部 helper 漏进了
        出口，少一个键说明出口重建时丢了线。"""
        published: set[str] = set()
        for entry in modules:
            source = edit.editor_script_path(entry).read_text(encoding="utf-8")
            names: set[str] = set()
            for block_text in re.findall(r"Object\.assign\(U, \{\n(.*?)\n  \}\);", source, re.DOTALL):
                names.update(re.findall(r"^    ([\w$]+),$", block_text, re.MULTILINE))
            names.update(re.findall(r"Object\.defineProperty\(U, '([\w$]+)'", source))
            overlap = names & published
            self.assertFalse(overlap, f"{sorted(overlap)} 被 {area} 两个模块同时发布")
            published |= names

        facade_body = surface.split("Object.freeze({", 1)[1]
        facade_keys = set(re.findall(r"^    (?:get |set )?([\w$]+)[:(]", facade_body, re.MULTILINE))
        self.assertTrue(facade_keys, "兼容出口没有解析出任何键")
        self.assertEqual(
            sorted(facade_keys),
            sorted(published),
            f"兼容出口的门面键与 {area} 各模块发布的内部符号不一致",
        )
        return published

    def test_split_block_builds_the_frozen_facade_after_every_module(self) -> None:
        """editor/split/* 按 window.MaweSplit 装配：模块只在函数体内惰性互读，
        顺序本身自由；但 namespace 必须第一（它创建命名空间），兼容出口必须最后
        （它在加载期一次性读出全部符号并 Object.freeze）。"""
        manifest = list(edit.read_editor_script_manifest())
        # 同目录还有 mode.js / trim.js / context-menu.js 这些各自独立的模块，
        # 块范围由 namespace 与兼容出口两个锚点决定，而不是整个目录。
        start = manifest.index("editor/split/namespace.js")
        end = manifest.index("editor/split/compat-surface.js")
        self.assertGreater(end, start)
        block = manifest[start : end + 1]
        self.assertEqual(
            {e for e in manifest if e.startswith("editor/split/") and e not in block},
            {"editor/split/mode.js", "editor/split/trim.js", "editor/split/context-menu.js"},
            "editor/split/ 目录里除本块之外还应只有这三个独立模块",
        )
        modules = block[1:-1]
        self.assertGreaterEqual(len(modules), 8, "拆分块模块数量异常，疑似装配方式被改动")

        surface = edit.editor_script_path("editor/split/compat-surface.js").read_text(encoding="utf-8")
        self.assertIn("global.MaweSplitCore = Object.freeze({", surface)
        # 可变状态必须以访问器对通过门面读写，语义才与拆分前共享同一个 let 一致。
        self.assertIn("get pendingLinkedSplit() { return U.pendingLinkedSplit; },", surface)
        self.assertIn("set pendingLinkedSplit(v) { U.pendingLinkedSplit = v; },", surface)
        self.assert_facade_matches_modules(modules, surface, "editor/split/")

    def test_timed_edit_block_builds_the_frozen_facade_after_every_module(self) -> None:
        """editor/text/timed-edit/* 按 window.MaweText 装配，规则与 editor/split/* 相同：
        namespace 第一，兼容出口最后，出口在加载期读出全部符号并 Object.freeze。
        这块没有跨模块写入的可变状态，所以门面全是数据属性，不含访问器对。"""
        manifest = list(edit.read_editor_script_manifest())
        start = manifest.index("editor/text/timed-edit/namespace.js")
        end = manifest.index("editor/text/timed-edit/compat-surface.js")
        self.assertGreater(end, start)
        block = manifest[start : end + 1]
        self.assertEqual(
            [e for e in manifest if e.startswith("editor/text/timed-edit/")],
            block,
            "editor/text/timed-edit/ 目录里的脚本必须连续装配",
        )
        modules = block[1:-1]
        self.assertGreaterEqual(len(modules), 4, "拆分块模块数量异常，疑似装配方式被改动")

        surface = edit.editor_script_path("editor/text/timed-edit/compat-surface.js").read_text(encoding="utf-8")
        self.assertIn("global.MaweTimedTextEdit = Object.freeze({", surface)
        self.assert_facade_matches_modules(modules, surface, "editor/text/timed-edit/")

    def test_dom_elements_block_is_split_by_ui_region_and_stays_contiguous(self) -> None:
        """editor/ui/elements/* 是编辑器全部 DOM 元素引用的装配块：每个模块在加载期
        调 getElementById，最后一块把整张表快照成冻结的 window.MaweDom。外部有几百处
        读 MaweDom.xxx、还有 5 处经门面 setter 写可变状态，所以键名、键序与访问器种类
        都不许变；模块按 UI 区域划分，是为了让"这个界面需要哪些元素"能一眼定位。"""
        manifest = list(edit.read_editor_script_manifest())
        block = [e for e in manifest if e.startswith("editor/ui/elements/")]
        self.assertEqual(block[0], "editor/ui/elements/namespace.js")
        self.assertEqual(block[-1], "editor/ui/elements/compat-surface.js")
        modules = block[1:-1]
        self.assertGreaterEqual(len(modules), 12, "DOM 引用块模块数量异常，疑似装配方式被改动")

        surface = edit.editor_script_path("editor/ui/elements/compat-surface.js").read_text(encoding="utf-8")
        self.assertIn("global.MaweDom = Object.freeze({", surface)
        published = self.assert_facade_matches_modules(modules, surface, "editor/ui/elements/")
        self.assertGreaterEqual(len(published), 280, "DOM 引用数量异常减少，疑似有引用在搬运中丢失")

        # 可变状态原来靠门面里的 setter 赋值；拆分后 owner 必须继续提供 setter，
        # 否则 compat-surface 里的 `U.x = v` 会在严格模式下抛 TypeError。
        for name in (
            "mediaSeekInputLastValue",
            "hideDisabled",
            "timedTextEditDraft",
            "timedTextEditReturnFocus",
            "timedTextEditReportTimer",
        ):
            self.assertIn(f"get {name}() {{ return U.{name}; }},", surface)
            self.assertIn(f"set {name}(v) {{ U.{name} = v; }},", surface)

        # 拆这一块的目的是消灭千行文件；区域模块再长也不该回到原来的量级。
        for entry in modules:
            lines = len(edit.editor_script_path(entry).read_text(encoding="utf-8").splitlines())
            self.assertLessEqual(lines, 200, f"{entry} 有 {lines} 行，超出区域模块的量级")

    def test_waveform_gap_display_type_uses_shared_core_and_subtle_protected_style(self) -> None:
        waveform = edit.read_editor_scripts_under("editor/waveform/")
        styles = edit.read_web_asset("waveform.css")
        self.assertIn("getGapRemoveDisplayType", waveform)
        self.assertIn("isGapRemoveDisplayProtected", waveform)
        self.assertIn("block.classList.toggle('restored', gap.removed === false)", waveform)
        self.assertIn("waveform-gap-block.protected", styles)
        self.assertIn("box-shadow: inset 0 0 0 4px", styles)
        self.assertIn("this.options.getGapRemoveGaps?.() || []", waveform)

    def test_gap_state_labels_match_in_mawe_and_align(self) -> None:
        waveform = edit.read_editor_scripts_under("editor/waveform/")
        align_page = (ROOT / "server-align" / "index.html").read_text(encoding="utf-8")
        label = "gap.removed === false ? '空隙（未激活）' : '空隙'"
        self.assertIn(label, waveform)
        self.assertIn(label, align_page)

    def test_gap_manual_drag_uses_blue_handles_and_preview_in_both_editors(self) -> None:
        waveform_styles = edit.read_web_asset("waveform.css")
        align_page = (ROOT / "server-align" / "index.html").read_text(encoding="utf-8")
        for styles, handle, dragging in (
            (waveform_styles, ".waveform-gap-handle::after", ".waveform-gap-block.dragging"),
            (align_page, ".gap-handle::after", ".gap-range.dragging"),
        ):
            self.assertIn(handle, styles)
            self.assertIn(dragging, styles)
            self.assertIn("background: #5ab6ff", styles)
            self.assertIn("rgba(94", styles)

    def test_gap_core_exposes_restore_and_clear_semantics(self) -> None:
        core = edit.read_web_asset("shared/gap-remove-core.js")
        self.assertIn("function getGapRemoveDisplayGaps", core)
        self.assertIn("removed: false", core)
        self.assertIn("function removeGapRemoveProvenanceRange", core)
        self.assertIn("GAP_DISPLAY_PROJECTION_CACHE", core)
        self.assertIn("function moveGapRemoveProvenance", core)
        self.assertIn("function absorbGapRemoveProvenanceRanges", core)
        self.assertIn("GAP_REMOVE_MANUAL_OPERATION_MOVE", core)
        self.assertIn("cleared_ranges", core)
        self.assertNotIn("underlying", core)

    def test_editor_overall_gap_move_uses_shared_provenance_operation(self) -> None:
        script = edit.read_web_asset("editor/gap/ui.js")
        start = script.index("function translateManualGap(")
        end = script.index("function resizeManualGapBoundary(", start)
        section = script[start:end]
        self.assertIn("core.moveGapRemoveProvenance", section)
        self.assertNotIn("original.start, end: original.end, removed: false", section)

    def test_shrink_gaps_replaces_audio_source_without_manual_override(self) -> None:
        script = edit.read_web_asset("editor/gap/ui.js")
        start = script.index("function shrinkExistingGaps()")
        end = script.index("function readGapRemoveDisableSettings()", start)
        section = script[start:end]
        self.assertIn("core.replaceGapRemoveProvenanceSource", section)
        self.assertIn("state.manual_corrections = provenance.manual_overrides.length > 0", section)
        self.assertNotIn("commitManualGapRemoveChange(state, overrides)", section)

    def test_template_uses_one_script_token(self) -> None:
        template = edit.read_web_asset("editor-template.html")
        self.assertEqual(template.count("__EDITOR_SCRIPTS_JS__"), 1)
        for legacy_token in (
            "__EDITOR_UTILS_JS__",
            "__EDITOR_I18N_JS__",
            "__WAVEFORM_JS__",
            "__EDITOR_JS__",
            "__EDITOR_ONBOARDING_JS__",
        ):
            self.assertNotIn(legacy_token, template)

    def test_server_connection_warning_uses_shared_editor_contract(self) -> None:
        template = edit.read_web_asset("editor-template.html")
        styles = edit.read_web_asset("editor.css")
        script = edit.build_editor_scripts()
        self.assertIn('id="server-connection-banner"', template)
        self.assertIn("SERVER_CONNECTION_FAILURE_THRESHOLD", script)
        self.assertIn("function checkServerConnection()", script)
        self.assertIn(".server-connection-banner", styles)
        self.assertIn(".server-connection-banner[hidden]", styles)

    def test_new_project_action_precedes_open_project(self) -> None:
        template = edit.read_web_asset("editor-template.html")
        self.assertIn('id="new-project"', template)
        self.assertLess(template.index('id="new-project"'), template.index('id="open-project"'))

    def test_editor_sources_expose_checkpointed_import_contract(self) -> None:
        script = edit.build_editor_scripts()
        for seam in (
            "function buildBlankProject()",
            "function suggestedProjectName(",
            "async function createProjectCheckpoint(",
            "async function ensureProjectCheckpointForImport(",
            "function applyCanonicalProject(",
        ):
            self.assertIn(seam, script)
        self.assertIn("let projectFileHandle = null", script)
        self.assertIn("function saveProjectToHandle(", script)
        self.assertIn("function saveCurrentProject(", script)
        self.assertIn("function detachServerProjectSaving(", script)
        self.assertNotIn("SERVER_CONFIG.createUrl", script)
        self.assertNotIn("!projectLoadedFromSrt", script)

    def test_sticker_root_uses_server_validation_without_browser_picker(self) -> None:
        template = edit.read_web_asset("editor-template.html")
        script = edit.build_editor_scripts()
        styles = edit.read_web_asset("editor.css")
        self.assertIn('id="sticker-root-input"', template)
        self.assertIn('id="sticker-root-read"', template)
        self.assertIn('id="sticker-root-status"', template)
        self.assertIn("MaweBoot.SERVER_CONFIG?.stickerRootUrl", script)
        self.assertIn("MaweBoot.STICKERS.splice(0, MaweBoot.STICKERS.length, ...result.stickers)", script)
        self.assertIn("let stickerRootHintCard = null", script)
        self.assertIn("stickerRootHintCard?.remove()", script)
        self.assertIn("function setStickerRootModalOpen(open)", script)
        self.assertIn("event.key === 'Escape'", script)
        self.assertIn("event.key !== 'Tab'", script)
        self.assertIn("#sticker-root-modal { z-index: 280; }", styles)
        self.assertIn("width: min(540px, calc(100vw - 32px))", styles)
        for removed in (
            "showDirectoryPicker",
            "webkitdirectory",
            "sticker-root-folder-input",
            "applyStickerFiles",
            "collectStickerEntries",
            "[本地]",
        ):
            self.assertNotIn(removed, template + script)

    def test_sticker_otio_exposes_portable_mode_and_relative_metadata(self) -> None:
        template = edit.read_web_asset("editor-template.html")
        script = edit.build_editor_scripts()
        self.assertIn('id="sticker-otio-export-mode"', template)
        self.assertIn('option value="portable"', template)
        self.assertIn("sticker_rel: sticker.rel || ''", script)
        self.assertIn("sticker_rel: sticker.sticker_rel", script)
        self.assertIn("SERVER_CONFIG?.canPortableStickerExport", script)
        self.assertIn("SERVER_CONFIG?.portableStickerExportUrl", script)
        self.assertIn("'stickers', MaweExportTimeline.buildStickerOtio", script)
        self.assertIn("'gap-removed-stickers', MaweExportTimeline.buildGapRemovedStickerOtio", script)
        self.assertIn("timeline: JSON.parse(payload)", script)

    def test_portable_sticker_export_capability_syncs_after_project_binding(self) -> None:
        # 断言对象是清单拼接后的完整脚本：符号可以跨模块搬迁，装配后的行为不变。
        script = edit.build_editor_scripts()
        self.assertIn("function syncStickerOtioExportMode()", script)
        self.assertIn("portableStickerExportOption.disabled = !available", script)
        self.assertIn("stickerOtioExportMode.value = available", script)
        self.assertIn("? MaweSettings.EDITOR_SETTINGS.stickerOtioExportMode", script)
        self.assertIn(": 'original'", script)
        self.assertIn("stickerOtioExportMode: 'original'", script)
        self.assertIn("saved.stickerOtioExportMode === 'portable' ? 'portable' : 'original'", script)
        self.assertIn("MaweSettings.updateEditorSettings({ stickerOtioExportMode: MaweStickerOtioExport.stickerOtioExportMode.value })", script)
        # 便携导出能力只在服务器渲染绑定工程时开启；浏览器句柄工程不被服务器
        # 跟踪，解除保存时必须一并关闭，避免把导出写到服务器旧工程目录。
        self.assertIn("SERVER_CONFIG.canPortableStickerExport = false", script)
        self.assertNotIn("SERVER_CONFIG.canPortableStickerExport = true", script)
        self.assertIn("if (!syncStickerOtioExportMode())", script)
        self.assertIn("function configureServerSaveControls()", script)
        # 同步统一收敛在 configureServerSaveControls 末尾：保存目标变化
        # （服务器绑定 / 浏览器句柄 / 解除）都流经它重算便携导出可用性。
        self.assertEqual(script.count("syncStickerOtioExportMode();"), 1)
        self.assertNotIn("const portableStickerExportEnabled", script)

    def test_generated_page_contains_registered_modules_in_order(self) -> None:
        page = edit.build_blank_html()
        self.assertNotRegex(page, r"__[A-Z][A-Z0-9_]+__")
        self.assertIn(
            f'<span class="app-version" id="app-version" data-label="版本号">版本号 v{edit.get_app_version()}</span>',
            page,
        )
        # 便携页禁止携带「生成时间：…」式硬编码时间戳；「正在生成时间线 OTIOZ…」
        # 这类把「生成时间」作为前缀子串的普通文案不受限制。
        self.assertNotRegex(page, r"生成时间\s*[:：]")
        markers = (
            "// Shared frontend runtime registry.",
            "global.AsrGapRemoveCore = Object.freeze({",
            "window.AsrEditorUtils = {",
            "global.MAWE_I18N = {",
            "window.AsrWaveform = {",
            "window.MAWE_EDITOR_BRIDGE = Object.freeze({",
            "window.MAWE_ONBOARDING = Object.freeze({",
        )
        indices = [page.index(marker) for marker in markers]
        self.assertEqual(indices, sorted(indices))

    def test_tauri_builder_consumes_the_shared_script_manifest(self) -> None:
        build_script = (ROOT / "desktop" / "src-tauri" / "build.rs").read_text(encoding="utf-8")
        self.assertIn('web_dir.join("editor-scripts.txt")', build_script)
        self.assertIn('("__EDITOR_SCRIPTS_JS__", editor_scripts.as_str())', build_script)
        for legacy_token in (
            "__EDITOR_UTILS_JS__",
            "__EDITOR_I18N_JS__",
            "__WAVEFORM_JS__",
            "__EDITOR_JS__",
        ):
            self.assertNotIn(legacy_token, build_script)


class StickerScanTests(unittest.TestCase):
    def test_scan_stickers_keeps_images_when_dimensions_are_unreadable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            sticker = Path(directory) / "broken.png"
            sticker.write_bytes(b"not-a-png")
            stderr = StringIO()
            with redirect_stderr(stderr):
                root, stickers = edit.scan_stickers(Path(directory))

        self.assertTrue(root)
        self.assertEqual(stickers, [{"name": "broken", "filename": "broken.png", "rel": "broken.png"}])
        self.assertIn("无法读取尺寸", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
