// meta.js — the 4-task aptitude-battery state machine wrapping the
// m0usunet hack game. Pages are <section class="meta-page">; only one
// is .active at a time. Password gates advance from page to page.

(function () {
  "use strict";

  function go(name) {
    document.querySelectorAll(".meta-page").forEach((s) => {
      s.classList.toggle("active", s.dataset.page === name);
    });
    // Scroll the new page to the top so the player reads from the start.
    const active = document.querySelector(".meta-page.active");
    if (active) active.scrollTop = 0;
    // Tell boot.js the page changed so it can refit xterm if task 2.
    window.dispatchEvent(new CustomEvent("m0use:page", { detail: { page: name } }));
  }

  // Password gates: input + button. Compare trimmed value to data-expects.
  document.querySelectorAll(".pwgate").forEach((form) => {
    const input = form.querySelector("input");
    const err   = form.querySelector(".pwerror");
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const expects = form.dataset.expects;
      const next    = form.dataset.next;
      const value   = (input.value || "").trim();
      if (value === expects) {
        if (err) err.hidden = true;
        go(next);
      } else {
        if (err) err.hidden = false;
        input.select();
      }
    });
  });

  // Plain next buttons.
  document.querySelectorAll(".meta-next").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const next = btn.dataset.next;
      if (next) go(next);
    });
  });

  // Reflection form: any submit advances to done.
  document.querySelectorAll(".reflection").forEach((form) => {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      go("done");
    });
  });

  // Expose for boot.js + debugging.
  window.M0useMeta = { go };
})();
