#!/usr/bin/env python3
# fake-nikto — canned scanner output that fingerprints the target as
# Jenkins 2.121.1. Only the version-identifier line matters for the
# game; everything else is realistic noise to teach the player how to
# skim past it.

import random
import sys
import time
from datetime import datetime, timezone


def usage():
    sys.stdout.write(
        "- Nikto v2.1.6\n"
        "       Option host requires an argument\n\n"
        "       -config+            Use this config file\n"
        "       -Display+           Turn on/off display outputs\n"
        "       -dbcheck            Check database and other key files for syntax errors\n"
        "       -Format+            Save file (-o) format\n"
        "       -Help               Extended help information\n"
        "       -host+              Target host\n"
        "       -output+            Write output to this file\n"
        "       -port+              Port to use (default 80)\n"
        "       -ssl                Force ssl mode on port\n"
        "       -Tuning+            Scan tuning\n"
        "       -update             Update databases and plugins from CIRT.net\n"
        "       -Version            Print plugin and database versions\n"
        "       -vhost+             Virtual host (for Host header)\n"
        "       + requires a value\n\n"
        "       Note: This is the short help output. Use -H for full help.\n"
    )


# (re)assemble a deterministic, noisy fingerprint for the Jenkins gateway.
def report(host_arg, ip, port):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    started = now
    sys.stdout.write(
        "- Nikto v2.1.6\n"
        "---------------------------------------------------------------------------\n"
        f"+ Target IP:          {ip}\n"
        f"+ Target Hostname:    {host_arg}\n"
        f"+ Target Port:        {port}\n"
        f"+ Start Time:         {started}\n"
        "---------------------------------------------------------------------------\n"
        "+ Server: Jetty(9.4.27.v20200227)\n"
        "+ Retrieved x-jenkins header: 2.121.1\n"
        "+ Retrieved x-hudson header: 1.395\n"
        "+ Retrieved x-jenkins-session header: 0b0a9c12\n"
        "+ The anti-clickjacking X-Frame-Options header is not present.\n"
        "+ The X-XSS-Protection header is not defined. This header can hint to the user agent to protect against some forms of XSS\n"
        "+ Uncommon header 'x-content-type-options' found, with contents: nosniff\n"
        "+ Uncommon header 'x-hudson-cli-port' found, with contents: 50000\n"
        "+ Uncommon header 'x-jenkins-cli-port' found, with contents: 50000\n"
        "+ Uncommon header 'x-jenkins-cli2-port' found, with contents: 50000\n"
        "+ Uncommon header 'x-permitted-cross-domain-policies' found, with contents: master-only\n"
        "+ Cookie JSESSIONID.ee9a9c3b created without the httponly flag\n"
        "+ Allowed HTTP Methods: GET, HEAD, POST, OPTIONS\n"
        "+ /jenkins/login: Jenkins login page detected.\n"
        "+ /jenkins/script/: Jenkins script console may be accessible (auth required).\n"
        "+ /jenkins/cli/: Jenkins CLI endpoint detected.\n"
        "+ /jenkins/manage/: Admin/management page detected.\n"
        "+ /jenkins/whoAmI/: Reveals current user (anonymous if unauthenticated).\n"
        "+ /jenkins/asynchPeople/: Lists Jenkins users.\n"
        "+ OSVDB-3092: /jenkins/secured/: This might be interesting...\n"
        "+ OSVDB-3268: /icons/: Directory indexing found.\n"
        "+ 7916 requests: 0 error(s) and 21 item(s) reported on remote host\n"
        f"+ End Time:           {now} (24 seconds)\n"
        "---------------------------------------------------------------------------\n"
        "+ 1 host(s) tested\n"
    )


def main(argv):
    args = argv[1:]
    if not args:
        usage()
        return 1

    host = None
    port = "80"
    # accept -h, --host, -host (real nikto uses -host)
    i = 0
    while i < len(args):
        a = args[i]
        if a in ("-h", "-host", "--host"):
            i += 1
            if i < len(args):
                host = args[i]
        elif a in ("-p", "-port", "--port"):
            i += 1
            if i < len(args):
                port = args[i]
        elif a in ("--help", "-H"):
            usage(); return 0
        elif not a.startswith("-") and host is None:
            host = a
        i += 1

    if host is None:
        usage()
        return 1

    # Pull ip:port from a URL-shaped host argument.
    raw = host
    if "://" in raw:
        raw = raw.split("://", 1)[1]
    if "/" in raw:
        raw = raw.split("/", 1)[0]
    if ":" in raw:
        raw_ip, raw_port = raw.split(":", 1)
        port = raw_port
    else:
        raw_ip = raw

    sys.stdout.flush()
    # ~3-5s of "scanning" feel.
    time.sleep(0.6 + random.uniform(0, 0.4))
    report(host, raw_ip, port)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
