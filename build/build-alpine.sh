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
  --image-size  128M \
  --branch      v3.18 \
  --packages    "$(xargs < "$ROOT/build/packages.txt")" \
  --script-chroot \
  "$OUT/alpine.img" \
  -- "$ROOT/build/customize.sh"

# inject answer files onto the rootfs + verify boot artifacts exist
TMP=$(mktemp -d)
LOOP=$(losetup -fP --show "$OUT/alpine.img")
# alpine-make-vm-image partitions the disk; the rootfs is on partition 1.
mount "${LOOP}p1" "$TMP" 2>/dev/null || mount "$LOOP" "$TMP"
cp "$ROOT/kit-content/flags.txt"   "$TMP/etc/m0use.flags"
cp "$ROOT/kit-content/exploit.sh"  "$TMP/etc/m0use.exploit"

# guard against silent mkinitfs failures
ls -l "$TMP/boot/" || { echo "ERROR: /boot empty"; exit 1; }
ls "$TMP/boot/"vmlinuz-* >/dev/null 2>&1   || { echo "ERROR: no kernel in /boot"; exit 1; }
ls "$TMP/boot/"initramfs-* >/dev/null 2>&1 || { echo "ERROR: no initramfs in /boot"; exit 1; }

sync
umount "$TMP"
losetup -d "$LOOP"
rmdir "$TMP"

# Diagnostics — figure out whether we got a partitioned image or a raw fs.
file "$OUT/alpine.img"
sfdisk -d "$OUT/alpine.img" 2>&1 || true

echo "wrote $OUT/alpine.img ($(du -h "$OUT/alpine.img" | cut -f1))"
