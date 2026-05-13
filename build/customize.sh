#!/bin/sh
# customize.sh — runs inside the Alpine image during alpine-make-vm-image build.
set -e

echo m0usunet > /etc/hostname
setup-hostname m0usunet

# autologin root on tty1
sed -i 's|^tty1::respawn:.*|tty1::respawn:/sbin/agetty --autologin root --noclear 38400 tty1 linux|' /etc/inittab
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
  ${E}[1;32mm0usunet v0.9.7${E}[0m  ${E}[2m•${E}[0m  ${E}[1;37mField Operations Terminal${E}[0m
  ${E}[2mtarget:${E}[0m ${E}[1;31mcrazy.ants${E}[0m  ${E}[2m•  window:${E}[0m ${E}[1;33m00:30:00${E}[0m  ${E}[2m•  Editor: watching${E}[0m

  ${E}[1;33mOPERATION: PARMESAN${E}[0m — three phases, thirty minutes total. Start here:

    ${E}[1;32mcat /mnt/kit/BRIEFING${E}[0m

EOF

# shell environment — first-login flow:
#   1. Prompt for operator handle (saved to /root/.operator)
#   2. Show briefing
#   3. Gate on "PRESS ENTER AND GET TO SNIFFING, CADET"
#   4. cd into phase 1 + show its README
# Subsequent shells skip all that and just use the saved handle.
cat > /etc/profile.d/01-m0usunet.sh <<'EOF'
if [ -z "$M0USE_SEEN" ]; then
  export M0USE_SEEN=1

  # Browser passes the operator handle via kernel cmdline (m0use.handle=...).
  # If it's not there (or empty), fall back to prompting on the terminal.
  if [ ! -f /root/.operator ]; then
    HANDLE_CMD=$(cat /proc/cmdline 2>/dev/null | tr ' ' '\n' | awk -F= '/^m0use\.handle=/{print $2; exit}')
    if [ -n "$HANDLE_CMD" ]; then
      HANDLE=$(echo "$HANDLE_CMD" | tr -cd 'A-Za-z0-9_-' | cut -c1-24)
      [ -n "$HANDLE" ] && echo "$HANDLE" > /root/.operator
    fi
  fi

  if [ ! -f /root/.operator ]; then
    printf '\033[1;32m[+]\033[0m m0usunet handshake complete\n'
    printf '\033[1;32m[+]\033[0m attaching to operation: \033[1;33mPARMESAN ROSE\033[0m\n'
    printf '\033[1;32m[+]\033[0m kit mounted at /mnt/kit\n\n'
    printf '\033[1;36moperator handle (your name on the wire):\033[0m '
    read -r HANDLE
    HANDLE=$(echo "$HANDLE" | tr -cd 'A-Za-z0-9_-' | cut -c1-24)
    [ -z "$HANDLE" ] && HANDLE="cadet$$"
    echo "$HANDLE" > /root/.operator
  fi

  HANDLE=$(cat /root/.operator)
  export HANDLE
  export PS1="\[\e[1;31m\]$HANDLE\[\e[0m\]@\[\e[1;32m\]m0usunet\[\e[0m\]:\[\e[36m\]\w\[\e[0m\]\$ "
  alias ll='ls -la'
  alias l='ls'

  # Briefing — only on the very first shell.
  if [ ! -f /root/.briefed ]; then
    touch /root/.briefed
    printf '\n\033[1;32m[+]\033[0m welcome, \033[1;33m%s\033[0m. attaching to \033[1;33mPARMESAN ROSE\033[0m.\n\n' "$HANDLE"
    cat /mnt/kit/BRIEFING
    printf '\n  \033[1;33mPRESS ENTER AND GET TO SNIFFING, CADET. YOU GOT THIS.\033[0m\n\n'
    read -r _
    cd /mnt/kit/01_nmap 2>/dev/null && cat README
  else
    cd /mnt/kit 2>/dev/null || cd /
  fi
fi
EOF
chmod +x /etc/profile.d/01-m0usunet.sh

# apply — local flag validator
cat > /usr/local/bin/apply <<'EOF'
#!/bin/sh
[ -z "$1" ] && { echo "usage: apply m0use{...}"; exit 1; }
if grep -qxF "$1" /etc/m0use.flags 2>/dev/null; then
  echo "✓ finding accepted — paste into the form below the terminal"
else
  echo "✗ that's not one of our findings. try again."
fi
EOF
chmod +x /usr/local/bin/apply
ln -s /usr/local/bin/apply /usr/local/bin/check

# fake nmap — stage 1 recon. Reads pre-baked scan data from
# /etc/m0use-nmap.dat. Adds color, pages through less for long scans,
# always prints a cheat-sheet footer when less exits.
cat > /usr/local/bin/nmap <<'NMAP'
#!/bin/sh
DAT=/etc/m0use-nmap.dat
E=$(printf '\033')

colorize() {
  sed -E "
    s/(open)([[:space:]])/${E}[1;32m\1${E}[0m\2/g;
    s/(filtered)/${E}[2;33m\1${E}[0m/g;
    s/(closed)/${E}[2;31m\1${E}[0m/g;
    s/^(Nmap scan report for[[:space:]]+)([^ ]+)([[:space:]]+)\((.+)\)/\1${E}[1;36m\2${E}[0m\3(${E}[1;33m\4${E}[0m)/g;
    s/^(PORT[[:space:]]+STATE[[:space:]]+SERVICE.*)$/${E}[1;37m\1${E}[0m/g;
    s/(rDNS record for [^:]+:[[:space:]]*)(\S+)/\1${E}[1;31m\2${E}[0m/g;
    s/(Port forwarding.*)/${E}[1;35m\1${E}[0m/g;
    s/(8080\/tcp -> 10\.4\.12\.88:8080)/${E}[1;35m\1${E}[0m/g;
  "
}

footer() {
  printf '\n${E}[2m──────────────────────────────────────────────────────────────────${E}[0m\n'
  printf '  ${E}[1;36mnmap 10.4.12.X${E}[0m         zoom on a single host\n'
  printf '  ${E}[1;36mapply m0use{HOST:PORT}${E}[0m  when you have the address\n'
  printf '  ${E}[1;36mcat hint${E}[0m              if you are stuck\n'
  printf '${E}[2m──────────────────────────────────────────────────────────────────${E}[0m\n'
}

case "$1" in
  ""|--help|-h|help)
    cat <<EOF
${E}[1;37mUsage:${E}[0m ${E}[1;36mnmap${E}[0m <target>

  ${E}[1;36mnmap 10.4.12.0/24${E}[0m       scan the whole Crazy Ants network
  ${E}[1;36mnmap 10.4.12.88${E}[0m         zoom on a single host
  ${E}[1;36mnmap --help${E}[0m             show this
EOF
    exit 0
    ;;
  10.4.12.0/24|10.4.12.0|10.4.12.*/24)
    cat "$DAT" | colorize | less -R
    footer
    exit 0
    ;;
  10.4.12.*)
    awk -v T="$1" '
      /^Nmap scan report for/ {
        if (in_block) { print block; print ""; in_block=0 }
        block = $0; for (i=1;i<=NF;i++) {
          ip = $i; gsub(/[()]/,"",ip)
          if (ip == T) in_block = 1
        }
        next
      }
      /^$/ {
        if (in_block) { print block; print ""; in_block=0; block="" }
        next
      }
      { if (in_block) block = block "\n" $0 }
      END { if (in_block) print block }
    ' "$DAT" | colorize
    footer
    exit 0
    ;;
  *)
    printf "${E}[1;31mnmap:${E}[0m cannot resolve target: %s\n" "$1" >&2
    printf "      (try ${E}[1;36mnmap 10.4.12.0/24${E}[0m for a full sweep)\n" >&2
    exit 1
    ;;
esac
NMAP
chmod +x /usr/local/bin/nmap

# fake msfconsole — stage 3 harness
cat > /usr/local/bin/msfconsole <<'EOF'
#!/bin/sh
# Mouse Bites Inc. — synthetic Metasploit harness, v0.9
[ -z "$1" ] && { echo "usage: msfconsole \"RHOST=... RPORT=... TARGETURI=... PAYLOAD=...\""; exit 1; }

CFG="$1"
RHOST=$(echo "$CFG" | tr ' ' '\n' | sed -n 's/^RHOST=//p')
RPORT=$(echo "$CFG" | tr ' ' '\n' | sed -n 's/^RPORT=//p')
URI=$(echo "$CFG"   | tr ' ' '\n' | sed -n 's/^TARGETURI=//p')
PAY=$(echo "$CFG"   | tr ' ' '\n' | sed -n 's/^PAYLOAD=//p')

. /etc/m0use.exploit

if [ "$RHOST" != "$X_RHOST" ]; then
  echo "[-] Exploit failed: target unreachable ($RHOST)"; exit 1
fi
if [ "$RPORT" != "$X_RPORT" ]; then
  echo "[-] Exploit failed: connection refused on port $RPORT"; exit 1
fi
if [ "$URI" != "$X_URI" ]; then
  echo "[-] Exploit failed: target endpoint returned 404"; exit 1
fi
if [ "$PAY" != "$X_PAY" ]; then
  case "$PAY" in
    *windows*)        echo "[-] Exploit failed: payload incompatible with target architecture";;
    *x86_64*|*amd64*) echo "[-] Exploit failed: payload incompatible with target architecture";;
    *meterpreter*)    echo "[-] Exploit failed: payload too large for target memory";;
    *)                echo "[-] Exploit failed: payload rejected by target";;
  esac
  exit 1
fi

cat <<'BANNER'
[*] Started reverse TCP handler on 10.4.99.7:4444
[*] Sending stage (38382 bytes) to target...
[*] Meterpreter session 1 opened (10.4.99.7:4444 -> target:8080)
meterpreter > shell
[+] Spawning shell on target

$ whoami
root
$ cat /root/.ssh/authorized_keys
m0use{jenkins_was_a_mistake}
$ exit
BANNER
EOF
chmod +x /usr/local/bin/msfconsole

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

# trim documentation, locale, and other dead weight
rm -rf /usr/share/man /usr/share/doc /usr/share/info \
       /usr/share/help /usr/share/locale \
       /usr/share/zoneinfo/right /usr/share/zoneinfo/posix \
       /var/cache/apk/* /var/cache/misc/* \
       /tmp/* /root/.ash_history 2>/dev/null || true
