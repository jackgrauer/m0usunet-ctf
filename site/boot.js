// boot.js — v86 emulator bootstrap for m0usunet.

(function () {
  "use strict";

  const splash       = document.getElementById("splash");
  const splashStatus = document.getElementById("splash-status");
  function say(msg) { if (splashStatus) splashStatus.innerHTML = msg; }
  function hideSplash() { if (splash) splash.hidden = true; }

  if (typeof V86 === "undefined") {
    say("libv86 missing — run the deploy workflow to populate site/v86/");
    return;
  }

  // Append ?bust=<param> to fetched URLs when the page URL includes
  // ?bust=, so iteration can force a fresh fetch past the Pages CDN.
  const bust = (() => {
    const p = new URLSearchParams(location.search).get("bust");
    return p ? `?bust=${encodeURIComponent(p)}` : "";
  })();
  const u = (path) => path + bust;

  fetch(u("cmdline.txt"))
    .then(r => r.ok ? r.text() : Promise.reject("no cmdline.txt"))
    .then(start, () => start("root=/dev/sda rw modules=ext4 quiet vga=normal nomodeset"))
    .catch(e => say("boot config error: " + e));

  function start(rawCmdline) {
    let cmdline = (rawCmdline || "").trim();

    // Pass the operator handle from localStorage to the kernel so
    // profile.d can use it without re-prompting.
    if (window.M0useNicks) {
      const handle = window.M0useNicks.get();
      if (handle) {
        // Sanitize for kernel cmdline (no spaces, alnum/_- only)
        const clean = handle.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
        if (clean) cmdline += " m0use.handle=" + clean;
      }
    }

    say('<span class="spinner"></span> booting m0usunet&hellip;');
    const emulator = new V86({
      wasm_path: "v86/v86.wasm",
      screen_container: document.getElementById("screen"),
      bios:     { url: u("v86/seabios.bin") },
      vga_bios: { url: u("v86/vgabios.bin") },
      bzimage:  { url: u("vmlinuz-virt"),   async: false },
      initrd:   { url: u("initramfs-virt"), async: false },
      cmdline:  cmdline,
      hda:      { url: u("alpine.img"), async: false },
      hdb:      { url: u("kit.img"),    async: false },
      memory_size:     128 * 1024 * 1024,
      vga_memory_size:   8 * 1024 * 1024,
      autostart: true,
    });

    emulator.add_listener("emulator-started", () => {
      // Give the kernel a beat to throw up the first text on screen
      // before we drop the splash.
      setTimeout(hideSplash, 200);
    });
    emulator.add_listener("download-progress", (e) => {
      if (!e || !e.file_name) return;
      const mb = (e.loaded / 1024 / 1024).toFixed(1);
      const name = e.file_name.split("/").pop();
      say(`<span class="spinner"></span> loading <b>${name}</b> &mdash; ${mb} MB`);
    });

    window.__m0usunet_emu = emulator;
    wireKeyboard(emulator);
    wireScrollback(emulator);
  }

  // wireScrollback — capture v86's text-mode screen rows into a
  // rolling buffer. The kernel runs in 80x25 VGA text mode
  // (vga=normal nomodeset), so v86 exposes get_text_screen() with
  // the current 25 rows. We poll every 200ms, detect when content
  // has scrolled, and append the rows that just rolled off the top.
  // A modal lets the player review the full captured history.
  function wireScrollback(emu) {
    const btn   = document.getElementById("scrollback-btn");
    const modal = document.getElementById("scrollback-modal");
    const close = document.getElementById("scrollback-close");
    const body  = document.getElementById("scrollback-body");
    if (!btn || !modal || !body) return;

    const MAX_LINES = 4000;
    const buffer = [];   // captured scrollback (older lines first)
    let prevRows = [];   // last polled snapshot

    function rowsEqual(a, b) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    }

    function captureScroll(curr) {
      if (!prevRows.length) { prevRows = curr.slice(); return; }
      // Find the largest scroll offset N such that curr[0..H-N-1]
      // equals prev[N..H-1]. That means content scrolled up by N
      // lines, and curr's last N rows are new.
      const H = curr.length;
      let scrolledBy = -1;
      for (let n = 0; n <= H; n++) {
        let ok = true;
        for (let i = 0; i < H - n; i++) {
          if (curr[i] !== prevRows[i + n]) { ok = false; break; }
        }
        if (ok) { scrolledBy = n; break; }
      }
      if (scrolledBy > 0) {
        // The N rows that scrolled off the top were prev[0..N-1].
        // The N new rows arriving at the bottom are curr[H-N..H-1].
        // Capture the rows that left the screen.
        for (let i = 0; i < scrolledBy; i++) {
          buffer.push(prevRows[i] || "");
        }
        if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES);
      }
      prevRows = curr.slice();
    }

    function poll() {
      try {
        const sa = emu.screen_adapter;
        if (!sa || typeof sa.get_text_screen !== "function") return;
        const rows = sa.get_text_screen();
        if (!Array.isArray(rows) || !rows.length) return;
        captureScroll(rows);
      } catch (_) {}
    }
    setInterval(poll, 200);

    function open() {
      // Render: scrollback buffer + the current screen (so the
      // player sees the full picture, not just what scrolled off)
      const live = (() => {
        try { return emu.screen_adapter.get_text_screen() || []; }
        catch (_) { return []; }
      })();
      body.textContent = buffer.concat(live).join("\n").replace(/\s+$/gm, "");
      modal.hidden = false;
      body.scrollTop = body.scrollHeight;
    }
    function shut() { modal.hidden = true; }

    btn.addEventListener("click", open);
    close.addEventListener("click", shut);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) shut();
    });
  }

  // wireKeyboard — forward soft-keyboard input from the textarea
  // overlay to v86. Desktop physical keyboards are handled by v86's
  // own document-level listener, so this is purely for mobile.
  function wireKeyboard(emu) {
    const overlay = document.getElementById("kbd-overlay");
    const screen = document.getElementById("screen");
    if (!overlay) return;

    const refocus = () => {
      try { overlay.focus({ preventScroll: true }); } catch (_) { overlay.focus(); }
    };
    screen.addEventListener("click",      refocus);
    screen.addEventListener("touchstart", refocus, { passive: true });
    overlay.addEventListener("touchstart", refocus, { passive: true });

    const clear = () => { if (overlay.value) overlay.value = ""; };

    const SC_BACKSPACE = 0x0E;
    const SC_ENTER     = 0x1C;

    overlay.addEventListener("beforeinput", (ev) => {
      const t = ev.inputType;
      if (t === "deleteContentBackward" || t === "deleteContentForward") {
        emu.keyboard_send_scancodes([SC_BACKSPACE, SC_BACKSPACE | 0x80]);
        ev.preventDefault();
      } else if (t === "insertLineBreak" || t === "insertParagraph") {
        emu.keyboard_send_scancodes([SC_ENTER, SC_ENTER | 0x80]);
        ev.preventDefault();
      } else if (t === "insertText" && ev.data) {
        if (typeof emu.keyboard_send_text === "function") {
          emu.keyboard_send_text(ev.data);
        }
        ev.preventDefault();
      }
      requestAnimationFrame(clear);
    });

    overlay.addEventListener("input", clear);
  }

  // The header pill is gone — the operator handle still gets passed
  // from localStorage into the kernel cmdline (see start()), and the
  // VM's profile.d will prompt on terminal if no handle is set yet.
})();
