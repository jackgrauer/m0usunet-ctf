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
/dev/sdb  /mnt/kit  ext2  ro,nofail  0  0
EOF

# motd — printed by the shell on first login via profile.d
cat > /etc/motd <<'EOF'
   __(.)__(.)__     m 0 u s u n e t   v0.9.7
  (___________)     MOUSE BITES INC. — Field Operations Terminal
   /         \      target: crazy.ants  •  window: 00:30:00  •  Editor: watching

  OPERATION: PARMESAN — three stages, three tools, thirty minutes.

    01_nmap/         recon: their external surface
    02_burp/         recon: captured HTTP exchanges
    03_metasploit/   operations: exploit library + harness

  cat /mnt/kit/BRIEFING    cat hint    apply m0use{...}    msfconsole "..."

EOF

# shell environment — chatty first-login banner that fits an 80x25 screen
cat > /etc/profile.d/01-m0usunet.sh <<'EOF'
if [ -z "$M0USE_SEEN" ]; then
  export M0USE_SEEN=1
  printf '\033[32m[+]\033[0m authenticated as operator (uid=0, ring=0)\n'
  printf '\033[32m[+]\033[0m granting Editor.read, Editor.write, Editor.scurry\n'
  printf '\033[32m[+]\033[0m attaching to operation: PARMESAN\n'
  printf '\033[32m[+]\033[0m kit mounted at /mnt/kit  —  3 stages located\n'
  printf '\033[1;33m[!]\033[0m window opens in 00:30:00 — clock starts NOW\n'
  printf '\n'
  cat /etc/motd
  cd /mnt/kit 2>/dev/null || cd /
  export PS1='\[\e[1;31m\]operator\[\e[0m\]@\[\e[1;32m\]m0usunet\[\e[0m\]:\[\e[36m\]\w\[\e[0m\]\$ '
  alias ll='ls -la'
  alias l='ls'
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

# kill unneeded services for fast boot
for svc in chronyd crond hwclock klogd networking syslog acpid; do
  rc-update del $svc default 2>/dev/null || true
  rc-update del $svc boot    2>/dev/null || true
done

rc-update add devfs sysinit
rc-update add bootmisc boot
rc-update add localmount boot
