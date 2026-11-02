/* ---------------------------------------------------------------------------
   Responsive behaviour.

   Desktop is the cinematic reading of this design, but the phone is not a
   shrunken copy of it. Two things are handled here that CSS alone cannot:

   1. VIEWPORT HEIGHT. On mobile browsers 100vh is the height of the viewport
      with the URL bar hidden, so a full-height hero jumps by 60-100px the
      moment the bar retracts. `--vh` is published here from the real measured
      height and only updated on genuine layout changes, never on the constant
      resize noise the URL bar generates while scrolling. `dvh` is used where
      supported and this is the fallback.

   2. BREAKPOINT CHANGES THAT NEED REBUILDING. Particle budgets and cloud
      counts are baked into GPU buffers at startup. Rotating a tablet should
      not silently leave a desktop-sized particle system running on a portrait
      layout, so a real breakpoint crossing is reported to the app rather than
      being left to CSS.
--------------------------------------------------------------------------- */
import { MOBILE } from "./config.js";

export class Responsive {
  constructor() {
    this.mobile = MOBILE();
    this.width  = innerWidth;
    this.height = innerHeight;
    this._handlers = [];

    this._publishVh();

    /* ResizeObserver on the documentElement fires for real layout changes and,
       unlike the resize event, not for every URL-bar nudge on iOS. */
    new ResizeObserver(() => this._check()).observe(document.documentElement);
    addEventListener("orientationchange", () => setTimeout(() => this._check(), 120));
  }

  onChange(fn) { this._handlers.push(fn); return this; }

  _publishVh() {
    document.documentElement.style.setProperty("--vh", `${innerHeight * 0.01}px`);
  }

  _check() {
    const w = innerWidth, h = innerHeight;
    const wasMobile = this.mobile;

    /* Height-only changes under ~120px are the URL bar, not a layout change.
       Republishing --vh for those causes the hero to twitch on every scroll. */
    const widthChanged  = w !== this.width;
    const heightChanged = Math.abs(h - this.height) > 120;
    if (!widthChanged && !heightChanged) return;

    this.width = w; this.height = h;
    this.mobile = MOBILE();
    this._publishVh();

    const crossed = wasMobile !== this.mobile;
    for (const fn of this._handlers) fn({ mobile: this.mobile, crossed, width: w, height: h });
  }
}

/* ---------------------------------------------------------------------------
   Offscreen pausing.

   Once the page has scrolled past the fixed stage there is nothing to look at,
   and continuing to render two WebGL scenes and a canvas blit for it is waste.
   This reports whether the stage is worth drawing at all.
--------------------------------------------------------------------------- */
export function watchStage(stageEl, onVisible) {
  if (!stageEl) return;
  new IntersectionObserver(
    (es) => es.forEach((e) => onVisible(e.isIntersecting)),
    { threshold: 0 }
  ).observe(stageEl);
}
