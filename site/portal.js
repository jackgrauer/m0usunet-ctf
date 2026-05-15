// portal.js — entry point handed control after the boot animation.
// SKELETON: stubbed loop so we can verify the boot → portal handoff
// works end-to-end before porting the real TASK 1/2/3/4 narrative.

(function () {
  "use strict";

  const C = (s) => `\x1b[1;36m${s}\x1b[0m`;
  const Y = (s) => `\x1b[1;33m${s}\x1b[0m`;
  const D = (s) => `\x1b[2m${s}\x1b[0m`;
  const G = (s) => `\x1b[1;32m${s}\x1b[0m`;

  async function run(io, { handle }) {
    io.write("\r\n");
    io.write(Y("  m0usunet portal — SKELETON BUILD") + "\r\n");
    io.write(D("  boot handoff successful. handle = ") + C(handle) + "\r\n");
    io.write("\r\n");
    io.write("  This is a stub. Type anything and press Enter to echo.\r\n");
    io.write(D("  Type ") + C("quit") + D(" to stop the stub loop.") + "\r\n");
    io.write("\r\n");

    const prompt = `${C(handle)}@${G("m0usunet")}:${D("~")}$ `;
    while (true) {
      const line = await io.readline({ prompt });
      const t = line.trim();
      if (!t) continue;
      if (t === "quit" || t === "exit") {
        io.write(D("[stub] portal exiting. (real portal would advance here.)") + "\r\n");
        return;
      }
      io.write(D(`[stub] echo: ${t}`) + "\r\n");
    }
  }

  window.M0usePortal = { run };
})();
