#!/bin/sh
# answer -- phase-aware finding submitter. The way the player advances
# through TASK 2. Accepts plain values:
#
#   answer 10.4.12.88
#   answer jenkins-old
#   answer CVE-2018-1000861
#   answer jenkins_was_a_mistake
#
# Also accepts the older m0use{...} flag format and ignores braces /
# spaces so muscle memory doesn't matter.
#
# Symlinked from /usr/local/bin/apply (back-compat for help/docs that
# still reference the old name).

if [ -z "$1" ]; then
  cat <<'EOF'
usage: answer <finding>

  Examples:
    answer 10.4.12.88
    answer CVE-2018-1000861
    answer jenkins_was_a_mistake

  This is how you advance through the assignment. Each phase tells
  you what kind of finding it wants -- an IP, a CVE, a string -- and
  you submit it with `answer`.
EOF
  exit 1
fi

# Glue everything together, strip whitespace, strip optional m0use{}
# wrapper. We compare against canonical entries in the flag files
# after the same normalization.
norm() {
  v=$(echo "$*" | tr -d ' \t')
  v="${v#m0use\{}"   # strip leading m0use{
  v="${v%\}}"        # strip trailing }
  v="${v#m0use}"     # strip bare m0use prefix (when bash brace-expansion
                     # collapsed m0use{X} into m0useX before we saw it)
  # Lowercase for case-insensitive compare.
  echo "$v" | tr '[:upper:]' '[:lower:]'
}

INPUT=$(norm "$*")

match_phase() {
  flagfile=$1
  [ -r "$flagfile" ] || return 1
  while IFS= read -r raw; do
    [ -z "$raw" ] && continue
    [ "$(norm "$raw")" = "$INPUT" ] && return 0
  done < "$flagfile"
  return 1
}

if   match_phase /etc/m0use.flags1; then
  printf '\n\n\n\033[1;32m[OK] finding accepted.\033[0m\n'
  cat /etc/m0use.phase1.done
elif match_phase /etc/m0use.flags2; then
  printf '\n\n\n\033[1;32m[OK] finding accepted.\033[0m\n'
  cat /etc/m0use.phase2.done
elif match_phase /etc/m0use.flags3; then
  printf '\n\n\n\033[1;32m[OK] finding accepted.\033[0m\n'
  cat /etc/m0use.phase3.done
else
  printf '\033[1;31m[!!] not quite\033[0m (read as %s). try again, or \033[1;36mcat hint\033[0m if stuck.\n' "$INPUT"
fi
