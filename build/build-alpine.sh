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

# Mount the image, inject answer files, extract kernel + initramfs +
# kernel command line. v86 will load those directly (bzimage_url +
# initrd_url) and skip the SYSLINUX bootloader entirely — that chain
# fails to load ldlinux.c32 in v86 for reasons we couldn't trace.

TMP=$(mktemp -d)
LOOP=$(losetup -f --show "$OUT/alpine.img")
mount "$LOOP" "$TMP"

cp "$ROOT/kit-content/flags.txt"   "$TMP/etc/m0use.flags"
cp "$ROOT/kit-content/exploit.sh"  "$TMP/etc/m0use.exploit"

ls "$TMP/boot/"vmlinuz-* >/dev/null 2>&1   || { echo "ERROR: no kernel"; exit 1; }
ls "$TMP/boot/"initramfs-* >/dev/null 2>&1 || { echo "ERROR: no initramfs"; exit 1; }

# Pull the kernel + initramfs out so v86 can boot them directly.
cp "$TMP"/boot/vmlinuz-virt   "$OUT/vmlinuz-virt"
cp "$TMP"/boot/initramfs-virt "$OUT/initramfs-virt"
chmod a+r "$OUT/vmlinuz-virt" "$OUT/initramfs-virt"

# Capture the APPEND line from extlinux.conf — it has the right
# cmdline (rootdev, modules, console). Strip "APPEND " and emit.
awk '/^[[:space:]]*APPEND /{ sub(/^[[:space:]]*APPEND /,""); print; exit }' \
  "$TMP/boot/extlinux.conf" > "$OUT/cmdline.txt"
echo "kernel cmdline: $(cat "$OUT/cmdline.txt")"

sync
umount "$TMP"
losetup -d "$LOOP"
rmdir "$TMP"

ls -lh "$OUT/"
