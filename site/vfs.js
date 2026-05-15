// vfs.js — virtual filesystem for the game shell. Mirrors the
// /mnt/kit/* layout the v86 build used to ship on hdb (kit.img),
// plus /mnt/exec/ic-memo.txt where the Crazy Ants' fileshare lives.
// Content is lazy-fetched from the live site over HTTP and cached
// per-session.

(function () {
  "use strict";

  function f(url) { return { type: "file", url }; }
  function d(children) { return { type: "dir", children }; }
  function sym(target) { return { type: "symlink", target }; }

  // Helper: build a flat children object from a count + name fn + url fn.
  // Replaces Object.fromEntries (Chrome 73+, Safari 12.1+) with a
  // plain loop so the vfs tree initializes on older mobile browsers.
  function dirOfNumbered(count, nameFn, urlFn) {
    const out = {};
    for (let i = 1; i <= count; i++) {
      const name = nameFn(i);
      out[name] = f(urlFn(name));
    }
    return out;
  }

  // Static tree. Symlink targets resolve relative to their parent.
  const TREE = {
    mnt: d({
      kit: d({
        briefing:  f("kit-content/briefing"),
        BRIEFING:  sym("briefing"),
        nmap: d({
          brief:  f("kit-content/nmap/brief"),
          hint:   f("kit-content/nmap/hint"),
          BRIEF:  sym("brief"),
          readme: sym("brief"),
        }),
        nikto: d({
          advisories: f("kit-content/nikto/advisories"),
          hint:       f("kit-content/nikto/hint"),
        }),
        burp: (function () {
          const c = { hint: f("kit-content/burp/hint") };
          const items = dirOfNumbered(
            20,
            (i) => "req_" + String(i).padStart(3, "0") + ".txt",
            (n) => "kit-content/burp/" + n
          );
          for (const k in items) c[k] = items[k];
          return d(c);
        })(),
        msf: d({
          brief:  f("kit-content/msf/brief"),
          hint:   f("kit-content/msf/hint"),
          BRIEF:  sym("brief"),
          readme: sym("brief"),
          modules: d(dirOfNumbered(
            15,
            (i) => "mod_" + String(i).padStart(2, "0") + ".txt",
            (n) => "kit-content/msf/modules/" + n
          )),
          payloads: d(dirOfNumbered(
            8,
            (i) => "pay_" + String(i).padStart(2, "0") + ".txt",
            (n) => "kit-content/msf/payloads/" + n
          )),
        }),
      }),
      exec: d({
        "ic-memo.txt": f("build/ic-memo.txt"),
      }),
    }),
  };

  function bustParam() {
    const p = new URLSearchParams(location.search).get("bust");
    return p ? `?bust=${encodeURIComponent(p)}` : "";
  }

  function canonicalize(p) {
    const parts = p.split("/");
    const out = [];
    for (const part of parts) {
      if (part === "" || part === ".") continue;
      if (part === "..") out.pop();
      else out.push(part);
    }
    return "/" + out.join("/");
  }

  // Resolve symlinks within their parent dir. Returns the final
  // node (file or dir) or null.
  function lookup(absPath) {
    const parts = absPath.split("/").filter(p => p);
    let parent = { type: "dir", children: TREE };
    let node = parent;
    for (const part of parts) {
      if (node.type !== "dir") return null;
      parent = node;
      let next = node.children[part];
      if (!next) return null;
      if (next.type === "symlink") {
        next = parent.children[next.target];
        if (!next) return null;
      }
      node = next;
    }
    return node;
  }

  const cache = new Map();

  async function readFile(absPath) {
    if (cache.has(absPath)) return cache.get(absPath);
    const node = lookup(absPath);
    if (!node || node.type !== "file") return null;
    try {
      const res = await fetch(node.url + bustParam());
      if (!res.ok) return null;
      const text = await res.text();
      cache.set(absPath, text);
      return text;
    } catch (_) {
      return null;
    }
  }

  function isDir(absPath) {
    const n = lookup(absPath);
    return !!(n && n.type === "dir");
  }

  function isFile(absPath) {
    const n = lookup(absPath);
    return !!(n && n.type === "file");
  }

  function listDir(absPath) {
    const n = lookup(absPath);
    if (!n || n.type !== "dir") return null;
    return Object.keys(n.children);
  }

  window.M0useVFS = { canonicalize, lookup, readFile, isDir, isFile, listDir };
})();
