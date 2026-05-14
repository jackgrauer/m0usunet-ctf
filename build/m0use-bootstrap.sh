#!/bin/sh
# m0use-bootstrap — fires once from busybox init via ::sysinit.
# Prints OpenRC-style "* msg ... [ ok ]" lines so the page's
# colorizer (site/boot.js) tags them green/cyan and the boot reads
# as a real Linux boot.
#
# We no longer set up a fake network — the recon tools (nmap, nikto,
# curl) are canned scripts that don't need real services. So this
# bootstrap only does the essential filesystem mounts + hostname.

step() {
    msg=$1; shift
    printf ' * %s ...' "$msg"
    if "$@" >/dev/null 2>&1; then
        printf '\t\t\t\t[ ok ]\n'
    else
        printf '\t\t\t\t[ !! ]\n'
    fi
}

echo
echo "   m0usunet 0.9.7 / busybox-init starting up"
echo

step "Mounting /proc"        mount -t proc     proc     /proc
step "Mounting /sys"         mount -t sysfs    sysfs    /sys
step "Mounting /dev"         mount -t devtmpfs devtmpfs /dev
step "Mounting /run"         mount -t tmpfs    tmpfs    /run
step "Mounting /tmp"         mount -t tmpfs    tmpfs    /tmp
step "Remounting root rw"    mount -o remount,rw /

mkdir -p /mnt/kit
step "Mounting recon kit"    mount -t ext4 -o ro,nofail /dev/sdb /mnt/kit
step "Setting hostname"      hostname m0usunet

# Operator handle from kernel cmdline (m0use.handle=NAME).
handle=$(tr ' ' '\n' < /proc/cmdline | awk -F= '/^m0use\.handle=/{print $2; exit}')
if [ -n "$handle" ]; then
    clean=$(echo "$handle" | tr -cd 'A-Za-z0-9_-' | cut -c1-24)
    [ -n "$clean" ] && echo "$clean" > /root/.operator
fi

echo
echo "   m0usunet ready. Welcome to Field Operations."
echo

exit 0
