// boot.js — wire v86's emulated serial port to an xterm.js terminal.
// xterm fills the page; v86 runs headless. All meta-frame flow lives
// inside the VM (see /usr/local/bin/m0use-portal), not here.

(async function () {
  "use strict";

  if (typeof V86 === "undefined" || typeof Terminal === "undefined") {
    document.body.textContent = "required libraries missing";
    return;
  }

  // ?bust= on the page URL propagates to fetched VM assets so the
  // GitHub Pages CDN can be forced to re-serve.
  const bust = (() => {
    const p = new URLSearchParams(location.search).get("bust");
    return p ? `?bust=${encodeURIComponent(p)}` : "";
  })();
  const u = (path) => path + bust;

  // Wait for the terminal font so xterm doesn't measure a fallback.
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.load('20px "Share Tech Mono"');
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

  // We pin xterm to 80 cols because that's what the VM's serial
  // console defaults to. If the two disagree, readline redraws over
  // the prompt when the player types past the shorter of the two
  // widths. Instead of changing cols on resize, we scale the font
  // size so 80 cells fit the available width — VT323's cell width
  // is roughly 0.55 of its font size.
  const COLS = 80;
  const CELL_W_RATIO = 0.55;

  function refit() {
    const w = terminalEl.clientWidth;
    const h = terminalEl.clientHeight;
    if (!w || !h) return;
    let fontSize = Math.floor((w - 4) / COLS / CELL_W_RATIO);
    fontSize = Math.max(10, Math.min(28, fontSize));
    term.options.fontSize = fontSize;
    const cellH = fontSize * 1.0; // lineHeight 1.0
    const rows = Math.max(10, Math.floor((h - 4) / cellH));
    try { term.resize(COLS, rows); } catch (_) {}
  }
  refit();

  window.addEventListener("resize", refit);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", refit);
  }
  // iOS Safari settles its viewport over a few hundred ms (URL bar
  // collapse, safe-area, notch). Re-run refit at a few intervals so
  // the final layout is locked in before the VM writes much.
  for (const t of [50, 200, 500, 1200]) setTimeout(refit, t);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(refit).observe(terminalEl);
  }

  // Ctrl-F → search scrollback. Crude prompt() for v1; can be
  // upgraded to an in-page search bar later.
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

  // Tap the terminal area on mobile → focus xterm → soft keyboard.
  terminalEl.addEventListener("click", () => {
    term.focus();
  });

  // ── boot v86 ──────────────────────────────────────────────────────
  let cmdline = await fetch(u("cmdline.txt"))
    .then(r => r.ok ? r.text() : Promise.reject("no cmdline.txt"))
    .catch(() => "root=/dev/sda rw modules=ext4 console=tty0 console=ttyS0,115200 quiet");
  cmdline = cmdline.trim();

  if (window.M0useNicks) {
    const handle = window.M0useNicks.get();
    if (handle) {
      const clean = handle.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
      if (clean) cmdline += " m0use.handle=" + clean;
    }
  }

  // Print a tiny "powering on" line into xterm before v86 starts so
  // the player sees something while disks download.
  term.write("\x1b[1;32m[m0usunet]\x1b[0m powering on...\r\n");

  const emulator = new V86({
    wasm_path: "v86/v86.wasm",
    screen_container: document.getElementById("v86-headless"),
    bios:     { url: u("v86/seabios.bin") },
    vga_bios: { url: u("v86/vgabios.bin") },
    bzimage:  { url: u("vmlinuz-virt"),   async: false },
    initrd:   { url: u("initramfs-virt"), async: false },
    cmdline:  cmdline,
    hda:      { url: u("alpine.img"), async: false },
    hdb:      { url: u("kit.img"),    async: false },
    memory_size:     128 * 1024 * 1024,
    vga_memory_size:   4 * 1024 * 1024,
    autostart: true,
  });

  emulator.add_listener("emulator-started", () => {
    setTimeout(refit, 200);
    term.focus();
  });
  emulator.add_listener("download-progress", (e) => {
    if (!e || !e.file_name) return;
    const mb = (e.loaded / 1024 / 1024).toFixed(1);
    const name = e.file_name.split("/").pop();
    term.write(`\r\x1b[2K\x1b[1;32m[m0usunet]\x1b[0m loading \x1b[1;36m${name}\x1b[0m — ${mb} MB`);
  });

  // ── boot-output colorizer ────────────────────────────────────────
  // Line-buffer v86's serial bytes, regex-tag well-known kernel /
  // OpenRC patterns with ANSI escapes, then write to xterm. Stops
  // touching the stream once the VM hands off to a real shell (the
  // m0usunet motd / cold-open shows up — at that point our own
  // scripts are emitting all the ANSI we need, so we get out of
  // the way).
  let _lbuf = '';
  let _flushTimer = null;
  let _colorizeOn = true;

  const ANSI_PRESENT = /\x1b\[/;
  function colorizeLine(line) {
    if (!_colorizeOn) return line;
    // If the VM started writing ANSI itself, that's our cold open or
    // a colored OpenRC line — passthrough.
    if (ANSI_PRESENT.test(line)) {
      // The motd/cold-open marks shell handoff. Stop colorizing.
      if (/m0usunet v0\.9\.7|M O U S E   B I T E S|operator@mouse-bites|cadet@m0usunet|@m0usunet:|Dear Applicant/.test(line)) {
        _colorizeOn = false;
      }
      return line;
    }
    let s = line;
    // Kernel timestamps [    4.729255]  → dim.
    s = s.replace(/^(\[\s*\d+\.\d+\])/, '\x1b[2m$1\x1b[0m');
    // OpenRC banner.
    s = s.replace(/^(\s*)(OpenRC \S+ is starting up Linux .*)$/, '$1\x1b[1;33m$2\x1b[0m');
    s = s.replace(/^(\s*)(Alpine Init \S+)/, '$1\x1b[1;36m$2\x1b[0m');
    // Leading "* " of an OpenRC step → bold cyan.
    s = s.replace(/^(\s*)\*( )/, '$1\x1b[1;36m*\x1b[0m$2');
    // "[ ok ]" → bold green.  "[ !! ]" / FAIL → red.
    s = s.replace(/\[ ok \]/g, '\x1b[1;32m[ ok ]\x1b[0m');
    s = s.replace(/\[\s*(?:!!|fail|FAIL)\s*\]/g, '\x1b[1;31m[ !! ]\x1b[0m');
    // Standalone "ok." → green.
    s = s.replace(/^(\s*Mounting root:\s*)(ok\.)/, '$1\x1b[1;32m$2\x1b[0m');
    s = s.replace(/^(\s*Loading boot drivers:\s*)(ok\.)/, '$1\x1b[1;32m$2\x1b[0m');
    // Subsystem prefixes after a kernel timestamp.
    s = s.replace(/(\x1b\[0m\s+)(EXT4-fs[^:]*:|sd \d+:\d+:\d+:\d+: \[\w+\]|cdrom:|scsi \d+:\d+:\d+:\d+:|ata\d+(?:\.\d+)?:)/, '$1\x1b[1;36m$2\x1b[0m');
    s = s.replace(/(\x1b\[0m\s+)(pci \S+|PCI:|clocksource:|usb \d+-\d+:)/, '$1\x1b[1;35m$2\x1b[0m');
    s = s.replace(/(\x1b\[0m\s+)(Booting paravirtualized kernel.*|Linux \S+ .*|smpboot:|rcu:|TCP:|NET:|IP\b)/, '$1\x1b[0;32m$2\x1b[0m');
    return s;
  }

  function flushBuf() {
    if (_lbuf) {
      term.write(colorizeLine(_lbuf));
      _lbuf = '';
    }
    _flushTimer = null;
  }

  function feed(byte) {
    // Once we've handed off to the m0usunet shell, the VM's own
    // output is doing all the coloring — bypass the buffer entirely
    // so keystroke echo stays responsive.
    if (!_colorizeOn) {
      term.write(new Uint8Array([byte]));
      return;
    }
    if (byte === 10 /* \n */) {
      term.write(colorizeLine(_lbuf) + '\n');
      _lbuf = '';
      if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
      return;
    }
    _lbuf += String.fromCharCode(byte);
    // Flush partial lines (interactive prompts) after a short idle so
    // they actually appear on screen.
    if (_flushTimer) clearTimeout(_flushTimer);
    _flushTimer = setTimeout(flushBuf, 40);
  }

  emulator.add_listener("serial0-output-byte", feed);
  // Older v86 builds emit char strings on this event — handle both.
  emulator.add_listener("serial0-output-char", (chr) => {
    if (typeof chr === "string") {
      for (let i = 0; i < chr.length; i++) feed(chr.charCodeAt(i));
    }
  });

  // ── input sanitizer ──────────────────────────────────────────────
  // Catch the typical paste-of-doom: a multi-line snippet where every
  // line ends in \r\n. xterm sends both bytes; bash sees \r (CR) and
  // executes whatever was buffered up to that point. Collapse \r\n -> \r
  // so paste-as-one-command still works, then forward.
  // Strip bracketed-paste markers (\e[200~ ... \e[201~) — the VM's
  // bash doesn't set bracketed-paste mode, so those escapes would
  // land in the command line as literal "200~" / "201~" garbage.
  function sanitizeInput(data) {
    return data
      .replace(/\r\n/g, "\r")
      .replace(/\x1b\[200~/g, "")
      .replace(/\x1b\[201~/g, "");
  }

  function sendToVM(data) {
    if (!data) return;
    if (typeof emulator.serial0_send === "function") {
      emulator.serial0_send(data);
    } else if (typeof emulator.serial_send_string === "function") {
      emulator.serial_send_string(0, data);
    }
  }

  term.onData((data) => sendToVM(sanitizeInput(data)));

  // ── safety nets ──────────────────────────────────────────────────

  // 1. Emulator crash: if v86 throws or stops, tell the player
  //    instead of leaving a frozen black terminal. Suggesting reload
  //    is better than silence.
  emulator.add_listener("emulator-stopped", () => {
    term.write("\r\n\r\n\x1b[1;31m[m0usunet]\x1b[0m VM stopped. Reload the page to restart.\r\n");
  });
  window.addEventListener("error", (e) => {
    // Only fire on errors from this script's own module — don't show
    // anything for downstream library hiccups.
    if (e && e.filename && e.filename.includes("boot.js")) {
      try {
        term.write("\r\n\x1b[1;31m[m0usunet]\x1b[0m page error: " +
                   (e.message || "unknown") + "\r\n");
      } catch (_) {}
    }
  });

  // 2. When the terminal regains focus (player tabbed away and back,
  //    or rotated the device), reset xterm's input mode and re-fit.
  //    Prevents the "I typed something but nothing happened" case.
  terminalEl.addEventListener("focus", refit, true);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refit();
      term.focus();
    }
  });

  // 3. Mobile soft keyboard pops up after first tap; visualViewport
  //    fires resize when it does. Make sure we re-pin the size.
  if (window.visualViewport) {
    window.visualViewport.addEventListener("scroll", refit);
  }

  window.__m0usunet_emu  = emulator;
  window.__m0usunet_term = term;
})();
