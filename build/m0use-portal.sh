#!/bin/bash
# m0use-portal — the four-task Junior Sniffer aptitude battery.
# Called from /etc/profile.d on first login. Walks the player through:
#   cold-open letter → PASSWORD1 → TASK 1 → PASSWORD2 → TASK 2 (the
#   m0usunet hack game, in a subshell) → PASSWORD3 → TASK 3 → TASK 4
#   reflection → done.

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

PROMPT="${GREEN}operator@mouse-bites${R}${DIM}:~\$${R}"

# Skip the portal flow if we've already finished it.
[ -f /root/.portal_done ] && return 0 2>/dev/null

# ─── COLD OPEN ────────────────────────────────────────────────────────

clear
cat <<EOF
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

${WHITE}OPERATION PARMESAN${R} will consist of four parts. Each targets one
aptitude expected of Mouse Bites Inc. Junior Sniffers:

   ${GOLD}1)${R}  ${WHITE}resourcefulness${R}
   ${GOLD}2)${R}  ${WHITE}intuition${R}
   ${GOLD}3)${R}  ${WHITE}the culinary art${R}
   ${GOLD}4)${R}  ${WHITE}emotional intelligence${R}

EOF

# ─── PASSWORD1 ────────────────────────────────────────────────────────

while :; do
  printf "${PROMPT} ${DIM}enter PASSWORD1 to proceed to TASK 1:${R} "
  read -r PW
  if [ "$PW" = "4123" ]; then
    printf "${GREEN}✓${R} accepted\n\n"
    break
  fi
  printf "${RED}✗${R} incorrect.\n\n"
done

# ─── TASK 1 ──────────────────────────────────────────────────────────

cat <<EOF
${GREEN}════════════════════════════════════════════════════════════════════${R}
${GOLD}TASK 1${R}    ${WHITE}resourcefulness${R}
${GREEN}════════════════════════════════════════════════════════════════════${R}

Proceed to a store you think sells the item you have been tasked to
supply. If inclined, buy a second item with which you like to cook.

If you're ${RED}fucking Austin Horse${R} or whatever, buy shit at ${CYAN}HMart${R} or
${CYAN}Sabzi Mandi${R} at 69th & Market St. I don't care.

If you're cheap, present receipt to Mouse Bites Inc. ${GOLD}Craft Services${R}
${GOLD}Accounting Unit${R} staff for reimbursement.

EOF

# ─── PASSWORD2 ────────────────────────────────────────────────────────

while :; do
  printf "${PROMPT} ${DIM}enter PASSWORD2 to proceed to TASK 2:${R} "
  read -r PW
  if [ "$PW" = "5123" ]; then
    printf "${GREEN}✓${R} accepted\n\n"
    break
  fi
  printf "${RED}✗${R} incorrect.\n\n"
done

# ─── TASK 2 INTRO ────────────────────────────────────────────────────

cat <<EOF
${GREEN}════════════════════════════════════════════════════════════════════${R}
${GOLD}TASK 2${R}    ${WHITE}intuition${R}
${GREEN}════════════════════════════════════════════════════════════════════${R}

Proceed with food items to the center of ${CYAN}Jefferson Square Park${R}
between 3rd St. and 4th St. and Federal St. and Washington Ave.
There, you will be provided access to the ${GREEN}m0usunet mainframe${R}.

Obtain ${MAGENTA}uncredentialed access${R} to our adversary's server:
${RED}crazy.ants${R}. Once you successfully breach the crazy.ants server,
you will be provided coordinates of Mouse Bites Inc. HQ.

${GREEN}════════════════════════════════════════════════════════════════════${R}
${DIM}You are now in the m0usunet operator shell. Inside this shell:${R}

  ${CYAN}cat /mnt/kit/BRIEFING${R}        the full op brief
  ${CYAN}cd /mnt/kit/01_nmap && cat README${R}  start phase 1
  ${CYAN}apply m0use{...}${R}             submit findings to the Editor
  ${CYAN}cat hint${R}                     real help, no penalty

${GREY}When you have completed phase 3 and the Editor has accepted the${R}
${GREY}final flag, type${R} ${GOLD}continue${R} ${GREY}to leave the game shell and proceed to${R}
${GREY}TASK 3.${R}

EOF

# Mark task 2 reached
touch /root/.portal_task2
sleep 1.5

# ─── TASK 2 GAME SUBSHELL ────────────────────────────────────────────
# Drop the player into the m0usunet game shell. The rc file sets the
# prompt, cd's to phase 1, prints the README, and aliases `continue`
# to `exit` so the player has an obvious way back out.

bash --rcfile /etc/m0use-game-rc -i || true

# ─── PASSWORD3 ────────────────────────────────────────────────────────

clear
cat <<EOF
${GREEN}════════════════════════════════════════════════════════════════════${R}
${GREEN_DIM}operator returning from m0usunet shell...${R}
${GREEN}════════════════════════════════════════════════════════════════════${R}

EOF

while :; do
  printf "${PROMPT} ${DIM}enter PASSWORD3 to proceed to TASK 3:${R} "
  read -r PW
  if [ "$PW" = "6123" ]; then
    printf "${GREEN}✓${R} accepted\n\n"
    break
  fi
  printf "${RED}✗${R} incorrect.\n\n"
done

# ─── TASK 3 ──────────────────────────────────────────────────────────

cat <<EOF
${GREEN}════════════════════════════════════════════════════════════════════${R}
${GOLD}TASK 3${R}    ${WHITE}the culinary art${R}
${GREEN}════════════════════════════════════════════════════════════════════${R}

Proceed to HQ.

Upon arrival at HQ, you will be provided ${WHITE}tofu and rice${R}. Using
ingredients supplied by fellow applicants and yourself, prepare a
${GOLD}visually appealing dish that tastes like something${R}.

Your dish will be assessed via ${MAGENTA}blind peer review${R}.

EOF

printf "${PROMPT} ${DIM}press ENTER when you have completed TASK 3:${R} "
read -r _
printf "${GREEN}✓${R} acknowledged\n\n"

# ─── TASK 4 ──────────────────────────────────────────────────────────

cat <<EOF
${GREEN}════════════════════════════════════════════════════════════════════${R}
${GOLD}TASK 4${R}    ${WHITE}emotional intelligence${R}
${GREEN}════════════════════════════════════════════════════════════════════${R}

Reflect on the evening's events. Write a statement, in this format,
directed to a fellow participant. Press ENTER on a blank line to
finish each section.

EOF

reflection_section() {
  local label="$1"
  printf "${CYAN}${label}${R}\n"
  local line lines=""
  while IFS= read -r line; do
    [ -z "$line" ] && break
    lines="${lines}${line}
"
  done
  echo "${label}:" >> /root/.portal_reflection.txt
  printf "%s\n\n" "$lines" >> /root/.portal_reflection.txt
}

: > /root/.portal_reflection.txt
reflection_section "WHEN YOU"
reflection_section "I FEEL"
reflection_section "I NEED"
reflection_section "WOULD YOU"

# ─── DONE ────────────────────────────────────────────────────────────

cat <<EOF

${GREEN}════════════════════════════════════════════════════════════════════${R}
${GOLD}ASSESSMENT COMPLETE${R}
${GREEN}════════════════════════════════════════════════════════════════════${R}

${GREEN_DIM}Reflection statement saved to /root/.portal_reflection.txt${R}

Thank you for your application. The Editor will be in touch.

${DIM}A reminder: the CEO's son-in-law will receive the position anyway.${R}

EOF

touch /root/.portal_done
