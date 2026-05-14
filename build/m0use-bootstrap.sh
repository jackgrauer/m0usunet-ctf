#!/bin/sh
# m0use-bootstrap — fires once from busybox init via ::sysinit. Does
# everything OpenRC used to do, minus the per-service ceremony. Boot
# should be measured in seconds, not tens of seconds.
#
# Prints OpenRC-style "* Doing thing ... [ ok ]" lines so the v86
# page's colorizer (site/boot.js) tags them green/cyan and the boot
# *looks* like a real Linux boot — just much faster.

# OpenRC-style step output. step() runs a command silently and prints
# "* msg ... [ ok ]" / "[ !! ]" depending on exit code. No timing
# overhead — the commands are the same ones we'd run silently.
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

# Essential filesystems. The kernel already created devtmpfs but we
# still need proc + sys + tmp + run.
step "Mounting /proc"  mount -t proc     proc     /proc
step "Mounting /sys"   mount -t sysfs    sysfs    /sys
step "Mounting /dev"   mount -t devtmpfs devtmpfs /dev
step "Mounting /run"   mount -t tmpfs    tmpfs    /run
step "Mounting /tmp"   mount -t tmpfs    tmpfs    /tmp

# Remount root read-write.
step "Remounting root rw" mount -o remount,rw /

# Mount the kit disk read-only at /mnt/kit.
mkdir -p /mnt/kit
step "Mounting recon kit /mnt/kit" mount -t ext4 -o ro,nofail /dev/sdb /mnt/kit

# Hostname.
step "Setting hostname m0usunet" hostname m0usunet

# Fake crazy.ants network. First alias is /24 so the kernel installs
# a main-table route for the subnet (required for nmap SYN scans).
printf ' * Bringing up loopback ...'
ip link set lo up 2>/dev/null
ip addr add 10.4.12.1/24 dev lo 2>/dev/null
printf '\t\t\t[ ok ]\n'

printf ' * Aliasing crazy.ants hosts on lo ...'
for ip in 10.4.12.10 10.4.12.20 10.4.12.21 \
          10.4.12.30 10.4.12.31 10.4.12.40 10.4.12.50 \
          10.4.12.70 10.4.12.80 10.4.12.88 10.4.12.99; do
    ip addr add "${ip}/32" dev lo 2>/dev/null
done
printf '\t\t[ ok ]\n'

# Resolver → local dnsmasq.
echo "nameserver 127.0.0.1" > /etc/resolv.conf
printf ' * Configuring resolver -> 127.0.0.1 ...\t\t[ ok ]\n'

# Operator handle from kernel cmdline (m0use.handle=NAME).
handle=$(tr ' ' '\n' < /proc/cmdline | awk -F= '/^m0use\.handle=/{print $2; exit}')
if [ -n "$handle" ]; then
    clean=$(echo "$handle" | tr -cd 'A-Za-z0-9_-' | cut -c1-24)
    [ -n "$clean" ] && echo "$clean" > /root/.operator
fi

# Background services. Logs go to /run so they don't fill / .
printf ' * Starting dnsmasq (fake .ants TLD) ...'
dnsmasq --keep-in-foreground --conf-file=/etc/m0use-dnsmasq.conf \
        >/run/m0use-dnsmasq.log 2>&1 &
printf '\t\t[ ok ]\n'

printf ' * Starting m0use-banners (fake services) ...'
/usr/local/bin/m0use-banners >/run/m0use-banners.log 2>&1 &
printf '\t[ ok ]\n'

printf ' * Starting m0use-jenkins (target) ...'
/usr/local/bin/m0use-jenkins >/run/m0use-jenkins.log 2>&1 &
printf '\t\t[ ok ]\n'

echo
echo "   m0usunet ready. Welcome to Field Operations."
echo

# Done. Return so init can spawn agetty.
exit 0
