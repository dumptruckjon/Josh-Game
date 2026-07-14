// The Buddy pipeline — Josh picks a companion ONCE (window.JoshBuddy, stored as
// "josh-buddy"), and that single choice threads everywhere: a companion that
// sits on the home screen AND the character who pops in to celebrate every win.
// One owner consolidates the pick-a-buddy / home-companion / themed-celebration
// ideas so they can never drift apart (RULE 7). The roster is built from the
// existing content (HEROES / FRIENDS / PUPS) + JoshArt, so adding a friend or a
// pup there automatically offers a new buddy here.

(function (global) {
  const KEY = "josh-buddy";
  const C = global.JoshContent || {};
  const ART = global.JoshArt || {};

  function buildRoster() {
    const R = [];
    (C.HEROES || []).forEach((h) => R.push({ id: "hero-" + String(h.name).toLowerCase(), label: h.name, make: () => (ART.hero ? ART.hero(h.color) : "") }));
    (C.FRIENDS || []).forEach((f) => R.push({ id: "friend-" + String(f.name).toLowerCase(), label: f.name, make: () => (ART.friend ? ART.friend(f.art || {}) : "") }));
    [[3, "#e23636"], [5, "#7be08a"], [7, "#c77dff"]].forEach((p) => R.push({ id: "num-" + p[0], label: "Number " + p[0], make: () => (ART.numberFriend ? ART.numberFriend(p[0], p[1]) : "") }));
    (C.PUPS || []).slice(0, 3).forEach((p) => R.push({ id: "pup-" + String(p.name).toLowerCase(), label: p.name, make: () => (ART.pup ? ART.pup(p.collar) : "") }));
    R.push({ id: "star", label: "Star", make: () => (ART.star ? ART.star() : "") });
    return R.filter((b) => b && typeof b.make === "function");
  }
  const ROSTER = buildRoster();

  function list() { return ROSTER.slice(); }
  function get(id) { return ROSTER.find((b) => b.id === id) || ROSTER[0] || null; }
  function currentId() {
    let id = null;
    try { id = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    if (id && ROSTER.some((b) => b.id === id)) return id;
    return ROSTER.length ? ROSTER[0].id : null; // default = the first roster buddy
  }
  function current() { return get(currentId()); }
  function choose(id) {
    if (!ROSTER.some((b) => b.id === id)) return;
    try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
    try { global.dispatchEvent(new CustomEvent("josh-buddy", { detail: { id: id } })); } catch (e) { /* ignore */ }
  }
  function art(id) {
    const b = id ? get(id) : current();
    try { return b ? b.make() : ""; } catch (e) { return ""; }
  }

  function eln(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }

  // Mount the home companion + the picker overlay (idempotent). beforeEl (the
  // game grid) lets the companion sit ABOVE the tiles in normal flow, so it never
  // overlaps a tap target.
  function mount(homeEl, beforeEl) {
    if (!homeEl || ROSTER.length === 0 || homeEl.querySelector(".buddy")) return;

    const wrap = eln("div", "buddy");
    const pick = eln("button", "buddy__pick tap");
    pick.type = "button";
    pick.setAttribute("aria-label", "Your buddy — tap to change");
    const face = eln("span", "buddy__face art-fill");
    face.setAttribute("aria-hidden", "true");
    const tag = eln("span", "buddy__tag");
    tag.textContent = "That's my buddy!";
    pick.appendChild(face);
    wrap.append(pick, tag);
    if (beforeEl && beforeEl.parentNode === homeEl) homeEl.insertBefore(wrap, beforeEl);
    else homeEl.appendChild(wrap);

    const overlay = eln("div", "buddyc");
    overlay.hidden = true;
    const box = eln("div", "buddyc__box");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Pick your buddy");
    const title = eln("p", "buddyc__title");
    title.textContent = "Pick your buddy!";
    const grid = eln("div", "buddyc__grid");
    ROSTER.forEach((b) => {
      const opt = eln("button", "buddyc__opt tap");
      opt.type = "button";
      opt.dataset.buddy = b.id;
      opt.setAttribute("aria-label", b.label);
      const a = eln("span", "buddyc__art art-fill");
      a.setAttribute("aria-hidden", "true");
      try { a.innerHTML = b.make(); } catch (e) { a.textContent = "⭐"; }
      opt.appendChild(a);
      opt.addEventListener("click", () => { choose(b.id); render(); highlight(); close(); });
      grid.appendChild(opt);
    });
    box.append(title, grid);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function render() { try { face.innerHTML = art(); } catch (e) { face.textContent = "⭐"; } }
    function highlight() { grid.querySelectorAll(".buddyc__opt").forEach((o) => o.classList.toggle("buddyc__opt--sel", o.dataset.buddy === currentId())); }
    function open() { overlay.hidden = false; highlight(); }
    function close() { overlay.hidden = true; }
    pick.addEventListener("click", open);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); }); // tap the dim area to cancel
    global.addEventListener("josh-buddy", render);
    render();
  }

  global.JoshBuddy = { KEY, list, get, current, currentId, choose, art, mount };
})(typeof window !== "undefined" ? window : globalThis);
