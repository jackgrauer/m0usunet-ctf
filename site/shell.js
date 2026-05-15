// shell.js — game-shell state machine for TASK 2. Replaces the bash
// subshell + m0use-game-rc + m0use-answer.sh combo from the v86
// build. Lands the player in /mnt/kit/nmap, prints the phase-1
// recon intro, handles cd/ls/pwd/cat with CDPATH search and auto-
// colorized output, routes bare findings (IPs, CVEs, m0use{...},
// snake_case) through the answer matcher, and exits on `continue`.

(function () {
  "use strict";

  // ── colors ────────────────────────────────────────────────────────
  const E = "\x1b";
  const R       = `${E}[0m`;
  const DIM     = `${E}[2m`;
  const GREEN_B = `${E}[1;32m`;
  const GOLD_B  = `${E}[1;33m`;
  const RED_B   = `${E}[1;31m`;
  const CYAN_B  = `${E}[1;36m`;
  const WHITE_B = `${E}[1;37m`;

  const CDPATH = ["/mnt/kit", "."];

  function ps1(handle, cwd) {
    return `${RED_B}${handle}${R}@${GREEN_B}m0usunet${R}:${CYAN_B}${cwd}${R}$ `;
  }

  function bustParam() {
    const p = new URLSearchParams(location.search).get("bust");
    return p ? `?bust=${encodeURIComponent(p)}` : "";
  }

  // ── builtins ──────────────────────────────────────────────────────

  async function builtin_pwd(io, state) {
    io.write(state.cwd + "\r\n");
  }

  async function builtin_cd(io, state, args) {
    const arg = args[0] || "/mnt/kit";
    let target = null;

    const isAbs = arg.startsWith("/");
    const isRel = arg === "." || arg === ".." ||
                  arg.startsWith("./") || arg.startsWith("../");

    if (isAbs) {
      target = M0useVFS.canonicalize(arg);
    } else if (isRel) {
      target = M0useVFS.canonicalize(state.cwd + "/" + arg);
    } else {
      // CDPATH search: try each entry in order.
      for (const dir of CDPATH) {
        const candidate = M0useVFS.canonicalize(
          (dir === "." ? state.cwd : dir) + "/" + arg
        );
        if (M0useVFS.isDir(candidate)) {
          target = candidate;
          break;
        }
      }
      if (!target) target = M0useVFS.canonicalize(state.cwd + "/" + arg);
    }

    if (!M0useVFS.isDir(target)) {
      if (M0useVFS.isFile(target)) {
        io.write(`bash: cd: ${arg}: Not a directory\r\n`);
      } else {
        io.write(`bash: cd: ${arg}: No such file or directory\r\n`);
      }
      return;
    }
    state.cwd = target;
  }

  async function builtin_ls(io, state, args) {
    const positional = args.filter(a => !a.startsWith("-"));
    const arg = positional[0] || state.cwd;
    const target = arg.startsWith("/")
      ? M0useVFS.canonicalize(arg)
      : M0useVFS.canonicalize(state.cwd + "/" + arg);

    if (M0useVFS.isFile(target)) {
      io.write(arg + "\r\n");
      return;
    }
    const entries = M0useVFS.listDir(target);
    if (!entries) {
      io.write(`ls: cannot access '${arg}': No such file or directory\r\n`);
      return;
    }
    const parts = [];
    for (const name of entries) {
      const child = M0useVFS.lookup(target + "/" + name);
      // Reaching the raw entry — re-lookup parent to know type without
      // resolving symlinks (so we can tag them).
      const parent = M0useVFS.lookup(target);
      const raw = parent.children[name];
      if (raw && raw.type === "dir") parts.push(`${CYAN_B}${name}${R}/`);
      else if (raw && raw.type === "symlink") parts.push(`${RED_B}${name}${R}`);
      else parts.push(name);
    }
    io.write(parts.join("  ") + "\r\n");
  }

  async function writeContentGated(io, content) {
    const { pre, rule, post, gated } = M0useColorize.colorize(content);
    io.write(pre);
    if (!pre.endsWith("\n")) io.write("\r\n");
    if (gated) {
      io.write(`\r\n  ${DIM}-- Press Enter to continue --${R}`);
      await io.waitEnter();
      io.write(M0useColorize.colorizeLine(rule) + "\r\n");
      io.write(post);
      if (!post.endsWith("\n")) io.write("\r\n");
    }
  }

  async function builtin_cat(io, state, args) {
    if (args.length === 0) {
      io.write("Usage: cat <file>\r\n");
      return;
    }
    // Power users could pass multiple args or flags. Mirror the bash
    // wrapper: only auto-colorize the single-file case.
    if (args.length > 1 || args[0].startsWith("-")) {
      for (const a of args.filter(a => !a.startsWith("-"))) {
        const target = a.startsWith("/")
          ? M0useVFS.canonicalize(a)
          : M0useVFS.canonicalize(state.cwd + "/" + a);
        const content = await M0useVFS.readFile(target);
        if (content === null) {
          io.write(`cat: ${a}: No such file or directory\r\n`);
        } else {
          io.write(content);
          if (!content.endsWith("\n")) io.write("\r\n");
        }
      }
      return;
    }
    const arg = args[0];
    const target = arg.startsWith("/")
      ? M0useVFS.canonicalize(arg)
      : M0useVFS.canonicalize(state.cwd + "/" + arg);
    const content = await M0useVFS.readFile(target);
    if (content === null) {
      if (M0useVFS.isDir(target)) {
        io.write(`cat: ${arg}: Is a directory\r\n`);
      } else {
        io.write(`cat: ${arg}: No such file or directory\r\n`);
      }
      return;
    }
    await writeContentGated(io, content);
  }

  // ── answer mechanism (port of build/m0use-answer.sh) ─────────────

  let flagCache = null;

  async function loadFlags() {
    if (flagCache) return flagCache;
    flagCache = { 1: [], 2: [], 3: [] };
    for (const n of [1, 2, 3]) {
      try {
        const res = await fetch(`kit-content/flags-phase${n}.txt${bustParam()}`);
        if (res.ok) {
          const text = await res.text();
          flagCache[n] = text.split("\n").map(l => l.trim()).filter(Boolean);
        }
      } catch (_) {}
    }
    return flagCache;
  }

  function normalize(s) {
    let v = s.replace(/[ \t]/g, "");
    if (v.startsWith("m0use{")) v = v.slice(6);
    if (v.endsWith("}"))        v = v.slice(0, -1);
    if (v.startsWith("m0use"))  v = v.slice(5);
    return v.toLowerCase();
  }

  async function loadPhaseDone(n) {
    try {
      const res = await fetch(`kit-content/phase${n}-done.txt${bustParam()}`);
      if (res.ok) return await res.text();
    } catch (_) {}
    return "";
  }

  async function answer(io, state, args) {
    const input = args.join(" ").trim();
    if (!input) {
      io.write(
        "usage: answer <finding>\r\n\r\n" +
        "  Examples:\r\n" +
        "    answer 10.4.12.88\r\n" +
        "    answer CVE-2018-1000861\r\n" +
        "    answer jenkins_was_a_mistake\r\n\r\n" +
        "  Each phase tells you what kind of finding it wants.\r\n"
      );
      return;
    }
    const flags = await loadFlags();
    const norm = normalize(input);
    for (const phaseN of [1, 2, 3]) {
      for (const flag of flags[phaseN]) {
        if (normalize(flag) === norm) {
          io.write(`\r\n\r\n\r\n${GREEN_B}[OK] finding accepted.${R}\r\n`);
          const phaseDone = await loadPhaseDone(phaseN);
          await writeContentGated(io, phaseDone);
          state.completed[phaseN] = true;
          return;
        }
      }
    }
    io.write(
      `${RED_B}[!!] not quite${R} (read as ${norm}). ` +
      `try again, or ${CYAN_B}cat hint${R} if stuck.\r\n`
    );
  }

  function looksLikeFinding(input) {
    if (/^\d+\.\d+\.\d+\.\d+/.test(input))   return true; // IPv4-ish
    if (/^cve[-_]/i.test(input))             return true; // CVE id
    if (/^m0use\{|^m0use/.test(input))       return true; // wrapped flag
    if (/_/.test(input))                     return true; // snake_case
    if (/-/.test(input) && !input.startsWith("-")) return true; // hostname
    return false;
  }

  // ── phase-1 recon intro (mirrors m0use-game-rc heredoc) ──────────

  function phase1Intro(io) {
    io.writeWrapped(
`  ${RED_B}target:${R} ${WHITE_B}10.4.12.0/24${R}   ${DIM}-- the Crazy Ants subnet${R}

This is the network the Ants run their company on. They don't know you're sitting on it.

Use ${CYAN_B}nmap${R} to map it. nmap is a network scanner. You give it a range of IP addresses; it touches every port on every host and reports back what's listening -- web servers, e-mail, anything. It catalogues unfamiliar networks from the outside.

Somewhere in the Ants' /24 there is a host that shouldn't be there. Their fragrance compounder computor runs on isolated infrastructure -- by policy. But people get tired. People make exceptions. They slip up. They forget they slipped up. A staging box left up from a sprint three years ago. A test environment someone "temporarily" exposed for a vendor demo and forgot. A back-office service that was supposed to live inside their VPN but escaped through a misconfigured firewall.

${DIM}What we're looking for:${R} not vulnerabilities -- ${WHITE_B}carelessness${R}. The host that's visible from outside but was clearly not meant for someone outside the company to see. The back office.
`);
    io.write("\r\n");
    io.write(`  ${CYAN_B}nmap 10.4.12.0/24${R}        ${DIM}sweep the subnet${R}\r\n`);
    io.write(`  ${CYAN_B}nmap -sV 10.4.12.0/24${R}    ${DIM}list service versions${R}\r\n`);
    io.write(`  ${CYAN_B}nmap 10.4.12.88${R}          ${DIM}one host${R}\r\n`);
    io.write(`  ${CYAN_B}cat hint${R}                 ${DIM}penalty-free hint if you're stuck${R}\r\n\r\n`);
  }

  // ── help ──────────────────────────────────────────────────────────

  function builtin_help(io) {
    io.writeWrapped(
`${GOLD_B}m0usunet command reference${R}
${DIM}───────────────────────────${R}

  ${CYAN_B}help${R}                       this card
  ${CYAN_B}cat hint${R}                   non-judgmental hint for the current phase
  ${CYAN_B}cat brief${R}                  long-form notes for the current phase

  ${CYAN_B}<finding>${R}                  just type the IP / host / CVE / flag and hit Enter
                             that's how you advance every phase
  ${CYAN_B}answer <finding>${R}           same thing, explicit form

  ${CYAN_B}continue${R}                   leave the m0usunet shell and proceed
  ${CYAN_B}ls${R} / ${CYAN_B}ll${R} / ${CYAN_B}cd${R}              navigate the kit (/mnt/kit)
  ${CYAN_B}nmap${R} / ${CYAN_B}nikto${R} / ${CYAN_B}curl${R} / ${CYAN_B}msfconsole${R}    phase tools (steps 3-4 of the JS port)
`);
    io.write("\r\n");
  }

  // ── dispatch ──────────────────────────────────────────────────────

  async function dispatch(io, state, raw) {
    const line = raw.trim();
    if (!line) return;

    const argv = line.split(/\s+/);
    const cmd = argv[0];
    const args = argv.slice(1);

    switch (cmd) {
      case "ll":         return await builtin_ls(io, state, ["-la", ...args]);
      case "l":          return await builtin_ls(io, state, args);
      case "ls":         return await builtin_ls(io, state, args);
      case "cd":         return await builtin_cd(io, state, args);
      case "pwd":        return await builtin_pwd(io, state);
      case "cat":        return await builtin_cat(io, state, args);
      case "clear":      io.write("\x1b[2J\x1b[H"); return;
      case "help":       return builtin_help(io);
      case "answer":
      case "apply":
      case "submit":
        return await answer(io, state, args);
      case "continue":
      case "exit":
      case "quit":
        state.exit = true;
        return;
      case "nmap":
      case "nikto":
      case "curl":
      case "msfconsole":
      case "msf":
      case "metasploit":
        io.write(`${DIM}[${cmd}: tool not yet ported (step 3-4 of the JS port). ` +
                 `Use ${R}${CYAN_B}cat hint${R}${DIM} for now.]${R}\r\n`);
        return;
    }

    // Bare-finding intercept (mirrors command_not_found_handle).
    if (looksLikeFinding(line)) {
      return await answer(io, state, [line]);
    }

    io.write(`bash: ${cmd}: command not found\r\n`);
  }

  // ── main ──────────────────────────────────────────────────────────

  async function run(io, { handle }) {
    const state = {
      cwd: "/mnt/kit/nmap",
      handle,
      completed: { 1: false, 2: false, 3: false },
      exit: false,
    };

    phase1Intro(io);

    while (!state.exit) {
      const line = await io.readline({ prompt: ps1(state.handle, state.cwd) });
      try {
        await dispatch(io, state, line);
      } catch (e) {
        io.write(`${RED_B}[shell error]${R} ${e && e.message ? e.message : String(e)}\r\n`);
      }
    }
  }

  window.M0useShell = { run };
})();
