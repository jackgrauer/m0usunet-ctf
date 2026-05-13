// boot.js — v86 emulator bootstrap for m0usunet.

(function () {
  "use strict";

  const status = document.getElementById("boot-status");
  function say(msg) { if (status) status.textContent = msg; }

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
    .then(start, () => start("root=/dev/sda rw modules=ext4 quiet"))
    .catch(e => say("boot config error: " + e));

  function start(cmdline) {
    cmdline = (cmdline || "").trim();
    say("Booting m0usunet…");
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
      if (status) status.classList.add("hidden");
      // Focus the input overlay so the soft keyboard pops on mobile
      // as soon as the user taps. We don't auto-focus immediately —
      // browsers block focus from non-user-gesture script paths.
    });
    emulator.add_listener("download-progress", (e) => {
      if (!e || !e.file_name) return;
      const pct = e.file_size ? Math.round(100 * e.loaded / e.file_size) : 0;
      say(`Loading ${e.file_name} ${pct}%`);
    });

    window.__m0usunet_emu = emulator;
    wireKeyboard(emulator);
  }

  // wireKeyboard — forward soft-keyboard input from the textarea
  // overlay to v86. Desktop physical keyboards are handled by v86's
  // own document-level listener, so this is purely for mobile.
  function wireKeyboard(emu) {
    const overlay = document.getElementById("kbd-overlay");
    const screen = document.getElementById("screen");
    if (!overlay) return;

    // Tap anywhere on the screen → focus the overlay → soft keyboard pops.
    const refocus = () => {
      try { overlay.focus({ preventScroll: true }); } catch (_) { overlay.focus(); }
    };
    screen.addEventListener("click",      refocus);
    screen.addEventListener("touchstart", refocus, { passive: true });
    overlay.addEventListener("touchstart", refocus, { passive: true });

    // Strip any value so the textarea doesn't accumulate (and so iOS
    // doesn't autocorrect previously-typed words).
    const clear = () => { if (overlay.value) overlay.value = ""; };

    // AT scancodes for the special edit keys we intercept.
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
        // Each character goes through v86's text-to-scancodes path.
        if (typeof emu.keyboard_send_text === "function") {
          emu.keyboard_send_text(ev.data);
        }
        ev.preventDefault();
      }
      // Anything else (paste/formatting) we ignore but clear after.
      requestAnimationFrame(clear);
    });

    // On desktop, also forward via the input event as a safety net.
    overlay.addEventListener("input", clear);
  }

  // Operator handle — clickable. Tap to set a new name (or accept the
  // rolled default).
  if (window.M0useNicks) {
    const el = document.getElementById("nick");
    const render = () => {
      if (el) el.textContent = `operator: ${window.M0useNicks.get()}`;
    };
    render();
    if (el) {
      el.style.cursor = "pointer";
      el.title = "Click to set your operator name";
      el.addEventListener("click", () => {
        const current = window.M0useNicks.get();
        const next = window.prompt("Operator name:", current);
        if (next === null) return;
        const trimmed = next.trim();
        if (!trimmed) { window.M0useNicks.reroll(); }
        else          { window.M0useNicks.set(trimmed); }
        render();
      });
    }
  }
})();
