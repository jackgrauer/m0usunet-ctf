#!/usr/bin/env python3
# fake-msfconsole -- enough of the real msfconsole REPL to walk the
# player through CVE-2018-1000861 against the Crazy Ants Jenkins
# host. Same structure a real session has: search → use → show
# options → set → check → exploit → shell session → cat the flag
# file → exit back out.

import os
import re
import shlex
import subprocess
import sys
import time

# ─── colors ────────────────────────────────────────────────────────
R       = "\x1b[0m"
DIM     = "\x1b[2m"
BOLD    = "\x1b[1m"
RED_B   = "\x1b[1;31m"
GREEN_B = "\x1b[1;32m"
GOLD_B  = "\x1b[1;33m"
CYAN_B  = "\x1b[1;36m"
WHITE_B = "\x1b[1;37m"

# ─── canned module data ────────────────────────────────────────────
MODULE = {
    "path": "exploit/multi/http/jenkins_metaprogramming",
    "name": "Jenkins ACL Bypass and Metaprogramming RCE",
    "disclosed": "2019-01-08",
    "rank": "excellent",
    "description": "Jenkins Stapler URL router accepts unauthenticated invocations of"
                   " arbitrary methods on internal objects, including the Groovy"
                   " script console. Yields RCE on Jenkins 2.138 / LTS 2.121.1"
                   " and earlier.",
    "cves": ["CVE-2018-1000861"],
    "target_versions": "Jenkins ≤ 2.138 / LTS ≤ 2.121.1",
    "payload": "generic/shell_reverse_tcp",
}

OPTION_DEFAULTS = {
    "RHOSTS":    {"value": "",     "required": True,  "desc": "The target host(s)"},
    "RPORT":     {"value": "8080", "required": True,  "desc": "The target port (TCP)"},
    "SSL":       {"value": "false","required": False, "desc": "Negotiate SSL/TLS"},
    "TARGETURI": {"value": "/",    "required": True,  "desc": "The application URI"},
    "VHOST":     {"value": "",     "required": False, "desc": "HTTP server virtual host"},
    "PROXIES":   {"value": "",     "required": False, "desc": "Proxy chain"},
    # Payload options
    "LHOST":     {"value": "",     "required": True,  "desc": "The listen address"},
    "LPORT":     {"value": "4444", "required": True,  "desc": "The listen port"},
}

VALID_RHOSTS = {"10.4.12.1", "gw.crazy.ants",
                "10.4.12.88", "jenkins-old.internal.crazy.ants",
                "legacy-build-03.crazy.ants"}


def banner():
    sys.stdout.write(
f"""
{DIM}       =[ metasploit v6.3.55-dev                          ]{R}
{DIM}+ -- --=[ 2367 exploits - 1218 auxiliary - 413 post       ]{R}
{DIM}+ -- --=[ 1442 payloads - 47 encoders - 11 nops           ]{R}
{DIM}+ -- --=[ 9 evasion                                       ]{R}

{DIM}Metasploit tip: Use {WHITE_B}sessions{R}{DIM} to list active sessions{R}
{DIM}Metasploit Documentation: {WHITE_B}https://docs.metasploit.com/{R}

""")


def prompt(state):
    if state["session"]:
        # session prompt is bare -- same as a real shell
        return ""
    if state["module"]:
        return f"{RED_B}msf6{R} {BOLD}exploit({CYAN_B}multi/http/jenkins_metaprogramming{R}{BOLD}){R} > "
    return f"{RED_B}msf6{R} > "


def cmd_help():
    sys.stdout.write(
"""
Core Commands
=============
    help                  Show this help (this card)
    banner                Display the metasploit banner
    search <term>         Look up modules by keyword (e.g. CVE id, software)
    use <module>          Select a module by path or by search-result index
    back                  Move back from the current context
    info                  Display info about the selected module
    show options          Show options for the current module
    show payloads         Show compatible payloads
    set <opt> <value>     Set an option
    unset <opt>           Clear an option
    check                 Probe the target without exploiting
    exploit | run         Launch the exploit against the configured target
    sessions              List active sessions
    exit | quit           Leave msfconsole
""")


# ─── command handlers ──────────────────────────────────────────────
def do_search(state, args):
    q = " ".join(args).strip().lower()
    if not q:
        sys.stdout.write("[-] usage: search <term>\n")
        return
    hits = []
    if any(c.lower() in q for c in MODULE["cves"]) or "jenkins" in q or "stapler" in q \
       or "metaprogramming" in q or "1000861" in q:
        hits.append(MODULE)

    if not hits:
        sys.stdout.write(f"\nNo results from search for: {q}\n\n")
        return

    sys.stdout.write(f"""
Matching Modules
================
   {BOLD}#  Name                                                  Disclosure   Rank       Description{R}
   -  ----                                                  ----------   ----       -----------
""")
    for i, m in enumerate(hits):
        sys.stdout.write(
            f"   {i}  {CYAN_B}{m['path']}{R}    {m['disclosed']}   "
            f"{GREEN_B}{m['rank']}{R}  {m['name']}\n"
        )
    sys.stdout.write("\n")


def do_use(state, args):
    if not args:
        sys.stdout.write("[-] usage: use <module-path-or-index>\n")
        return
    arg = args[0]
    # Accept either the full path or the index 0 (we only have one module)
    if arg == "0" or arg == MODULE["path"] or arg.endswith("jenkins_metaprogramming"):
        state["module"] = MODULE
        state["options"] = {k: dict(v) for k, v in OPTION_DEFAULTS.items()}
        sys.stdout.write(f"[*] Using configured payload {WHITE_B}{MODULE['payload']}{R}\n")
    else:
        sys.stdout.write(f"[-] Failed to load module: {arg}\n")


def do_info(state):
    if not state["module"]:
        sys.stdout.write("[-] No module selected (use one first).\n")
        return
    m = state["module"]
    sys.stdout.write(f"""
       Name: {m['name']}
     Module: {m['path']}
   Platform: Unix
       Arch: cmd
       Rank: {m['rank']}
  Disclosed: {m['disclosed']}

  CVE: {", ".join(m['cves'])}

  Description:
    {m['description']}

  Targets:
    {m['target_versions']}

""")


def do_show(state, args):
    if not args:
        sys.stdout.write("[-] usage: show options | show payloads\n")
        return
    what = args[0].lower()
    if what == "options":
        if not state["module"]:
            sys.stdout.write("[-] No module selected.\n")
            return
        sys.stdout.write(f"\nModule options ({CYAN_B}{state['module']['path']}{R}):\n\n")
        sys.stdout.write(f"   {BOLD}Name       Current Setting  Required  Description{R}\n")
        sys.stdout.write(   "   ----       ---------------  --------  -----------\n")
        for k in ("PROXIES", "RHOSTS", "RPORT", "SSL", "TARGETURI", "VHOST"):
            o = state["options"][k]
            req = "yes" if o["required"] else "no"
            val = o["value"] or ""
            sys.stdout.write(f"   {k:<10} {val:<16} {req:<9} {o['desc']}\n")
        sys.stdout.write(f"\nPayload options ({CYAN_B}{state['module']['payload']}{R}):\n\n")
        sys.stdout.write(f"   {BOLD}Name   Current Setting  Required  Description{R}\n")
        sys.stdout.write(   "   ----   ---------------  --------  -----------\n")
        for k in ("LHOST", "LPORT"):
            o = state["options"][k]
            req = "yes" if o["required"] else "no"
            val = o["value"] or ""
            sys.stdout.write(f"   {k:<6} {val:<16} {req:<9} {o['desc']}\n")
        sys.stdout.write(f"\nExploit target:\n\n   Id  Name\n   --  ----\n   0   Unix In-Memory\n\n")
    elif what == "payloads":
        sys.stdout.write(f"""
Compatible Payloads
===================
   #   Name                                  Description
   -   ----                                  -----------
   0   {CYAN_B}generic/shell_reverse_tcp{R}    Connect back and spawn a command shell (default)
   1   cmd/unix/reverse_bash                 Bash one-liner reverse shell
   2   cmd/unix/reverse_python               Python reverse shell

""")
    else:
        sys.stdout.write(f"[-] show: don't know about '{what}'\n")


def do_set(state, args):
    if len(args) < 2:
        sys.stdout.write("[-] usage: set <option> <value>\n")
        return
    if not state["module"]:
        sys.stdout.write("[-] No module selected.\n")
        return
    opt = args[0].upper()
    val = " ".join(args[1:])
    if opt not in state["options"]:
        sys.stdout.write(f"[-] Unknown option: {opt}\n")
        return
    state["options"][opt]["value"] = val
    sys.stdout.write(f"{opt} => {val}\n")


def do_unset(state, args):
    if not args:
        sys.stdout.write("[-] usage: unset <option>\n")
        return
    if not state["module"]:
        sys.stdout.write("[-] No module selected.\n")
        return
    opt = args[0].upper()
    if opt in state["options"]:
        state["options"][opt]["value"] = OPTION_DEFAULTS[opt]["value"]
        sys.stdout.write(f"Unsetting {opt}...\n")


def required_unset(state):
    out = []
    for k, o in state["options"].items():
        if o["required"] and not o["value"]:
            out.append(k)
    return out


def target_is_real(rhost):
    return rhost in VALID_RHOSTS


def do_check(state):
    if not state["module"]:
        sys.stdout.write("[-] No module selected.\n")
        return
    missing = required_unset(state)
    if "RHOSTS" in missing:
        sys.stdout.write(f"[-] {RED_B}RHOSTS not set.{R} Try: set RHOSTS 10.4.12.1\n")
        return
    rhost = state["options"]["RHOSTS"]["value"]
    rport = state["options"]["RPORT"]["value"]
    if not target_is_real(rhost):
        sys.stdout.write(f"[*] {rhost}:{rport} - Sending check request\n")
        time.sleep(0.6)
        sys.stdout.write(f"[-] {rhost}:{rport} - {RED_B}Connection refused{R}.\n")
        return
    sys.stdout.write(f"[*] {rhost}:{rport} - Sending check request\n")
    time.sleep(0.5)
    sys.stdout.write(f"[+] {rhost}:{rport} - {GREEN_B}The target is vulnerable.{R} Jenkins 2.121.1 detected.\n")


def do_exploit(state):
    if not state["module"]:
        sys.stdout.write("[-] No module selected (use exploit/multi/http/jenkins_metaprogramming).\n")
        return
    missing = required_unset(state)
    if missing:
        sys.stdout.write(f"[-] {RED_B}Missing required options:{R} {', '.join(missing)}\n")
        if "RHOSTS" in missing:
            sys.stdout.write("    Try: set RHOSTS 10.4.12.1\n")
        if "LHOST" in missing:
            sys.stdout.write("    Try: set LHOST 10.4.12.99   (your callback address)\n")
        return
    rhost = state["options"]["RHOSTS"]["value"]
    rport = state["options"]["RPORT"]["value"]
    lhost = state["options"]["LHOST"]["value"]
    lport = state["options"]["LPORT"]["value"]
    if not target_is_real(rhost):
        sys.stdout.write(f"[*] Started reverse TCP handler on {lhost}:{lport}\n")
        time.sleep(0.5)
        sys.stdout.write(f"[-] {rhost}:{rport} - {RED_B}Exploit failed:{R} target not reachable.\n")
        sys.stdout.write(f"[*] Exploit completed, but no session was created.\n")
        return

    sys.stdout.write(f"[*] Started reverse TCP handler on {lhost}:{lport}\n")
    time.sleep(0.4)
    sys.stdout.write(f"[*] Running automatic check (\"set AutoCheck false\" to disable)\n")
    time.sleep(0.4)
    sys.stdout.write(f"[+] {rhost}:{rport} - {GREEN_B}The target is vulnerable.{R} Jenkins 2.121.1 detected.\n")
    time.sleep(0.3)
    sys.stdout.write(f"[*] Sending payload to /jenkins/securityRealm/user/admin/descriptorByName/...\n")
    time.sleep(0.6)
    sys.stdout.write(f"[*] Command Stager progress -  47.30% done (961/2031 bytes)\n")
    time.sleep(0.4)
    sys.stdout.write(f"[*] Command Stager progress - 100.00% done (2031/2031 bytes)\n")
    time.sleep(0.5)
    sys.stdout.write(f"[*] Sending stage ({3045380:,} bytes) to {rhost}\n")
    time.sleep(0.6)
    now = time.strftime("%Y-%m-%d %H:%M:%S %z") or "2026-05-14 14:02:18 +0000"
    sys.stdout.write(f"[*] {GREEN_B}Command shell session 1 opened{R} ({lhost}:{lport} -> {rhost}:{rport}) at {now}\n\n")
    state["session"] = 1
    sys.stdout.write(f"{DIM}you are now executing commands as the jenkins service account on the target.{R}\n")
    sys.stdout.write(f"{DIM}try:{R}  {CYAN_B}id{R}   {CYAN_B}cat /var/m0use/blueprint.txt{R}   {CYAN_B}exit{R}  (to leave the session)\n\n")


def do_sessions(state):
    if state["session"]:
        sys.stdout.write(f"\nActive sessions\n===============\n\n  Id  Type            Information\n  --  ----            -----------\n   1  shell unix      Jenkins 2.121.1 (10.4.12.1)\n\n")
    else:
        sys.stdout.write("No active sessions.\n")


# ─── session shell sub-REPL ────────────────────────────────────────
def run_session(state):
    """Player is "on the target". Pass commands to a real shell so
    `cat /var/m0use/blueprint.txt` works for free (the file is on
    this VM's disk). Spoof a handful of commands so the fiction
    holds (id, whoami, hostname show jenkins-flavored output)."""
    while state["session"]:
        try:
            line = input()
        except (EOFError, KeyboardInterrupt):
            line = "exit"
        line = line.strip()
        if not line:
            continue
        if line in ("background", "bg"):
            sys.stdout.write(f"[*] Backgrounding session 1...\n")
            state["session"] = None
            return
        if line in ("exit", "quit"):
            # Cascade out: close the session AND leave msfconsole.
            # Pentest pedants can `background` if they want to keep the
            # session alive, but for the walkthrough flow one `exit`
            # should drop the player back at the m0usenet prompt so
            # they can submit the flag.
            sys.stdout.write(f"[*] Closing session 1 and exiting metasploit.\n")
            state["session"] = None
            state["exit_after_session"] = True
            return
        # Spoof a few outputs so the player feels like they're on a
        # Jenkins box, not the m0usenet host.
        if line == "id":
            sys.stdout.write("uid=1000(jenkins) gid=1000(jenkins) groups=1000(jenkins)\n")
            continue
        if line == "whoami":
            sys.stdout.write("jenkins\n")
            continue
        if line == "hostname":
            sys.stdout.write("legacy-build-03\n")
            continue
        if line == "uname -a":
            sys.stdout.write("Linux legacy-build-03 5.10.0-amd64 #1 SMP Debian x86_64 GNU/Linux\n")
            continue
        if line == "pwd":
            sys.stdout.write("/var/lib/jenkins\n")
            continue
        # Pass anything else through to /bin/sh -- `cat`, `ls`, `head`,
        # etc. all work, which means `cat /var/m0use/blueprint.txt`
        # prints the real flag file.
        try:
            r = subprocess.run(["/bin/sh", "-c", line], capture_output=True, text=True, timeout=10)
            sys.stdout.write(r.stdout)
            if r.stderr:
                sys.stdout.write(r.stderr)
        except subprocess.TimeoutExpired:
            sys.stdout.write("[!] command timed out\n")
        # Nudge the player toward the exit once they've actually read
        # the blueprint -- otherwise they wander around the session
        # looking for what to do next.
        if "blueprint.txt" in line and "cat" in line:
            sys.stdout.write(f"\n{DIM}[*] Got the flag? Type {CYAN_B}exit{R}{DIM} to leave metasploit and submit it at the m0usenet prompt.{R}\n")


# ─── main REPL ─────────────────────────────────────────────────────
def main():
    # Module and callback address are pre-loaded for this engagement.
    # The "metasploit pattern" (search → use → options → set → check
    # → exploit) is in the brief as background; the player only has
    # to do the parts that carry the lesson: point at target, fire.
    state = {
        "module":  MODULE,
        "options": {k: dict(v) for k, v in OPTION_DEFAULTS.items()},
        "session": None,
        "exit_after_session": False,
    }
    state["options"]["LHOST"]["value"] = "10.4.12.99"
    banner()
    sys.stdout.write(
        f"{DIM}[*] Engagement preloaded:{R} {CYAN_B}{MODULE['path']}{R}\n"
        f"{DIM}[*] LHOST auto-set to {WHITE_B}10.4.12.99{R}{DIM} (your callback){R}\n"
        f"{DIM}[*] You need:{R}  {CYAN_B}set RHOSTS <target>{R}   {DIM}then{R}   {CYAN_B}exploit{R}\n\n"
    )
    while True:
        if state["session"]:
            run_session(state)
            if state.get("exit_after_session"):
                break
            continue
        try:
            sys.stdout.write(prompt(state))
            sys.stdout.flush()
            line = input()
        except (EOFError, KeyboardInterrupt):
            sys.stdout.write("\n")
            break
        line = line.strip()
        if not line:
            continue
        try:
            argv = shlex.split(line)
        except ValueError:
            argv = line.split()
        cmd, args = argv[0].lower(), argv[1:]

        if cmd in ("exit", "quit"):
            break
        elif cmd in ("help", "?"):
            cmd_help()
        elif cmd == "banner":
            banner()
        elif cmd == "search":
            do_search(state, args)
        elif cmd == "use":
            do_use(state, args)
        elif cmd == "back":
            state["module"] = None
            state["options"] = {}
        elif cmd == "info":
            do_info(state)
        elif cmd == "show":
            do_show(state, args)
        elif cmd == "set":
            do_set(state, args)
        elif cmd == "unset":
            do_unset(state, args)
        elif cmd == "check":
            do_check(state)
        elif cmd in ("exploit", "run"):
            do_exploit(state)
        elif cmd == "sessions":
            do_sessions(state)
        elif cmd == "cls" or cmd == "clear":
            sys.stdout.write("\x1b[2J\x1b[H")
        else:
            sys.stdout.write(f"[-] Unknown command: {cmd}\n")

    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
