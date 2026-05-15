// tool-nikto.js — port of build/fake-nikto.py. Canned web-scan
// output that fingerprints the target as Jenkins 2.121.1. The
// version-identifier line is the only one that matters for the
// game; everything else is realistic noise to teach the player
// how to skim past it.

(function () {
  "use strict";

  function usage(io) {
    io.write(
      "- Nikto v2.1.6\r\n" +
      "       Option host requires an argument\r\n\r\n" +
      "       -config+            Use this config file\r\n" +
      "       -Display+           Turn on/off display outputs\r\n" +
      "       -dbcheck            Check database and other key files for syntax errors\r\n" +
      "       -Format+            Save file (-o) format\r\n" +
      "       -Help               Extended help information\r\n" +
      "       -host+              Target host\r\n" +
      "       -output+            Write output to this file\r\n" +
      "       -port+              Port to use (default 80)\r\n" +
      "       -ssl                Force ssl mode on port\r\n" +
      "       -Tuning+            Scan tuning\r\n" +
      "       -update             Update databases and plugins from CIRT.net\r\n" +
      "       -Version            Print plugin and database versions\r\n" +
      "       -vhost+             Virtual host (for Host header)\r\n" +
      "       + requires a value\r\n\r\n" +
      "       Note: This is the short help output. Use -H for full help.\r\n"
    );
  }

  function report(io, hostArg, ip, port) {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const lines = [
      "- Nikto v2.1.6",
      "---------------------------------------------------------------------------",
      `+ Target IP:          ${ip}`,
      `+ Target Hostname:    ${hostArg}`,
      `+ Target Port:        ${port}`,
      `+ Start Time:         ${now}`,
      "---------------------------------------------------------------------------",
      "+ Server: Jetty(9.4.27.v20200227)",
      "+ Retrieved x-jenkins header: 2.121.1",
      "+ Retrieved x-hudson header: 1.395",
      "+ Retrieved x-jenkins-session header: 0b0a9c12",
      "+ The anti-clickjacking X-Frame-Options header is not present.",
      "+ The X-XSS-Protection header is not defined. This header can hint to the user agent to protect against some forms of XSS",
      "+ Uncommon header 'x-content-type-options' found, with contents: nosniff",
      "+ Uncommon header 'x-hudson-cli-port' found, with contents: 50000",
      "+ Uncommon header 'x-jenkins-cli-port' found, with contents: 50000",
      "+ Uncommon header 'x-jenkins-cli2-port' found, with contents: 50000",
      "+ Uncommon header 'x-permitted-cross-domain-policies' found, with contents: master-only",
      "+ Cookie JSESSIONID.ee9a9c3b created without the httponly flag",
      "+ Allowed HTTP Methods: GET, HEAD, POST, OPTIONS",
      "+ /jenkins/login: Jenkins login page detected.",
      "+ /jenkins/script/: Jenkins script console may be accessible (auth required).",
      "+ /jenkins/cli/: Jenkins CLI endpoint detected.",
      "+ /jenkins/manage/: Admin/management page detected.",
      "+ /jenkins/whoAmI/: Reveals current user (anonymous if unauthenticated).",
      "+ /jenkins/asynchPeople/: Lists Jenkins users.",
      "+ OSVDB-3092: /jenkins/secured/: This might be interesting...",
      "+ OSVDB-3268: /icons/: Directory indexing found.",
      "+ 7916 requests: 0 error(s) and 21 item(s) reported on remote host",
      `+ End Time:           ${now} (24 seconds)`,
      "---------------------------------------------------------------------------",
      "+ 1 host(s) tested",
      "",
      "\x1b[1;33mNEXT:\x1b[0m nikto reports the software + version. To find a CVE that fits this version,",
      "open the advisories table:",
      "",
      "  \x1b[1;36mcat advisories\x1b[0m",
      "",
      "Then type the matching CVE id at the prompt to advance.",
    ];
    io.write(lines.join("\r\n") + "\r\n");
  }

  async function run(io, args) {
    if (args.length === 0) { usage(io); return; }

    let host = null;
    let port = "80";
    let i = 0;
    while (i < args.length) {
      const a = args[i];
      if (a === "-h" || a === "-host" || a === "--host") {
        i++;
        if (i < args.length) host = args[i];
      } else if (a === "-p" || a === "-port" || a === "--port") {
        i++;
        if (i < args.length) port = args[i];
      } else if (a === "--help" || a === "-H") {
        usage(io); return;
      } else if (!a.startsWith("-") && host === null) {
        host = a;
      }
      i++;
    }

    if (host === null) { usage(io); return; }

    let raw = host;
    if (raw.includes("://")) raw = raw.split("://", 2)[1];
    if (raw.includes("/"))   raw = raw.split("/", 1)[0];
    let rawIp;
    if (raw.includes(":")) {
      const parts = raw.split(":", 2);
      rawIp = parts[0]; port = parts[1];
    } else {
      rawIp = raw;
    }

    await io.sleep(600 + Math.random() * 400);
    report(io, host, rawIp, port);
  }

  window.M0useNikto = { run };
})();
