#!/usr/bin/env python3
# fake-curl -- recognizes the Jenkins checkScript URL pattern and the
# Groovy `value=` payload. Everything else gets a generic 404 / DNS
# fail so the player learns by trying. The two payloads that matter:
#
#   value=println(42)                 → "Result: 42"  (sanity check)
#   new File("/mnt/exec/ic-memo.txt").text
#                                     → file contents (the IC memo)

import re
import sys
import time
from urllib.parse import urlparse, parse_qs, unquote


MEMO_PATH = "/mnt/exec/ic-memo.txt"


def usage():
    sys.stdout.write(
        "Usage: curl [options...] <url>\n"
        " -d, --data <data>      HTTP POST data\n"
        " -i, --include          Include protocol response headers in the output\n"
        " -I, --head             Show document info only\n"
        " -o, --output <file>    Write to file instead of stdout\n"
        " -s, --silent           Silent mode\n"
        " -S, --show-error       Show error even when -s is used\n"
        " -X, --request <method> Specify request command to use\n"
        " -v, --verbose          Make the operation more verbose\n"
        " -h, --help             Get help for commands\n"
        "\n"
        "Note: this is a teaching shim. Only the Jenkins target is reachable.\n"
    )


def parse_args(argv):
    """Return (url, opts) where opts is a dict of recognized flags."""
    args = argv[1:]
    url = None
    opts = {
        "include": False,
        "head": False,
        "silent": False,
        "show_error": False,
        "verbose": False,
        "method": None,
        "data": None,
    }
    i = 0
    while i < len(args):
        a = args[i]
        if a in ("-h", "--help"):
            usage(); sys.exit(0)
        if a == "--":
            i += 1; continue
        if a in ("-i", "--include"):
            opts["include"] = True
        elif a in ("-I", "--head"):
            opts["head"] = True
        elif a in ("-s", "--silent"):
            opts["silent"] = True
        elif a in ("-S", "--show-error"):
            opts["show_error"] = True
        elif a in ("-v", "--verbose"):
            opts["verbose"] = True
        elif a in ("-X", "--request"):
            i += 1
            if i < len(args): opts["method"] = args[i]
        elif a in ("-d", "--data"):
            i += 1
            if i < len(args): opts["data"] = args[i]
        elif a in ("-o", "--output"):
            i += 1  # swallow the filename; we just write to stdout
        elif a.startswith("-is") or a.startswith("-Si") or a.startswith("-iS"):
            # cluster like -isS  → include + silent + show_error
            for c in a[1:]:
                if c == "i": opts["include"] = True
                elif c == "s": opts["silent"] = True
                elif c == "S": opts["show_error"] = True
        elif a.startswith("-"):
            # unknown short flag -- swallow quietly
            pass
        else:
            if url is None:
                url = a
        i += 1
    return url, opts


CHECK_SCRIPT_RE = re.compile(
    r"^/jenkins/securityRealm/user/[^/]+/descriptorByName/"
    r"org\.jenkinsci\.plugins\.scriptsecurity\.sandbox\.groovy\."
    r"SecureGroovyScript/checkScript$"
)

# Patterns inside the value= parameter we recognize.
PRINTLN_RE = re.compile(r"^\s*println\s*\(\s*(-?\d+)\s*\)\s*$")
FILE_READ_RE = re.compile(r'^\s*new\s+File\s*\(\s*"([^"]+)"\s*\)\.text\s*$')


def respond_jenkins_checkscript(value, opts):
    """Emit a Jenkins-shaped HTTP response for the value= payload."""
    m = PRINTLN_RE.match(value)
    if m:
        body = f"Result: {m.group(1)}\n"
        return http_response(200, "OK", body, opts, ctype="text/plain;charset=UTF-8")

    m = FILE_READ_RE.match(value)
    if m:
        path = m.group(1)
        if path == MEMO_PATH:
            try:
                with open(MEMO_PATH, "r") as f:
                    body = f.read()
            except OSError:
                body = "Result: \n"
            else:
                body = "Result: " + body
                if not body.endswith("\n"):
                    body += "\n"
            return http_response(200, "OK", body, opts, ctype="text/plain;charset=UTF-8")
        # Some other file path -- Groovy would throw FileNotFoundException.
        body = (
            "javax.servlet.ServletException: groovy.lang.GroovyRuntimeException: "
            f"java.io.FileNotFoundException: {path} (No such file or directory)\n"
        )
        return http_response(500, "Internal Server Error", body, opts,
                             ctype="text/plain;charset=UTF-8")

    # Anything else -- Jenkins responds 200 with empty body for unparsable
    # expressions in this endpoint. Mimic that so the player gets useful
    # feedback when they typo.
    body = "Result: \n"
    return http_response(200, "OK", body, opts, ctype="text/plain;charset=UTF-8")


def http_response(code, reason, body, opts, ctype="text/html;charset=UTF-8"):
    out = []
    if opts["include"] or opts["head"]:
        out.append(f"HTTP/1.1 {code} {reason}")
        out.append(f"Server: Jetty(9.4.27.v20200227)")
        out.append("X-Content-Type-Options: nosniff")
        out.append("X-Hudson: 1.395")
        out.append("X-Jenkins: 2.121.1")
        out.append("X-Jenkins-Session: 0b0a9c12")
        out.append(f"Content-Type: {ctype}")
        out.append(f"Content-Length: {len(body.encode('utf-8'))}")
        out.append("Connection: close")
        out.append("")  # blank line between headers + body
    if not opts["head"]:
        out.append(body.rstrip("\n"))
    return "\n".join(out) + "\n"


def main(argv):
    url, opts = parse_args(argv)
    if url is None:
        sys.stderr.write("curl: try 'curl --help' for more information\n")
        return 2

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        sys.stderr.write(f"curl: (1) Protocol \"{parsed.scheme}\" not supported or disabled in libcurl\n")
        return 1

    host = parsed.hostname or ""
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    # Only the Jenkins gateway answers.
    if (host, port) not in [("10.4.12.1", 8080), ("gw.crazy.ants", 8080),
                            ("jenkins-old.internal.crazy.ants", 8080),
                            ("legacy-build-03.crazy.ants", 8080),
                            ("10.4.12.88", 8080)]:
        # Generic curl-style failure.
        time.sleep(0.4)
        sys.stderr.write(f"curl: (7) Failed to connect to {host} port {port} after 250 ms: Connection refused\n")
        return 7

    # Brief "connecting" feel.
    time.sleep(0.3)

    path = parsed.path or "/"
    qs = parse_qs(parsed.query, keep_blank_values=True)

    if CHECK_SCRIPT_RE.match(path):
        value = unquote(qs.get("value", [""])[0])
        sys.stdout.write(respond_jenkins_checkscript(value, opts))
        return 0

    # Recognize a few other innocuous paths so the player gets a
    # consistent "Jenkins is here" feeling.
    if path in ("/", "/jenkins/", "/jenkins/login"):
        body = (
            "<html><head><title>Dashboard [Jenkins]</title></head>\n"
            "<body><h1>Jenkins 2.121.1</h1>\n"
            "<p>Welcome to Jenkins.</p></body></html>\n"
        )
        sys.stdout.write(http_response(200, "OK", body, opts))
        return 0

    body = (
        "<html><head><title>Error 404 Not Found</title></head>\n"
        "<body><h2>HTTP ERROR 404</h2><p>Not Found</p>\n"
        "<hr><i><small>Powered by Jetty:// 9.4.27.v20200227</small></i></body></html>\n"
    )
    sys.stdout.write(http_response(404, "Not Found", body, opts))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
