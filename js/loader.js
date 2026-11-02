/* ---------------------------------------------------------------------------
   Loader — the opening state.

   The film is the first thing on screen and it is the largest asset on the
   page, so something has to hold the frame while it arrives. That something is
   a wordmark and a hairline: no spinner, no percentage, no progress bar with a
   border. The rule is that the loading state should look like the first page
   of the brand's own print campaign, and then get out of the way.

   Progress is real, not simulated. It is weighted across three things:
     · the critical stills the hero cannot be drawn without
     · enough of the film buffered to play through
     · a first pass of product frames

   Two guards keep it honest in both directions. It never resolves faster than
   CONFIG.loader.minMs, because a loading state that flashes past reads as a
   glitch. And it never blocks forever: if an asset stalls, the film is allowed
   to begin anyway, because a visitor staring at a stuck hairline is worse than
   a hero that fills in a beat late.
--------------------------------------------------------------------------- */
import { CONFIG } from "./config.js";

export class Loader {
  constructor(root) {
    this.el   = root;
    this.bar  = root.querySelector(".load-bar i");
    this.born = performance.now();
    this.done = false;

    /* weights sum to 1 — the film is the heaviest single item */
    this.parts = { stills: 0, film: 0, product: 0 };
    this.weight = { stills: 0.35, film: 0.45, product: 0.20 };
    this.shown = 0;
  }

  set(part, v) {
    this.parts[part] = Math.min(1, Math.max(0, v));
    this._paint();
  }

  _paint() {
    let p = 0;
    for (const k in this.parts) p += this.parts[k] * this.weight[k];
    /* the bar only ever advances; a re-measure must not make it retreat */
    this.shown = Math.max(this.shown, p);
    if (this.bar) this.bar.style.transform = `scaleX(${this.shown.toFixed(4)})`;
  }

  /* decode the stills the hero genuinely cannot be composed without */
  preload() {
    const list = CONFIG.loader.critical;
    let n = 0;
    return Promise.allSettled(list.map((src) => {
      const im = new Image();
      im.decoding = "async";
      im.src = src;
      return im.decode()
        .catch(() => {})
        .finally(() => this.set("stills", ++n / list.length));
    }));
  }

  /* Resolve when the film can play through, or when it has clearly stalled.
     `canplaythrough` is the honest signal; the timeout is the escape hatch. */
  film(video) {
    return new Promise((resolve) => {
      let settled = false;
      const go = () => { if (!settled) { settled = true; this.set("film", 1); resolve(); } };

      if (video.readyState >= 3) return go();

      video.addEventListener("canplaythrough", go, { once: true });
      video.addEventListener("error", go, { once: true });

      /* report buffered fraction while we wait, so the hairline actually moves */
      const tick = setInterval(() => {
        if (settled) return clearInterval(tick);
        const d = video.duration;
        if (d && video.buffered.length) {
          this.set("film", Math.min(0.98, video.buffered.end(0) / d));
        }
      }, 120);

      setTimeout(() => { clearInterval(tick); go(); }, 9000);
    });
  }

  /* fade out, honouring the minimum on-screen time */
  finish() {
    if (this.done) return Promise.resolve();
    this.done = true;
    this.set("stills", 1); this.set("film", 1); this.set("product", 1);

    const wait = Math.max(0, CONFIG.loader.minMs - (performance.now() - this.born));
    return new Promise((resolve) => setTimeout(() => {
      this.el.classList.add("gone");
      document.body.classList.remove("loading");
      setTimeout(() => { this.el.hidden = true; resolve(); }, CONFIG.loader.fadeMs);
    }, wait));
  }
}
