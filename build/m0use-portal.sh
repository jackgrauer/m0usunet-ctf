#!/bin/bash
# m0use-portal — the four-task Junior Sniffer aptitude battery.
# Called from /etc/profile.d on first login. Walks the player through:
#   cold-open letter → PASSWORD1 → TASK 1 → PASSWORD2 → TASK 2 (the
#   m0usunet hack game, in a subshell) → PASSWORD3 → TASK 3 →
#   PASSWORD4 → TASK 4 reflection → done.

# Colors
E=$'\033'
R="${E}[0m"
B="${E}[1m"
DIM="${E}[2m"
GREEN="${E}[1;32m"
GREEN_DIM="${E}[0;32m"
GOLD="${E}[1;33m"
RED="${E}[1;31m"
CYAN="${E}[1;36m"
CYAN_DIM="${E}[0;36m"
MAGENTA="${E}[1;35m"
WHITE="${E}[1;37m"
GREY="${E}[2;37m"

PROMPT="${DIM}>${R}"

# Overridable for local dry-runs. Defaults match the in-VM paths.
STATE_DIR="${PORTAL_STATE:-/root}"
GAME_RC="${PORTAL_RC:-/etc/m0use-game-rc}"
if ! { mkdir -p "$STATE_DIR" 2>/dev/null && [ -w "$STATE_DIR" ]; }; then
  STATE_DIR=$(mktemp -d -t m0use-portal)
  PORTAL_SKIP_GAME=${PORTAL_SKIP_GAME:-1}
fi

# Skip the portal flow if we've already finished it.
[ -f "$STATE_DIR/.portal_done" ] && return 0 2>/dev/null

# ─── COLD OPEN ────────────────────────────────────────────────────────

clear
wrap <<EOF
${GREEN}╔════════════════════════════════════════════════════════════════════╗${R}
${GREEN}║${R}                     ${WHITE}M O U S E   B I T E S   I N C .${R}                ${GREEN}║${R}
${GREEN}║${R}                ${DIM}Office of Junior Sniffer Recruitment${R}                ${GREEN}║${R}
${GREEN}╚════════════════════════════════════════════════════════════════════╝${R}

${GOLD}Dear Applicant,${R}

Thank you for your interest in the ${CYAN}Junior Sniffer${R} position at Mouse
Bites Inc.

Due to the number of applications we receive — daily, every second,
while you are probably sleeping or on the toilet, and generally how
much everyone loves our company and it's so fucking incredible — we
will not be able to directly respect, or even conceive of, your
individual personal agency, let alone your skills or value as a
prospective employee.

Regardless of performance during the assessment, ${RED}the CEO's son-in-law${R}
${RED}will receive the position anyway.${R} Save your energy. Don't try very
hard. Enjoy yourself. You think you deserve this pain. You don't.

The ${WHITE}Junior Sniffer assessment${R} consists of four parts, each targeting
one aptitude expected of Mouse Bites Inc. Junior Sniffers:

   ${GOLD}1)${R}  ${WHITE}resourcefulness${R}
   ${GOLD}2)${R}  ${WHITE}intuition${R}
   ${GOLD}3)${R}  ${WHITE}the culinary art${R}
   ${GOLD}4)${R}  ${WHITE}emotional intelligence${R}

EOF

# ─── PASSWORD1 ────────────────────────────────────────────────────────

while :; do
  printf "${PROMPT} ${DIM}enter PASSWORD1 to proceed to TASK 1:${R} "
  read -r PW </dev/tty
  if [ "$PW" = "4123" ]; then
    printf "${GREEN}✓${R} accepted\n\n"
    break
  fi
  printf "${RED}✗${R} incorrect.\n\n"
done

# ─── TASK 1 ──────────────────────────────────────────────────────────

wrap <<EOF
${GOLD}TASK 1) RESOURCEFULNESS${R}
${GREEN}═══════════════════════${R}

Proceed to a store you think sells the item you have been tasked to
supply. If inclined, buy a second item with which you like to cook.

If you're ${RED}fucking Austin Horse${R} or whatever, buy shit at ${CYAN}HMart${R} or
${CYAN}Sabzi Mandi${R} at 69th & Market St. I don't care.

If you're cheap, present receipt to Mouse Bites Inc. ${GOLD}Craft Services${R}
${GOLD}Accounting Unit${R} staff for reimbursement.

Proceed with food items to the center of ${CYAN}Jefferson Square Park${R}
between 3rd St. and 4th St. and Federal St. and Washington Ave.
There, you will be provided ${GREEN}m0usunet access credentials${R}.

EOF

# ─── PASSWORD2 ────────────────────────────────────────────────────────

while :; do
  printf "${PROMPT} ${DIM}enter PASSWORD2 to proceed to TASK 2:${R} "
  read -r PW </dev/tty
  if [ "$PW" = "4123" ]; then
    printf "${GREEN}✓${R} accepted\n\n"
    break
  fi
  printf "${RED}✗${R} incorrect.\n\n"
done

# ─── TASK 2 INTRO ────────────────────────────────────────────────────

wrap <<EOF
${GOLD}TASK 2) OPERATION PARMESAN ROSE${R}
${GREEN}═══════════════════════════════${R}

${WHITE}Mouse Bites Inc.${R} has received intel that the ${RED}Crazy Ants${R}, our rival
concern, are planning something major.

We suspect a private equity roll-up play in the fragmented hotel
fragrances and potpourri sector in FY Q3 2026.

${DIM}What we know so far:${R}

  ${GOLD}-${R} Respiratory therapists at local urgent care clinics report
    clusters of new-onset reactive airway cases in residents of three
    subway-accessible facilities this year.

  ${GOLD}-${R} Department of State filing cross-references the institutional
    purchasing data via a RTK request to the Bucks County purchasing
    office, and matches the ${RED}Crazy Ants Fragrance Compounder${R}
    ${RED}Subsidiary${R} SDS sheets (obtained through an OSHA 300 log FOIA
    on the contract facility) against the Protected Substances List.

  ${GOLD}-${R} "SAME ARTISAN QUALITY, NEW OWNERSHIP" signs are appearing at
    Mom-and-pop crafters and aging Yankee Candle mall kiosks across
    Mischief City.

Right now we can see the shape. We need the blueprint. That's where
you come in, ${CYAN}Sniffer Cadet${R}. We need to cripple the ${RED}Ants${R}' deck
before they start yoking investors.

Your first assignment: scan the ${RED}Crazy Ants${R} network with ${CYAN}nmap${R} and
find the back-office host that's accidentally exposed to the outside
— the one wired into their fragrance compounding subsidiary.

EOF

# Mark task 2 reached
touch "$STATE_DIR/.portal_task2"

printf "  ${DIM}Press ${R}${WHITE}Enter${R}${DIM} to continue${R}"
read -r _ </dev/tty
printf "\n"

# ─── TASK 2 GAME SUBSHELL ────────────────────────────────────────────
# Drop the player into the m0usunet game shell. The rc file sets the
# prompt, cd's to phase 1, prints the recon intro, and aliases
# `continue` to `exit` so the player has an obvious way back out.

if [ -n "$PORTAL_SKIP_GAME" ]; then
  printf "${DIM}(dryrun: skipping m0usunet game shell)${R}\n\n"
else
  bash --rcfile "$GAME_RC" -i || true
fi

# ─── PASSWORD3 ────────────────────────────────────────────────────────

clear
printf "${GREEN_DIM}operator returning from m0usunet shell...${R}\n\n"

while :; do
  printf "${PROMPT} ${DIM}enter PASSWORD3 to proceed to TASK 3:${R} "
  read -r PW </dev/tty
  if [ "$PW" = "4123" ]; then
    printf "${GREEN}✓${R} accepted\n\n"
    break
  fi
  printf "${RED}✗${R} incorrect.\n\n"
done

# ─── TASK 3 ──────────────────────────────────────────────────────────

wrap <<EOF
${GOLD}TASK 3) THE CULINARY ART${R}
${GREEN}════════════════════════${R}

Proceed to HQ.

Upon arrival at HQ, you will be provided ${WHITE}tofu and rice${R}. Using
ingredients supplied by fellow applicants and yourself, prepare a
${GOLD}visually appealing dish that tastes like something${R}.

Your dish will be assessed via ${MAGENTA}blind peer review${R}.

EOF

# ─── PASSWORD4 ────────────────────────────────────────────────────────

while :; do
  printf "${PROMPT} ${DIM}enter PASSWORD4 to proceed to TASK 4:${R} "
  read -r PW </dev/tty
  if [ "$PW" = "4123" ]; then
    printf "${GREEN}✓${R} accepted\n\n"
    break
  fi
  printf "${RED}✗${R} incorrect.\n\n"
done

# ─── TASK 4 ──────────────────────────────────────────────────────────

wrap <<EOF
${GOLD}TASK 4) EMOTIONAL INTELLIGENCE${R}
${GREEN}══════════════════════════════${R}

Reflect on the evening's events. Write a statement, in this format,
directed to a fellow participant. Press ENTER on a blank line to
finish each section.

EOF

reflection_section() {
  local label="$1"
  printf "${CYAN}${label}${R}\n"
  local line lines=""
  while IFS= read -r line </dev/tty; do
    [ -z "$line" ] && break
    lines="${lines}${line}
"
  done
  echo "${label}:" >> "$STATE_DIR/.portal_reflection.txt"
  printf "%s\n\n" "$lines" >> "$STATE_DIR/.portal_reflection.txt"
}

: > "$STATE_DIR/.portal_reflection.txt"
reflection_section "WHEN YOU"
reflection_section "I FEEL"
reflection_section "I NEED"
reflection_section "WOULD YOU"

# ─── DONE ────────────────────────────────────────────────────────────

wrap <<EOF

${GOLD}ASSESSMENT COMPLETE${R}
${GREEN}═══════════════════${R}

${GREEN_DIM}Reflection statement saved to $STATE_DIR/.portal_reflection.txt${R}

Thank you for your application. The Editor will be in touch.

${DIM}A reminder: the CEO's son-in-law will receive the position anyway.${R}

EOF

touch "$STATE_DIR/.portal_done"
