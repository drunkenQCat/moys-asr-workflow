#!/usr/bin/env bash
set -euo pipefail

feature=${1:?Expected ocr or local}
case $feature in ocr|local) ;; *) exit 2 ;; esac
data="$HOME/.var/app/$APP_ID/data/MAW"
evidence="$PWD/flatpak-evidence"
mkdir -p "$data/fixture" "$data/tmp" "$evidence"

flatpak run --user --command=sh "$APP_ID" -ec 'df -h /tmp "$XDG_DATA_HOME"' \
    | tee "$evidence/space.log"

flatpak run --user --env=QTWEBENGINE_REMOTE_DEBUGGING=127.0.0.1:9222 \
    --env=TMPDIR="$data/tmp" \
    --env=MAW_PIP_INDEX=https://pypi.org/simple "$APP_ID" >"$evidence/launcher.log" 2>&1 &
launcher=$!
finish() {
    flatpak kill "$APP_ID" >/dev/null 2>&1 || true
    wait "$launcher" 2>/dev/null || true
    cp -r "$data/logs" "$evidence/" 2>/dev/null || true
}
trap finish EXIT
timeout 820 node scripts/packaging/flatpak-validation/install-via-launcher.mjs "$feature" \
    | tee "$evidence/install-result.json"

case $feature in
    ocr)
        ffmpeg -hide_banner -loglevel error -f lavfi -i color=white:s=480x160:r=5 \
            -vf 'drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text=MAW TEST 123:fontsize=40:fontcolor=black:x=20:y=50' \
            -t 2 -c:v libx264 -pix_fmt yuv420p "$data/fixture/input.mp4"
        timeout 320 flatpak run --user --command=sh "$APP_ID" -ec '
            root="$XDG_DATA_HOME/MAW"
            exec "$root/ocr-runtime/bin/python" /app/maw/_internal/ocr-runtime/maw/ocr_runtime_worker.py scan \
              --model-id pp-ocrv6-tiny --video-path "$root/fixture/input.mp4" \
              --ffmpeg-path /app/maw/ffmpeg/bin/ffmpeg --duration-ms 2000 --max-frames 2
        ' | tee "$evidence/ocr.log"
        grep -q '"type": "result"' "$evidence/ocr.log"
        grep -Eqi 'MAW[[:space:]]*TEST[[:space:]]*123' "$evidence/ocr.log"
        ;;
    local)
        espeak-ng -v en-us -s 140 -w "$data/fixture/input.wav" 'Hello world. This is a subtitle test.'
        timeout 420 flatpak run --user --command=sh "$APP_ID" -ec '
            root="$XDG_DATA_HOME/MAW"
            export PATH="/app/maw/ffmpeg/bin:$PATH"
            cd /app/maw/_internal/local-runtime
            exec "$root/local-runtime/bin/python" -m maw.asr.local "$root/fixture/input.wav" \
              --engine whisper --model tiny.en --device cpu --language en \
              --output "$root/fixture/output.srt" --json --no-html
        ' | tee "$evidence/asr.log"
        test -s "$data/fixture/output.srt"
        test -s "$data/fixture/output.mosp"
        grep -qi 'hello\|subtitle' "$data/fixture/output.srt"
        ;;
esac
