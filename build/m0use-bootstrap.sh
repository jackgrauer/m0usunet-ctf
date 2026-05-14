#!/bin/sh
# m0use-bootstrap — fires once from busybox init via ::sysinit. Does
# everything OpenRC used to do, minus the per-service ceremony. Boot
# should be measured in seconds, not tens of seconds.

# Essential filesystems. The kernel already created devtmpfs but we
# still need proc + sys + tmp + run.
mount -t proc     proc     /proc 2>/dev/null
mount -t sysfs    sysfs    /sys 2>/dev/null
mount -t devtmpfs devtmpfs /dev 2>/dev/null
mount -t tmpfs    tmpfs    /run 2>/dev/null
mount -t tmpfs    tmpfs    /tmp 2>/dev/null

# Remount root read-write.
mount -o remount,rw / 2>/dev/null

# Mount the kit disk read-only at /mnt/kit.
mkdir -p /mnt/kit
mount -t ext4 -o ro,nofail /dev/sdb /mnt/kit 2>/dev/null

# Hostname.
hostname m0usunet 2>/dev/null

# Fake crazy.ants network. First alias is /24 so the kernel installs
# a main-table route for the subnet (required for nmap SYN scans).
ip link set lo up 2>/dev/null
ip addr add 10.4.12.1/24 dev lo 2>/dev/null
for ip in 10.4.12.10 10.4.12.20 10.4.12.21 \
          10.4.12.30 10.4.12.31 10.4.12.40 10.4.12.50 \
          10.4.12.70 10.4.12.80 10.4.12.88 10.4.12.99; do
    ip addr add "${ip}/32" dev lo 2>/dev/null
done

# Resolver → local dnsmasq.
echo "nameserver 127.0.0.1" > /etc/resolv.conf

# Operator handle from kernel cmdline (m0use.handle=NAME).
handle=$(tr ' ' '\n' < /proc/cmdline | awk -F= '/^m0use\.handle=/{print $2; exit}')
if [ -n "$handle" ]; then
    clean=$(echo "$handle" | tr -cd 'A-Za-z0-9_-' | cut -c1-24)
    [ -n "$clean" ] && echo "$clean" > /root/.operator
fi

# Background services. Logs go to /run so they don't fill / .
dnsmasq --keep-in-foreground --conf-file=/etc/m0use-dnsmasq.conf \
        >/run/m0use-dnsmasq.log 2>&1 &
/usr/local/bin/m0use-banners >/run/m0use-banners.log 2>&1 &
/usr/local/bin/m0use-jenkins >/run/m0use-jenkins.log 2>&1 &

# Done. Return so init can spawn agetty.
exit 0
