#!/bin/sh
# customize.sh — runs inside the Alpine image during alpine-make-vm-image build.
set -e

echo m0usunet > /etc/hostname
setup-hostname m0usunet

# autologin root on the serial port — xterm.js in the page is what
# the player actually sees, and it reads from v86's emulated ttyS0.
sed -i 's|^tty1::respawn:.*|ttyS0::respawn:/sbin/agetty --autologin root --noclear 115200 ttyS0 vt100|' /etc/inittab
# Strip the other tty[2-6] lines — they spawn useless gettys we'd never see.
sed -i '/^tty[2-6]::respawn:/d' /etc/inittab
passwd -d root

# drivers v86 wants
sed -i 's|^features=.*|features="ata base ide scsi usb virtio ext4 ext2 keymap kms mmc raid"|' /etc/mkinitfs/mkinitfs.conf
echo "atkbd i8042 libps2 serio serio_raw" > /etc/modules-load.d/v86.conf

# recon kit mount
mkdir -p /mnt/kit
cat >> /etc/fstab <<'EOF'
/dev/sdb  /mnt/kit  ext4  ro,nofail  0  0
EOF

E=$(printf '\033')

# pre-login banner — replaces Alpine's "Welcome to Alpine Linux" default.
cat > /etc/issue <<EOF
${E}[1;32mm0usunet${E}[0m ${E}[2m—${E}[0m ${E}[37mField Operations Terminal${E}[0m  ${E}[2mv0.9.7 on \r (\l)${E}[0m

EOF

# motd — colored. login(1) preserves ANSI escapes when piping to tty.
cat > /etc/motd <<EOF
  ${E}[1;32mm0usunet v0.9.7${E}[0m    ${E}[1;37mField Operations Terminal${E}[0m
  ${E}[1;33mOPERATION: PARMESAN ROSE${E}[0m
EOF

# profile.d hook — on first login, hand off to /usr/local/bin/m0use-portal
# which walks the player through the four-task aptitude battery. Subsequent
# shells skip the portal (it sets /root/.portal_done) and just give a
# normal prompt.
cat > /etc/profile.d/01-m0usunet.sh <<'EOF'
if [ -z "$M0USE_SEEN" ]; then
  export M0USE_SEEN=1

  printf '  \033[2mPress \033[0m\033[1;37mEnter\033[0m\033[2m to continue\033[0m'
  read _ </dev/tty
  printf '\n'

  # Operator handle: take from kernel cmdline (browser passes
  # m0use.handle=NAME); else use a fallback.
  if [ ! -f /root/.operator ]; then
    HANDLE_CMD=$(cat /proc/cmdline 2>/dev/null | tr ' ' '\n' | awk -F= '/^m0use\.handle=/{print $2; exit}')
    if [ -n "$HANDLE_CMD" ]; then
      HANDLE=$(echo "$HANDLE_CMD" | tr -cd 'A-Za-z0-9_-' | cut -c1-24)
      [ -n "$HANDLE" ] || HANDLE="cadet"
      echo "$HANDLE" > /root/.operator
    fi
  fi

  HANDLE=$(cat /root/.operator 2>/dev/null)
  [ -z "$HANDLE" ] && HANDLE=cadet
  export HANDLE
  export PS1="\[\e[1;31m\]${HANDLE}\[\e[0m\]@\[\e[1;32m\]m0usunet\[\e[0m\]:\[\e[36m\]\w\[\e[0m\]\$ "
  alias ll='ls -la'
  alias l='ls'

  # Hand off to the portal flow if we haven't completed it yet.
  if [ ! -f /root/.portal_done ]; then
    /usr/local/bin/m0use-portal
  fi
fi
EOF
chmod +x /etc/profile.d/01-m0usunet.sh

# apply — phase-aware flag validator. Matches against the per-phase
# accepted-flag files and prints the matching phase-complete banner.
cat > /usr/local/bin/apply <<'EOF'
#!/bin/sh
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
EOF
chmod +x /usr/local/bin/apply
ln -s /usr/local/bin/apply /usr/local/bin/check

# The fake nmap and msfconsole stubs are gone — players use real
# nmap (from apk) and real curl against a real fake-network running
# inside the VM. See /etc/init.d/m0usenet which brings up the lo
# aliases and starts dnsmasq + banner responder + fake-Jenkins.

# replay — replays a captured burp request against the live target
# using real curl, so the player can verify the bug still works.
cat > /usr/local/bin/replay <<'REPLAY'
#!/bin/sh
[ -z "$1" ] && { echo "usage: replay <N>          (N = capture number, e.g. 17)"; exit 1; }
N=$(printf '%03d' "$1" 2>/dev/null) || N="$1"
FILE="/mnt/kit/02_burp/req_${N}.txt"
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
REPLAY
chmod +x /usr/local/bin/replay

# Install the m0usenet service files (sourced from /etc/m0use/* on
# the rootfs; build-alpine.sh copies them in alongside the flag files).
chmod +x /usr/local/bin/m0use-banners /usr/local/bin/m0use-jenkins
chmod +x /etc/init.d/m0usenet

# kill every service we don't strictly need — boot inside v86 should
# go from kernel handoff to shell in a couple of seconds.
for svc in chronyd crond hwclock klogd networking syslog acpid \
           machine-id save-keymaps save-termencoding urandom \
           swap modules sysctl modloop firstboot save-entropy \
           seedrng cgroups dmesg keymaps; do
  rc-update del $svc default 2>/dev/null || true
  rc-update del $svc boot    2>/dev/null || true
  rc-update del $svc sysinit 2>/dev/null || true
done

# parallel service startup
sed -i 's|^#*rc_parallel=.*|rc_parallel="YES"|' /etc/rc.conf

# minimum services to mount + apply hostname + get to a shell
rc-update add devfs       sysinit
rc-update add hostname    boot
rc-update add bootmisc    boot
rc-update add localmount  boot

# our fake network — runs after localmount, before agetty respawns
# so by the time the player gets a prompt, nmap returns real results.
rc-update add m0usenet    boot

# trim documentation, locale, and other dead weight
rm -rf /usr/share/man /usr/share/doc /usr/share/info \
       /usr/share/help /usr/share/locale \
       /usr/share/zoneinfo/right /usr/share/zoneinfo/posix \
       /var/cache/apk/* /var/cache/misc/* \
       /tmp/* /root/.ash_history 2>/dev/null || true
