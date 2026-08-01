// portal.js — the Junior Sniffer narrative flow.
//
//   NAME PROMPT
//     -> Cold-open letter
//     -> OPERATION PARMESAN ROSE intro
//     -> [game shell — the hack]
//     -> ASSESSMENT COMPLETE (held indefinitely)

(function () {
  "use strict";

  // ── colors ────────────────────────────────────────────────────────
  const E = "\x1b";
  const R         = `${E}[0m`;
  const B         = `${E}[1m`;
  const DIM       = `${E}[2m`;
  const GREEN     = `${E}[1;32m`;
  const GREEN_DIM = `${E}[0;32m`;
  const GOLD      = `${E}[1;33m`;
  const RED       = `${E}[1;31m`;
  const CYAN      = `${E}[1;36m`;
  const CYAN_DIM  = `${E}[0;36m`;
  const MAGENTA   = `${E}[1;35m`;
  const WHITE     = `${E}[1;37m`;

  const PROMPT = `${DIM}>${R}`;

  // ── helpers ───────────────────────────────────────────────────────
  function pageBreak(io) {
    io.write(`${E}[2J${E}[H\n\n\n`);
  }

  // ── name prompt ───────────────────────────────────────────────────
  async function namePrompt(io, prefill) {
    pageBreak(io);
    io.writeWrapped(`${DIM}Please enter your name to begin:${R}`);
    io.write("\n");
    const input = await io.readline({ prompt: `${PROMPT} ` });
    // Blank falls back to the random handle so an empty name can't wedge
    // the flow; players who type a name get theirs.
    const clean = input.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
    const handle = clean || prefill;
    if (window.M0useNicks && window.M0useNicks.set) window.M0useNicks.set(handle);
    io.write(`${GREEN}[OK]${R} welcome, ${CYAN}${handle}${R}.\n\n`);
    return handle;
  }

  // ── cold open letter ──────────────────────────────────────────────
  async function coldOpen(io, handle) {
    pageBreak(io);
    io.writeWrapped(
`${GREEN}╔════════════════════════════════════════════════════════════════════╗${R}
${GREEN}║${R}                     ${GOLD}M O U S E   B I T E S   I N C .${R}                ${GREEN}║${R}
${GREEN}║${R}                ${CYAN_DIM}Office of Junior Sniffer Recruitment${R}                ${GREEN}║${R}
${GREEN}╚════════════════════════════════════════════════════════════════════╝${R}

${GOLD}Dear ${WHITE}${handle}${GOLD},${R}

Thank you for your interest in the ${CYAN}Junior Sniffer${R} position at ${WHITE}Mouse Bites Inc.${R}

Due to the number of applications we receive -- daily, every second, while you are probably sleeping or on the toilet, and generally how much everyone loves our company and it's so ${MAGENTA}fucking incredible${R} -- we will not be able to directly respect, or even conceive of, your individual personal agency, let alone your skills or value as a prospective employee.

Regardless of performance during the assessment, ${RED}the CEO's son-in-law will receive the position anyway.${R} You think you deserve this pain. ${B}${WHITE}You don't.${R}
`);
    io.write(`\n  ${DIM}Press ${R}${WHITE}Enter${R}${DIM} to begin the application${R}`);
    await io.waitEnter();
  }

  // ── OPERATION PARMESAN ROSE intro ─────────────────────────────────
  async function task2Intro(io, handle) {
    pageBreak(io);
    io.writeWrapped(
`${GOLD}WELCOME TO OPERATION PARMESAN ROSE${R}
${GREEN}══════════════════════════════════${R}

${WHITE}Mouse Bites Inc.${R} has received intel that the ${RED}Crazy Ants${R}, our rival concern, are planning a private equity roll-up play in the fragmented hotel fragrances and potpourri sector during FY Q3 2026. ${DIM}Here's why we think that:${R}

  ${GOLD}-${R} Respiratory therapists at local urgent care clinics report clusters of new-onset reactive airway cases in residents of three subway-accessible facilities this year.

  ${GOLD}-${R} Department of State filing cross-references the institutional purchasing data via a RTK request to the Bucks County purchasing office, and matches the ${RED}Crazy Ants Fragrance Compounder Subsidiary${R} SDS sheets.

  ${GOLD}-${R} "SAME ARTISAN QUALITY, NEW OWNERSHIP" signs are appearing at Mom-and-pop crafters and aging Yankee Candle mall kiosks across Mischief City.

We see the vague shape of it but need the deck itself -- some sensitive data like maybe an IC memo we could use to cripple the ${RED}Ants${R}' play before they start yoking investors. That's where you come in, ${CYAN}${handle}${R}. Your assignment: obtain that data. ${B}${WHITE}By any means at your disposal.${R}

Start by scanning the ${RED}Ants${R}' network. Find a back-office host wired into their fragrance compounding subsidiary.
`);
    io.write(`\n  ${DIM}Press ${R}${WHITE}Enter${R}${DIM} to enter the m0usunet shell${R}`);
    await io.waitEnter();
  }

  // ── game shell (TASK 2 interactive phase) ────────────────────────
  async function gameShell(io, handle) {
    pageBreak(io);
    if (window.M0useShell && window.M0useShell.run) {
      await window.M0useShell.run(io, { handle });
    } else {
      io.write(`${DIM}[shell.js not loaded — type ${R}${CYAN}continue${R}${DIM} to advance]${R}\n\n`);
      while (true) {
        const line = await io.readline({ prompt: `${RED}${handle}${R}@${GREEN}m0usunet${R}$ ` });
        if (line.trim() === "continue" || line.trim() === "exit") return;
      }
    }
  }

  // ── Assessment complete + hold ────────────────────────────────────
  async function assessmentComplete(io) {
    pageBreak(io);
    io.writeWrapped(
`
${GOLD}ASSESSMENT COMPLETE${R}
${GREEN}═══════════════════${R}

Thank you for your application. The Editor will be in touch.

${DIM}A reminder: the CEO's son-in-law will receive the position anyway.${R}
`);
    io.write("\n");

    // Hold the final screen indefinitely. The applicant closes the
    // browser tab when ready. Stray Enter presses are swallowed so
    // the cursor stays on the final screen.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await io.readline({ prompt: "", echo: false });
    }
  }

  // ── main ──────────────────────────────────────────────────────────
  async function run(io, opts) {
    let handle = (opts && opts.handle) || "cadet";

    handle = await namePrompt(io, handle);
    await coldOpen(io, handle);
    await task2Intro(io, handle);
    await gameShell(io, handle);
    await assessmentComplete(io);
  }

  window.M0usePortal = { run };
})();
