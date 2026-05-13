// nicks.js — applicant alias generator
// Mouse-themed two-word nicknames stored in localStorage.

(function () {
  "use strict";

  const ADJ = [
    "Whisker", "Twitch", "Squeak", "Nibble", "Scurry", "Crumb",
    "Tail", "Paw", "Cheese", "Burrow", "Shadow", "Brisk",
    "Quiet", "Quick", "Dust", "Snout", "Velvet", "Tin",
    "Brass", "Tooth", "Litter", "Gnaw", "Rust", "Pellet",
  ];

  const NOUN = [
    "Watcher", "Walker", "Bandit", "Runner", "Sniffer", "Sleuth",
    "Scout", "Mole", "Cypher", "Bishop", "Drift", "Lurker",
    "Smith", "Pry", "Vector", "Wretch", "Marlow", "Vex",
    "Reed", "Quill", "Ash", "Pine", "Boon", "Latch",
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function newNick() { return pick(ADJ) + pick(NOUN); }

  function get() {
    let n = null;
    try { n = localStorage.getItem("m0use_nick"); } catch (_) {}
    if (!n) {
      n = newNick();
      try { localStorage.setItem("m0use_nick", n); } catch (_) {}
    }
    return n;
  }

  function reroll() {
    try { localStorage.removeItem("m0use_nick"); } catch (_) {}
    return get();
  }

  window.M0useNicks = { get, reroll, newNick };
})();
