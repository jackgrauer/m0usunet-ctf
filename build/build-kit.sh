#!/bin/sh
# build-kit.sh — produce build/out/kit.img (ext2, mounted as /dev/sdb in the VM).
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/build/out/kit.img"
SRC="$ROOT/kit-content"
SIZE_MB=2

mkdir -p "$ROOT/build/out"
rm -f "$OUT"
truncate -s "${SIZE_MB}M" "$OUT"
mkfs.ext2 -F -L M0USUNET_KIT "$OUT"

TMP=$(mktemp -d)
mount -o loop "$OUT" "$TMP"
cp -r "$SRC"/BRIEFING "$SRC"/01_nmap "$SRC"/02_burp "$SRC"/03_metasploit "$TMP"/
chown -R 0:0 "$TMP"
sync
umount "$TMP"
rmdir "$TMP"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
