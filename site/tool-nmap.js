// tool-nmap.js — fake nmap for phase 1. Shows a SMALL network (four
// hosts): three services a company deliberately exposes to the public
// internet, and one careless internal box. No auto-win — the player
// has to read the output and name the odd host themselves.
//
// Anti-brute-force: the leak's IP is randomized every layout, and a
// wrong guess reshuffles the whole /24 (see shell.js answer()), so you
// can't just try each IP in turn. The leak's HOSTNAME is stable and
// obviously-internal, so identifying it by reading always works.

(function () {
  "use strict";

  const R       = "\x1b[0m";
  const DIM     = "\x1b[2m";
  const BOLD    = "\x1b[1m";
  const CYAN_B  = "\x1b[1;36m";
  const GREEN_B = "\x1b[1;32m";
  const WHITE_B = "\x1b[1;37m";
  const GOLD_B  = "\x1b[1;33m";

  // Decoys: recognizable, public-by-design services. A layman can name
  // what each is for (website, email, store), which is what makes the
  // one weird host stand out.
  const PUBLIC_POOL = [
    ["www",    [[80,  "tcp", "http",  "nginx 1.24.0"],
                [443, "tcp", "https", "nginx 1.24.0"]]],
    ["mail",   [[25,  "tcp", "smtp",  "Postfix smtpd"],
                [993, "tcp", "imaps", "Dovecot imapd"]]],
    ["shop",   [[443, "tcp", "https", "nginx 1.24.0 (WooCommerce)"]]],
    ["store",  [[443, "tcp", "https", "nginx 1.24.0 (Shopify storefront)"]]],
    ["portal", [[443, "tcp", "https", "nginx 1.24.0 (customer login)"]]],
  ];

  // The leak: an old internal build box someone left exposed. The name
  // carries two tells a non-technical player can read -- "old" and
  // "internal" -- and it runs Jenkins on 8080, which phase 2 needs.
  const LEAK = {
    host:  "jenkins-old.internal.crazy.ants",
    short: "jenkins-old",
    ports: [[22,   "tcp", "ssh",  "OpenSSH 7.4p1 (protocol 2.0)"],
            [8080, "tcp", "http", "Jetty 9.4.27.v20200227 (Jenkins httpd 2.121.1)"]],
  };

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Distinct random last octets so no two hosts collide.
  function distinctOctets(n) {
    const seen = new Set();
    const out = [];
    while (out.length < n) {
      const o = randInt(2, 250);
      if (!seen.has(o)) { seen.add(o); out.push(o); }
    }
    return out;
  }

  // Build (or rebuild) the four-host layout onto state.phase1. Called at
  // shell start and again after every wrong guess.
  function generate(state) {
    const decoys = shuffle(PUBLIC_POOL).slice(0, 3);
    const octets = distinctOctets(4);
    const rows = [];
    decoys.forEach((d, i) => {
      rows.push([`10.4.12.${octets[i]}`, `${d[0]}.crazy.ants`, d[1]]);
    });
    const leakIp = `10.4.12.${octets[3]}`;
    rows.push([leakIp, LEAK.host, LEAK.ports]);

    state.phase1 = {
      rows:      shuffle(rows),
      leakIp:    leakIp,
      leakHost:  LEAK.host,
      leakShort: LEAK.short,
    };
    return state.phase1;
  }

  function ensure(state) {
    if (!state || !state.phase1) return generate(state || {});
    return state.phase1;
  }

  function help(io) {
    io.write(
      "Nmap 7.93 ( https://nmap.org )\r\n" +
      "Usage: nmap [Scan Type(s)] [Options] {target specification}\r\n" +
      "TARGET SPECIFICATION:\r\n" +
      "  Can pass hostnames, IP addresses, networks, etc.\r\n" +
      "  Ex: scanme.nmap.org, 10.4.12.0/24, 10.4.12.7\r\n" +
      "SERVICE/VERSION DETECTION:\r\n" +
      "  -sV:  Probe open ports to determine service/version info\r\n" +
      "OUTPUT:\r\n" +
      "  -v:   Increase verbosity level\r\n" +
      "NOTE:\r\n" +
      "  teaching shim; ranges: 10.4.12.0/24, individual 10.4.12.X, hostnames.\r\n"
    );
  }

  function pad(s, n) { return String(s).padEnd(n); }

  function fmtReport(row, withVersions) {
    const [ip, host, ports] = row;
    const lines = [];
    lines.push(`${WHITE_B}Nmap scan report for ${host} (${ip})${R}`);
    const latency = rand(0.000040, 0.000220).toFixed(6);
    lines.push(`${DIM}Host is up (${latency}s latency).${R}`);
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

  // Resolve a target string to matching rows in the current layout.
  function parseTargets(p1, arg) {
    if (arg === "10.4.12.0/24" || arg === "10.4.12.*") return p1.rows.slice();
    for (const row of p1.rows) if (row[0] === arg) return [row];
    for (const row of p1.rows) {
      const host = row[1];
      if (host === arg || host.split(".", 1)[0] === arg) return [row];
    }
    return [];
  }

  async function run(io, args, ctx) {
    if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
      help(io);
      return;
    }

    const state = (ctx && ctx.state) || {};
    const p1 = ensure(state);

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

    const matches = parseTargets(p1, target);
    const now = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    io.write(`Starting Nmap 7.93 ( https://nmap.org ) at ${now}\r\n`);

    if (matches.length === 0) {
      // A specific address that isn't currently leased. Realistic miss,
      // and a quiet reminder the addresses move around.
      io.write(`Note: Host seems down. If it is really up, it may be blocking pings.\r\n`);
      io.write(`Nmap done: 1 IP address (0 hosts up) scanned in ${rand(0.4, 0.9).toFixed(2)} seconds\r\n`);
      return;
    }

    const start = Date.now();
    for (const row of matches) {
      await io.sleep(180 + Math.random() * 160);
      io.write(fmtReport(row, withVersions));
    }
    const elapsed = (Date.now() - start) / 1000 + rand(0.4, 0.9);
    const nHosts = matches.length;
    const nIps = (target === "10.4.12.0/24" || target === "10.4.12.*") ? 256 : nHosts;
    io.write(`Nmap done: ${nIps} IP addresses (${nHosts} hosts up) scanned in ${elapsed.toFixed(2)} seconds\r\n`);

    // No auto-submit. If they scanned the whole subnet, nudge toward the
    // reasoning without naming the answer.
    if (nHosts > 1) {
      io.write(`\r\n${GOLD_B}${nHosts} hosts are up.${R} Most are things a company puts on the public\r\n`);
      io.write(`internet on purpose. One of them is not. Read the names.\r\n\r\n`);
      io.write(`When you spot the host that was never meant for outsiders, type\r\n`);
      io.write(`its ${WHITE_B}IP${R} or ${WHITE_B}hostname${R} at the prompt and press Enter. ${DIM}(cat hint if stuck)${R}\r\n`);
    }
  }

  window.M0useNmap = { run, generate, ensure };
})();
