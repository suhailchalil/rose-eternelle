/* ---------------------------------------------------------------------------
   StorySection — Act II's chapters.

   Each chapter is a tall section containing one pinned block of copy. The
   section supplies scroll distance; the pinned block is what the visitor
   actually reads while the product and the environment keep moving behind it.
   That separation is the whole reason the copy can sit still and feel
   composed while the world behind it is in constant motion.

   Copy lives on the left because the right belongs to the product. Nothing
   here animates position on scroll — reveals are opacity and a small
   transform, triggered once by IntersectionObserver, which is both cheaper
   than a scroll handler and interruption-safe.
--------------------------------------------------------------------------- */
import { CONFIG } from "./config.js";

export function buildChapters() {
  const host = document.querySelector("#chapters");
  if (!host) return;
  const frag = document.createDocumentFragment();

  for (const c of CONFIG.chapters) {
    const sec = document.createElement("section");
    sec.className = "chapter";
    sec.id = "ch-" + c.id;
    sec.style.setProperty("--span", c.vh);
    sec.setAttribute("aria-labelledby", `t-${c.id}`);

    const pin  = document.createElement("div");
    pin.className = "pin";

    const copy = document.createElement("div");
    copy.className = "copy reveal";

    const kicker = document.createElement("p");
    kicker.className = "kicker";
    kicker.textContent = c.kicker;

    const title = document.createElement("h2");
    title.className = "ch-title";
    title.id = `t-${c.id}`;
    title.textContent = c.title;

    copy.append(kicker, title);

    for (const line of c.lines) {
      const p = document.createElement("p");
      p.className = "ch-line";
      p.textContent = line;
      copy.appendChild(p);
    }

    if (c.notes) copy.appendChild(notesBlock());

    pin.appendChild(copy);
    sec.appendChild(pin);
    frag.appendChild(sec);
  }
  host.appendChild(frag);
}

/* The note pyramid. A definition list is the honest markup here: each group is
   a term and its notes are the description. */
function notesBlock() {
  const wrap = document.createElement("dl");
  wrap.className = "notes";

  CONFIG.notes.forEach((g, i) => {
    const group = document.createElement("div");
    group.className = "note-group";
    group.style.setProperty("--i", i);

    const dt = document.createElement("dt");
    dt.className = "note-label";
    dt.textContent = g.group;

    const dd = document.createElement("dd");
    const ul = document.createElement("ul");
    for (const n of g.items) {
      const li = document.createElement("li");
      li.textContent = n;
      ul.appendChild(li);
    }
    dd.appendChild(ul);
    group.append(dt, dd);
    wrap.appendChild(group);
  });

  return wrap;
}

export function buildApproachCopy() {
  const host = document.querySelector("#approach-copy");
  if (!host) return;
  const A = CONFIG.approachCopy;

  const k = document.createElement("p");
  k.className = "kicker";
  k.textContent = A.kicker;
  host.appendChild(k);

  for (const line of A.lines) {
    const p = document.createElement("p");
    p.className = "ch-line";
    p.textContent = line;
    host.appendChild(p);
  }
}

export function buildProduct() {
  const p = CONFIG.product;
  const set = (sel, v) => { const el = document.querySelector(sel); if (el) el.textContent = v; };
  set("#p-name", p.name);
  set("#p-kind", p.kind);
  set("#p-size", p.size);
  set("#p-price", p.price);
  set("#p-blurb", p.blurb);
}

/* One-shot reveals. Unobserved after firing so the observer empties itself
   rather than tracking every element for the life of the page. */
export function reveals() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      io.unobserve(e.target);
    }
  }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });

  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}
