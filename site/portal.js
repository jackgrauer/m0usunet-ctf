// portal.js — the four-task Junior Sniffer aptitude battery,
// ported from build/m0use-portal.sh. Same flow:
//
//   TASK 1 (pre-auth -- go to Jefferson Square Park)
//     -> ENTRY PASSWORD (4161)
//     -> NAME PROMPT
//     -> Cold-open letter
//     -> TASK 2 OPERATION PARMESAN ROSE intro
//     -> [game shell — stub here; ported in step 3]
//     -> HQ PASSWORD (1736)
//     -> TASK 3 THE CULINARY ART
//     -> TASK 4 PASSWORD (3750)
//     -> TASK 4 EMOTIONAL INTELLIGENCE reflection
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

  async function passwordGate(io, label, expected) {
    while (true) {
      const pw = await io.readline({ prompt: `${PROMPT} ${DIM}${label}:${R} ` });
      if (pw.trim() === expected) {
        io.write(`${GREEN}[OK]${R} accepted\n\n`);
        return;
      }
      io.write(`${RED}[!!]${R} incorrect.\n\n`);
    }
  }

  // ── TASK 1 (pre-auth) ─────────────────────────────────────────────
  async function task1(io) {
    pageBreak(io);
    io.writeWrapped(
`${GOLD}TASK 1) RESOURCEFULNESS${R}
${GREEN}═══════════════════════${R}

Proceed to a store you think sells the item you have been tasked to supply. If inclined, buy a second item with which you like to cook.

If you're ${RED}fucking Austin Horse${R} or whatever, buy shit at ${CYAN}HMart${R} or ${CYAN}Sabzi Mandi${R} at 69th & Market St. I don't care.

If you're cheap, present receipt to Mouse Bites Inc. ${GOLD}Craft Services Accounting Unit${R} staff for reimbursement.

Proceed with food items to the center of ${CYAN}Jefferson Square Park${R} between 3rd St. and 4th St. and Federal St. and Washington Ave. There, you will be provided ${GREEN}m0usunet access credentials${R}.

${DIM}Return to this terminal and enter the password to log in.${R}
`);
    io.write("\n");
  }

  // ── name prompt ───────────────────────────────────────────────────
  async function namePrompt(io, prefill) {
    io.write("\n");
    io.writeWrapped(
`${DIM}Pick a callsign. This is the name the assessment will use to address you. Or just press Enter to keep the random one we already gave you: ${R}${CYAN}${prefill}${R}${DIM}.${R}
`);
    io.write("\n");
    const input = await io.readline({
      prompt: `${PROMPT} ${DIM}your callsign (press Enter for ${R}${CYAN}${prefill}${R}${DIM}):${R} `,
    });
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

Regardless of performance during the assessment, ${RED}the CEO's son-in-law will receive the position anyway.${R} Save your energy. Don't try very hard. Enjoy yourself. You think you deserve this pain. ${B}${WHITE}You don't.${R}

The ${WHITE}Junior Sniffer assessment${R} consists of four parts, each targeting one aptitude expected of Mouse Bites Inc. Junior Sniffers:

   ${GOLD}1)${R}  ${GREEN}resourcefulness${R}    ${DIM}(complete -- you got here)${R}
   ${GOLD}2)${R}  ${CYAN}intuition${R}          ${DIM}(next -- at this terminal)${R}
   ${GOLD}3)${R}  ${GOLD}the culinary art${R}   ${DIM}(at HQ, after this)${R}
   ${GOLD}4)${R}  ${MAGENTA}emotional intelligence${R}
`);
    io.write(`\n  ${DIM}Press ${R}${WHITE}Enter${R}${DIM} to begin TASK 2${R}`);
    await io.waitEnter();
  }

  // ── TASK 2 intro ──────────────────────────────────────────────────
  async function task2Intro(io, handle) {
    pageBreak(io);
    io.writeWrapped(
`${GOLD}TASK 2) OPERATION PARMESAN ROSE${R}
${GREEN}═══════════════════════════════${R}

${WHITE}Mouse Bites Inc.${R} has received intel that the ${RED}Crazy Ants${R}, our rival concern, are planning something major.

We suspect a private equity roll-up play in the fragmented hotel fragrances and potpourri sector in FY Q3 2026.

${DIM}What we know so far:${R}

  ${GOLD}-${R} Respiratory therapists at local urgent care clinics report clusters of new-onset reactive airway cases in residents of three subway-accessible facilities this year.

  ${GOLD}-${R} Department of State filing cross-references the institutional purchasing data via a RTK request to the Bucks County purchasing office, and matches the ${RED}Crazy Ants Fragrance Compounder Subsidiary${R} SDS sheets (obtained through an OSHA 300 log FOIA on the contract facility) against the Protected Substances List.

  ${GOLD}-${R} "SAME ARTISAN QUALITY, NEW OWNERSHIP" signs are appearing at Mom-and-pop crafters and aging Yankee Candle mall kiosks across Mischief City.

Right now we can see the shape. We need the deck itself -- the IC memo. That's where you come in, ${CYAN}${handle}${R}. We need to cripple the ${RED}Ants${R}' play before they start yoking investors.

Your first assignment: scan the ${RED}Crazy Ants${R} network with ${CYAN}nmap${R} and find the back-office host that's accidentally exposed to the outside -- the one wired into their fragrance compounding subsidiary.
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

  // ── TASK 3 ────────────────────────────────────────────────────────
  async function task3(io) {
    pageBreak(io);
    io.writeWrapped(
`${GOLD}TASK 3) THE CULINARY ART${R}
${GREEN}════════════════════════${R}

Proceed to HQ.

Upon arrival at HQ, you will be provided ${WHITE}tofu and rice${R}. Using ingredients supplied by fellow applicants and yourself, prepare a ${GOLD}visually appealing dish that tastes like something${R}.

Your dish will be assessed via ${MAGENTA}blind peer review${R}.
`);
    io.write("\n");
  }

  // ── TASK 4 reflection ─────────────────────────────────────────────
  async function task4Reflection(io) {
    pageBreak(io);
    io.writeWrapped(
`${GOLD}TASK 4) EMOTIONAL INTELLIGENCE${R}
${GREEN}══════════════════════════════${R}

Reflect on the evening's events. Write a statement, directed to a fellow participant, in four sections:

   ${CYAN}1)  WHEN YOU${R}     ${DIM}-- the behavior you observed${R}
   ${CYAN}2)  I FEEL${R}       ${DIM}-- the emotion it produced${R}
   ${CYAN}3)  I NEED${R}       ${DIM}-- what you require going forward${R}
   ${CYAN}4)  WOULD YOU${R}    ${DIM}-- the specific request you're making${R}

You'll be prompted for each section in turn. Type freely, multi-line is fine. Press ENTER on a blank line to move to the next section.
`);
    io.write("\n");

    const reflection = {};
    for (const label of ["WHEN YOU", "I FEEL", "I NEED", "WOULD YOU"]) {
      io.write(`${CYAN}${label}${R}\n`);
      reflection[label] = await io.readBlock();
      io.write("\n");
    }
    try {
      localStorage.setItem(
        "m0use_reflection_" + Date.now(),
        JSON.stringify({ ts: Date.now(), reflection })
      );
    } catch (_) {}
  }

  // ── Assessment complete + hold ────────────────────────────────────
  async function assessmentComplete(io) {
    pageBreak(io);
    io.writeWrapped(
`
${GOLD}ASSESSMENT COMPLETE${R}
${GREEN}═══════════════════${R}

${GREEN_DIM}Reflection statement saved.${R}

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

    await task1(io);
    await passwordGate(io, "enter password", "4161");
    handle = await namePrompt(io, handle);
    await coldOpen(io, handle);
    await task2Intro(io, handle);
    await gameShell(io, handle);

    pageBreak(io);
    io.write(`${GREEN_DIM}operator returning from m0usunet shell...${R}\n\n`);
    await passwordGate(io, "enter password to proceed to TASK 3", "1736");
    await task3(io);

    await passwordGate(io, "enter password to proceed to TASK 4", "3750");
    await task4Reflection(io);

    await assessmentComplete(io);
  }

  window.M0usePortal = { run };
})();
