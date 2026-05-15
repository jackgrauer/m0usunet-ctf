#!/usr/bin/env python3
# m0use-colorize -- filter for phase-done banners and other in-game
# prose. Reads stdin, applies syntax highlighting to known patterns,
# writes to stdout. When it sees a "--- next ---" rule, prints what
# it has so far, pauses for Enter, then continues -- so the player
# reads the post-success prose in two beats instead of having a wall
# of text dumped at them.

import re
import sys

R       = "\x1b[0m"
DIM     = "\x1b[2m"
CYAN_B  = "\x1b[1;36m"
GREEN_B = "\x1b[1;32m"
RED_B   = "\x1b[1;31m"
GOLD_B  = "\x1b[1;33m"
MAGENTA = "\x1b[1;35m"
WHITE_B = "\x1b[1;37m"

# CVE-YYYY-NNNNNN (also CVE_YYYY_NNNNNN form). Gold so they pop.
CVE_RE = re.compile(r'\b(CVE[-_]\d{4}[-_]\d+)\b')

# Tool / command names the player types. Cyan to match the in-shell
# command color scheme.
TOOL_RE = re.compile(
    r'(?<![A-Za-z0-9_-])'
    r'(nmap|nikto|curl|msfconsole|metasploit|msf|cat|cd|ls|less|grep|'
    r'answer|hint|readme|briefing|advisories|wrap)'
    r'(?![A-Za-z0-9_-])'
)

# <placeholder> bracketed prompts. Magenta so they read as fill-me-in.
PLACEHOLDER_RE = re.compile(r'<([^>\n]+)>')

# IP addresses (4-octet dotted). White-bold.
IP_RE = re.compile(r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?)\b')

# "next" rule marker -- the visual separator between the success
# pay-off and the instructions for the next step.
NEXT_RULE_RE = re.compile(r'^.*?--- next ---.*$|^.*?─── next ─.*$')

# A spelled-out [OK] / [!!] status tag.
OK_RE  = re.compile(r'\[OK\]')
BAD_RE = re.compile(r'\[!!\]')

# Bold section headers (ALL CAPS lines >= 4 chars). Used for things
# like "TO ADVANCE:" / "NEXT:" / "YOUR FIRST RUN".
HEADER_RE = re.compile(r'^([A-Z][A-Z0-9 \-]{2,})$')


def colorize(line: str) -> str:
    # Headers first (anchored to start; only matches whole-line caps).
    m = HEADER_RE.match(line.rstrip())
    if m and not any(c in line for c in "[<"):  # don't double-color tagged lines
        return GOLD_B + line.rstrip() + R + "\n"

    line = CVE_RE.sub(GOLD_B + r"\1" + R, line)
    line = TOOL_RE.sub(CYAN_B + r"\1" + R, line)
    line = PLACEHOLDER_RE.sub(MAGENTA + r"<\1>" + R, line)
    line = IP_RE.sub(WHITE_B + r"\1" + R, line)
    line = OK_RE.sub(GREEN_B + "[OK]" + R, line)
    line = BAD_RE.sub(RED_B + "[!!]" + R, line)
    return line


def main() -> int:
    pre, post = [], []
    saw_rule = False
    for raw in sys.stdin:
        if not saw_rule and NEXT_RULE_RE.match(raw):
            saw_rule = True
            rule_line = raw
            continue
        (post if saw_rule else pre).append(raw)

    for ln in pre:
        sys.stdout.write(colorize(ln))
    sys.stdout.flush()

    if saw_rule:
        sys.stdout.write(f"\n  {DIM}-- Press Enter to continue --{R}")
        sys.stdout.flush()
        try:
            input()
        except (KeyboardInterrupt, EOFError):
            sys.stdout.write("\n")
            return 0
        sys.stdout.write("\n")
        # Print the rule itself + everything after.
        sys.stdout.write(colorize(rule_line))
        for ln in post:
            sys.stdout.write(colorize(ln))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
