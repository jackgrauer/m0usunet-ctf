// tool-msfconsole.js — port of build/fake-msfconsole.py. The full
// metasploit shim: REPL with search/use/show/set/check/exploit, a
// session sub-REPL, and the IC memo gated payoff that auto-submits
// the flag and cascades out of the tool.
//
// Player flow: msfconsole → set RHOSTS jenkins-old.internal.crazy.ants → exploit
//                        → cat /mnt/exec/ic-memo.txt
//                        → press Enter through three screens
//                        → back at the m0usunet prompt, phase 3 done.

(function () {
  "use strict";

  const R       = "\x1b[0m";
  const DIM     = "\x1b[2m";
  const BOLD    = "\x1b[1m";
  const RED_B   = "\x1b[1;31m";
  const GREEN_B = "\x1b[1;32m";
  const GOLD_B  = "\x1b[1;33m";
  const CYAN_B  = "\x1b[1;36m";
  const WHITE_B = "\x1b[1;37m";

  const MODULE = {
    path: "exploit/multi/http/jenkins_metaprogramming",
    name: "Jenkins ACL Bypass and Metaprogramming RCE",
    disclosed: "2019-01-08",
    rank: "excellent",
    description:
      "Jenkins Stapler URL router accepts unauthenticated invocations of" +
      " arbitrary methods on internal objects, including the Groovy" +
      " script console. Yields RCE on Jenkins 2.138 / LTS 2.121.1" +
      " and earlier.",
    cves: ["CVE-2018-1000861"],
    target_versions: "Jenkins ≤ 2.138 / LTS ≤ 2.121.1",
    payload: "generic/shell_reverse_tcp",
  };

  function freshOptions() {
    return {
      RHOSTS:    { value: "",     required: true,  desc: "The target host(s)" },
      RPORT:     { value: "8080", required: true,  desc: "The target port (TCP)" },
      SSL:       { value: "false",required: false, desc: "Negotiate SSL/TLS" },
      TARGETURI: { value: "/",    required: true,  desc: "The application URI" },
      VHOST:     { value: "",     required: false, desc: "HTTP server virtual host" },
      PROXIES:   { value: "",     required: false, desc: "Proxy chain" },
      LHOST:     { value: "",     required: true,  desc: "The listen address" },
      LPORT:     { value: "4444", required: true,  desc: "The listen port" },
    };
  }

  const VALID_RHOSTS = new Set([
    "10.4.12.1", "gw.crazy.ants",
    "10.4.12.88", "jenkins-old.internal.crazy.ants",
    "legacy-build-03.crazy.ants",
  ]);

  // ── post-exploit payoff screens ────────────────────────────────────
  const YOU_IN_BANNER =
`
${GREEN_B}═══════════════════════════════════════════════════════════════════${R}
${GREEN_B}  YOU'RE IN.${R}
${GREEN_B}═══════════════════════════════════════════════════════════════════${R}

  The Jenkins box has a fileshare mounted from the executive
  network. Sitting on top of it: an Investment Committee memo for
  an operation they call ${GOLD_B}OPERATION PARMESAN ROSE${R}.

  Reading...
`;

  const IC_MEMO =
`
═══════════════════════════════════════════════════════════════════
${RED_B}CRAZY ANTS — FRAGRANCE COMPOUNDER SUBSIDIARY${R}
${DIM}INTERNAL DOCUMENT — DO NOT DISTRIBUTE${R}
═══════════════════════════════════════════════════════════════════

Project:           FY Q3 2026 — Hotel Fragrances Roll-up
Status:            ${GREEN_B}ACTIVE${R}
Authorized by:     Pemberton (Acting CFO)
Filed:             2026-04-18

Subsidiaries acquired (Q1-Q2 2026):
  • Aunt Mary's Candle Loft (Trenton, NJ)
  • Bayard St. Botanicals (Philadelphia, PA)
  • Hollow Reed Co. (Newark, NJ)
  • Pine Box Apothecary (Camden, NJ)
  • Linden & Yew Soaperie (Allentown, PA)

Target chains (Q3 2026):
  • 71x Yankee Candle mall kiosks (negotiations open)
  • Bath & Body Works hotel-amenity contracts (term sheet draft)
  • 14 independent crafters across Mischief City (LoI signed)

Cover branding to retain at point-of-sale:
  "SAME ARTISAN QUALITY, NEW OWNERSHIP"

Master compounding formula (proprietary):
  Base:   ethanolamine + isothiazolinone (industrial)
  Top:    synthetic rose accord, fougère undertones
  Note:   undisclosed phthalate carrier (cost optimization)

Regulatory status: pending OSHA review on contract facilities.
SDS sheets withheld at counsel's direction.
`;

  const SIGNIFICANCE =
`
${GOLD_B}WHAT YOU JUST READ${R}
${DIM}──────────────────${R}

  That's the deck. The Ants are quietly buying every artisan
  candle and soap brand in the corridor, swapping the actual
  formulas for industrial ethanolamine and an undisclosed
  phthalate carrier, and shipping under the original boutique
  labels.

  "SAME ARTISAN QUALITY, NEW OWNERSHIP" isn't marketing. It's
  the substitution disclosure, buried in point-of-sale language
  nobody reads.

  The respiratory clusters at the urgent-care clinics aren't a
  coincidence. They're the cost optimization.

  This is what the back-office Jenkins box was for. Now Mouse
  Bites Inc. has it.
`;

  const DEBRIEF =
`
${GOLD_B}OPERATION PARMESAN ROSE — DEBRIEF${R}
${GREEN_B}═════════════════════════════════${R}
${DIM}How Mouse Bites took the contra side:${R}

  • Choke point: every Ants fragrance SKU ships in wicker.
  • We cornered the wicker float — five producers, Lancaster
    to Doylestown, three weeks. Long every basket weaver in
    the corridor.
  • Pulled the bid. No street inventory left.
  • Ants now sitting on ${WHITE_B}50 tons of phthalate potpourri${R} at
    the Camden warehouse, no packaging exit. Working capital
    frozen.
  • Bid/ask collapsed. Mark to market: zero. They're holding
    the bag.

  Distribution arb dead. We squeezed it through supply.

  The Editor has the FOIA package and a list of the candle
  brands that are actually still candles. Press goes Friday.

  Your part is done.
`;

  // ── helpers ────────────────────────────────────────────────────────

  function asTermLines(s) {
    // Convert \n to \r\n for raw terminal writes.
    return s.replace(/\n/g, "\r\n");
  }

  async function showPayoff(io) {
    io.write(asTermLines(YOU_IN_BANNER));
    await io.sleep(400);
    io.write(asTermLines(IC_MEMO));
    io.write(`\r\n  ${DIM}Press ${WHITE_B}Enter${R}${DIM} for the situation analysis.${R}`);
    await io.waitEnter();
    io.write(asTermLines(SIGNIFICANCE));
    io.write(`\r\n  ${DIM}Press ${WHITE_B}Enter${R}${DIM} for the Mouse Bites debrief.${R}`);
    await io.waitEnter();
    io.write(asTermLines(DEBRIEF));
    io.write(`\r\n  ${DIM}Press ${WHITE_B}Enter${R}${DIM} to leave m0usunet.${R}`);
    await io.waitEnter();
  }

  function banner(io) {
    io.write(asTermLines(`
${DIM}       =[ metasploit v6.3.55-dev                          ]${R}
${DIM}+ -- --=[ 2367 exploits - 1218 auxiliary - 413 post       ]${R}
${DIM}+ -- --=[ 1442 payloads - 47 encoders - 11 nops           ]${R}
${DIM}+ -- --=[ 9 evasion                                       ]${R}

${DIM}Metasploit tip: Use ${WHITE_B}sessions${R}${DIM} to list active sessions${R}
${DIM}Metasploit Documentation: ${WHITE_B}https://docs.metasploit.com/${R}

`));
  }

  function prompt(state) {
    if (state.session) return "";
    if (state.module) {
      return `${RED_B}msf6${R} ${BOLD}exploit(${CYAN_B}multi/http/jenkins_metaprogramming${R}${BOLD})${R} > `;
    }
    return `${RED_B}msf6${R} > `;
  }

  function helpCard(io) {
    io.write(asTermLines(`
Core Commands
=============
    help                  Show this help (this card)
    banner                Display the metasploit banner
    search <term>         Look up modules by keyword (e.g. CVE id, software)
    use <module>          Select a module by path or by search-result index
    back                  Move back from the current context
    info                  Display info about the selected module
    show options          Show options for the current module
    show payloads         Show compatible payloads
    set <opt> <value>     Set an option
    unset <opt>           Clear an option
    check                 Probe the target without exploiting
    exploit | run         Launch the exploit against the configured target
    sessions              List active sessions
    exit | quit           Leave msfconsole
`));
  }

  // ── command handlers ───────────────────────────────────────────────

  function doSearch(io, state, args) {
    const q = args.join(" ").trim().toLowerCase();
    if (!q) { io.write("[-] usage: search <term>\r\n"); return; }
    let hit = false;
    if (MODULE.cves.some(c => q.includes(c.toLowerCase()))
        || q.includes("jenkins") || q.includes("stapler")
        || q.includes("metaprogramming") || q.includes("1000861")) {
      hit = true;
    }
    if (!hit) { io.write(`\r\nNo results from search for: ${q}\r\n\r\n`); return; }
    io.write(asTermLines(`
Matching Modules
================
   ${BOLD}#  Name                                                  Disclosure   Rank       Description${R}
   -  ----                                                  ----------   ----       -----------
   0  ${CYAN_B}${MODULE.path}${R}    ${MODULE.disclosed}   ${GREEN_B}${MODULE.rank}${R}  ${MODULE.name}

`));
  }

  function doUse(io, state, args) {
    if (!args.length) { io.write("[-] usage: use <module-path-or-index>\r\n"); return; }
    const arg = args[0];
    if (arg === "0" || arg === MODULE.path || arg.endsWith("jenkins_metaprogramming")) {
      state.module = MODULE;
      state.options = freshOptions();
      io.write(`[*] Using configured payload ${WHITE_B}${MODULE.payload}${R}\r\n`);
    } else {
      io.write(`[-] Failed to load module: ${arg}\r\n`);
    }
  }

  function doInfo(io, state) {
    if (!state.module) { io.write("[-] No module selected (use one first).\r\n"); return; }
    const m = state.module;
    io.write(asTermLines(`
       Name: ${m.name}
     Module: ${m.path}
   Platform: Unix
       Arch: cmd
       Rank: ${m.rank}
  Disclosed: ${m.disclosed}

  CVE: ${m.cves.join(", ")}

  Description:
    ${m.description}

  Targets:
    ${m.target_versions}

`));
  }

  function pad(s, n) { return String(s).padEnd(n); }

  function doShow(io, state, args) {
    if (!args.length) { io.write("[-] usage: show options | show payloads\r\n"); return; }
    const what = args[0].toLowerCase();
    if (what === "options") {
      if (!state.module) { io.write("[-] No module selected.\r\n"); return; }
      io.write(`\r\nModule options (${CYAN_B}${state.module.path}${R}):\r\n\r\n`);
      io.write(`   ${BOLD}Name       Current Setting  Required  Description${R}\r\n`);
      io.write(`   ----       ---------------  --------  -----------\r\n`);
      for (const k of ["PROXIES", "RHOSTS", "RPORT", "SSL", "TARGETURI", "VHOST"]) {
        const o = state.options[k];
        io.write(`   ${pad(k, 10)} ${pad(o.value || "", 16)} ${pad(o.required ? "yes" : "no", 9)} ${o.desc}\r\n`);
      }
      io.write(`\r\nPayload options (${CYAN_B}${state.module.payload}${R}):\r\n\r\n`);
      io.write(`   ${BOLD}Name   Current Setting  Required  Description${R}\r\n`);
      io.write(`   ----   ---------------  --------  -----------\r\n`);
      for (const k of ["LHOST", "LPORT"]) {
        const o = state.options[k];
        io.write(`   ${pad(k, 6)} ${pad(o.value || "", 16)} ${pad(o.required ? "yes" : "no", 9)} ${o.desc}\r\n`);
      }
      io.write(`\r\nExploit target:\r\n\r\n   Id  Name\r\n   --  ----\r\n   0   Unix In-Memory\r\n\r\n`);
    } else if (what === "payloads") {
      io.write(asTermLines(`
Compatible Payloads
===================
   #   Name                                  Description
   -   ----                                  -----------
   0   ${CYAN_B}generic/shell_reverse_tcp${R}    Connect back and spawn a command shell (default)
   1   cmd/unix/reverse_bash                 Bash one-liner reverse shell
   2   cmd/unix/reverse_python               Python reverse shell

`));
    } else {
      io.write(`[-] show: don't know about '${what}'\r\n`);
    }
  }

  function doSet(io, state, args) {
    if (args.length < 2) { io.write("[-] usage: set <option> <value>\r\n"); return; }
    if (!state.module)   { io.write("[-] No module selected.\r\n"); return; }
    const opt = args[0].toUpperCase();
    const val = args.slice(1).join(" ");
    if (!(opt in state.options)) { io.write(`[-] Unknown option: ${opt}\r\n`); return; }
    state.options[opt].value = val;
    io.write(`${opt} => ${val}\r\n`);
  }

  function doUnset(io, state, args) {
    if (!args.length)    { io.write("[-] usage: unset <option>\r\n"); return; }
    if (!state.module)   { io.write("[-] No module selected.\r\n"); return; }
    const opt = args[0].toUpperCase();
    if (opt in state.options) {
      const defaults = freshOptions();
      state.options[opt].value = defaults[opt].value;
      io.write(`Unsetting ${opt}...\r\n`);
    }
  }

  function requiredUnset(state) {
    const out = [];
    for (const [k, o] of Object.entries(state.options)) {
      if (o.required && !o.value) out.push(k);
    }
    return out;
  }

  function targetIsReal(rhost) { return VALID_RHOSTS.has(rhost); }

  // Player-friendly nudge when RHOSTS is set to something that won't
  // work (e.g. a stale/roamed IP). Points them at the stable hostname,
  // which is always a valid target.
  function suggestRhostFix(rhost) {
    return `    ${GOLD_B}[!]${R} ${DIM}that target isn't answering. Aim at the Jenkins box${R}\r\n` +
           `    ${DIM}by name:${R}  ${CYAN_B}set RHOSTS jenkins-old.internal.crazy.ants${R}\r\n`;
  }

  async function doCheck(io, state) {
    if (!state.module) { io.write("[-] No module selected.\r\n"); return; }
    const missing = requiredUnset(state);
    if (missing.includes("RHOSTS")) {
      io.write(`[-] ${RED_B}RHOSTS not set.${R} Try: set RHOSTS jenkins-old.internal.crazy.ants\r\n`);
      return;
    }
    const rhost = state.options.RHOSTS.value;
    const rport = state.options.RPORT.value;
    if (!targetIsReal(rhost)) {
      io.write(`[*] ${rhost}:${rport} - Sending check request\r\n`);
      await io.sleep(600);
      io.write(`[-] ${rhost}:${rport} - ${RED_B}Connection refused${R}.\r\n`);
      io.write(suggestRhostFix(rhost));
      return;
    }
    io.write(`[*] ${rhost}:${rport} - Sending check request\r\n`);
    await io.sleep(500);
    io.write(`[+] ${rhost}:${rport} - ${GREEN_B}The target is vulnerable.${R} Jenkins 2.121.1 detected.\r\n`);
  }

  async function doExploit(io, state) {
    if (!state.module) {
      io.write("[-] No module selected (use exploit/multi/http/jenkins_metaprogramming).\r\n");
      return;
    }
    const missing = requiredUnset(state);
    if (missing.length) {
      io.write(`[-] ${RED_B}Missing required options:${R} ${missing.join(", ")}\r\n`);
      if (missing.includes("RHOSTS")) io.write("    Try: set RHOSTS jenkins-old.internal.crazy.ants\r\n");
      if (missing.includes("LHOST"))  io.write("    Try: set LHOST 10.4.12.99   (your callback address)\r\n");
      return;
    }
    const rhost = state.options.RHOSTS.value;
    const rport = state.options.RPORT.value;
    const lhost = state.options.LHOST.value;
    const lport = state.options.LPORT.value;
    if (!targetIsReal(rhost)) {
      io.write(`[*] Started reverse TCP handler on ${lhost}:${lport}\r\n`);
      await io.sleep(500);
      io.write(`[-] ${rhost}:${rport} - ${RED_B}Exploit failed:${R} target not reachable.\r\n`);
      io.write(`[*] Exploit completed, but no session was created.\r\n`);
      io.write(suggestRhostFix(rhost));
      return;
    }
    io.write(`[*] Started reverse TCP handler on ${lhost}:${lport}\r\n`);
    await io.sleep(400);
    io.write(`[*] Running automatic check ("set AutoCheck false" to disable)\r\n`);
    await io.sleep(400);
    io.write(`[+] ${rhost}:${rport} - ${GREEN_B}The target is vulnerable.${R} Jenkins 2.121.1 detected.\r\n`);
    await io.sleep(300);
    io.write(`[*] Sending payload to /jenkins/securityRealm/user/admin/descriptorByName/...\r\n`);
    await io.sleep(600);
    io.write(`[*] Command Stager progress -  47.30% done (961/2031 bytes)\r\n`);
    await io.sleep(400);
    io.write(`[*] Command Stager progress - 100.00% done (2031/2031 bytes)\r\n`);
    await io.sleep(500);
    io.write(`[*] Sending stage (3,045,380 bytes) to ${rhost}\r\n`);
    await io.sleep(600);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " +0000";
    io.write(`[*] ${GREEN_B}Command shell session 1 opened${R} (${lhost}:${lport} -> ${rhost}:${rport}) at ${now}\r\n\r\n`);
    state.session = 1;
    io.write(`${GREEN_B}You're in.${R} ${DIM}The blank prompt means every command you type now${R}\r\n`);
    io.write(`${DIM}runs on THEIR machine -- the Jenkins box -- as the jenkins user.${R}\r\n`);
    io.write(`${DIM}Grab the memo:${R}  ${CYAN_B}cat /mnt/exec/ic-memo.txt${R}   ${DIM}(that's the win)${R}\r\n\r\n`);
  }

  function doSessions(io, state) {
    if (state.session) {
      io.write(asTermLines(`
Active sessions
===============

  Id  Type            Information
  --  ----            -----------
   1  shell unix      Jenkins 2.121.1 (10.4.12.1)

`));
    } else {
      io.write("No active sessions.\r\n");
    }
  }

  // ── session sub-REPL ───────────────────────────────────────────────

  async function runSession(io, state, ctx) {
    while (state.session) {
      const line = (await io.readline({ prompt: "" })).trim();
      if (!line) continue;
      if (line === "background" || line === "bg") {
        io.write(`[*] Backgrounding session 1...\r\n`);
        state.session = null;
        return;
      }
      if (line === "exit" || line === "quit") {
        io.write(`[*] Closing session 1 and exiting metasploit.\r\n`);
        state.session = null;
        state.exit_after_session = true;
        return;
      }
      if (line === "id") {
        io.write("uid=1000(jenkins) gid=1000(jenkins) groups=1000(jenkins)\r\n");
        continue;
      }
      if (line === "whoami") { io.write("jenkins\r\n"); continue; }
      if (line === "hostname") { io.write("legacy-build-03\r\n"); continue; }
      if (line === "uname -a") {
        io.write("Linux legacy-build-03 5.10.0-amd64 #1 SMP Debian x86_64 GNU/Linux\r\n");
        continue;
      }
      if (line === "pwd") { io.write("/var/lib/jenkins\r\n"); continue; }

      // Win condition: cat the IC memo. Don't dump the static file —
      // play the gated multi-screen payoff, then auto-submit and
      // cascade out of msfconsole.
      if (line.includes("ic-memo.txt") && line.includes("cat")) {
        await showPayoff(io);
        try {
          if (ctx && typeof ctx.submitAnswer === "function") {
            await ctx.submitAnswer("jenkins_was_a_mistake");
          }
        } catch (_) {}
        state.session = null;
        state.exit_after_session = true;
        return;
      }

      // Pass-through for poking around. We don't have a real shell —
      // route ls/cat through the VFS so the player can explore.
      const argv = line.split(/\s+/);
      const cmd = argv[0];
      if (cmd === "ls") {
        const target = argv[1] || "/var/lib/jenkins";
        const entries = M0useVFS.listDir(target);
        if (entries) io.write(entries.join("  ") + "\r\n");
        else io.write(`ls: cannot access '${target}': No such file or directory\r\n`);
      } else if (cmd === "cat") {
        const target = argv[1];
        if (!target) { io.write("cat: missing operand\r\n"); continue; }
        const content = await M0useVFS.readFile(target);
        if (content === null) {
          io.write(`cat: ${target}: No such file or directory\r\n`);
        } else {
          io.write(content);
          if (!content.endsWith("\n")) io.write("\r\n");
        }
      } else {
        io.write(`${line}: command not found\r\n`);
      }
    }
  }

  // ── main ───────────────────────────────────────────────────────────

  async function run(io, args, ctx) {
    const state = {
      module:  MODULE,
      options: freshOptions(),
      session: null,
      exit_after_session: false,
    };
    state.options.LHOST.value = "10.4.12.99";

    banner(io);
    io.write(
      `${DIM}[*] Attack preloaded:${R} ${CYAN_B}${MODULE.path}${R}\r\n` +
      `${DIM}[*] Callback set to ${WHITE_B}10.4.12.99${R}${DIM} (our machine -- where the target reports back)${R}\r\n` +
      `${DIM}[*] Two steps left. Aim:${R}  ${CYAN_B}set RHOSTS jenkins-old.internal.crazy.ants${R}\r\n` +
      `${DIM}[*] Then fire:${R}  ${CYAN_B}exploit${R}\r\n\r\n`
    );

    while (true) {
      if (state.session) {
        await runSession(io, state, ctx);
        if (state.exit_after_session) break;
        continue;
      }
      const line = (await io.readline({ prompt: prompt(state) })).trim();
      if (!line) continue;

      const argv = line.split(/\s+/);
      const cmd = argv[0].toLowerCase();
      const cargs = argv.slice(1);

      if (cmd === "exit" || cmd === "quit") break;
      else if (cmd === "help" || cmd === "?") helpCard(io);
      else if (cmd === "banner")       banner(io);
      else if (cmd === "search")       doSearch(io, state, cargs);
      else if (cmd === "use")          doUse(io, state, cargs);
      else if (cmd === "back")       { state.module = null; state.options = {}; }
      else if (cmd === "info")         doInfo(io, state);
      else if (cmd === "show")         doShow(io, state, cargs);
      else if (cmd === "set")          doSet(io, state, cargs);
      else if (cmd === "unset")        doUnset(io, state, cargs);
      else if (cmd === "check")        await doCheck(io, state);
      else if (cmd === "exploit" || cmd === "run") await doExploit(io, state);
      else if (cmd === "sessions")     doSessions(io, state);
      else if (cmd === "clear" || cmd === "cls") io.write("\x1b[2J\x1b[H");
      else if (cmd === "cat" || cmd === "ls" || cmd === "pwd" ||
               cmd === "id"  || cmd === "whoami" || cmd === "uname") {
        io.write(`[-] Unknown command: ${cmd}\r\n`);
        io.write(`    ${DIM}\`${cmd}\` is a shell command, not an msfconsole${R}\r\n`);
        io.write(`    ${DIM}command. You need a session on the target first --${R}\r\n`);
        io.write(`    ${DIM}set RHOSTS, then${R} ${CYAN_B}exploit${R}${DIM}. Once the prompt goes${R}\r\n`);
        io.write(`    ${DIM}blank, you're on the Jenkins box and${R} ${CYAN_B}${cmd}${R} ${DIM}works.${R}\r\n`);
      }
      else io.write(`[-] Unknown command: ${cmd}\r\n`);
    }

    io.write("\r\n");
  }

  window.M0useMsfconsole = { run };
})();
