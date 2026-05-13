#!/usr/bin/env python3
# m0use-jenkins — fake Jenkins LTS 2.121.1 vulnerable to CVE-2018-1000861.
#
# Listens on BOTH 10.4.12.1:8080 (the gateway port-forward target) and
# 10.4.12.88:8080 (the actual jenkins-old host). The fact that the same
# service answers on both IPs is the indicator that the gateway is
# forwarding traffic to jenkins-old.
#
# Implements a minimal HTTP server with one vulnerable endpoint:
#   /jenkins/securityRealm/user/admin/descriptorByName/
#     org.jenkinsci.plugins.scriptsecurity.sandbox.groovy
#     .SecureGroovyScript/checkScript?value=<EXPR>
# which evaluates a tiny Groovy-like expression language without any
# authentication. Supported expressions:
#   println(<number>)        → returns "Result: <number>"
#   println("<string>")      → returns "Result: <string>"
#   new File("<path>").text  → returns the contents of <path> (the
#                              blueprint flag file lives at this path)

import asyncio
import re
import sys
import urllib.parse

LOGIN_PAGE = (
    b"<!DOCTYPE html><html lang=\"en\">\n"
    b"<head><title>Sign in [Jenkins]</title></head>\n"
    b"<body><h1>Jenkins</h1>\n"
    b"<form method=\"POST\" action=\"/jenkins/j_acegi_security_check\">\n"
    b"<label>Username: <input name=\"j_username\"></label>\n"
    b"<label>Password: <input name=\"j_password\" type=\"password\"></label>\n"
    b"<button type=\"submit\">Sign in</button>\n"
    b"</form></body></html>\n"
)


def http_resp(status, headers, body):
    if isinstance(body, str):
        body = body.encode()
    out = {"Content-Length": str(len(body)),
           "Server": "Jetty(9.4.z-SNAPSHOT)",
           "X-Jenkins": "2.121.1"}
    out.update(headers or {})
    head = "\r\n".join(f"{k}: {v}" for k, v in out.items())
    return f"HTTP/1.1 {status}\r\n{head}\r\n\r\n".encode() + body


def eval_groovy(expr):
    """Tiny Groovy-ish evaluator for the vulnerable endpoint."""
    expr = (expr or "").strip()
    # new File("path").text  →  read file
    m = re.match(r'^new\s+File\(["\'](.+?)["\']\)\s*\.\s*text\s*$', expr)
    if m:
        path = m.group(1)
        try:
            with open(path, "r", errors="replace") as f:
                return f.read()
        except FileNotFoundError:
            return f"Result: <FileNotFoundException: {path}>"
        except PermissionError:
            return f"Result: <PermissionDenied: {path}>"
        except Exception as e:
            return f"Result: <IOException: {e}>"
    # println(N)  where N is a number
    m = re.match(r'^println\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)\s*$', expr)
    if m:
        return f"Result: {m.group(1)}"
    # println("...") or println('...')
    m = re.match(r'^println\(\s*["\'](.*?)["\']\s*\)\s*$', expr)
    if m:
        return f"Result: {m.group(1)}"
    # Anything else
    return ("Result: <ScriptException: cannot parse expression>\n"
            "  supported: println(N), println(\"...\"),"
            " new File(\"path\").text\n")


CHECK_SCRIPT_PREFIX = (
    "/jenkins/securityRealm/user/admin/descriptorByName/"
    "org.jenkinsci.plugins.scriptsecurity.sandbox.groovy"
    ".SecureGroovyScript/checkScript"
)


async def handle(reader, writer):
    try:
        first = await asyncio.wait_for(reader.readline(), timeout=5.0)
        first = first.decode("latin-1", errors="replace").rstrip("\r\n")
        if not first:
            writer.close(); return
        parts = first.split(" ")
        if len(parts) < 3:
            writer.write(http_resp("400 Bad Request",
                                   {"Content-Type": "text/plain"},
                                   b"bad request\n"))
            await writer.drain(); writer.close(); return
        method, target, _ = parts[0], parts[1], parts[2]

        # Consume the rest of the headers (we don't need them).
        for _ in range(64):
            line = await asyncio.wait_for(reader.readline(), timeout=2.0)
            if not line or line.rstrip(b"\r\n") == b"":
                break

        path, _, qs = target.partition("?")
        params = urllib.parse.parse_qs(qs) if qs else {}

        # Strip trailing slash
        norm = path.rstrip("/")

        if norm in ("", "/jenkins", "/"):
            writer.write(http_resp("200 OK",
                                   {"Content-Type": "text/html;charset=utf-8"},
                                   LOGIN_PAGE))
        elif norm == "/jenkins/login":
            writer.write(http_resp("401 Unauthorized",
                                   {"WWW-Authenticate": 'Basic realm="Jenkins"',
                                    "Content-Type": "text/plain"},
                                   b"authentication required\n"))
        elif norm.startswith(CHECK_SCRIPT_PREFIX):
            value = params.get("value", [""])[0]
            result = eval_groovy(value)
            writer.write(http_resp("200 OK",
                                   {"Content-Type": "text/plain;charset=utf-8"},
                                   result))
        elif norm.startswith("/jenkins/manage") or norm.startswith("/jenkins/script") or norm.startswith("/jenkins/configure"):
            writer.write(http_resp("403 Forbidden",
                                   {"Content-Type": "text/plain"},
                                   b"forbidden\n"))
        else:
            writer.write(http_resp("404 Not Found",
                                   {"Content-Type": "text/plain"},
                                   b"not found\n"))
        await writer.drain()
    except asyncio.TimeoutError:
        pass
    except Exception as e:
        try:
            writer.write(http_resp("500 Internal Server Error",
                                   {"Content-Type": "text/plain"},
                                   str(e).encode()))
            await writer.drain()
        except Exception:
            pass
    finally:
        try: writer.close()
        except Exception: pass


async def main():
    binds = [("10.4.12.1", 8080), ("10.4.12.88", 8080)]
    servers = []
    for ip, port in binds:
        try:
            srv = await asyncio.start_server(handle, ip, port, reuse_address=True)
            servers.append(srv)
            print(f"m0use-jenkins: listening on {ip}:{port}", file=sys.stderr)
        except OSError as e:
            print(f"m0use-jenkins: bind {ip}:{port} failed: {e}", file=sys.stderr)
    if not servers:
        return
    await asyncio.gather(*(s.serve_forever() for s in servers))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
