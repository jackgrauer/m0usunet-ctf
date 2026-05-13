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

# shrink: resize2fs to minimum, then truncate the image to fit
PART="${LOOP}p1"
e2fsck -fy "$PART" >/dev/null
resize2fs -M "$PART" >/dev/null 2>&1 || resize2fs -M "$PART"

# get final filesystem size in bytes
BCOUNT=$(dumpe2fs -h "$PART" 2>/dev/null | awk -F: '/Block count/{print $2}' | tr -d ' ')
BSIZE=$(dumpe2fs  -h "$PART" 2>/dev/null | awk -F: '/Block size/{print $2}'  | tr -d ' ')
FSBYTES=$(( BCOUNT * BSIZE ))

losetup -d "$LOOP"

# partition start in sectors (from sfdisk dump)
PSTART=$(sfdisk -d "$OUT/alpine.img" | awk '/start=/{for(i=1;i<=NF;i++) if($i~/^start=/){gsub(",","",$i); sub("start=","",$i); print $i}}' | head -1)
PSECTORS=$(( (FSBYTES + 511) / 512 ))
NEW_SIZE=$(( (PSTART + PSECTORS) * 512 ))
truncate -s "$NEW_SIZE" "$OUT/alpine.img"

# rewrite partition table so it doesn't point past EOF
sfdisk "$OUT/alpine.img" <<EOF
label: dos
unit: sectors
${PSTART},${PSECTORS},83,*
EOF

rmdir "$TMP"

echo "wrote $OUT/alpine.img ($(du -h "$OUT/alpine.img" | cut -f1))"
