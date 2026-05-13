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
    fontFamily: '"Share Tech Mono", ui-monospace, "Courier New", monospace',
    fontSize: 17,
    lineHeight: 1.1,
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

  const fitAddon = (typeof FitAddon !== "undefined" && FitAddon.FitAddon)
    ? new FitAddon.FitAddon() : null;
  if (fitAddon) term.loadAddon(fitAddon);

  term.open(document.getElementById("terminal"));
  if (fitAddon) try { fitAddon.fit(); } catch (_) {}

  function refit() { if (fitAddon) try { fitAddon.fit(); } catch (_) {} }
  window.addEventListener("resize", refit);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", refit);
  }

  // Tap the terminal area on mobile → focus xterm → soft keyboard.
  document.getElementById("terminal").addEventListener("click", () => {
    term.focus();
  });

  // ── boot v86 ──────────────────────────────────────────────────────
  let cmdline = await fetch(u("cmdline.txt"))
    .then(r => r.ok ? r.text() : Promise.reject("no cmdline.txt"))
    .catch(() => "root=/dev/sda rw modules=ext4 console=tty0 console=ttyS0,115200 loglevel=7");
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

  emulator.add_listener("serial0-output-char", (chr) => { term.write(chr); });
  emulator.add_listener("serial0-output-byte", (byte) => {
    term.write(new Uint8Array([byte]));
  });

  term.onData((data) => {
    if (typeof emulator.serial0_send === "function") {
      emulator.serial0_send(data);
    } else if (typeof emulator.serial_send_string === "function") {
      emulator.serial_send_string(0, data);
    }
  });

  window.__m0usunet_emu  = emulator;
  window.__m0usunet_term = term;
})();
