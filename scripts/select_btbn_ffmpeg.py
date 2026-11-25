"""Resolve a Linux static FFmpeg asset from the newest dated BtbN build."""

import json
import re
import sys


def select_release(release, branch):
    tag = release["tag_name"]
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", tag):
        raise ValueError("invalid FFmpeg release tag")
    names = [asset["name"] for asset in release["assets"]]
    branch_re = re.escape(branch)
    exact = rf"ffmpeg-n{branch_re}(?:-latest|\.\d+(?:-\d+-g[0-9a-f]+)?)-linux64-gpl-{branch_re}\.tar\.xz"
    matches = [name for name in names if re.fullmatch(exact, name)]
    legacy = f"ffmpeg-n{branch}-latest-linux64-gpl-{branch}.tar.xz"
    if names.count("checksums.sha256") != 1:
        raise ValueError("missing or ambiguous FFmpeg checksum manifest")
    if matches.count(legacy) == 1:
        return tag, legacy
    if len(matches) == 1:
        return tag, matches[0]
    raise ValueError(f"expected one static Linux x86_64 GPL FFmpeg {branch} archive")


def select_autobuild(releases, branch):
    # BtbN deletes and recreates the rolling latest tag on every build.
    dated = (
        release
        for release in releases
        if re.fullmatch(r"autobuild-[0-9]{4}(?:-[0-9]{2}){4}", release["tag_name"])
    )
    newest = max(dated, key=lambda release: release["tag_name"], default=None)
    if newest is None:
        raise ValueError("no dated FFmpeg autobuild in the release list")
    return select_release(newest, branch)


if __name__ == "__main__":
    try:
        print(*select_autobuild(json.load(sys.stdin), sys.argv[1]))
    except (KeyError, TypeError, ValueError) as error:
        sys.exit(f"Cannot resolve upstream FFmpeg: {error}")
