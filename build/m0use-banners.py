#!/usr/bin/env python3
# m0use-banners — multi-host fake service responder.
# Binds to every advertised (IP, PORT) on the fake crazy.ants network
# and replies with a canned banner so real nmap -sV can identify
# services. The Jenkins host (10.4.12.88:8080 and gateway forward
# at 10.4.12.1:8080) is handled by m0use-jenkins, not this script.

import asyncio
import sys

BANNERS = [
    # Gateway — corporate front page on 80/443, ssh on 22.
    # 10.4.12.1:8080 is the gateway port-forward to jenkins-old — that
    # binding lives in m0use-jenkins, not here.
    ("10.4.12.1",  22,   b"SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.11\r\n"),
    ("10.4.12.1",  80,   b"HTTP/1.0 200 OK\r\nServer: nginx/1.22.1\r\nContent-Type: text/html\r\n\r\n<html><title>crazy.ants \xe2\x80\x94 corporate</title><body>welcome to crazy.ants</body></html>\r\n"),
    ("10.4.12.1",  443,  b"HTTP/1.0 200 OK\r\nServer: nginx/1.22.1\r\nContent-Type: text/html\r\n\r\n<html><title>crazy.ants</title></html>\r\n"),
    # Mail
    ("10.4.12.10", 22,   b"SSH-2.0-OpenSSH_8.4p1 Debian-5+deb11u3\r\n"),
    ("10.4.12.10", 25,   b"220 mail.crazy.ants ESMTP Postfix\r\n"),
    ("10.4.12.10", 465,  b"220 mail.crazy.ants ESMTP Postfix\r\n"),
    ("10.4.12.10", 993,  b"* OK Dovecot ready.\r\n"),
    # Public website
    ("10.4.12.20", 80,   b"HTTP/1.0 200 OK\r\nServer: nginx/1.24.0\r\nContent-Type: text/html\r\n\r\n<html><title>crazy.ants</title></html>\r\n"),
    ("10.4.12.20", 443,  b"HTTP/1.0 200 OK\r\nServer: nginx/1.24.0\r\nContent-Type: text/html\r\n\r\n<html><title>crazy.ants</title></html>\r\n"),
    # API
    ("10.4.12.21", 8443, b"HTTP/1.0 200 OK\r\nServer: Kestrel\r\nContent-Type: text/html\r\n\r\n<html><title>api.crazy.ants v3</title></html>\r\n"),
    # Databases
    ("10.4.12.30", 22,   b"SSH-2.0-OpenSSH_8.9p1\r\n"),
    ("10.4.12.30", 5432, b""),
    ("10.4.12.31", 22,   b"SSH-2.0-OpenSSH_8.9p1\r\n"),
    ("10.4.12.31", 5432, b""),
    # Redis
    ("10.4.12.40", 22,   b"SSH-2.0-OpenSSH_8.9p1\r\n"),
    ("10.4.12.40", 6379, b"-ERR unknown command\r\n"),
    # OpenVPN
    ("10.4.12.50", 443,  b""),
    # CI server
    ("10.4.12.70", 22,   b"SSH-2.0-OpenSSH_9.3p1\r\n"),
    ("10.4.12.70", 80,   b"HTTP/1.0 200 OK\r\nServer: Caddy\r\nContent-Type: text/html\r\n\r\n<html><title>crazy.ants \xe2\x80\x94 Drone CI</title></html>\r\n"),
    ("10.4.12.70", 443,  b"HTTP/1.0 200 OK\r\nServer: Caddy\r\nContent-Type: text/html\r\n\r\n<html><title>crazy.ants \xe2\x80\x94 Drone CI</title></html>\r\n"),
    # Grafana
    ("10.4.12.80", 3000, b"HTTP/1.0 200 OK\r\nServer: nginx\r\nContent-Type: text/html\r\n\r\n<html><title>Grafana</title></html>\r\n"),
    # jenkins-old (legacy-build-03) — only ssh on this host directly;
    # the Jenkins service is exposed via the gateway port-forward.
    ("10.4.12.88", 22,   b"SSH-2.0-OpenSSH_7.4p1\r\n"),
    # Assets CDN
    ("10.4.12.99", 443,  b"HTTP/1.0 200 OK\r\nServer: nginx/1.24.0\r\nContent-Type: text/html\r\n\r\n<html><title>crazy.ants \xe2\x80\x94 assets CDN</title></html>\r\n"),
]


async def handle(reader, writer, banner):
    try:
        if banner:
            writer.write(banner)
            try: await writer.drain()
            except Exception: pass
        # Drain whatever the client sends and then close.
        try:
            await asyncio.wait_for(reader.read(4096), timeout=1.5)
        except Exception:
            pass
    except Exception:
        pass
    finally:
        try: writer.close()
        except Exception: pass


async def main():
    servers = []
    for ip, port, banner in BANNERS:
        try:
            srv = await asyncio.start_server(
                lambda r, w, b=banner: handle(r, w, b), ip, port,
                reuse_address=True)
            servers.append(srv)
            print(f"m0use-banners: listening on {ip}:{port}", file=sys.stderr)
        except OSError as e:
            print(f"m0use-banners: bind {ip}:{port} failed: {e}", file=sys.stderr)
    if not servers:
        print("m0use-banners: no listeners — aborting", file=sys.stderr)
        return
    await asyncio.gather(*(s.serve_forever() for s in servers))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
