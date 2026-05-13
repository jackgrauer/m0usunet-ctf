// boot.js — wires v86's serial port to an xterm.js terminal in the page.
// v86 runs invisible; xterm is what the player actually interacts with.

(function () {
  "use strict";

  const splash       = document.getElementById("splash");
  const splashStatus = document.getElementById("splash-status");
  function say(msg) { if (splashStatus) splashStatus.innerHTML = msg; }
  function hideSplash() { if (splash) splash.hidden = true; }

  if (typeof V86 === "undefined" || typeof Terminal === "undefined") {
    say("required libraries missing — check site/ assets");
    return;
  }

  // Append ?bust=<param> from the page URL to fetched asset URLs.
  const bust = (() => {
    const p = new URLSearchParams(location.search).get("bust");
    return p ? `?bust=${encodeURIComponent(p)}` : "";
  })();
  const u = (path) => path + bust;

  // ── xterm.js terminal ──────────────────────────────────────────────
  const term = new Terminal({
    fontFamily: '"VT323", "Courier New", monospace',
    fontSize: 20,
    lineHeight: 1.05,
    letterSpacing: 0,
    scrollback: 8000,
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
  window.visualViewport && window.visualViewport.addEventListener("resize", refit);

  // ── boot v86 with serial console ───────────────────────────────────
  fetch(u("cmdline.txt"))
    .then(r => r.ok ? r.text() : Promise.reject("no cmdline.txt"))
    .then(start, () => start("root=/dev/sda rw modules=ext4 quiet console=ttyS0,115200 console=tty0"))
    .catch(e => say("boot config error: " + e));

  function start(rawCmdline) {
    let cmdline = (rawCmdline || "").trim();

    if (window.M0useNicks) {
      const handle = window.M0useNicks.get();
      if (handle) {
        const clean = handle.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
        if (clean) cmdline += " m0use.handle=" + clean;
      }
    }

    say('<span class="spinner"></span> booting m0usunet&hellip;');

    const emulator = new V86({
      wasm_path: "v86/v86.wasm",
      // v86 wants a screen_container; we give it a hidden one and
      // ignore its output, reading everything via serial instead.
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
      setTimeout(hideSplash, 300);
      setTimeout(refit, 350);
      term.focus();
    });
    emulator.add_listener("download-progress", (e) => {
      if (!e || !e.file_name) return;
      const mb = (e.loaded / 1024 / 1024).toFixed(1);
      const name = e.file_name.split("/").pop();
      say(`<span class="spinner"></span> loading <b>${name}</b> &mdash; ${mb} MB`);
    });

    // ── v86 → xterm: bytes from the emulated UART get written to xterm.
    // v86 emits this event as one char (string) per byte. Some builds
    // emit "serial0-output-byte" instead — listen for both.
    emulator.add_listener("serial0-output-char", (chr) => {
      term.write(chr);
    });
    emulator.add_listener("serial0-output-byte", (byte) => {
      term.write(new Uint8Array([byte]));
    });

    // ── xterm → v86: every keystroke we receive goes back over serial ──
    term.onData((data) => {
      if (typeof emulator.serial0_send === "function") {
        emulator.serial0_send(data);
      } else if (typeof emulator.serial_send_string === "function") {
        emulator.serial_send_string(0, data);
      }
    });

    window.__m0usunet_emu  = emulator;
    window.__m0usunet_term = term;
  }
})();
