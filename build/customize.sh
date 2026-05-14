#!/bin/sh
# customize.sh -- runs inside the Alpine image during alpine-make-vm-image build.
set -e

echo m0usunet > /etc/hostname
setup-hostname m0usunet

# Bypass OpenRC entirely. busybox init reads /etc/inittab and we
# replace the whole thing: one ::sysinit script does all the
# mounts + network + services, then agetty respawns on ttyS0. Boot
# goes from ~30-60s of openrc service ceremony to ~2-3s.
cat > /etc/inittab <<'EOF'
::sysinit:/sbin/m0use-bootstrap
ttyS0::respawn:/sbin/agetty --autologin root --noclear 115200 ttyS0 vt100
::ctrlaltdel:/sbin/reboot
::shutdown:/bin/umount -a -r
EOF
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

# pre-login banner -- replaces Alpine's "Welcome to Alpine Linux" default.
cat > /etc/issue <<EOF
${E}[1;32mm0usunet${E}[0m ${E}[2m--${E}[0m ${E}[37mField Operations Terminal${E}[0m  ${E}[2mv0.9.7 on \r (\l)${E}[0m

EOF

# motd -- colored. login(1) preserves ANSI escapes when piping to tty.
# Keep it short. The OPERATION reveal happens inside TASK 2 of the
# portal, not at the pre-portal banner -- the player hasn't been
# briefed yet.
cat > /etc/motd <<EOF
  ${E}[1;32mm0usunet v0.9.7${E}[0m    ${E}[1;37mField Operations Terminal${E}[0m
EOF

# profile.d hook -- on first login, hand off to /usr/local/bin/m0use-portal
# which walks the player through the four-task aptitude battery. Subsequent
# shells skip the portal (it sets /root/.portal_done) and just give a
# normal prompt.
#
# No "Press Enter to continue" gate here: the portal's first screen
# (TASK 1) page_breaks anyway, so boot output flashes past and TASK 1
# appears -- no human-controlled idle in between.
cat > /etc/profile.d/01-m0usunet.sh <<'EOF'
if [ -z "$M0USE_SEEN" ]; then
  export M0USE_SEEN=1

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

# apply + replay scripts + m0use-bootstrap are copied into the
# rootfs by build-alpine.sh after this chroot script finishes.
# OpenRC is bypassed by inittab above, so we don't add any
# rc-update entries here.
:

# trim documentation, locale, and other dead weight
rm -rf /usr/share/man /usr/share/doc /usr/share/info \
       /usr/share/help /usr/share/locale \
       /usr/share/zoneinfo/right /usr/share/zoneinfo/posix \
       /var/cache/apk/* /var/cache/misc/* \
       /tmp/* /root/.ash_history 2>/dev/null || true
