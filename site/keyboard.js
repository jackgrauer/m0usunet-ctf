// keyboard.js — soft-keyboard helper bar for v86 on mobile
//
// Phone keyboards hide Tab, Esc, Ctrl, arrows, pipe, etc. This bar surfaces
// them as on-screen buttons that inject AT scancodes via the only API we
// can rely on across v86 builds: keyboard_send_scancodes(make + break).
//
// Ctrl is sticky: tap Ctrl, then C → sends Ctrl-C. Same for Shift, Alt.

(function () {
  "use strict";

  // AT keyboard scancode set 1 — make codes. Break = make | 0x80.
  const SC = {
    Esc:   0x01,
    Tab:   0x0F,
    Ctrl:  0x1D,
    LShft: 0x2A,
    Alt:   0x38,
    Space: 0x39,
    Enter: 0x1C,
    Up:    [0xE0, 0x48],
    Down:  [0xE0, 0x50],
    Left:  [0xE0, 0x4B],
    Right: [0xE0, 0x4D],
    PgUp:  [0xE0, 0x49],
    PgDn:  [0xE0, 0x51],
    Home:  [0xE0, 0x47],
    End:   [0xE0, 0x4F],
    Pipe:  0x2B,     // \\| key
    Slash: 0x35,     // /? key
    Minus: 0x0C,     // -_ key
    Eq:    0x0D,     // =+ key
    LBrk:  0x1A,     // [{ key
    RBrk:  0x1B,     // ]} key
    Semi:  0x27,     // ;: key
    Quote: 0x28,     // '" key
    BackQ: 0x29,     // `~ key
    Comma: 0x33,
    Dot:   0x34,
  };

  const BAR = [
    { label: "Tab",   code: SC.Tab },
    { label: "Esc",   code: SC.Esc },
    { label: "Ctrl",  modifier: SC.Ctrl },
    { label: "Shift", modifier: SC.LShft },
    { label: "Alt",   modifier: SC.Alt },
    { label: "↑",     code: SC.Up },
    { label: "↓",     code: SC.Down },
    { label: "←",     code: SC.Left },
    { label: "→",     code: SC.Right },
    { label: "PgUp",  code: SC.PgUp },
    { label: "PgDn",  code: SC.PgDn },
    { label: "/",     code: SC.Slash },
    { label: "|",     code: SC.Pipe, shift: true },
    { label: "-",     code: SC.Minus },
    { label: "~",     code: SC.BackQ, shift: true },
  ];

  const bar = document.getElementById("keybar");
  if (!bar) return;

  const stickyMods = new Set();

  function sendOne(code) {
    const emu = window.__m0usunet_emu;
    if (!emu || !emu.keyboard_send_scancodes) return;
    const make = Array.isArray(code) ? code : [code];
    const brk = make.map((c) => c >= 0xE0 ? c : (c | 0x80));
    // Multibyte (extended) codes: the 0xE0 prefix repeats on release.
    if (Array.isArray(code) && code[0] === 0xE0) {
      emu.keyboard_send_scancodes([0xE0, make[1]]);
      emu.keyboard_send_scancodes([0xE0, make[1] | 0x80]);
    } else {
      emu.keyboard_send_scancodes(make.concat(brk.reverse()));
    }
  }

  function pressWithMods(code, extraShift) {
    const emu = window.__m0usunet_emu;
    if (!emu || !emu.keyboard_send_scancodes) return;
    const seq = [];
    const releases = [];
    for (const m of stickyMods) {
      seq.push(m);
      releases.push(m | 0x80);
    }
    if (extraShift && !stickyMods.has(SC.LShft)) {
      seq.push(SC.LShft);
      releases.push(SC.LShft | 0x80);
    }
    const make = Array.isArray(code) ? code : [code];
    if (Array.isArray(code) && code[0] === 0xE0) {
      seq.push(0xE0, make[1]);
      releases.unshift(0xE0, make[1] | 0x80);
    } else {
      seq.push(make[0]);
      releases.unshift(make[0] | 0x80);
    }
    emu.keyboard_send_scancodes(seq.concat(releases));
    stickyMods.clear();
    document.querySelectorAll("#keybar button.sticky").forEach((b) => b.classList.remove("sticky"));
  }

  for (const k of BAR) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = k.label;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (k.modifier !== undefined) {
        if (stickyMods.has(k.modifier)) {
          stickyMods.delete(k.modifier);
          btn.classList.remove("sticky");
        } else {
          stickyMods.add(k.modifier);
          btn.classList.add("sticky");
        }
        return;
      }
      pressWithMods(k.code, !!k.shift);
    });
    bar.appendChild(btn);
  }
})();
