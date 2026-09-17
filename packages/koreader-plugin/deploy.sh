#!/usr/bin/env bash
# Deploys studyreader.koplugin + example courses to a KOReader device over SSH.
#
# Usage:
#   STUDYREADER_HOST=root@kindle-ip pnpm plugin:deploy
#
# Variables:
#   STUDYREADER_HOST        (required) SSH target with KOReader
#   STUDYREADER_PLUGIN_DST  (optional) default: /mnt/us/koreader/plugins/studyreader.koplugin
#   STUDYREADER_STUDY_DST   (optional) default: /mnt/us/documents/study
#   STUDYREADER_RESTART_CMD (optional) command run on device after deploy.
#                           Default kills KOReader (it exits to the launcher;
#                           reopen it to load the new plugin).

set -euo pipefail

HOST="${STUDYREADER_HOST:-}"
PLUGIN_DST="${STUDYREADER_PLUGIN_DST:-/mnt/us/koreader/plugins/studyreader.koplugin}"
STUDY_DST="${STUDYREADER_STUDY_DST:-/mnt/us/documents/study}"
RESTART_CMD="${STUDYREADER_RESTART_CMD:-killall -TERM luajit || true}"

if [[ -z "$HOST" ]]; then
	echo "error: set STUDYREADER_HOST (e.g. root@192.168.1.50)" >&2
	exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLUGIN_SRC="$REPO_ROOT/packages/koreader-plugin/plugin/studyreader.koplugin"

echo "→ deploying plugin to $HOST:$PLUGIN_DST"
ssh "$HOST" "mkdir -p '$(dirname "$PLUGIN_DST")'"
rsync -av --delete "$PLUGIN_SRC/" "$HOST:$PLUGIN_DST/"

if ls "$REPO_ROOT"/examples/*.study >/dev/null 2>&1; then
	echo "→ deploying courses to $HOST:$STUDY_DST"
	ssh "$HOST" "mkdir -p '$STUDY_DST'"
	rsync -av "$REPO_ROOT"/examples/*.study "$HOST:$STUDY_DST/"
fi

echo "→ restarting KOReader"
ssh "$HOST" "$RESTART_CMD"

echo "✅ done — reopen KOReader on the device and look for the 'Study' menu entry."
