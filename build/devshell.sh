#!/bin/sh
# devshell.sh -- run the full m0usunet experience in a local Alpine
# container instead of v86. Same OS, same scripts, no boot wait.
# Iteration loop: edit on host → ./build/devshell.sh → walk the flow.
#
# Pass HANDLE=<name> to set the operator handle.

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)

if ! command -v docker >/dev/null 2>&1; then
  echo "devshell: docker not found. Start OrbStack/Docker Desktop first." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "devshell: docker daemon not running. Start OrbStack/Docker Desktop." >&2
  exit 1
fi

: "${HANDLE:=cadet}"

# Persistent bash history across container runs. File lives in the
# repo root (gitignored) so Ctrl-R picks up commands from prior runs.
HIST="$ROOT/.devshell-history"
[ -f "$HIST" ] || touch "$HIST"

exec docker run --rm -it \
  --platform linux/386 \
  --cap-add NET_ADMIN --cap-add NET_RAW \
  -v "$ROOT:/work:ro" \
  -v "$HIST:/root/.bash_history" \
  -e HANDLE="$HANDLE" \
  -e TERM="${TERM:-xterm-256color}" \
  i386/alpine:3.18 \
  sh /work/build/devshell-entrypoint.sh
