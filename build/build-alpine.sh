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
  --image-size  256M \
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

# alpine-make-vm-image traps EXIT with `exit 0`, so apk failures don't
# fail the build. Assert customize.sh actually ran by checking for the
# inittab line it writes. If this is missing, the image still has the
# default Alpine boot config (OpenRC + every service) and v86 will hang.
if ! grep -q 'm0use-bootstrap' "$TMP/etc/inittab"; then
  echo "ERROR: customize.sh did not run — /etc/inittab is the Alpine default."
  echo "       Almost certainly apk add ran out of disk space mid-install."
  echo "       Either trim build/packages.txt or bump --image-size in this script."
  umount "$TMP"; losetup -d "$LOOP"; rmdir "$TMP"
  exit 1
fi

cp "$ROOT/kit-content/flags-phase1.txt" "$TMP/etc/m0use.flags1"
cp "$ROOT/kit-content/flags-phase2.txt" "$TMP/etc/m0use.flags2"
cp "$ROOT/kit-content/flags-phase3.txt" "$TMP/etc/m0use.flags3"
cp "$ROOT/kit-content/phase1-done.txt"  "$TMP/etc/m0use.phase1.done"
cp "$ROOT/kit-content/phase2-done.txt"  "$TMP/etc/m0use.phase2.done"
cp "$ROOT/kit-content/phase3-done.txt"  "$TMP/etc/m0use.phase3.done"

# Blueprint flag file — read by fake-curl when the player exploits
# the Jenkins endpoint.
mkdir -p "$TMP/var/m0use"
cp "$ROOT/build/m0use-blueprint.txt" "$TMP/var/m0use/blueprint.txt"
chmod 644 "$TMP/var/m0use/blueprint.txt"

# Fake recon tools — canned output, no real network. Shadow whatever
# real binary might exist by putting these in /usr/local/bin, which
# appears before /usr/bin on PATH (and we've stopped installing the
# real nmap/nikto/curl packages anyway).
cp "$ROOT/build/fake-nmap.py"   "$TMP/usr/local/bin/nmap"
cp "$ROOT/build/fake-nikto.py"  "$TMP/usr/local/bin/nikto"
cp "$ROOT/build/fake-curl.py"   "$TMP/usr/local/bin/curl"
chmod 755 "$TMP/usr/local/bin/nmap" \
          "$TMP/usr/local/bin/nikto" \
          "$TMP/usr/local/bin/curl"

# Minimal PID-1 bootstrap: replaces OpenRC. Runs once at boot via
# inittab's ::sysinit, does mounts + hostname.
cp "$ROOT/build/m0use-bootstrap.sh"  "$TMP/sbin/m0use-bootstrap"
chmod 755 "$TMP/sbin/m0use-bootstrap"

# Finding submitter (the way the player advances) + burp replay.
cp "$ROOT/build/m0use-answer.sh"    "$TMP/usr/local/bin/answer"
cp "$ROOT/build/m0use-replay.sh"    "$TMP/usr/local/bin/replay"
chmod 755 "$TMP/usr/local/bin/answer" "$TMP/usr/local/bin/replay"
# Back-compat aliases for muscle memory and old docs.
ln -sf answer "$TMP/usr/local/bin/apply"
ln -sf answer "$TMP/usr/local/bin/check"
ln -sf answer "$TMP/usr/local/bin/submit"

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
echo "root=/dev/sda rw modules=ext4 console=tty0 console=ttyS0,115200" > "$OUT/cmdline.txt"
echo "kernel cmdline: $(cat "$OUT/cmdline.txt")"

sync
umount "$TMP"
losetup -d "$LOOP"
rmdir "$TMP"

ls -lh "$OUT/"
