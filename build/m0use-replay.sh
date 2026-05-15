#!/bin/sh
# replay -- replays a captured burp request against the live target
# using real curl, so the player can verify the bug still works.

[ -z "$1" ] && { echo "usage: replay <N>          (N = capture number, e.g. 17)"; exit 1; }
N=$(printf '%03d' "$1" 2>/dev/null) || N="$1"
FILE="/mnt/kit/burp/req_${N}.txt"
if [ ! -f "$FILE" ]; then
  echo "replay: no capture matching #$N"; exit 1
fi
# Extract method + path from the captured request line.
LINE=$(grep -m1 -E '^(GET|POST|PUT|DELETE|HEAD) ' "$FILE")
METHOD=$(echo "$LINE" | awk '{print $1}')
PATH_=$(echo "$LINE" | awk '{print $2}')
# Was there an Authorization line in the capture's request half?
HASAUTH=$(awk '/^====== RESPONSE ======/{exit} /^Authorization:/{print "yes"; exit}' "$FILE")

printf '\033[1;36mreplaying capture #%s against live target\033[0m\n' "$N"
printf '  %s http://10.4.12.1:8080%s   (auth %s)\n\n' "$METHOD" "$PATH_" "${HASAUTH:-NO}"

if [ "$HASAUTH" = "yes" ]; then
  curl -isS -X "$METHOD" -H 'Authorization: Basic YW5hbHlzdDpodW50ZXIy' \
       "http://10.4.12.1:8080${PATH_}" | head -20
else
  curl -isS -X "$METHOD" "http://10.4.12.1:8080${PATH_}" | head -20
fi
