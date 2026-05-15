// colorize.js — port of build/m0use-colorize.py. Tags tool names,
// CVE ids, IPs, placeholders, status tags, and ALL-CAPS headers in
// any text we want to render with the in-game color scheme. Honors
// the "--- next ---" rule: returns a {pre, rule, post, gated}
// breakdown so the caller can press-Enter gate between the two
// halves.

(function () {
  "use strict";

  const R       = "\x1b[0m";
  const DIM     = "\x1b[2m";
  const CYAN_B  = "\x1b[1;36m";
  const GREEN_B = "\x1b[1;32m";
  const RED_B   = "\x1b[1;31m";
  const GOLD_B  = "\x1b[1;33m";
  const MAGENTA = "\x1b[1;35m";
  const WHITE_B = "\x1b[1;37m";

  const CVE_RE = /\b(CVE[-_]\d{4}[-_]\d+)\b/g;
  // Cyan tool / command names. The leading boundary is a captured
  // group (start-of-string OR a non-word char) instead of a lookbehind
  // (?<!...) so this parses on Safari < 16.4 / iOS 16.3 and earlier.
  // Apply via a callback that puts the captured prefix back unchanged.
  const TOOL_RE = new RegExp(
    "(^|[^A-Za-z0-9_-])" +
    "(nmap|nikto|curl|msfconsole|metasploit|msf|cat|cd|ls|less|grep|" +
    "answer|hint|brief|briefing|advisories|wrap|" +
    "set|exploit|check|search|exit|continue|RHOSTS|LHOST)" +
    "(?![A-Za-z0-9_-])",
    "g"
  );
  const PLACEHOLDER_RE = /<([^>\n]+)>/g;
  const IP_RE          = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?)\b/g;
  const NEXT_RULE_RE   = /^.*?--- next ---.*$|^.*?─── next ─.*$/;
  const OK_RE          = /\[OK\]/g;
  const BAD_RE         = /\[!!\]/g;
  const HEADER_RE      = /^([A-Z][A-Z0-9 \-]{2,})$/;

  function colorizeLine(line) {
    const trimmed = line.replace(/\s+$/, "");
    const m = HEADER_RE.exec(trimmed);
    if (m && !/[\[<]/.test(line)) {
      return GOLD_B + trimmed + R;
    }
    let s = line;
    s = s.replace(CVE_RE,         GOLD_B + "$1" + R);
    // TOOL_RE captures a leading boundary char (or empty for start).
    // Preserve it in the replacement so we don't eat the prefix.
    s = s.replace(TOOL_RE, (_match, prefix, name) =>
      prefix + CYAN_B + name + R);
    s = s.replace(PLACEHOLDER_RE, MAGENTA + "<$1>" + R);
    s = s.replace(IP_RE,          WHITE_B + "$1" + R);
    s = s.replace(OK_RE,          GREEN_B + "[OK]" + R);
    s = s.replace(BAD_RE,         RED_B  + "[!!]" + R);
    return s;
  }

  // Returns { pre, rule, post, gated }. `pre` is the text before any
  // "--- next ---" rule (always colored). If gated, `rule` is the
  // rule line itself and `post` is the colored remainder. Caller
  // press-Enter gates between pre and post.
  function colorize(text) {
    const lines = text.split("\n");
    const pre = [], post = [];
    let saw = false;
    let ruleLine = "";
    for (const line of lines) {
      if (!saw && NEXT_RULE_RE.test(line)) {
        saw = true;
        ruleLine = line;
        continue;
      }
      (saw ? post : pre).push(line);
    }
    return {
      pre:   pre.map(colorizeLine).join("\n"),
      rule:  ruleLine,
      post:  saw ? post.map(colorizeLine).join("\n") : "",
      gated: saw,
    };
  }

  window.M0useColorize = { colorize, colorizeLine };
})();
