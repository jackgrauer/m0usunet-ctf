// tool-nmap.js — port of build/fake-nmap.py. Canned output that
// walks the player to the jenkins-old leak on 10.4.12.88. No real
// network; output is generated from a static host table. The leak
// is a forward/reverse DNS mismatch on one host — same pattern real
// nmap prints when fwd/rev disagree.

(function () {
  "use strict";

  const R       = "\x1b[0m";
  const DIM     = "\x1b[2m";
  const BOLD    = "\x1b[1m";
  const CYAN_B  = "\x1b[1;36m";
  const GREEN_B = "\x1b[1;32m";
  const WHITE_B = "\x1b[1;37m";
  const YELLOW  = "\x1b[0;33m";
  const GOLD_B  = "\x1b[1;33m";

  const HOSTS = [
    ["10.4.12.1",  "gw.crazy.ants",  null, [
      [22,   "tcp", "ssh",   "OpenSSH 8.9p1 Ubuntu 3ubuntu0.11 (Ubuntu Linux; protocol 2.0)"],
      [80,   "tcp", "http",  "nginx 1.22.1"],
      [443,  "tcp", "https", "nginx 1.22.1"],
      [8080, "tcp", "http",  "Jetty 9.4.27.v20200227 (Jenkins httpd 2.121.1)"],
    ]],
    ["10.4.12.10", "mail.crazy.ants", null, [
      [22,  "tcp", "ssh",   "OpenSSH 8.4p1 Debian 5+deb11u3 (protocol 2.0)"],
      [25,  "tcp", "smtp",  "Postfix smtpd"],
      [465, "tcp", "smtps", "Postfix smtpd"],
      [993, "tcp", "imaps", "Dovecot imapd"],
    ]],
    ["10.4.12.20", "www.crazy.ants", null, [
      [80,  "tcp", "http",  "nginx 1.24.0"],
      [443, "tcp", "https", "nginx 1.24.0"],
    ]],
    ["10.4.12.21", "api.crazy.ants", null, [
      [8443, "tcp", "https", "Kestrel httpd (.NET 7.0)"],
    ]],
    ["10.4.12.30", "db-01.crazy.ants", null, [
      [22,   "tcp", "ssh",        "OpenSSH 8.9p1 (protocol 2.0)"],
      [5432, "tcp", "postgresql", "PostgreSQL DB 15.2"],
    ]],
    ["10.4.12.31", "db-02.crazy.ants", null, [
      [22,   "tcp", "ssh",        "OpenSSH 8.9p1 (protocol 2.0)"],
      [5432, "tcp", "postgresql", "PostgreSQL DB 15.2"],
    ]],
    ["10.4.12.40", "redis.crazy.ants", null, [
      [22,   "tcp", "ssh",   "OpenSSH 8.9p1 (protocol 2.0)"],
      [6379, "tcp", "redis", "Redis key-value store 7.0.11"],
    ]],
    ["10.4.12.50", "vpn.crazy.ants", null, [
      [443, "tcp", "https",   "OpenVPN"],
      [943, "tcp", "openvpn", "OpenVPN Access Server admin UI"],
    ]],
    ["10.4.12.70", "ci.crazy.ants", null, [
      [22,  "tcp", "ssh",   "OpenSSH 9.3p1 (protocol 2.0)"],
      [80,  "tcp", "http",  "Caddy httpd (Drone CI)"],
      [443, "tcp", "https", "Caddy httpd (Drone CI)"],
    ]],
    ["10.4.12.80", "grafana.crazy.ants", null, [
      [3000, "tcp", "http", "nginx (Grafana 9.5.2)"],
    ]],
    // The leak: fwd DNS = legacy-build-03, rDNS = jenkins-old.internal.
    ["10.4.12.88", "legacy-build-03.crazy.ants",
                   "jenkins-old.internal.crazy.ants", [
      [22, "tcp", "ssh", "OpenSSH 7.4p1 (protocol 2.0)"],
    ]],
    ["10.4.12.99", "assets.crazy.ants", null, [
      [443, "tcp", "https", "nginx 1.24.0"],
    ]],
  ];

  function help(io) {
    io.write(
      "Nmap 7.93 ( https://nmap.org )\r\n" +
      "Usage: nmap [Scan Type(s)] [Options] {target specification}\r\n" +
      "TARGET SPECIFICATION:\r\n" +
      "  Can pass hostnames, IP addresses, networks, etc.\r\n" +
      "  Ex: scanme.nmap.org, microsoft.com/24, 192.168.0.1; 10.0.0-255.1-254\r\n" +
      "SCAN TECHNIQUES:\r\n" +
      "  -sS/sT: TCP SYN / TCP connect() scan\r\n" +
      "  -sU:    UDP scan\r\n" +
      "  -sn:    No port scan (ping sweep)\r\n" +
      "PORT SPECIFICATION:\r\n" +
      "  -p <ranges>:  Only scan specified ports. Ex: -p22; -p1-65535\r\n" +
      "  -F:           Fast mode - scan fewer ports than default\r\n" +
      "SERVICE/VERSION DETECTION:\r\n" +
      "  -sV:  Probe open ports to determine service/version info\r\n" +
      "  -A:   Enable OS detection, version detection, script scanning\r\n" +
      "OUTPUT:\r\n" +
      "  -v:   Increase verbosity level\r\n" +
      "  -oN <file>: Output normal scan results to file\r\n" +
      "SEE ALSO:\r\n" +
      "  this is a teaching shim; only a handful of flags are honored.\r\n" +
      "  ranges supported: 10.4.12.0/24, individual 10.4.12.X, hostnames.\r\n"
    );
  }

  function parseTargets(arg) {
    if (arg === "10.4.12.0/24") return HOSTS.slice();
    for (const h of HOSTS) if (h[0] === arg) return [h];
    for (const h of HOSTS) {
      if (h[1] === arg || h[1].split(".", 1)[0] === arg) return [h];
    }
    return [];
  }

  function pad(s, n) { return String(s).padEnd(n); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function fmtReport(host, withVersions) {
    const [ip, fwd, rdns, ports] = host;
    const lines = [];
    lines.push(`${WHITE_B}Nmap scan report for ${fwd} (${ip})${R}`);
    const latency = rand(0.000040, 0.000220).toFixed(6);
    lines.push(`${DIM}Host is up (${latency}s latency).${R}`);
    if (rdns) lines.push(`${YELLOW}rDNS record for ${ip}: ${rdns}${R}`);
    const closed = 1000 - ports.length;
    lines.push(`${DIM}Not shown: ${closed} closed tcp ports (conn-refused)${R}`);
    if (withVersions) lines.push(`${DIM}PORT     STATE SERVICE     VERSION${R}`);
    else              lines.push(`${DIM}PORT     STATE SERVICE${R}`);
    for (const [port, proto, service, version] of ports) {
      const head = pad(`${port}/${proto}`, 9);
      if (withVersions) {
        lines.push(`${BOLD}${head}${R}${GREEN_B}open${R}  ${CYAN_B}${pad(service, 11)}${R} ${DIM}${version}${R}`);
      } else {
        lines.push(`${BOLD}${head}${R}${GREEN_B}open${R}  ${CYAN_B}${service}${R}`);
      }
    }
    lines.push("");
    return lines.join("\r\n") + "\r\n";
  }

  async function run(io, args) {
    if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
      help(io);
      return;
    }

    let withVersions = false;
    let target = null;
    for (const a of args) {
      if (a === "-sV" || a === "-A") withVersions = true;
      else if (a === "-v") { /* verbose ignored */ }
      else if (a.startsWith("-")) { /* unknown flag swallowed */ }
      else target = a;
    }

    if (target === null) {
      io.write("WARNING: No targets were specified, so 0 hosts scanned.\r\n");
      return;
    }

    const matches = parseTargets(target);
    if (matches.length === 0) {
      io.write(`Failed to resolve "${target}".\r\n`);
      io.write("WARNING: No targets were specified, so 0 hosts scanned.\r\n");
      io.write("Nmap done: 0 IP addresses (0 hosts up) scanned in 0.42 seconds\r\n");
      return;
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    io.write(`Starting Nmap 7.93 ( https://nmap.org ) at ${now}\r\n`);

    const start = Date.now();
    for (const h of matches) {
      await io.sleep(120 + Math.random() * 100);
      io.write(fmtReport(h, withVersions));
    }
    const elapsed = (Date.now() - start) / 1000 + rand(0.4, 0.9);
    const nHosts = matches.length;
    const nIps = target === "10.4.12.0/24" ? 256 : nHosts;
    io.write(`Nmap done: ${nIps} IP addresses (${nHosts} hosts up) scanned in ${elapsed.toFixed(2)} seconds\r\n`);

    // Show the submit hint whenever a scanned host has the rDNS
    // mismatch (i.e. the phase-1 leak is now visible on screen),
    // not just on the full /24 sweep. A player who scans the single
    // target box and sees jenkins-old.internal in the rDNS line
    // needs to know they can type the finding to advance.
    const sawLeak = matches.some(h => h[2] !== null);
    if (sawLeak) {
      io.write(`\r\n${GOLD_B}TO ADVANCE:${R} just type the IP address or hostname at the prompt\r\n`);
      io.write(`and hit Enter. That's it. Examples:\r\n\r\n`);
      io.write(`  ${WHITE_B}10.4.12.88${R}\r\n`);
      io.write(`  ${WHITE_B}jenkins-old${R}\r\n`);
      io.write(`  ${WHITE_B}legacy-build-03${R}\r\n\r\n`);
    }
  }

  window.M0useNmap = { run };
})();
