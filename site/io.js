// io.js — terminal IO abstraction over xterm.js. Async readline +
// waitEnter for the portal/shell flow; raw write passes straight
// through. One reader at a time; pending input queues so fast
// typists don't lose keystrokes between prompts.

(function () {
  "use strict";

  // Catch the typical paste-of-doom and bracketed-paste markers.
  function sanitize(data) {
    return data
      .replace(/\r\n/g, "\r")
      .replace(/\x1b\[200~/g, "")
      .replace(/\x1b\[201~/g, "");
  }

  // ── ANSI-aware word-wrap (port of build/m0use-wrap.py) ────────────
  // Reflows consecutive non-empty, same-indent, non-art lines into a
  // paragraph and word-wraps it to `width`. Lines containing box-
  // drawing chars or table-like spacing pass through unchanged.

  const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
  const BOX_CHARS = new Set("═║╔╗╚╝╠╣╦╩╬─│┌┐└┘├┤┬┴┼━┃┏┓┗┛┣┫┳┻╋");
  const TABLE_LIKE = /\S {2,}\S/;

  function visibleLen(s) { return s.replace(ANSI, "").length; }

  function looksLikeArt(line) {
    const stripped = line.replace(ANSI, "");
    for (let i = 0; i < stripped.length; i++) {
      if (BOX_CHARS.has(stripped[i])) return true;
    }
    return TABLE_LIKE.test(stripped);
  }

  function detectIndent(line) {
    const m = line.match(/^[ \t]*/);
    return m ? m[0] : "";
  }

  function wrapParagraph(text, width, indent) {
    const parts = text.split(/(\s+)/);
    const out = [];
    let cur = indent;
    let curW = indent.length;
    let pending = "";
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) { pending = " "; continue; }
      const pw = visibleLen(p);
      if (curW + pending.length + pw > width && cur.trim()) {
        out.push(cur.replace(/\s+$/, ""));
        cur = indent + p;
        curW = indent.length + pw;
        pending = "";
      } else {
        cur += pending + p;
        curW += pending.length + pw;
        pending = "";
      }
    }
    if (cur.trim()) out.push(cur.replace(/\s+$/, ""));
    return out;
  }

  function reflow(lines, width) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { out.push(""); i++; continue; }
      if (looksLikeArt(line)) { out.push(line); i++; continue; }
      const indent = detectIndent(line);
      const para = [line.replace(/^[ \t]+/, "")];
      let j = i + 1;
      while (j < lines.length) {
        const nxt = lines[j];
        if (!nxt.trim() || looksLikeArt(nxt) || detectIndent(nxt) !== indent) break;
        para.push(nxt.replace(/^[ \t]+/, ""));
        j++;
      }
      out.push(...wrapParagraph(para.join(" "), width, indent));
      i = j;
    }
    return out;
  }

  function wrap(text, width) {
    width = Math.max(20, Math.min(width, 78));
    return reflow(text.split("\n"), width).join("\n");
  }

  // ── IO factory ────────────────────────────────────────────────────
  function createIO(term) {
    let reader = null;
    const pending = [];

    term.onData(d => {
      const data = sanitize(d);
      if (!data) return;
      if (reader) {
        reader(data);
      } else {
        pending.push(data);
      }
    });

    function drainPending() {
      while (pending.length > 0 && reader) {
        const data = pending.shift();
        reader(data);
      }
    }

    return {
      write(s) { term.write(s); },

      // Word-wrap to the current terminal width and write.
      writeWrapped(text) {
        const w = (term.cols || 78);
        term.write(wrap(text, w) + (text.endsWith("\n") ? "" : "\n"));
      },

      sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

      async waitEnter() {
        return new Promise(resolve => {
          reader = function consume(data) {
            for (let i = 0; i < data.length; i++) {
              if (data[i] === "\r" || data[i] === "\n") {
                term.write("\r\n");
                const rest = data.slice(i + 1);
                reader = null;
                if (rest) pending.unshift(rest);
                resolve();
                return;
              }
            }
          };
          drainPending();
        });
      },

      async readline({ echo = true, prompt = null, mask = false } = {}) {
        if (prompt != null) term.write(prompt);
        let line = "";
        return new Promise(resolve => {
          reader = function consume(data) {
            for (let i = 0; i < data.length; i++) {
              const ch = data[i];
              if (ch === "\r" || ch === "\n") {
                term.write("\r\n");
                const rest = data.slice(i + 1);
                reader = null;
                if (rest) pending.unshift(rest);
                resolve(line);
                return;
              } else if (ch === "\x7f" || ch === "\b") {
                if (line.length > 0) {
                  line = line.slice(0, -1);
                  if (echo) term.write("\b \b");
                }
              } else if (ch === "\x03") {
                term.write("^C\r\n");
                reader = null;
                resolve("");
                return;
              } else if (ch >= " " || ch === "\t") {
                line += ch;
                if (echo) term.write(mask ? "*" : ch);
              }
            }
          };
          drainPending();
        });
      },

      // Read a multi-line block. Blank line terminates. Returns the
      // joined text (with internal newlines, no trailing).
      async readBlock() {
        const lines = [];
        while (true) {
          const line = await this.readline({ echo: true });
          if (line === "") break;
          lines.push(line);
        }
        return lines.join("\n");
      },
    };
  }

  window.M0useIO = { createIO, sanitize, wrap };
})();
