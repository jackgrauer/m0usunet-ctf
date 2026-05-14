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

# apply + replay scripts and m0usenet service files are copied into
# this rootfs by build-alpine.sh after this chroot script finishes.
# We just need to make sure the executable bits get set; build-alpine
# also sets them after the cp.
:

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
