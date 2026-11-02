/* ---------------------------------------------------------------------------
   PerfumeSequence — the product.

   192 alpha frames of the real ROSE ETERNELLE flacon turning through 360°,
   scrubbed by scroll rather than played. The bottle is never a 3D model and is
   never faked into one: it is the supplied photography, and the sense of a
   solid object in space comes from the sequence plus the camera moving around
   it, not from geometry.

   WHY A CANVAS, NOT AN <img>
   Swapping src on a 192-frame sequence produces a visible decode hitch on
   almost every frame change. Blitting an already-decoded image to a canvas
   does not. Frames are decoded once, up front, and only drawn thereafter.

   LOADING STRATEGY
   A stride of frames spread evenly around the full turn is fetched first, so
   the hero can appear with a coarse but complete rotation available; the gaps
   fill in behind it. Nothing waits on all 192, and a frame that has not landed
   yet falls back to the nearest one that has, so a slow network degrades into
   a slightly steppier turn rather than a blank space where the product was.
--------------------------------------------------------------------------- */
import { CONFIG, REDUCED, TIER } from "./config.js";

export class PerfumeSequence {
  constructor(canvas) {
    this.cv  = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.frames = new Array(CONFIG.perfume.count).fill(null);
    this.loaded = 0;
    this.ready  = false;

    this.cur = 0;        /* smoothed frame position, fractional */
    this.target = 0;
    this._drawn = -1;

    /* Sub-frame blending: cross-dissolve the two frames either side of the
       fractional position. At 192 frames the steps are already under two
       degrees, so this is a polish pass, not a rescue — it is what stops slow
       scrolling from looking like a flipbook. Reserved for capable hardware
       because it doubles the per-frame blit. */
    this.blend = TIER === "high" && !REDUCED;

    this._dpr = Math.min(devicePixelRatio || 1, 2);
    this.resize();
    this._onResize = () => this.resize();
    addEventListener("resize", this._onResize, { passive: true });
  }

  url(i) {
    const c = CONFIG.perfume;
    return `${c.dir}r_${String(i).padStart(c.pad, "0")}${c.ext}`;
  }

  /* Frames listed in CONFIG.perfume.skip carry a defect in the supplied render
     and are never fetched. _nearest() then bridges them automatically, exactly
     as it would bridge a frame that had not arrived yet. */
  _skipped(i) {
    return CONFIG.perfume.skip ? CONFIG.perfume.skip.includes(i) : false;
  }

  /* onWarm fires as soon as a usable turn exists — the hero waits on this, not
     on the full sequence. onProgress reports 0..1 for the loading state. */
  async load(onWarm, onProgress) {
    const c = CONFIG.perfume;
    this._wanted = c.count - (c.skip ? c.skip.length : 0);

    /* pass one: evenly spaced around the turn, so every angle is represented */
    const stride = Math.max(1, Math.round(c.count / c.warmup));
    const first = [];
    for (let i = 0; i < c.count; i += stride) first.push(this._one(i, onProgress));
    await Promise.allSettled(first);

    this.ready = true;
    onWarm && onWarm();

    /* pass two: everything else, in the background, unawaited */
    for (let i = 0; i < c.count; i++) if (!this.frames[i]) this._one(i, onProgress);
  }

  _one(i, onProgress) {
    if (this.frames[i] || this._skipped(i)) return Promise.resolve();
    const im = new Image();
    im.decoding = "async";
    im.src = this.url(i);
    /* decode() moves the cost off the frame in which it is first drawn */
    return im.decode()
      .then(() => {
        this.frames[i] = im;
        this.loaded++;
        onProgress && onProgress(this.loaded / (this._wanted || CONFIG.perfume.count));
      })
      .catch(() => { /* a missing frame is survivable — see _nearest */ });
  }

  resize() {
    /* A tab that is loaded while hidden, printed, or mounted in a zero-sized
       frame reports innerHeight 0. Sizing the canvas from that leaves it 0x0
       forever, so the measurement is deferred instead and retried from the
       next update() once the viewport is real. */
    if (innerHeight < 2 || innerWidth < 2) { this._pendingResize = true; return; }
    this._pendingResize = false;

    /* The source frames are 366x660. Displaying them much beyond that softens
       the glass, so the display height is capped near native and the flacon is
       given presence through composition rather than through upscaling. */
    const h = Math.min(innerHeight * 0.72, 700);
    const w = h * CONFIG.perfume.aspect;
    this.cssW = w; this.cssH = h;
    this.cv.style.width  = w + "px";
    this.cv.style.height = h + "px";
    this.cv.width  = Math.round(w * this._dpr);
    this.cv.height = Math.round(h * this._dpr);
    this._drawn = -1;           /* backing store was cleared by the resize */
  }

  /* nearest loaded frame to i, so a gap in the stream never blanks the product */
  _nearest(i) {
    if (this.frames[i]) return this.frames[i];
    for (let d = 1; d < 16; d++) {
      if (this.frames[i - d]) return this.frames[i - d];
      if (this.frames[i + d]) return this.frames[i + d];
    }
    return null;
  }

  /* p: 0..1 of a full revolution, from scroll progress. */
  update(p) {
    if (this._pendingResize) this.resize();
    const c = CONFIG.perfume;
    const last = c.count - 1;
    this.target = Math.min(last, Math.max(0, p * c.turns * last));

    /* the lerp is the weight: the flacon keeps turning for a beat after the
       scroll stops, the way a heavy object would */
    this.cur += (this.target - this.cur) * (REDUCED ? 1 : c.smoothing);

    const i = Math.floor(this.cur);
    const f = this.cur - i;

    /* nothing to do if we are still on the same sub-frame */
    const key = this.blend ? Math.round(this.cur * 4) : Math.round(this.cur);
    if (key === this._drawn) return;

    const a = this._nearest(i);
    /* Commit `_drawn` only once a frame has actually been painted. Committing
       it before the lookup would mark the position as done even when nothing
       was available yet — and at the top of the page, where scroll never moves
       the position off zero, that key would never change again and the product
       would stay invisible for the whole visit. */
    if (!a) return;
    this._drawn = key;

    const { ctx, cv } = this;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(a, 0, 0, cv.width, cv.height);

    if (this.blend && f > 0.02) {
      const b = this._nearest(Math.min(last, i + 1));
      if (b && b !== a) {
        ctx.globalAlpha = f;
        ctx.drawImage(b, 0, 0, cv.width, cv.height);
        ctx.globalAlpha = 1;
      }
    }
  }

  dispose() {
    removeEventListener("resize", this._onResize);
    this.frames.length = 0;
  }
}
