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

# alpine-make-vm-image leaves us with a 128M ext4 image. resize2fs -M
# refuses to shrink it (allocator pins blocks throughout the fs even
# after dropping resize_inode + has_journal). So rebuild a fresh
# smaller image: tar the rootfs out, mkfs a minimal image, extract,
# reinstall the extlinux boot sector.

TMP=$(mktemp -d)
TAR=$(mktemp /tmp/rootfs.XXXXXX.tar)
LOOP=$(losetup -f --show "$OUT/alpine.img")
mount "$LOOP" "$TMP"

cp "$ROOT/kit-content/flags.txt"   "$TMP/etc/m0use.flags"
cp "$ROOT/kit-content/exploit.sh"  "$TMP/etc/m0use.exploit"

ls -l "$TMP/boot/" || { echo "ERROR: /boot empty"; exit 1; }
ls "$TMP/boot/"vmlinuz-* >/dev/null 2>&1   || { echo "ERROR: no kernel"; exit 1; }
ls "$TMP/boot/"initramfs-* >/dev/null 2>&1 || { echo "ERROR: no initramfs"; exit 1; }

# Tar everything out (preserve permissions, symlinks, ownership).
tar -cf "$TAR" -C "$TMP" --acls --xattrs .
sync
umount "$TMP"
losetup -d "$LOOP"

# Pick target size: tar size + 25% headroom, rounded up to MB, floor 64M.
TARSIZE=$(stat -c %s "$TAR")
TARGET_MB=$(( (TARSIZE * 5 / 4 + 1024*1024 - 1) / (1024*1024) ))
[ "$TARGET_MB" -lt 64 ] && TARGET_MB=64
echo "tar=${TARSIZE}B  new image=${TARGET_MB}M"

NEW="$OUT/alpine.img.new"
rm -f "$NEW"
truncate -s "${TARGET_MB}M" "$NEW"
# Bootable ext4 without journal or resize-inode reserves — image is read-only.
mkfs.ext4 -F -O ^has_journal,^resize_inode -L M0USUNET "$NEW"

LOOP=$(losetup -f --show "$NEW")
mount "$LOOP" "$TMP"
tar -xf "$TAR" -C "$TMP" --acls --xattrs

# Reinstall the extlinux bootloader into the fresh fs.
extlinux --install "$TMP/boot"

# Overwrite the .c32 modules so they match the freshly-written
# ldlinux.sys. Find the modules wherever syslinux dropped them.
echo "=== syslinux module locations ==="
ls /usr/share/syslinux/ 2>&1 | head -30
find / -name 'ldlinux.c32' 2>/dev/null
SYSLINUX_DIR=$(dirname "$(find / -name 'ldlinux.c32' -not -path "$TMP/*" 2>/dev/null | head -1)")
echo "SYSLINUX_DIR=$SYSLINUX_DIR"
if [ -n "$SYSLINUX_DIR" ] && [ -d "$SYSLINUX_DIR" ]; then
  cp "$SYSLINUX_DIR"/*.c32 "$TMP/boot/" 2>/dev/null
  ls -l "$TMP/boot/"*.c32 | head -10
else
  echo "ERROR: cannot find syslinux .c32 modules in container"
  exit 1
fi

sync
umount "$TMP"
losetup -d "$LOOP"

mv "$NEW" "$OUT/alpine.img"
rm -f "$TAR"
rmdir "$TMP"

echo "wrote $OUT/alpine.img ($(du -h "$OUT/alpine.img" | cut -f1))"
ls -lh "$OUT/alpine.img"
