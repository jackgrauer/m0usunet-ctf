// boot.js — pure-JS m0usunet runtime. No emulator, no disk image.
// Drives xterm.js directly: a fake boot animation (kernel jargon,
// OpenRC ceremony, motd, agetty auto-login) hands off to portal.js.
//
// Why we ditched v86: older phone browsers (Android 8.1 / SDM660-
// class) either OOM on the disk-into-JS-heap step or freeze on the
// WASM JIT. The whole experience is shimmed anyway (fake-nmap,
// fake-curl, fake-msfconsole), so the "real Linux" property was
// paid-for-but-unused on the players' devices. This runtime keeps
// every visible thing — the boot jargon, the prompts, the narrative,
// the pacing — and removes the emulator that made it slow.

(async function () {
  "use strict";

  // Identify which dep failed so phone diagnostics aren't a guess.
  const missing = [];
  if (typeof Terminal === "undefined")           missing.push("xterm.js (Terminal)");
  if (typeof window.M0useIO === "undefined")     missing.push("io.js (M0useIO)");
  if (typeof window.M0usePortal === "undefined") missing.push("portal.js (M0usePortal)");
  if (typeof window.M0useNicks === "undefined")  missing.push("nicks.js (M0useNicks)");
  if (missing.length) {
    document.body.innerHTML =
      "<pre style='color:#c8ffc8;background:#000;padding:1em;font:14px monospace'>" +
      "[m0usunet] required libraries failed to load:\n  - " +
      missing.join("\n  - ") +
      "\n\nLikely causes: blocked network (corporate proxy, captive portal),\n" +
      "old TLS that can't reach the host, or a stale browser cache.\n\n" +
      "Try: full reload, switch network, or another browser." +
      "</pre>";
    return;
  }

  // Wait for the terminal font so xterm doesn't measure a fallback.
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.load('20px "VT323"');
      await document.fonts.ready;
    } catch (_) {}
  }

  // ── xterm.js terminal ──────────────────────────────────────────────
  const term = new Terminal({
    fontFamily: '"VT323", "Perfect DOS VGA 437", "Courier New", monospace',
    fontSize: 20,
    lineHeight: 1.0,
    letterSpacing: 0,
    scrollback: 10000,
    cursorBlink: true,
    cursorStyle: "block",
    convertEol: true,
    allowProposedApi: true,
    theme: {
      background: "#000000",
      foreground: "#c8ffc8",
      cursor:     "#00ff66",
      cursorAccent: "#000000",
      selectionBackground: "#005522",
      black:   "#0a0a0a",
      red:     "#ff4040",
      green:   "#00ff66",
      yellow:  "#ffcc33",
      blue:    "#5599ff",
      magenta: "#ff66ff",
      cyan:    "#66ffff",
      white:   "#c8ffc8",
      brightBlack:   "#666666",
      brightRed:     "#ff8080",
      brightGreen:   "#88ff88",
      brightYellow:  "#ffe066",
      brightBlue:    "#88bbff",
      brightMagenta: "#ffaaff",
      brightCyan:    "#aaffff",
      brightWhite:   "#ffffff",
    },
  });

  const searchAddon = (typeof SearchAddon !== "undefined" && SearchAddon.SearchAddon)
    ? new SearchAddon.SearchAddon() : null;
  if (searchAddon) term.loadAddon(searchAddon);

  const webLinksAddon = (typeof WebLinksAddon !== "undefined" && WebLinksAddon.WebLinksAddon)
    ? new WebLinksAddon.WebLinksAddon() : null;
  if (webLinksAddon) term.loadAddon(webLinksAddon);

  const terminalEl = document.getElementById("terminal");
  term.open(terminalEl);

  // Pin to 80 cols, scale font size to fit. VT323's cell width is
  // roughly 0.55 of its font size.
  const COLS = 80;
  const CELL_W_RATIO = 0.55;

  function refit() {
    const w = terminalEl.clientWidth;
    const h = terminalEl.clientHeight;
    if (!w || !h) return;
    let fontSize = Math.floor((w - 4) / COLS / CELL_W_RATIO);
    fontSize = Math.max(10, Math.min(28, fontSize));
    term.options.fontSize = fontSize;
    const cellH = fontSize * 1.0;
    const rows = Math.max(10, Math.floor((h - 4) / cellH));
    try { term.resize(COLS, rows); } catch (_) {}
  }
  refit();

  window.addEventListener("resize", refit);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", refit);
    window.visualViewport.addEventListener("scroll", refit);
  }
  for (const t of [50, 200, 500, 1200]) setTimeout(refit, t);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(refit).observe(terminalEl);
  }

  if (searchAddon) {
    term.attachCustomKeyEventHandler((ev) => {
      if (ev.type === "keydown" && (ev.ctrlKey || ev.metaKey) && ev.key === "f") {
        ev.preventDefault();
        const q = window.prompt("search scrollback:");
        if (q) searchAddon.findNext(q, { caseSensitive: false });
        return false;
      }
      return true;
    });
  }

  terminalEl.addEventListener("click", () => term.focus());
  terminalEl.addEventListener("focus", refit, true);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { refit(); term.focus(); }
  });

  // ── IO + handle ────────────────────────────────────────────────────
  const io = window.M0useIO.createIO(term);
  const handle = (window.M0useNicks && window.M0useNicks.get()) || "cadet";

  // ── boot animation ─────────────────────────────────────────────────
  // Lines below pre-color with ANSI escapes. Sequence mirrors a real
  // Alpine boot in v86 — same kernel timestamps, same OpenRC banner,
  // same motd handoff to agetty. Delays are tight so the whole boot
  // lands in ~2.5 s on any device.

  const D  = (s) => `\x1b[2m${s}\x1b[0m`;     // dim
  const G  = (s) => `\x1b[1;32m${s}\x1b[0m`;  // green-bold
  const C  = (s) => `\x1b[1;36m${s}\x1b[0m`;  // cyan-bold
  const Y  = (s) => `\x1b[1;33m${s}\x1b[0m`;  // gold-bold
  const W  = (s) => `\x1b[1;37m${s}\x1b[0m`;  // white-bold
  const M  = (s) => `\x1b[1;35m${s}\x1b[0m`;  // magenta-bold
  const Md = (s) => `\x1b[0;35m${s}\x1b[0m`;  // magenta-dim

  function ts(t) { return D(`[${t.padStart(11)}]`); }
  function okLine(label) {
    const padLen = Math.max(2, 65 - stripAnsi(label).length);
    return `  ${C("*")} ${label}${" ".repeat(padLen)}${G("[ ok ]")}`;
  }
  function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ""); }

  const bootLines = [
    [0,    `SeaBIOS (version 1.16.0-prebuilt.qemu.org)`],
    [40,   `iPXE (https://ipxe.org) 00:03.0 CA00 PCI2.10 PnP PMM+07F912F0+07EF12F0 CA00`],
    [60,   ``],
    [30,   `Booting from Hard Disk...`],
    [80,   `${ts("0.000000")} Linux version 5.15.55-0-virt (buildozer@build-3-18-x86_64) #1-Alpine SMP Wed Aug 9 14:01:11 UTC 2026`],
    [10,   `${ts("0.000000")} Command line: root=${Md("/dev/sda")} rw modules=ext4 console=tty0 console=ttyS0,115200`],
    [10,   `${ts("0.012000")} BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable`],
    [10,   `${ts("0.024000")} BIOS-e820: [mem 0x0000000000100000-0x0000000007ffffff] usable`],
    [10,   `${ts("0.035000")} DMI: QEMU Standard PC (i440FX + PIIX, 1996), BIOS rel-1.16.0`],
    [10,   `${ts("0.058000")} tsc: Detected ${C("2700.000 MHz")} processor`],
    [10,   `${ts("0.142000")} ${G("Booting paravirtualized kernel on bare hardware")}`],
    [10,   `${ts("0.181000")} ${M("PCI:")} Using configuration type 1 for base access`],
    [10,   `${ts("0.218000")} ${G("clocksource:")} tsc-early: mask: 0xffffffffffffffff max_cycles: 0x26d3aff858f`],
    [10,   `${ts("0.301000")} ${G("NET:")} Registered PF_INET protocol family`],
    [10,   `${ts("0.355000")} ${G("TCP:")} Hash tables configured (established 2048 bind 2048)`],
    [30,   `${ts("0.394000")} ${C("sd 0:0:0:0: [sda]")} 196608 512-byte logical blocks: (${C("100 MB")}/${C("96.0 MiB")})`],
    [10,   `${ts("0.412000")} ${C("sd 0:0:0:0: [sda]")} Write Protect is off`],
    [10,   `${ts("0.428000")} ${C("sd 1:0:0:0: [sdb]")} 4096 512-byte logical blocks: (${C("2.10 MB")}/${C("2.00 MiB")})`],
    [40,   `${ts("0.501000")} ${C("EXT4-fs (sda):")} mounted filesystem with ordered data mode. Opts: (null)`],
    [10,   `${ts("0.522000")} devtmpfs: mounted`],
    [30,   `${ts("0.589000")} Run /sbin/init as init process`],
    [60,   ``],
    [10,   `  ${Y("m0usunet 0.9.7 / busybox-init")} ${D("--")} ${Y("m0usunet starting up...")}`],
    [50,   ``],
    [10,   `  ${C("*")} Mounting root: ${G("ok.")}`],
    [10,   `  ${C("*")} Loading boot drivers: ${G("ok.")}`],
    [10,   okLine(`Bringing up ${Md("lo")} interface`)],
    [10,   okLine(`Setting clock locally from RTC`)],
    [10,   okLine(`Mounting ${Md("/mnt/kit")} (read-only)`)],
    [10,   okLine(`Starting m0use-banners`)],
    [10,   okLine(`Starting m0use-jenkins (crazy.ants back-office)`)],
    [60,   ``],
    [10,   `  ${Y("m0usunet ready.")} ${W("Welcome to Field Operations.")}`],
    [80,   ``],
    [10,   `Welcome to Alpine Linux 3.18`],
    [10,   `Kernel 5.15.55-0-virt on an x86_64 (ttyS0)`],
    [40,   ``],
    [10,   `m0usunet login: ${D("root (automatic login)")}`],
    [60,   ``],
    [10,   `  ${G("m0usunet v0.9.7")}    ${W("Field Operations Terminal")}`],
    [400,  ``],
  ];

  for (const [delay, text] of bootLines) {
    if (delay) await io.sleep(delay);
    term.write(text + "\r\n");
  }

  // ── handoff to portal ──────────────────────────────────────────────
  term.focus();
  try {
    await window.M0usePortal.run(io, { handle });
  } catch (e) {
    term.write(`\r\n\x1b[1;31m[m0usunet]\x1b[0m portal error: ${e && e.message ? e.message : e}\r\n`);
    throw e;
  }

  // ── after portal returns ──────────────────────────────────────────
  // The real portal holds on the final screen indefinitely (its own
  // read loop). If we ever fall out, write a power-down marker.
  term.write(`\r\n${D("-- session ended --")}\r\n`);

  window.__m0usunet_term = term;
  window.__m0usunet_io = io;
})();
