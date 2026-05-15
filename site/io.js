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

      sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

      // Wait for an Enter keypress. Discards anything typed before
      // it; pushes anything typed after back into the pending queue.
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

      // Read a single line with simple echo + backspace handling.
      // No history, no readline tricks. mask=true draws "*" instead
      // of the typed character (password fields).
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
                // Ctrl-C: abandon and return empty.
                term.write("^C\r\n");
                reader = null;
                resolve("");
                return;
              } else if (ch >= " " || ch === "\t") {
                line += ch;
                if (echo) term.write(mask ? "*" : ch);
              }
              // Other control bytes: ignore.
            }
          };
          drainPending();
        });
      },

      // Read a multi-line block. Blank line terminates. Returns
      // the joined text (with internal newlines, no trailing).
      async readBlock({ prompt = null } = {}) {
        if (prompt != null) term.write(prompt);
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

  window.M0useIO = { createIO, sanitize };
})();
