import unittest

from scripts import select_btbn_ffmpeg
from scripts.select_btbn_ffmpeg import select_release


class SelectBtbnFfmpegTests(unittest.TestCase):
    legacy = "ffmpeg-n8.1-latest-linux64-gpl-8.1.tar.xz"
    versioned = "ffmpeg-n8.1.3-41-ga8029b6528-linux64-gpl-8.1.tar.xz"

    def test_selects_versioned_static_asset(self):
        self.assertEqual(self.select(self.versioned, self.versioned.replace("-gpl-", "-gpl-shared-"),
                                     self.versioned.replace("8.1", "9.0")), ("autobuild-test", self.versioned))

    def test_keeps_support_for_legacy_filename(self):
        self.assertEqual(self.select(self.legacy), ("autobuild-test", self.legacy))

    def test_rejects_missing_or_ambiguous_exact_matches(self):
        for names in [(), (self.versioned, self.versioned.replace("-41-", "-42-"))]:
            with self.subTest(names=names), self.assertRaises(ValueError):
                self.select(*names)

    def test_requires_checksum_manifest(self):
        with self.assertRaises(ValueError):
            select_release({"tag_name": "autobuild-test", "assets": [{"name": self.versioned}]}, "8.1")

    def test_prefers_newest_dated_build_during_latest_rollover(self):
        older = self.release("autobuild-2026-11-24-12-41", self.versioned)
        newer = self.release("autobuild-2026-11-25-12-41", self.versioned)
        latest = self.release("latest", self.legacy)
        incomplete_latest = {"tag_name": "latest", "assets": []}
        for releases in ([older, latest, newer], [incomplete_latest, newer], [newer, older]):
            with self.subTest(releases=releases):
                self.assertEqual(
                    select_btbn_ffmpeg.select_autobuild(releases, "8.1"),
                    (newer["tag_name"], self.versioned),
                )

    def select(self, *names):
        return select_release(self.release("autobuild-test", *names), "8.1")

    @staticmethod
    def release(tag, *names):
        return {
            "tag_name": tag,
            "assets": [{"name": name} for name in (*names, "checksums.sha256")],
        }
