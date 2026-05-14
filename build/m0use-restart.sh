#!/bin/sh
# restart — wipe portal state so the next login re-enters from the
# cold open. Does NOT clear /root/.operator (keep the handle).

rm -f /root/.portal_done /root/.portal_task2 /root/.portal_reflection.txt

E=$(printf '\033')
printf "${E}[1;33mportal state cleared.${E}[0m exit this shell (Ctrl-D) and the\n"
printf "next login will run the portal from the top.\n"
