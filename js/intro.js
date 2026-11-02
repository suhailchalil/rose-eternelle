/* ---------------------------------------------------------------------------
   IntroVideo — the opening of the home page.

   The film is not a landing page, an overlay or a title card. It is the top of
   the document: the hero viewport happens to contain moving footage for its
   first five seconds. Nothing is layered over it, and there is no skip button.

   HOW THE JOIN IS HIDDEN
   The film's own final frame is also the hero's first frame. It ships as a
   still (assets/env/hero_plate.webp) and sits directly under the video. Late
   in the clip the live stage is faded up to full opacity BENEATH the still
   opaque video, so by the time the film ends the interactive scene has already
   been warm and painting for a second or more. Then the video crossfades to
   the plate, and the plate dissolves into the live scene. Every step of that
   chain is a dissolve between two images that already match, which is why
   there is no cut, no flash and no pop.

   THERE IS NO SKIP CONTROL — BUT NOBODY IS TRAPPED
   Scroll is never locked. If a visitor scrolls during the film, that IS the
   skip: the hand-off is triggered immediately and the page carries on from
   wherever they are. A five second lock with no exit would be hostile; a
   button would break the composition the direction asks for. Scrolling
   resolves both.
--------------------------------------------------------------------------- */
import { CONFIG, REDUCED } from "./config.js";

export class IntroVideo {
  constructor({ onHandoff, onDone }) {
    this.el   = document.querySelector("#intro");
    this.vid  = document.querySelector("#intro-vid");
    this.onHandoff = onHandoff;
    this.onDone = onDone;

    this.started = false;
    this.handed  = false;
    this.finished = false;
  }

  /* called once the loader has released the page */
  begin() {
    this.el.style.setProperty("--fade", CONFIG.intro.handoffMs + "ms");

    /* Reduced motion: the film is motion by definition, so it is replaced by
       its final frame and the page simply starts. */
    if (REDUCED) { this.handoff(); this.finish(true); return; }

    this.vid.addEventListener("timeupdate", () => {
      if (this.handed || !this.vid.duration) return;
      if (this.vid.currentTime / this.vid.duration >= CONFIG.intro.warmAt) this.handoff();
    });
    this.vid.addEventListener("ended", () => this.finish());
    this.vid.addEventListener("error", () => { this.handoff(); this.finish(true); });

    /* scrolling during the film is the exit */
    this._onScroll = () => { if (scrollY > 4) this.finish(true); };
    addEventListener("scroll", this._onScroll, { passive: true });

    /* the clip may already be decoded from cache — check rather than relying
       on an event that has already fired */
    if (this.vid.readyState >= 2) this.play();
    else this.vid.addEventListener("loadeddata", () => this.play(), { once: true });

    this._watch();
  }

  /* Let the film run to its own end however long decode takes; only step in if
     playback actually stops advancing. Measuring PROGRESS rather than wall
     time means a slow device gets its full film instead of a truncated one. */
  _watch() {
    let last = -1, moved = performance.now();
    this._timer = setInterval(() => {
      if (this.finished) return clearInterval(this._timer);
      const t = this.vid.currentTime;
      if (t > last + 0.01) { last = t; moved = performance.now(); }
      if (performance.now() - moved > CONFIG.intro.stallMs) {
        clearInterval(this._timer);
        this.handoff();
        this.finish(true);
      }
    }, 500);
  }

  play() {
    if (this.started || this.finished) return;
    this.started = true;
    const r = this.vid.play();
    if (r && r.catch) r.catch(() => {
      /* Autoplay refused. Show the film's final plate and let the page begin,
         rather than stranding the visitor on a frozen first frame. */
      this.started = false;
      this.handoff();
      this.finish(true);
    });
  }

  /* bring the live stage up underneath the still-opaque film */
  handoff() {
    if (this.handed) return;
    this.handed = true;
    document.body.classList.add("stage-live");
    this.onHandoff && this.onHandoff();
  }

  finish(immediate) {
    if (this.finished) return;
    this.finished = true;
    clearInterval(this._timer);
    removeEventListener("scroll", this._onScroll);
    this.handoff();

    this.el.classList.add("gone");
    document.body.classList.add("intro-done");
    /* pause rather than leave a decoded video looping behind an opacity of 0 */
    setTimeout(() => {
      try { this.vid.pause(); } catch {}
      this.el.hidden = true;
      this.onDone && this.onDone();
    }, immediate ? 260 : CONFIG.intro.handoffMs);
  }
}
