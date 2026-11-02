/* ---------------------------------------------------------------------------
   Navigation.

   Minimal by direction: a wordmark, six links, search and bag. It sits over
   the film and over the hero, so it has to stay legible against moving pink
   imagery without ever growing a solid bar that would cut the composition in
   half. It earns contrast from a very soft gradient scrim and from weight,
   not from a filled background.

   On a narrow viewport it becomes a full-height panel rather than a squeezed
   row. The panel is a real dialog: focus is trapped while it is open, Escape
   closes it, and the toggle carries aria-expanded.
--------------------------------------------------------------------------- */

export function navigation() {
  const nav    = document.querySelector("#nav");
  const toggle = document.querySelector("#nav-toggle");
  const panel  = document.querySelector("#nav-panel");
  const links  = [...document.querySelectorAll("#nav a[href^='#']")];

  /* --- condense once the page has left the very top ------------------- */
  const onScroll = () => nav.classList.toggle("solid", scrollY > 80);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --- ink flips to dark over the light purchase panel ---------------- */
  const light = document.querySelector("#final");
  if (light) {
    new IntersectionObserver(
      (es) => es.forEach((e) => nav.classList.toggle("on-light", e.isIntersecting)),
      { threshold: 0.3 }
    ).observe(light);
  }

  /* --- current section, for the underline ------------------------------ */
  const targets = links
    .map((a) => ({ a, el: document.querySelector(a.getAttribute("href")) }))
    .filter((t) => t.el);

  if (targets.length) {
    const spy = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        const hit = targets.find((t) => t.el === e.target);
        if (!hit) return;
        targets.forEach((t) => t.a.classList.remove("here"));
        hit.a.classList.add("here");
        targets.forEach((t) => t.a.removeAttribute("aria-current"));
        hit.a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    targets.forEach((t) => spy.observe(t.el));
  }

  /* --- mobile panel ---------------------------------------------------- */
  if (!toggle || !panel) return;

  const setOpen = (open) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    panel.setAttribute("aria-hidden", String(!open));
    /* the panel is inert when closed, so its links stay out of the tab order */
    panel.querySelectorAll("a, button").forEach((el) => {
      if (open) el.removeAttribute("tabindex"); else el.setAttribute("tabindex", "-1");
    });
    if (open) (panel.querySelector("a") || panel).focus({ preventScroll: true });
    else toggle.focus({ preventScroll: true });
  };

  setOpen(false);
  toggle.addEventListener("click", () =>
    setOpen(!document.body.classList.contains("nav-open")));

  panel.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });

  addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !document.body.classList.contains("nav-open")) return;
    setOpen(false);
  });

  /* keep focus inside the open panel */
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...panel.querySelectorAll("a, button")].filter((el) => el.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* returning to a wide viewport must not leave the panel state stuck */
  matchMedia("(min-width: 820px)").addEventListener("change", (m) => {
    if (m.matches) setOpen(false);
  });
}

/* ---------------------------------------------------------------------------
   Bag. A concept study, so this is local state and nothing more — but it
   behaves correctly, announces itself, and never lies about what it did.
--------------------------------------------------------------------------- */
export function bag() {
  const count = document.querySelector("#bag-count");
  const qtyEl = document.querySelector("#qty");
  const add   = document.querySelector("#add");
  const wish  = document.querySelector("#wish");
  if (!add) return;

  let qty = 1, total = 0;

  document.querySelector("#qminus").addEventListener("click", () => {
    qty = Math.max(1, qty - 1); qtyEl.textContent = qty;
  });
  document.querySelector("#qplus").addEventListener("click", () => {
    qty = Math.min(9, qty + 1); qtyEl.textContent = qty;
  });

  add.addEventListener("click", () => {
    total += qty;
    count.textContent = total;
    count.hidden = false;
    add.classList.add("added");
    add.querySelector(".label").textContent = "Added to bag";
    setTimeout(() => {
      add.classList.remove("added");
      add.querySelector(".label").textContent = "Add to bag";
    }, 1900);
  });

  wish && wish.addEventListener("click", (e) => {
    const on = e.currentTarget.classList.toggle("on");
    e.currentTarget.setAttribute("aria-pressed", String(on));
  });
}
