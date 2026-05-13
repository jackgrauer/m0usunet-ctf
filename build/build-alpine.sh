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

# Image is unpartitioned ext4 with a syslinux boot sector in the first
# 512 bytes. Mount $LOOP directly; no partition device files exist.
TMP=$(mktemp -d)
LOOP=$(losetup -f --show "$OUT/alpine.img")
mount "$LOOP" "$TMP"
cp "$ROOT/kit-content/flags.txt"   "$TMP/etc/m0use.flags"
cp "$ROOT/kit-content/exploit.sh"  "$TMP/etc/m0use.exploit"

ls -l "$TMP/boot/" || { echo "ERROR: /boot empty"; exit 1; }
ls "$TMP/boot/"vmlinuz-* >/dev/null 2>&1   || { echo "ERROR: no kernel in /boot"; exit 1; }
ls "$TMP/boot/"initramfs-* >/dev/null 2>&1 || { echo "ERROR: no initramfs in /boot"; exit 1; }

sync
umount "$TMP"

# Shrink the filesystem to minimum, then truncate the image to fit.
echo "=== before shrink ==="
ls -lh "$OUT/alpine.img"
e2fsck -fy "$LOOP"
resize2fs -M "$LOOP"

dumpe2fs -h "$LOOP" 2>/dev/null | grep -E 'Block count|Block size'
BCOUNT=$(dumpe2fs -h "$LOOP" 2>/dev/null | awk -F: '/Block count/{print $2}' | tr -d ' ')
BSIZE=$(dumpe2fs  -h "$LOOP" 2>/dev/null | awk -F: '/Block size/{print $2}'  | tr -d ' ')
FSBYTES=$(( BCOUNT * BSIZE ))
echo "computed FSBYTES=$FSBYTES (BCOUNT=$BCOUNT * BSIZE=$BSIZE)"

losetup -d "$LOOP"
truncate -s "$FSBYTES" "$OUT/alpine.img"
echo "=== after truncate ==="
ls -lh "$OUT/alpine.img"
rmdir "$TMP"

echo "wrote $OUT/alpine.img ($(du -h "$OUT/alpine.img" | cut -f1))"
