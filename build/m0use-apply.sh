#!/bin/sh
# apply — phase-aware flag validator. Matches against the per-phase
# accepted-flag files (/etc/m0use.flags{1,2,3}) and prints the
# matching phase-complete banner (/etc/m0use.phase{1,2,3}.done).
# Symlinked from /usr/local/bin/check.

[ -z "$1" ] && { echo "usage: apply m0use{...}"; exit 1; }
INPUT="$1"

if   grep -qxF "$INPUT" /etc/m0use.flags1 2>/dev/null; then
  printf '\033[1;32m✓ finding accepted.\033[0m\n'
  cat /etc/m0use.phase1.done
elif grep -qxF "$INPUT" /etc/m0use.flags2 2>/dev/null; then
  printf '\033[1;32m✓ finding accepted.\033[0m\n'
  cat /etc/m0use.phase2.done
elif grep -qxF "$INPUT" /etc/m0use.flags3 2>/dev/null; then
  printf '\033[1;32m✓ finding accepted.\033[0m\n'
  cat /etc/m0use.phase3.done
else
  printf '\033[1;31m✗ not quite.\033[0m try again, or \033[1;36mcat hint\033[0m if you are stuck.\n'
fi
