#!/bin/sh
# apply — phase-aware flag validator. Matches against the per-phase
# accepted-flag files (/etc/m0use.flags{1,2,3}) and prints the
# matching phase-complete banner (/etc/m0use.phase{1,2,3}.done).
# Symlinked from /usr/local/bin/check.

if [ -z "$1" ]; then
  echo "usage: apply m0use{...}"; exit 1
fi

# Players often type `apply m0use 10.4.12.88` (space) or
# `apply m0use{10.4.12.88` (missing trailing brace). Normalize: glue
# all args together, strip whitespace, and if the result is bare
# (no braces) or has only one brace, reshape it.
INPUT=$(echo "$*" | tr -d ' \t')

# If they typed `m0use 10.4.12.88` → glued to `m0use10.4.12.88`.
# Recover by inserting a `{` after the leading m0use and adding `}`.
case "$INPUT" in
  m0use\{*\}) : ;;                                    # already correct
  m0use\{*)   INPUT="${INPUT}}" ;;                    # missing close brace
  m0use*\})   INPUT="m0use{${INPUT#m0use}" ;;         # missing open brace
  m0use*)     INPUT="m0use{${INPUT#m0use}}" ;;        # both braces missing
  *)
    printf '\033[1;31m[!!] wrong format.\033[0m flags look like \033[1;36mm0use{...}\033[0m -- try again.\n'
    exit 1
    ;;
esac

if   grep -qxF "$INPUT" /etc/m0use.flags1 2>/dev/null; then
  printf '\033[1;32m[OK] finding accepted.\033[0m\n'
  cat /etc/m0use.phase1.done
elif grep -qxF "$INPUT" /etc/m0use.flags2 2>/dev/null; then
  printf '\033[1;32m[OK] finding accepted.\033[0m\n'
  cat /etc/m0use.phase2.done
elif grep -qxF "$INPUT" /etc/m0use.flags3 2>/dev/null; then
  printf '\033[1;32m[OK] finding accepted.\033[0m\n'
  cat /etc/m0use.phase3.done
else
  printf '\033[1;31m[!!] not quite\033[0m (read as %s). try again, or \033[1;36mcat hint\033[0m if stuck.\n' "$INPUT"
fi
