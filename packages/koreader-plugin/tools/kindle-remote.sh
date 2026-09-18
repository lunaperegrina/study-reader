#!/usr/bin/env bash
# Remote eyes + hands on the reference Kindle over SSH: framebuffer screenshots
# and injected touch input, so the plugin UI can be verified and driven from
# the dev machine without touching the device.
#
# Usage:
#   STUDYREADER_HOST=root@kindle-ip [STUDYREADER_PORT=2222] pnpm plugin:remote <cmd> [args]
#
# Commands:
#   info                                framebuffer geometry, touch device, KOReader pid
#   screenshot [out.png]                capture e-ink framebuffer (default /tmp/kindle-screen.png)
#   tap <x> <y> [hold_ms]               inject tap (default 100ms hold)
#   longpress <x> <y>                   inject ~900ms hold (context menus)
#   swipe <x1> <y1> <x2> <y2> [ms]      inject drag (default 400ms)
#   launch [file]                       restart KOReader, optionally opening <file>
#   log [lines]                         tail KOReader crash.log (default 30)
#
# Needs on the dev machine: ssh, python3, ffmpeg (screenshot only).
# Auth: same SSH_ASKPASS setup as deploy.sh. Remote side: busybox sh, base64,
# usleep; input injection writes protocol-B evdev events to the touchscreen.
export COPYFILE_DISABLE=1

set -euo pipefail

HOST="${STUDYREADER_HOST:-}"
PORT="${STUDYREADER_PORT:-22}"
FB_GEOMETRY="${STUDYREADER_FB_GEOMETRY:-1072x1448}"
FB_DEV="${STUDYREADER_FB:-/dev/fb0}"
TOUCH_DEV="${STUDYREADER_TOUCH:-/dev/input/event1}"
KO_DIR="${STUDYREADER_KO_DIR:-/mnt/us/koreader}"

usage() { sed -n '2,21p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

SSH_OPTS=(-p "$PORT" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8)

ssh_run() {
	[[ -n "$HOST" ]] || { echo "error: set STUDYREADER_HOST (e.g. root@192.168.1.50)" >&2; exit 1; }
	ssh "${SSH_OPTS[@]}" "$HOST" "$@"
}

cmd_info() {
	ssh_run "
		echo \"geometry(config): $FB_GEOMETRY\"
		echo \"bpp: \$(cat /sys/class/graphics/fb0/bits_per_pixel 2>/dev/null || echo '?')\"
		echo \"fb: \$(ls -la $FB_DEV 2>/dev/null || echo missing)\"
		echo \"touch: $TOUCH_DEV -> \$(cat /sys/class/input/\$(basename $TOUCH_DEV)/device/name 2>/dev/null || cat /sys/class/input/\$(basename $TOUCH_DEV)/name 2>/dev/null || echo '?')\"
		echo \"koreader pid: \$(pidof luajit || echo not running)\"
		echo \"usleep: \$(command -v usleep || echo MISSING)\"
	"
}

pix_fmt_for_bpp() {
	case "$1" in
		8) echo gray ;;
		16) echo rgb565le ;;
		32) echo bgr0 ;;
		*) echo "error: unsupported framebuffer bpp $1" >&2; return 1 ;;
	esac
}

cmd_screenshot() {
	local out="${1:-/tmp/kindle-screen.png}"
	local w h bpp bytes raw fmt
	w="${FB_GEOMETRY%x*}"
	h="${FB_GEOMETRY#*x}"
	bpp="$(ssh_run "cat /sys/class/graphics/fb0/bits_per_pixel 2>/dev/null" || echo 8)"
	[[ "$bpp" =~ ^[0-9]+$ ]] || bpp=8
	fmt="$(pix_fmt_for_bpp "$bpp")"
	bytes=$(( (w * h * bpp + 7) / 8 ))
	raw="$(mktemp /tmp/kindle-fb.XXXXXX)"
	trap 'rm -f "$raw"' RETURN
	ssh_run "head -c $bytes $FB_DEV" > "$raw"
	[[ "$(wc -c < "$raw" | tr -d ' ')" -eq "$bytes" ]] || { echo "error: short framebuffer read" >&2; exit 1; }
	ffmpeg -y -loglevel error -f rawvideo -pix_fmt "$fmt" -s "${w}x${h}" -i "$raw" "$out"
	echo "$out"
}

inject_script() {
	local kind="$1"
	shift
	python3 - "$kind" "$@" "$TOUCH_DEV" <<'PYEOF'
import base64, struct, sys

def ev(t, c, v):
    return struct.pack('<IIHHi', 0, 0, t, c, v)

SYN, KEY, ABS = 0, 1, 3
SLOT, POS_X, POS_Y, TRACK_ID, BTN_TOUCH = 0x2F, 0x35, 0x36, 0x39, 0x14A

def down(x, y, tid):
    return b''.join([ev(ABS, SLOT, 0), ev(ABS, TRACK_ID, tid), ev(ABS, POS_X, x),
                     ev(ABS, POS_Y, y), ev(KEY, BTN_TOUCH, 1), ev(SYN, 0, 0)])

def move(x, y):
    return b''.join([ev(ABS, SLOT, 0), ev(ABS, POS_X, x), ev(ABS, POS_Y, y), ev(SYN, 0, 0)])

def up():
    return b''.join([ev(ABS, SLOT, 0), ev(KEY, BTN_TOUCH, 0), ev(ABS, TRACK_ID, -1), ev(SYN, 0, 0)])

kind, touch = sys.argv[1], sys.argv[-1]
lines = []

def emit(blob, us):
    lines.append(f"put '{base64.b64encode(blob).decode()}' {us}")

if kind == 'tap':
    x, y, hold_ms = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
    emit(down(x, y, 1000), hold_ms * 1000)
    emit(up(), 0)
elif kind == 'swipe':
    x1, y1, x2, y2, ms = map(int, sys.argv[2:7])
    steps = 8
    emit(down(x1, y1, 1000), ms * 1000 // steps)
    for i in range(1, steps + 1):
        emit(move(x1 + (x2 - x1) * i // steps, y1 + (y2 - y1) * i // steps),
             ms * 1000 // steps if i < steps else 0)
    emit(up(), 0)

print(f'put() {{ printf %s "$1" | base64 -d > "{touch}"; usleep "$2"; }}')
for line in lines:
    print(line)
PYEOF
}

cmd_tap() {
	[[ $# -ge 2 ]] || { echo "usage: tap <x> <y> [hold_ms]" >&2; exit 2; }
	inject_script tap "$1" "$2" "${3:-100}" | ssh_run sh -s
}

cmd_longpress() {
	[[ $# -ge 2 ]] || { echo "usage: longpress <x> <y>" >&2; exit 2; }
	cmd_tap "$1" "$2" 900
}

cmd_swipe() {
	[[ $# -ge 4 ]] || { echo "usage: swipe <x1> <y1> <x2> <y2> [ms]" >&2; exit 2; }
	inject_script swipe "$1" "$2" "$3" "$4" "${5:-400}" | ssh_run sh -s
}

cmd_launch() {
	local file_arg=""
	[[ -n "${1:-}" ]] && file_arg="'$1'"
	ssh_run "killall -TERM luajit 2>/dev/null || true; sleep 1; cd '$KO_DIR' && nohup ./koreader.sh $file_arg >>'$KO_DIR/crash.log' 2>&1 &"
	echo "KOReader restarting${1:+ (opening $1)}"
}

cmd_log() {
	ssh_run "tail -n ${1:-30} '$KO_DIR/crash.log'"
}

case "${1:-}" in
	info) shift; cmd_info "$@" ;;
	screenshot) shift; cmd_screenshot "$@" ;;
	tap) shift; cmd_tap "$@" ;;
	longpress) shift; cmd_longpress "$@" ;;
	swipe) shift; cmd_swipe "$@" ;;
	launch) shift; cmd_launch "$@" ;;
	log) shift; cmd_log "$@" ;;
	help|-h|--help) usage ;;
	*) usage >&2; exit 2 ;;
esac
