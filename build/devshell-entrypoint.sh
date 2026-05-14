#!/bin/sh
# devshell-entrypoint.sh — runs INSIDE the Alpine dev container.
# Wires the repo's build/ + kit-content/ into the rootfs paths the
# portal expects, brings up the fake crazy.ants network, and execs
# the portal. The host repo is mounted read-only at /work.
set -e

# Packages. apk add is cached across runs by the layer if we ever
# move to a Dockerfile; for now it re-fetches each container start
# (~5-10 s on a warm mirror).
apk add --no-cache -q bash bash-completion nmap nmap-nselibs nmap-scripts curl python3 dnsmasq iproute2 less >/dev/null 2>&1 || true

# nmap SYN scans need raw-packet ioctls that OrbStack / Lima's
# lightweight kernel does not expose. Wrap nmap so it transparently
# uses TCP-connect (-sT --unprivileged) for the player. The real VM
# runs root + a real kernel so it never needs this wrapper.
cat >/usr/local/bin/nmap <<'WRAP'
#!/bin/sh
exec /usr/bin/nmap -sT --unprivileged "$@"
WRAP
chmod 755 /usr/local/bin/nmap

# Layout: place scripts where the portal expects them.
mkdir -p /usr/local/bin /etc /var/m0use /mnt/kit /run

cp /work/build/m0use-portal.sh   /usr/local/bin/m0use-portal
cp /work/build/m0use-apply.sh    /usr/local/bin/apply
cp /work/build/m0use-replay.sh   /usr/local/bin/replay
cp /work/build/m0use-banners.py  /usr/local/bin/m0use-banners
cp /work/build/m0use-jenkins.py  /usr/local/bin/m0use-jenkins
cp /work/build/m0use-dnsmasq.conf /etc/m0use-dnsmasq.conf
cp /work/build/m0use-game-rc     /etc/m0use-game-rc
cp /work/build/m0use-blueprint.txt /var/m0use/blueprint.txt
cp /work/build/m0use-help.sh     /usr/local/bin/help
cp /work/build/m0use-restart.sh  /usr/local/bin/restart
cp /work/build/m0use-wrap.py     /usr/local/bin/wrap
mkdir -p /etc/profile.d
cp /work/build/qol-profile.sh    /etc/profile.d/qol.sh
chmod 755 /usr/local/bin/m0use-portal /usr/local/bin/apply \
          /usr/local/bin/replay /usr/local/bin/m0use-banners \
          /usr/local/bin/m0use-jenkins /usr/local/bin/help \
          /usr/local/bin/restart /usr/local/bin/wrap
ln -sf /usr/local/bin/apply /usr/local/bin/check

# Per-phase flag lists + completion banners.
cp /work/kit-content/flags-phase1.txt /etc/m0use.flags1
cp /work/kit-content/flags-phase2.txt /etc/m0use.flags2
cp /work/kit-content/flags-phase3.txt /etc/m0use.flags3
cp /work/kit-content/phase1-done.txt  /etc/m0use.phase1.done
cp /work/kit-content/phase2-done.txt  /etc/m0use.phase2.done
cp /work/kit-content/phase3-done.txt  /etc/m0use.phase3.done

# Kit at /mnt/kit. Symlinks point at the read-only host mount so
# live edits to kit-content/ show up immediately on the next run.
ln -sfn /work/kit-content/01_nmap        /mnt/kit/01_nmap
ln -sfn /work/kit-content/02_burp        /mnt/kit/02_burp
ln -sfn /work/kit-content/03_metasploit  /mnt/kit/03_metasploit
cp /work/kit-content/BRIEFING            /mnt/kit/BRIEFING

# Fake crazy.ants network — same IPs the m0usenet initd sets up.
# First alias is /24 so the kernel installs a 10.4.12.0/24 → lo route
# in the main table; otherwise default nmap SYN scans bail.
ip link set lo up 2>/dev/null || true
ip addr add 10.4.12.1/24 dev lo 2>/dev/null || true
for ip in 10.4.12.10 10.4.12.20 10.4.12.21 \
          10.4.12.30 10.4.12.31 10.4.12.40 10.4.12.50 \
          10.4.12.70 10.4.12.80 10.4.12.88 10.4.12.99; do
  ip addr add "${ip}/32" dev lo 2>/dev/null || true
done
echo "nameserver 127.0.0.1" > /etc/resolv.conf

# Background services. Quiet — their output would clobber the portal.
dnsmasq --keep-in-foreground --conf-file=/etc/m0use-dnsmasq.conf \
        >/run/m0use-dnsmasq.log 2>&1 &
sleep 0.3
/usr/local/bin/m0use-banners >/run/m0use-banners.log 2>&1 &
/usr/local/bin/m0use-jenkins >/run/m0use-jenkins.log 2>&1 &
sleep 0.3

# Operator handle (passed in by host via -e HANDLE).
: "${HANDLE:=cadet}"
echo "$HANDLE" > /root/.operator

# Clean state so the portal runs from the top each container.
rm -f /root/.portal_done /root/.portal_task2

clear
exec /usr/local/bin/m0use-portal
