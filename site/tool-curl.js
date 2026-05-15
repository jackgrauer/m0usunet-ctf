// tool-curl.js — port of build/fake-curl.py. Recognizes the Jenkins
// checkScript URL pattern and the Groovy `value=` payload. The two
// payloads that matter:
//
//   value=println(42)                 -> "Result: 42"  (sanity check)
//   new File("/mnt/exec/ic-memo.txt").text
//                                     -> file contents (the IC memo)
//
// Everything else returns the appropriate Jenkins-shaped 404 / DNS
// fail so the player learns by trying.

(function () {
  "use strict";

  const MEMO_PATH = "/mnt/exec/ic-memo.txt";

  function usage(io) {
    io.write(
      "Usage: curl [options...] <url>\r\n" +
      " -d, --data <data>      HTTP POST data\r\n" +
      " -i, --include          Include protocol response headers in the output\r\n" +
      " -I, --head             Show document info only\r\n" +
      " -o, --output <file>    Write to file instead of stdout\r\n" +
      " -s, --silent           Silent mode\r\n" +
      " -S, --show-error       Show error even when -s is used\r\n" +
      " -X, --request <method> Specify request command to use\r\n" +
      " -v, --verbose          Make the operation more verbose\r\n" +
      " -h, --help             Get help for commands\r\n" +
      "\r\n" +
      "Note: this is a teaching shim. Only the Jenkins target is reachable.\r\n"
    );
  }

  function parseArgs(args) {
    const opts = {
      include: false, head: false, silent: false, show_error: false,
      verbose: false, method: null, data: null,
    };
    let url = null;
    let i = 0;
    let exitNow = false;
    while (i < args.length) {
      const a = args[i];
      if (a === "-h" || a === "--help") { exitNow = true; break; }
      if (a === "--") { i++; continue; }
      if (a === "-i" || a === "--include") opts.include = true;
      else if (a === "-I" || a === "--head") opts.head = true;
      else if (a === "-s" || a === "--silent") opts.silent = true;
      else if (a === "-S" || a === "--show-error") opts.show_error = true;
      else if (a === "-v" || a === "--verbose") opts.verbose = true;
      else if (a === "-X" || a === "--request") { i++; if (i < args.length) opts.method = args[i]; }
      else if (a === "-d" || a === "--data") { i++; if (i < args.length) opts.data = args[i]; }
      else if (a === "-o" || a === "--output") { i++; /* swallow filename */ }
      else if (/^-[isS]+$/.test(a)) {
        for (const c of a.slice(1)) {
          if (c === "i") opts.include = true;
          else if (c === "s") opts.silent = true;
          else if (c === "S") opts.show_error = true;
        }
      } else if (a.startsWith("-")) {
        // unknown short flag — swallow
      } else if (url === null) {
        url = a;
      }
      i++;
    }
    return { url, opts, exitNow };
  }

  const CHECK_SCRIPT_RE = /^\/jenkins\/securityRealm\/user\/[^/]+\/descriptorByName\/org\.jenkinsci\.plugins\.scriptsecurity\.sandbox\.groovy\.SecureGroovyScript\/checkScript$/;
  const PRINTLN_RE = /^\s*println\s*\(\s*(-?\d+)\s*\)\s*$/;
  const FILE_READ_RE = /^\s*new\s+File\s*\(\s*"([^"]+)"\s*\)\.text\s*$/;

  function httpResponse(code, reason, body, opts, ctype = "text/html;charset=UTF-8") {
    const out = [];
    if (opts.include || opts.head) {
      out.push(`HTTP/1.1 ${code} ${reason}`);
      out.push("Server: Jetty(9.4.27.v20200227)");
      out.push("X-Content-Type-Options: nosniff");
      out.push("X-Hudson: 1.395");
      out.push("X-Jenkins: 2.121.1");
      out.push("X-Jenkins-Session: 0b0a9c12");
      out.push(`Content-Type: ${ctype}`);
      out.push(`Content-Length: ${new TextEncoder().encode(body).length}`);
      out.push("Connection: close");
      out.push("");
    }
    if (!opts.head) out.push(body.replace(/\n+$/, ""));
    return out.join("\n") + "\n";
  }

  async function respondJenkinsCheckscript(value, opts) {
    let m = PRINTLN_RE.exec(value);
    if (m) {
      const body = `Result: ${m[1]}\n`;
      return httpResponse(200, "OK", body, opts, "text/plain;charset=UTF-8");
    }
    m = FILE_READ_RE.exec(value);
    if (m) {
      const path = m[1];
      if (path === MEMO_PATH) {
        let body;
        const content = await M0useVFS.readFile(MEMO_PATH);
        if (content == null) {
          body = "Result: \n";
        } else {
          body = "Result: " + content;
          if (!body.endsWith("\n")) body += "\n";
        }
        return httpResponse(200, "OK", body, opts, "text/plain;charset=UTF-8");
      }
      const body =
        "javax.servlet.ServletException: groovy.lang.GroovyRuntimeException: " +
        `java.io.FileNotFoundException: ${path} (No such file or directory)\n`;
      return httpResponse(500, "Internal Server Error", body, opts,
                          "text/plain;charset=UTF-8");
    }
    return httpResponse(200, "OK", "Result: \n", opts, "text/plain;charset=UTF-8");
  }

  function parseUrl(url) {
    // Minimal URL parser sufficient for our test corpus.
    try {
      const u = new URL(url);
      return {
        scheme: u.protocol.replace(/:$/, ""),
        host: u.hostname,
        port: u.port ? parseInt(u.port, 10) : (u.protocol === "https:" ? 443 : 80),
        path: u.pathname || "/",
        query: u.search.startsWith("?") ? u.search.slice(1) : u.search,
      };
    } catch (_) {
      return null;
    }
  }

  function parseQs(qs) {
    const out = {};
    if (!qs) return out;
    for (const pair of qs.split("&")) {
      const eq = pair.indexOf("=");
      const k = eq >= 0 ? pair.slice(0, eq) : pair;
      const v = eq >= 0 ? pair.slice(eq + 1) : "";
      try {
        out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
      } catch (_) {
        out[k] = v;
      }
    }
    return out;
  }

  async function run(io, args) {
    const { url, opts, exitNow } = parseArgs(args);
    if (exitNow) { usage(io); return; }
    if (url === null) {
      io.write("curl: try 'curl --help' for more information\r\n");
      return;
    }
    const parsed = parseUrl(url);
    if (!parsed || (parsed.scheme !== "http" && parsed.scheme !== "https")) {
      io.write(`curl: (1) Protocol "${parsed ? parsed.scheme : ""}" not supported or disabled in libcurl\r\n`);
      return;
    }

    const { host, port, path, query } = parsed;
    const validTargets = [
      ["10.4.12.1", 8080], ["gw.crazy.ants", 8080],
      ["jenkins-old.internal.crazy.ants", 8080],
      ["legacy-build-03.crazy.ants", 8080],
      ["10.4.12.88", 8080],
    ];
    const hit = validTargets.some(([h, p]) => h === host && p === port);
    if (!hit) {
      await io.sleep(400);
      io.write(`curl: (7) Failed to connect to ${host} port ${port} after 250 ms: Connection refused\r\n`);
      return;
    }

    await io.sleep(300);

    if (CHECK_SCRIPT_RE.test(path)) {
      const qs = parseQs(query);
      const value = qs.value || "";
      io.write((await respondJenkinsCheckscript(value, opts)).replace(/\n/g, "\r\n"));
      return;
    }

    if (path === "/" || path === "/jenkins/" || path === "/jenkins/login") {
      const body =
        "<html><head><title>Dashboard [Jenkins]</title></head>\n" +
        "<body><h1>Jenkins 2.121.1</h1>\n" +
        "<p>Welcome to Jenkins.</p></body></html>\n";
      io.write(httpResponse(200, "OK", body, opts).replace(/\n/g, "\r\n"));
      return;
    }

    const body =
      "<html><head><title>Error 404 Not Found</title></head>\n" +
      "<body><h2>HTTP ERROR 404</h2><p>Not Found</p>\n" +
      "<hr><i><small>Powered by Jetty:// 9.4.27.v20200227</small></i></body></html>\n";
    io.write(httpResponse(404, "Not Found", body, opts).replace(/\n/g, "\r\n"));
  }

  window.M0useCurl = { run };
})();
