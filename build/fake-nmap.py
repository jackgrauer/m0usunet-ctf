#!/usr/bin/env python3
# fake-nmap — canned output that walks the player to the jenkins-old
# leak on 10.4.12.88. No real network involved; output is generated
# from a host table so it stays consistent across runs.
#
# The "leak" reproduces a classic real-nmap pattern: when forward and
# reverse DNS disagree, nmap prints the rDNS as an extra line right
# under the scan-report header. Most hosts here have matching fwd/rev
# DNS so that line is absent; legacy-build-03 (10.4.12.88) is the one
# whose rDNS says jenkins-old.internal.crazy.ants. That mismatch is
# the giveaway the README/hint point at.

import random
import sys
import time
from datetime import datetime, timezone

# (ip, fwd_hostname, rdns_override, [(port, proto, service, version), ...])
HOSTS = [
    ("10.4.12.1", "gw.crazy.ants", None, [
        (22,   "tcp", "ssh",   "OpenSSH 8.9p1 Ubuntu 3ubuntu0.11 (Ubuntu Linux; protocol 2.0)"),
        (80,   "tcp", "http",  "nginx 1.22.1"),
        (443,  "tcp", "https", "nginx 1.22.1"),
        (8080, "tcp", "http",  "Jetty 9.4.27.v20200227 (Jenkins httpd 2.121.1)"),
    ]),
    ("10.4.12.10", "mail.crazy.ants", None, [
        (22,  "tcp", "ssh",     "OpenSSH 8.4p1 Debian 5+deb11u3 (protocol 2.0)"),
        (25,  "tcp", "smtp",    "Postfix smtpd"),
        (465, "tcp", "smtps",   "Postfix smtpd"),
        (993, "tcp", "imaps",   "Dovecot imapd"),
    ]),
    ("10.4.12.20", "www.crazy.ants", None, [
        (80,  "tcp", "http",  "nginx 1.24.0"),
        (443, "tcp", "https", "nginx 1.24.0"),
    ]),
    ("10.4.12.21", "api.crazy.ants", None, [
        (8443, "tcp", "https", "Kestrel httpd (.NET 7.0)"),
    ]),
    ("10.4.12.30", "db-01.crazy.ants", None, [
        (22,   "tcp", "ssh",        "OpenSSH 8.9p1 (protocol 2.0)"),
        (5432, "tcp", "postgresql", "PostgreSQL DB 15.2"),
    ]),
    ("10.4.12.31", "db-02.crazy.ants", None, [
        (22,   "tcp", "ssh",        "OpenSSH 8.9p1 (protocol 2.0)"),
        (5432, "tcp", "postgresql", "PostgreSQL DB 15.2"),
    ]),
    ("10.4.12.40", "redis.crazy.ants", None, [
        (22,   "tcp", "ssh",   "OpenSSH 8.9p1 (protocol 2.0)"),
        (6379, "tcp", "redis", "Redis key-value store 7.0.11"),
    ]),
    ("10.4.12.50", "vpn.crazy.ants", None, [
        (443, "tcp", "https",   "OpenVPN"),
        (943, "tcp", "openvpn", "OpenVPN Access Server admin UI"),
    ]),
    ("10.4.12.70", "ci.crazy.ants", None, [
        (22,  "tcp", "ssh",   "OpenSSH 9.3p1 (protocol 2.0)"),
        (80,  "tcp", "http",  "Caddy httpd (Drone CI)"),
        (443, "tcp", "https", "Caddy httpd (Drone CI)"),
    ]),
    ("10.4.12.80", "grafana.crazy.ants", None, [
        (3000, "tcp", "http", "nginx (Grafana 9.5.2)"),
    ]),
    # The leak. fwd DNS says legacy-build-03, rDNS says jenkins-old.internal.
    # That mismatch is the entire game on phase 1.
    ("10.4.12.88", "legacy-build-03.crazy.ants",
                   "jenkins-old.internal.crazy.ants", [
        (22, "tcp", "ssh", "OpenSSH 7.4p1 (protocol 2.0)"),
    ]),
    ("10.4.12.99", "assets.crazy.ants", None, [
        (443, "tcp", "https", "nginx 1.24.0"),
    ]),
]


def print_help():
    sys.stdout.write(
        "Nmap 7.93 ( https://nmap.org )\n"
        "Usage: nmap [Scan Type(s)] [Options] {target specification}\n"
        "TARGET SPECIFICATION:\n"
        "  Can pass hostnames, IP addresses, networks, etc.\n"
        "  Ex: scanme.nmap.org, microsoft.com/24, 192.168.0.1; 10.0.0-255.1-254\n"
        "SCAN TECHNIQUES:\n"
        "  -sS/sT: TCP SYN / TCP connect() scan\n"
        "  -sU:    UDP scan\n"
        "  -sn:    No port scan (ping sweep)\n"
        "PORT SPECIFICATION:\n"
        "  -p <ranges>:  Only scan specified ports. Ex: -p22; -p1-65535\n"
        "  -F:           Fast mode - scan fewer ports than default\n"
        "SERVICE/VERSION DETECTION:\n"
        "  -sV:  Probe open ports to determine service/version info\n"
        "  -A:   Enable OS detection, version detection, script scanning\n"
        "OUTPUT:\n"
        "  -v:   Increase verbosity level\n"
        "  -oN <file>: Output normal scan results to file\n"
        "SEE ALSO:\n"
        "  this is a teaching shim; only a handful of flags are honored.\n"
        "  ranges supported: 10.4.12.0/24, individual 10.4.12.X, hostnames.\n"
    )


def parse_targets(arg):
    """Return list of (ip, fwd, rdns, ports) tuples this arg matches."""
    if arg == "10.4.12.0/24":
        return list(HOSTS)
    # exact IP
    for h in HOSTS:
        if h[0] == arg:
            return [h]
    # hostname (forward or with .crazy.ants)
    for h in HOSTS:
        if h[1] == arg or h[1].split(".", 1)[0] == arg:
            return [h]
    return []


_R       = "\x1b[0m"
_DIM     = "\x1b[2m"
_BOLD    = "\x1b[1m"
_CYAN_B  = "\x1b[1;36m"
_GREEN_B = "\x1b[1;32m"
_WHITE_B = "\x1b[1;37m"
_YELLOW  = "\x1b[0;33m"


def fmt_report(host, with_versions):
    ip, fwd, rdns, ports = host
    lines = []
    # Hostname / IP header — bold white, the visual anchor for each host.
    lines.append(f"{_WHITE_B}Nmap scan report for {fwd} ({ip}){_R}")
    lines.append(f"{_DIM}Host is up ({random.uniform(0.000040, 0.000220):.6f}s latency).{_R}")
    # The leak: extra rDNS line on the one host whose fwd/rev DNS
    # disagree. Tinted yellow so it reads as "something is up here"
    # without screaming GIVEAWAY at the player.
    if rdns:
        lines.append(f"{_YELLOW}rDNS record for {ip}: {rdns}{_R}")
    closed = 1000 - len(ports)
    lines.append(f"{_DIM}Not shown: {closed} closed tcp ports (conn-refused){_R}")
    if with_versions:
        lines.append(f"{_DIM}PORT     STATE SERVICE     VERSION{_R}")
    else:
        lines.append(f"{_DIM}PORT     STATE SERVICE{_R}")
    for port, proto, service, version in ports:
        head = f"{port}/{proto}".ljust(9)
        if with_versions:
            lines.append(
                f"{_BOLD}{head}{_R}{_GREEN_B}open{_R}  "
                f"{_CYAN_B}{service:<11}{_R} {_DIM}{version}{_R}"
            )
        else:
            lines.append(
                f"{_BOLD}{head}{_R}{_GREEN_B}open{_R}  {_CYAN_B}{service}{_R}"
            )
    # Trailing blank line so consecutive scan reports breathe.
    lines.append("")
    return "\n".join(lines) + "\n"


def main(argv):
    args = argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print_help()
        return 0

    with_versions = False
    target = None
    verbose = False
    for a in args:
        if a in ("-sV", "-A"):
            with_versions = True
        elif a == "-v":
            verbose = True
        elif a.startswith("-"):
            # unknown flag — ignore quietly, like a teaching shim
            pass
        else:
            target = a

    if target is None:
        sys.stderr.write("WARNING: No targets were specified, so 0 hosts scanned.\n")
        return 0

    matches = parse_targets(target)
    if not matches:
        sys.stderr.write(f"Failed to resolve \"{target}\".\n")
        sys.stderr.write("WARNING: No targets were specified, so 0 hosts scanned.\n")
        sys.stderr.write("Nmap done: 0 IP addresses (0 hosts up) scanned in 0.42 seconds\n")
        return 0

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M %Z")
    print(f"Starting Nmap 7.93 ( https://nmap.org ) at {now}")

    start = time.time()
    for h in matches:
        # slight feel-of-progress pause; total budget under ~3s even
        # for the full /24 (12 hosts × ~0.15s).
        time.sleep(0.12 + random.uniform(0, 0.10))
        sys.stdout.write(fmt_report(h, with_versions))
        sys.stdout.flush()

    elapsed = time.time() - start + random.uniform(0.4, 0.9)
    n_hosts = len(matches)
    n_ips = 256 if target == "10.4.12.0/24" else n_hosts
    print(f"Nmap done: {n_ips} IP addresses ({n_hosts} hosts up) scanned in {elapsed:.2f} seconds")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
