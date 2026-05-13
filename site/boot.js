// boot.js — v86 emulator bootstrap for m0usunet
//
// Loads Alpine (hda) + recon kit (hdb) and starts the VM.
// Disk images are produced by build/build-alpine.sh and build/build-kit.sh
// and copied into site/ by the GitHub Actions deploy workflow. Until that
// runs at least once, this page will fail to boot with a 404 on alpine.img
// — that is expected for the Day-1 scaffold.

(function () {
  "use strict";

  const status = document.getElementById("boot-status");
  function say(msg) { if (status) status.textContent = msg; }

  if (typeof V86 === "undefined") {
    say("libv86 missing — run the deploy workflow to populate site/v86/");
    return;
  }

  // Fetch the kernel cmdline from the build, then boot the kernel + initrd
  // directly. The disk images supply userspace; we don't go through the
  // SYSLINUX bootloader on the disk.
  fetch("cmdline.txt")
    .then(r => r.ok ? r.text() : Promise.reject("no cmdline.txt"))
    .then(start, err => start("modules=ext4 root=/dev/sda rw"))
    .catch(e => say("boot config error: " + e));

  function start(cmdline) {
    cmdline = (cmdline || "").trim();
    say("Booting m0usunet…");
    const emulator = new V86({
      wasm_path: "v86/v86.wasm",
      screen_container: document.getElementById("screen"),
      bios:     { url: "v86/seabios.bin" },
      vga_bios: { url: "v86/vgabios.bin" },
      bzimage:  { url: "vmlinuz-virt",   async: false },
      initrd:   { url: "initramfs-virt", async: false },
      cmdline:  cmdline,
      hda:      { url: "alpine.img", async: false },
      hdb:      { url: "kit.img",    async: false },
      memory_size:     128 * 1024 * 1024,
      vga_memory_size:   8 * 1024 * 1024,
      autostart: true,
    });

    emulator.add_listener("emulator-started", () => {
      if (status) status.classList.add("hidden");
    });
    emulator.add_listener("download-progress", (e) => {
      if (!e || !e.file_name) return;
      const pct = e.file_size ? Math.round(100 * e.loaded / e.file_size) : 0;
      say(`Loading ${e.file_name} ${pct}%`);
    });
    window.__m0usunet_emu = emulator;
  }


  // submit form → POST to scoreboard worker (URL filled in once deployed).
  // Until the Worker exists this just validates the format client-side.
  const FLAG_RE = /^m0use\{[a-z0-9_:\.\-]+\}$/i;
  const form = document.getElementById("submit");
  const result = document.getElementById("submit-result");
  const input = document.getElementById("flag");

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const flag = (input.value || "").trim();
    result.className = "";
    if (!FLAG_RE.test(flag)) {
      result.textContent = "✗ format: m0use{...}";
      result.className = "bad";
      return;
    }
    // Worker not deployed yet — accept locally and clear.
    result.textContent = "✓ shipped (no scoreboard configured yet)";
    result.className = "ok";
    input.value = "";
  });

  // nickname plumbing
  if (window.M0useNicks) {
    const nick = window.M0useNicks.get();
    const el = document.getElementById("nick");
    if (el) el.textContent = `operator: ${nick}`;
  }
})();
