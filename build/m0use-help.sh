#!/bin/sh
# help -- quick reference card for the current shell context.
# Works in both the portal shell and the m0usunet game shell.

E=$(printf '\033')
R="${E}[0m"
B="${E}[1m"
DIM="${E}[2m"
GOLD="${E}[1;33m"
CYAN="${E}[1;36m"
WHITE="${E}[1;37m"

cat <<EOF

${GOLD}m0usunet command reference${R}
${DIM}───────────────────────────${R}

  ${CYAN}help${R}                       this card
  ${CYAN}cat hint${R}                   non-judgmental hint for the current phase
  ${CYAN}cat README${R}                 long-form notes for the current phase

  ${CYAN}<finding>${R}                  ${B}just type the IP / host / CVE / flag and hit Enter${R}
                             that's how you advance every phase
  ${CYAN}replay <N>${R}                 re-fire burp capture #N against the live target

  ${CYAN}continue${R}                   leave the m0usunet shell and proceed
  ${CYAN}restart${R}                    nuke portal state and re-enter from the top

  ${CYAN}ls${R} / ${CYAN}ll${R} / ${CYAN}cd${R}              navigate the kit
  ${CYAN}cat file${R} / ${CYAN}less file${R}         read files (colors preserved through less)

${DIM}Recon tools -- try:${R} ${CYAN}nmap --help${R}, ${CYAN}nikto -H${R}, ${CYAN}msfconsole${R}, ${CYAN}curl --help${R}

EOF
