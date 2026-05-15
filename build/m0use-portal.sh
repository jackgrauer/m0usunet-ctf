#!/bin/bash
# m0use-portal -- the four-task Junior Sniffer aptitude battery.
# Called from /etc/profile.d on first login. The order matters:
# the player meets the terminal BEFORE they have credentials, so
# the pre-auth screen tells them where to GET credentials (TASK 1).
# Only after they authenticate do they see the Mouse Bites welcome
# letter + the mission briefing.
#
#   TASK 1 (pre-auth -- go to Jefferson Square Park)
#     ↓
#   PASSWORD prompt        -- the code received at the park
#     ↓
#   NAME prompt            -- operator handle
#     ↓
#   Cold-open letter       -- Mouse Bites welcome + 4-task overview
#     ↓
#   TASK 2 intro           -- Operation Parmesan Rose
#     ↓
#   m0usunet game shell    -- nmap / nikto / curl puzzle
#     ↓
#   PASSWORD prompt        -- code received at HQ
#     ↓
#   TASK 3                 -- culinary
#     ↓
#   PASSWORD prompt        -- for TASK 4 gate
#     ↓
#   TASK 4                 -- reflection
#     ↓
#   ASSESSMENT COMPLETE

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

# page_break -- clears the screen and pads the top with blank lines so
# the next section visually starts as a fresh page, not flush against
# the previous prompt. Used at every major transition.
page_break() {
  clear
  printf '\n\n\n'
}

# Overridable for local dry-runs. Defaults match the in-VM paths.
STATE_DIR="${PORTAL_STATE:-/root}"
GAME_RC="${PORTAL_RC:-/etc/m0use-game-rc}"
if ! { mkdir -p "$STATE_DIR" 2>/dev/null && [ -w "$STATE_DIR" ]; }; then
  STATE_DIR=$(mktemp -d -t m0use-portal)
  PORTAL_SKIP_GAME=${PORTAL_SKIP_GAME:-1}
fi

# Skip the portal flow if we've already finished it.
[ -f "$STATE_DIR/.portal_done" ] && return 0 2>/dev/null

# ─── TASK 1 (pre-auth) ────────────────────────────────────────────────
# First thing the player sees. Tells them to go get credentials.

page_break
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

${DIM}Return to this terminal and enter the password to log in.${R}

EOF

# ─── PASSWORD (entry) ─────────────────────────────────────────────────
# The code the applicant received at the park.

while :; do
  printf "${PROMPT} ${DIM}enter password:${R} "
  read -r PW </dev/tty
  if [ "$PW" = "4161" ]; then
    printf "${GREEN}[OK]${R} accepted\n\n"
    break
  fi
  printf "${RED}[!!]${R} incorrect.\n\n"
done

# ─── NAME prompt ──────────────────────────────────────────────────────
# Operator handle. nicks.js / kernel cmdline may have pre-seeded one;
# either way, the player gets to confirm or replace it here.

PREFILL=$(cat /root/.operator 2>/dev/null)
[ -z "$PREFILL" ] && PREFILL="cadet"

printf "\n${DIM}Pick a callsign. This is the name the assessment will use to${R}\n"
printf "${DIM}address you. Or just press Enter to keep the random one we${R}\n"
printf "${DIM}already gave you: ${R}${CYAN}${PREFILL}${R}${DIM}.${R}\n\n"
printf "${PROMPT} ${DIM}your callsign (press Enter for ${R}${CYAN}${PREFILL}${R}${DIM}):${R} "
read -r HANDLE </dev/tty
HANDLE=$(echo "$HANDLE" | tr -cd 'A-Za-z0-9_-' | cut -c1-24)
[ -z "$HANDLE" ] && HANDLE="$PREFILL"
echo "$HANDLE" > /root/.operator
printf "${GREEN}[OK]${R} welcome, ${CYAN}${HANDLE}${R}.\n\n"

# ─── COLD OPEN ────────────────────────────────────────────────────────
# Post-auth: the welcome letter explaining the full assessment.

page_break
wrap <<EOF
${GREEN}╔════════════════════════════════════════════════════════════════════╗${R}
${GREEN}║${R}                     ${GOLD}M O U S E   B I T E S   I N C .${R}                ${GREEN}║${R}
${GREEN}║${R}                ${CYAN_DIM}Office of Junior Sniffer Recruitment${R}                ${GREEN}║${R}
${GREEN}╚════════════════════════════════════════════════════════════════════╝${R}

${GOLD}Dear ${WHITE}${HANDLE}${GOLD},${R}

Thank you for your interest in the ${CYAN}Junior Sniffer${R} position at ${WHITE}Mouse Bites Inc.${R}

Due to the number of applications we receive -- daily, every second, while you are probably sleeping or on the toilet, and generally how much everyone loves our company and it's so ${MAGENTA}fucking incredible${R} -- we will not be able to directly respect, or even conceive of, your individual personal agency, let alone your skills or value as a prospective employee.

Regardless of performance during the assessment, ${RED}the CEO's son-in-law will receive the position anyway.${R} Save your energy. Don't try very hard. Enjoy yourself. You think you deserve this pain. ${B}${WHITE}You don't.${R}

The ${WHITE}Junior Sniffer assessment${R} consists of four parts, each targeting one aptitude expected of Mouse Bites Inc. Junior Sniffers:

   ${GOLD}1)${R}  ${GREEN}resourcefulness${R}    ${DIM}(complete -- you got here)${R}
   ${GOLD}2)${R}  ${CYAN}intuition${R}          ${DIM}(next -- at this terminal)${R}
   ${GOLD}3)${R}  ${GOLD}the culinary art${R}   ${DIM}(at HQ, after this)${R}
   ${GOLD}4)${R}  ${MAGENTA}emotional intelligence${R}

EOF

printf "  ${DIM}Press ${R}${WHITE}Enter${R}${DIM} to begin TASK 2${R}"
read -r _ </dev/tty
printf "\n"

# ─── TASK 2 INTRO ────────────────────────────────────────────────────

page_break
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

Right now we can see the shape. We need the deck itself -- the IC
memo. That's where you come in, ${CYAN}${HANDLE}${R}. We need to cripple the
${RED}Ants${R}' play before they start yoking investors.

Your first assignment: scan the ${RED}Crazy Ants${R} network with ${CYAN}nmap${R} and
find the back-office host that's accidentally exposed to the outside
-- the one wired into their fragrance compounding subsidiary.

EOF

# Mark task 2 reached
touch "$STATE_DIR/.portal_task2"

printf "  ${DIM}Press ${R}${WHITE}Enter${R}${DIM} to enter the m0usunet shell${R}"
read -r _ </dev/tty
printf "\n"

# ─── TASK 2 GAME SUBSHELL ────────────────────────────────────────────

if [ -n "$PORTAL_SKIP_GAME" ]; then
  printf "${DIM}(dryrun: skipping m0usunet game shell)${R}\n\n"
else
  bash --rcfile "$GAME_RC" -i || true
fi

# ─── PASSWORD (HQ) ────────────────────────────────────────────────────

page_break
printf "${GREEN_DIM}operator returning from m0usunet shell...${R}\n\n"

while :; do
  printf "${PROMPT} ${DIM}enter password to proceed to TASK 3:${R} "
  read -r PW </dev/tty
  if [ "$PW" = "1736" ]; then
    printf "${GREEN}[OK]${R} accepted\n\n"
    break
  fi
  printf "${RED}[!!]${R} incorrect.\n\n"
done

# ─── TASK 3 ──────────────────────────────────────────────────────────

page_break
wrap <<EOF
${GOLD}TASK 3) THE CULINARY ART${R}
${GREEN}════════════════════════${R}

Proceed to HQ.

Upon arrival at HQ, you will be provided ${WHITE}tofu and rice${R}. Using
ingredients supplied by fellow applicants and yourself, prepare a
${GOLD}visually appealing dish that tastes like something${R}.

Your dish will be assessed via ${MAGENTA}blind peer review${R}.

EOF

# ─── PASSWORD (TASK 4 gate) ──────────────────────────────────────────

while :; do
  printf "${PROMPT} ${DIM}enter password to proceed to TASK 4:${R} "
  read -r PW </dev/tty
  if [ "$PW" = "3750" ]; then
    printf "${GREEN}[OK]${R} accepted\n\n"
    break
  fi
  printf "${RED}[!!]${R} incorrect.\n\n"
done

# ─── TASK 4 ──────────────────────────────────────────────────────────

page_break
wrap <<EOF
${GOLD}TASK 4) EMOTIONAL INTELLIGENCE${R}
${GREEN}══════════════════════════════${R}

Reflect on the evening's events. Write a statement, directed to a
fellow participant, in four sections:

   ${CYAN}1)  WHEN YOU${R}     ${DIM}-- the behavior you observed${R}
   ${CYAN}2)  I FEEL${R}       ${DIM}-- the emotion it produced${R}
   ${CYAN}3)  I NEED${R}       ${DIM}-- what you require going forward${R}
   ${CYAN}4)  WOULD YOU${R}    ${DIM}-- the specific request you're making${R}

You'll be prompted for each section in turn. Type freely, multi-line
is fine. Press ENTER on a blank line to move to the next section.

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

page_break
wrap <<EOF

${GOLD}ASSESSMENT COMPLETE${R}
${GREEN}═══════════════════${R}

${GREEN_DIM}Reflection statement saved to $STATE_DIR/.portal_reflection.txt${R}

Thank you for your application. The Editor will be in touch.

${DIM}A reminder: the CEO's son-in-law will receive the position anyway.${R}

EOF

touch "$STATE_DIR/.portal_done"
