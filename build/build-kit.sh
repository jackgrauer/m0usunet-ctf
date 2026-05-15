#!/bin/sh
# build-kit.sh -- produce build/out/kit.img (ext2, mounted as /dev/sdb in the VM).
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT/build/out/kit.img"
SRC="$ROOT/kit-content"
SIZE_MB=2

mkdir -p "$ROOT/build/out"
rm -f "$OUT"
truncate -s "${SIZE_MB}M" "$OUT"
mkfs.ext4 -F -O ^has_journal -L M0USUNET_KIT "$OUT"

TMP=$(mktemp -d)
LOOP=$(losetup -f --show "$OUT")
mount "$LOOP" "$TMP"
cp -r "$SRC"/briefing "$SRC"/nmap "$SRC"/nikto "$SRC"/burp "$SRC"/msf "$TMP"/

# Case-fold safety: players type `cat readme` or `cat README` from
# habit. The canonical names are lowercase; add uppercase symlinks
# so both work. Same for briefing.
for d in "$TMP"/nmap "$TMP"/nikto "$TMP"/msf; do
  [ -e "$d/readme" ] && ln -sf readme "$d/README"
done
[ -e "$TMP/briefing" ] && ln -sf briefing "$TMP/BRIEFING"

chown -R 0:0 "$TMP"
sync
umount "$TMP"
losetup -d "$LOOP"
rmdir "$TMP"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
