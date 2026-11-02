/* ---------------------------------------------------------------------------
   Scroll physics and pointer deflection.

   Deliberately NOT a transform-hijacking smooth-scroll library. Native scroll
   is left alone, so keyboard paging, trackpad momentum, mobile fling, the
   scrollbar, find-in-page and focus-scrolling all keep working. What gets
   smoothed is the VALUE THE ANIMATION READS, which is where the cinematic
   weight actually comes from. A hijacked scroller buys the same look at the
   cost of accessibility, and on this site it would also fight the pinned
   transition.

   Three things are exposed:
     · a smoothed global progress, for the product's one continuous rotation
     · per-section progress, for anything pinned (the cloud passage, chapters)
     · scroll velocity, so fast scrolling can be damped rather than smeared
--------------------------------------------------------------------------- */
import { CONFIG, REDUCED } from "./config.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export class Scroll {
  constructor() {
    this.raw = 0;         /* 0..1 through the whole cinematic run */
    this.value = 0;       /* the smoothed value everything animates against */
    this.velocity = 0;
    this._max = 1;
    this._sections = new Map();

    this.measure();
    addEventListener("scroll", () => this.read(), { passive: true });
    addEventListener("resize", () => this.measure(), { passive: true });
    this.read();
    this.value = this.raw;
  }

  /* Register a pinned region. Its progress runs 0 as its top reaches the top
     of the viewport, 1 when its bottom does — which is exactly the window in
     which its pinned child is stuck to the screen. */
  section(name, el) {
    if (el) this._sections.set(name, { el, p: 0, raw: 0 });
    return this;
  }

  /* The cinematic run ends where the purchase panel begins: past that point
     the page is an ordinary document and the camera should be at rest. */
  measure() {
    const end = document.querySelector("#final");
    const h = end ? end.offsetTop : document.body.scrollHeight;
    this._max = Math.max(1, h - innerHeight);
    this.read();
  }

  read() {
    this.raw = clamp01(scrollY / this._max);
  }

  update() {
    const e = REDUCED ? 1 : CONFIG.scroll.ease;
    const last = this.value;
    this.value += (this.raw - this.value) * e;
    this.velocity = this.value - last;

    /* Section progress is read from live layout rather than cached offsets, so
       it stays correct through font loads, image reflow and orientation
       changes without needing to be told to re-measure. */
    for (const s of this._sections.values()) {
      const r = s.el.getBoundingClientRect();
      const span = Math.max(1, r.height - innerHeight);
      s.raw = clamp01(-r.top / span);
      /* eased with the same law as the global value so a pinned scene has the
         same weight as the rest of the film */
      s.p += (s.raw - s.p) * e;
    }
    return this.value;
  }

  /* eased progress for a registered section, 0 if it does not exist */
  at(name) {
    const s = this._sections.get(name);
    return s ? s.p : 0;
  }

  /* true while the section is the thing on screen */
  active(name, pad = 0.001) {
    const s = this._sections.get(name);
    if (!s) return false;
    const r = s.el.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0 && s.raw > -pad;
  }
}

/* ---------------------------------------------------------------------------
   Pointer deflection, normalised to -1..1 and eased.

   Never mapped straight to coordinates: the target is set by the event and the
   current value chases it every frame. That lag is what makes the depth feel
   heavy and expensive rather than twitchy.
--------------------------------------------------------------------------- */
export class Pointer {
  constructor() {
    this.tx = 0; this.ty = 0;   /* target */
    this.x = 0;  this.y = 0;    /* eased */

    /* coarse pointers get no parallax: a finger cannot hover, and driving
       depth from taps only produces jumps */
    if (matchMedia("(pointer: fine)").matches && !REDUCED) {
      addEventListener("pointermove", (e) => {
        this.tx = (e.clientX / innerWidth) * 2 - 1;
        this.ty = (e.clientY / innerHeight) * 2 - 1;
      }, { passive: true });
      /* settle back to centre when the cursor leaves, rather than freezing
         the scene at whatever angle it was last pushed to */
      addEventListener("pointerleave", () => { this.tx = 0; this.ty = 0; });
      document.addEventListener("mouseleave", () => { this.tx = 0; this.ty = 0; });
    }
  }

  update() {
    const e = CONFIG.pointer.ease;
    this.x += (this.tx - this.x) * e;
    this.y += (this.ty - this.y) * e;
  }
}

/* ---------------------------------------------------------------------------
   Keyframe sampling.

   Tracks are lists of { p, x, y, scale, cam }. Between keyframes everything is
   smoothstepped, so the product travels as one continuous move rather than
   snapping from section to section.
--------------------------------------------------------------------------- */
export function sampleTrack(track, p) {
  const n = track.length;
  if (p <= track[0].p) return track[0];
  if (p >= track[n - 1].p) return track[n - 1];

  let i = 0;
  while (i < n - 2 && track[i + 1].p < p) i++;
  const a = track[i], b = track[i + 1];
  const t = (p - a.p) / (b.p - a.p);
  const s = t * t * (3 - 2 * t);

  return {
    x:     a.x + (b.x - a.x) * s,
    y:     a.y + (b.y - a.y) * s,
    scale: a.scale + (b.scale - a.scale) * s,
    cam:   [0, 1, 2].map((k) => a.cam[k] + (b.cam[k] - a.cam[k]) * s)
  };
}

/* blend two sampled states — used to hand the camera from Act I to Act II
   through the cloud without either track snapping */
export function blendState(a, b, t) {
  const s = t * t * (3 - 2 * t);
  return {
    x:     a.x + (b.x - a.x) * s,
    y:     a.y + (b.y - a.y) * s,
    scale: a.scale + (b.scale - a.scale) * s,
    cam:   [0, 1, 2].map((k) => a.cam[k] + (b.cam[k] - a.cam[k]) * s)
  };
}
