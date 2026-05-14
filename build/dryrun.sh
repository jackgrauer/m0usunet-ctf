#!/bin/sh
# dryrun.sh — run the portal locally, no VM, no CI.
# State files go to a temp dir; the TASK 2 game shell is skipped.
# Use HANDLE=<name> to set the operator handle.
set -e

HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d -t m0use-portal)
trap 'rm -rf "$TMP"' EXIT

: "${HANDLE:=cadet}"
echo "$HANDLE" > "$TMP/.operator"

PORTAL_STATE="$TMP" \
PORTAL_SKIP_GAME=1 \
HANDLE="$HANDLE" \
bash "$HERE/m0use-portal.sh"
