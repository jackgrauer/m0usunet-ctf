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

# Case-fold + muscle-memory safety: canonical name is `brief` (single
# dictionary word — phone autocorrect won't split it the way it splits
# `readme` into `read me`). Add an uppercase symlink, plus a `readme`
# symlink for anyone who manages to type it past autocorrect.
for d in "$TMP"/nmap "$TMP"/nikto "$TMP"/msf; do
  [ -e "$d/brief" ] && ln -sf brief "$d/BRIEF"
  [ -e "$d/brief" ] && ln -sf brief "$d/readme"
done
[ -e "$TMP/briefing" ] && ln -sf briefing "$TMP/BRIEFING"

chown -R 0:0 "$TMP"
sync
umount "$TMP"
losetup -d "$LOOP"
rmdir "$TMP"

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
