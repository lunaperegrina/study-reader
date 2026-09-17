#!/usr/bin/env bash
# Deploys studyreader.koplugin + example courses to a KOReader device over SSH.
#
# Usage:
#   STUDYREADER_HOST=root@kindle-ip STUDYREADER_PORT=2222 pnpm plugin:deploy
#
# Variables:
#   STUDYREADER_HOST        (required) SSH target with KOReader
#   STUDYREADER_PORT        (optional) SSH port, default 22
#   STUDYREADER_PLUGIN_DST  (optional) default: /mnt/us/koreader/plugins/studyreader.koplugin
#   STUDYREADER_STUDY_DST   (optional) default: /mnt/us/documents/study
#   STUDYREADER_RESTART_CMD (optional) command run on device after deploy.
#                           Default kills KOReader (it exits to the launcher;
#                           reopen it to load the new plugin).
#
# Password auth: if the device needs a password and you don't want to type it
# per-connection, export SSH_ASKPASS pointing to a script that echoes it plus
# SSH_ASKPASS_REQUIRE=force (OpenSSH 8.4+).
#
# Transfers use tar over ssh (rsync is not available on stock Kindle firmware).
# COPYFILE_DISABLE keeps macOS tar from emitting AppleDouble (._*) junk onto
# FAT-formatted device storage.
export COPYFILE_DISABLE=1

set -euo pipefail

HOST="${STUDYREADER_HOST:-}"
PORT="${STUDYREADER_PORT:-22}"
PLUGIN_DST="${STUDYREADER_PLUGIN_DST:-/mnt/us/koreader/plugins/studyreader.koplugin}"
STUDY_DST="${STUDYREADER_STUDY_DST:-/mnt/us/documents/study}"
RESTART_CMD="${STUDYREADER_RESTART_CMD:-killall -TERM luajit || true}"

if [[ -z "$HOST" ]]; then
	echo "error: set STUDYREADER_HOST (e.g. root@192.168.1.50)" >&2
	exit 1
fi

SSH_OPTS=(-p "$PORT" -o StrictHostKeyChecking=accept-new)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLUGIN_SRC="$REPO_ROOT/packages/koreader-plugin/plugin/studyreader.koplugin"

echo "→ deploying plugin to $HOST:$PLUGIN_DST (port $PORT)"
ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p '$PLUGIN_DST'"
ssh "${SSH_OPTS[@]}" "$HOST" "rm -rf '$PLUGIN_DST'/*"
tar -C "$PLUGIN_SRC" -cf - . | ssh "${SSH_OPTS[@]}" "$HOST" "tar -C '$PLUGIN_DST' -xf -"

if ls "$REPO_ROOT"/examples/*.study >/dev/null 2>&1; then
	echo "→ deploying courses to $HOST:$STUDY_DST"
	ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p '$STUDY_DST'"
	(cd "$REPO_ROOT/examples" && tar -cf - *.study) | ssh "${SSH_OPTS[@]}" "$HOST" "tar -C '$STUDY_DST' -xf -"
fi

echo "→ restarting KOReader"
ssh "${SSH_OPTS[@]}" "$HOST" "$RESTART_CMD"

echo "✅ done — reopen KOReader on the device and look for the 'Study' menu entry."
