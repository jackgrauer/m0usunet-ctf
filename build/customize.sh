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

# issue file — shown by agetty before login (we autologin so it lands above motd)
cat > /etc/issue <<'EOF'

[    0.000000] m0usunet kernel v0.9.7 — Mouse Bites Inc. proprietary
[    0.001234] CPU: Pentium IV (Prescott) family 0xf model 0x4 — virtualized
[    0.002301] Probing recon bus at 0x300-0x3ff ......................... [  OK  ]
[    0.003187] Probing exploit bus at 0x400-0x4ff ........................ [  OK  ]
[    0.004023] Loading intuition module (sniffer.ko) ..................... [  OK  ]
[    0.004900] Loading hubris module (operator.ko) ....................... [  OK  ]
[    0.005301] Setting up paranoia channels: irq=5,7,9,11 ................ [  OK  ]
[    0.005998] Mounting /dev/sda                                          [  OK  ]
[    0.006144] Mounting /dev/sdb (M0USUNET_KIT, ro)                       [  OK  ]
[    0.006887] Starting m0usunet subsystems:
[    0.007012]    * recon-net.service ..................................  [READY]
[    0.007234]    * exploit-db.service .................................  [READY]
[    0.007456]    * exfil-pipe.service .................................  [READY]
[    0.007678]    * apply-daemon (port 4242/tcp) .......................  [LISTEN]
[    0.007900]    * msfconsole-shim v0.9 ...............................  [READY]
[    0.008122]    * editor.watch.service ...............................  [ARMED]
[    0.008555] Loading recon manifests from /mnt/kit ..................... [  OK  ]
[    0.008999] Reticulating splines ...................................... [  OK  ]
[    0.009345] Counting whiskers ......................................... [  OK  ]
[    0.009987] All systems nominal. Standing by for operator.

EOF

# motd — printed by the shell on first login via profile.d
cat > /etc/motd <<'EOF'
        __(.)__(.)__
       (___________)         m 0 u s u n e t   v0.9.7
        /         \          MOUSE BITES INC. — Field Operations Terminal
       /___________\         "the mouse just has to scurry once"

  ╔══════════════════════════════════════════════════════════════════════╗
  ║  OPERATION: PARMESAN                          Editor: watching       ║
  ║  TARGET:    crazy.ants                        Window:  00:30:00      ║
  ║  OPERATOR:  on the wire                       Sector:  philadelphia  ║
  ╚══════════════════════════════════════════════════════════════════════╝

  Three stages. Three tools. Thirty minutes. Bring back what you find.

    01_nmap/         — recon: their external surface
    02_burp/         — recon: captured HTTP exchanges
    03_metasploit/   — operations: exploit library + harness

  Hotkeys
    cat /mnt/kit/BRIEFING       The operation, in plain language
    cat hint                    In any stage folder, costs nothing
    apply m0use{...}            Ship a finding back to the Editor
    msfconsole "RHOST=..."      Fire stage 3 once you have the values

  Last contact:  $(date -u 2>/dev/null || echo 2026-05-13 15:34Z) — The Editor
  Recent intel:  3 operators on the wire, 1 declared, 0 burned

  — The Editor is watching. Be quick.

EOF

# shell environment — verbose first-login banner + tight prompt
cat > /etc/profile.d/01-m0usunet.sh <<'EOF'
if [ -z "$M0USE_SEEN" ]; then
  export M0USE_SEEN=1
  clear
  cat /etc/issue
  printf '\n'
  printf '\033[32m[+]\033[0m authenticated as operator (uid=0, ring=0)\n'
  printf '\033[32m[+]\033[0m granting Editor.read, Editor.write, Editor.scurry\n'
  printf '\033[32m[+]\033[0m attaching to operation: PARMESAN\n'
  printf '\033[32m[+]\033[0m mounting kit at /mnt/kit ............... done\n'
  printf '\033[32m[+]\033[0m loading manifests ..................... 3 stages located\n'
  printf '\033[32m[33m[!]\033[0m WARNING: window opens in: 00:30:00 — clock starts NOW\n'
  printf '\n'
  cat /etc/motd
  cd /mnt/kit 2>/dev/null || cd /
  export PS1='\[\e[1;31m\]operator\[\e[0m\]@\[\e[1;32m\]m0usunet\[\e[0m\]:\[\e[36m\]\w\[\e[0m\]\[\e[33m\] ❯\[\e[0m\] '
  alias ll='ls -la'
  alias l='ls'
  echo
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
