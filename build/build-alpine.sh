#!/bin/sh
# build-alpine.sh — produce build/out/alpine.img using alpine-make-vm-image.
# Run on Alpine (or in an Alpine container). Needs root.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/build/out"
TOOL="$ROOT/build/alpine-make-vm-image"

mkdir -p "$OUT"

if [ ! -x "$TOOL/alpine-make-vm-image" ]; then
  echo "fetching alpine-make-vm-image"
  rm -rf "$TOOL"
  git clone --depth 1 https://github.com/alpinelinux/alpine-make-vm-image "$TOOL"
fi

"$TOOL/alpine-make-vm-image" \
  --image-format raw \
  --image-size  160M \
  --branch      v3.18 \
  --packages    "$(xargs < "$ROOT/build/packages.txt")" \
  --script-chroot \
  "$OUT/alpine.img" \
  -- "$ROOT/build/customize.sh"

# Mount the image, inject answer files, extract kernel + initramfs +
# kernel command line. v86 will load those directly (bzimage_url +
# initrd_url) and skip the SYSLINUX bootloader entirely — that chain
# fails to load ldlinux.c32 in v86 for reasons we couldn't trace.

TMP=$(mktemp -d)
LOOP=$(losetup -f --show "$OUT/alpine.img")
mount "$LOOP" "$TMP"

cp "$ROOT/kit-content/flags-phase1.txt" "$TMP/etc/m0use.flags1"
cp "$ROOT/kit-content/flags-phase2.txt" "$TMP/etc/m0use.flags2"
cp "$ROOT/kit-content/flags-phase3.txt" "$TMP/etc/m0use.flags3"
cp "$ROOT/kit-content/phase1-done.txt"  "$TMP/etc/m0use.phase1.done"
cp "$ROOT/kit-content/phase2-done.txt"  "$TMP/etc/m0use.phase2.done"
cp "$ROOT/kit-content/phase3-done.txt"  "$TMP/etc/m0use.phase3.done"

# Fake-network services + DNS + blueprint flag file.
cp "$ROOT/build/m0use-banners.py"   "$TMP/usr/local/bin/m0use-banners"
cp "$ROOT/build/m0use-jenkins.py"   "$TMP/usr/local/bin/m0use-jenkins"
cp "$ROOT/build/m0use-dnsmasq.conf" "$TMP/etc/m0use-dnsmasq.conf"
chmod 755 "$TMP/usr/local/bin/m0use-banners" "$TMP/usr/local/bin/m0use-jenkins"
mkdir -p "$TMP/var/m0use"
cp "$ROOT/build/m0use-blueprint.txt" "$TMP/var/m0use/blueprint.txt"
chmod 644 "$TMP/var/m0use/blueprint.txt"

# Minimal PID-1 bootstrap: replaces OpenRC. Runs once at boot via
# inittab's ::sysinit, does mounts + lo aliases + background services.
cp "$ROOT/build/m0use-bootstrap.sh"  "$TMP/sbin/m0use-bootstrap"
chmod 755 "$TMP/sbin/m0use-bootstrap"

# Flag validator + burp replay tool.
cp "$ROOT/build/m0use-apply.sh"     "$TMP/usr/local/bin/apply"
cp "$ROOT/build/m0use-replay.sh"    "$TMP/usr/local/bin/replay"
chmod 755 "$TMP/usr/local/bin/apply" "$TMP/usr/local/bin/replay"
ln -sf apply "$TMP/usr/local/bin/check"

# Portal flow (4-task aptitude battery)
cp "$ROOT/build/m0use-portal.sh"    "$TMP/usr/local/bin/m0use-portal"
cp "$ROOT/build/m0use-game-rc"      "$TMP/etc/m0use-game-rc"
chmod 755 "$TMP/usr/local/bin/m0use-portal"
chmod 644 "$TMP/etc/m0use-game-rc"

# QoL: colored ls/grep, less defaults, completion, help/restart cmds.
mkdir -p "$TMP/etc/profile.d"
cp "$ROOT/build/qol-profile.sh"     "$TMP/etc/profile.d/qol.sh"
cp "$ROOT/build/m0use-help.sh"      "$TMP/usr/local/bin/help"
cp "$ROOT/build/m0use-restart.sh"   "$TMP/usr/local/bin/restart"
cp "$ROOT/build/m0use-wrap.py"      "$TMP/usr/local/bin/wrap"
chmod 644 "$TMP/etc/profile.d/qol.sh"
chmod 755 "$TMP/usr/local/bin/help" "$TMP/usr/local/bin/restart" \
          "$TMP/usr/local/bin/wrap"

ls "$TMP/boot/"vmlinuz-* >/dev/null 2>&1   || { echo "ERROR: no kernel"; exit 1; }
ls "$TMP/boot/"initramfs-* >/dev/null 2>&1 || { echo "ERROR: no initramfs"; exit 1; }

# Pull the kernel + initramfs out so v86 can boot them directly.
cp "$TMP"/boot/vmlinuz-virt   "$OUT/vmlinuz-virt"
cp "$TMP"/boot/initramfs-virt "$OUT/initramfs-virt"
chmod a+r "$OUT/vmlinuz-virt" "$OUT/initramfs-virt"

# /boot is dead weight on the disk now — v86 boots the kernel and
# initramfs externally via bzimage_url. Strip it.
rm -rf "$TMP"/boot/* 2>/dev/null || true

# /lib/modules is also unused — every driver we need (ext4, ata, bochs)
# is compiled into the kernel image itself, not as a loadable module.
rm -rf "$TMP"/lib/modules 2>/dev/null || true

# Build a stable kernel cmdline.
# - root=/dev/sda is stable across builds (UUIDs drift).
# - console=tty0 console=ttyS0,115200 sends kernel + agetty output to
#   the emulated serial port; xterm.js in the page reads it and is
#   the player's actual terminal. tty0 stays as a secondary console
#   in case v86 ever has its canvas wired in again.
echo "root=/dev/sda rw modules=ext4 console=tty0 console=ttyS0,115200 quiet" > "$OUT/cmdline.txt"
echo "kernel cmdline: $(cat "$OUT/cmdline.txt")"

sync
umount "$TMP"
losetup -d "$LOOP"
rmdir "$TMP"

ls -lh "$OUT/"
