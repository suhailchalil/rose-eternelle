/* ---------------------------------------------------------------------------
   ROSE ETERNELLE — wiring.

   ONE requestAnimationFrame loop drives everything: the environment, the
   product, the particles, the cloud passage and the camera. That is deliberate.
   The moment any of those gets its own loop or its own scroll listener they
   can land on different frames, and the illusion that this is one continuous
   camera move through one continuous space falls apart. A single tick makes
   desync structurally impossible.

   THE SHAPE OF THE FILM

       loader                     wordmark + hairline, real progress
         |
       intro film                 the top of the home page, no overlay
         |  crossfade through the film's own final frame
       ACT I   hero               background + branch + flacon, left-side copy
               approach           the flacon turns, the camera drifts in
         |
       PASSAGE cloud              pinned; the camera flies through cloud planes
         |     ...swap happens blind, inside the densest part
       ACT II  chapters           the world beyond, story on the left
         |
       final                      the product, at rest

   Scroll progress is read once per frame and shared. Act I and Act II each own
   a camera track; the cloud passage cross-blends between them, so the camera
   never cuts — it is handed over inside the cloud.
--------------------------------------------------------------------------- */
import { CONFIG, REDUCED, MOBILE, TIER } from "./config.js";
import { Scroll, Pointer, sampleTrack, blendState } from "./scroll.js";
import { Stage } from "./stage.js";
import { HeroScene } from "./heroScene.js";
import { WorldScene } from "./worldScene.js";
import { ParticleSystem } from "./particles.js";
import { CloudTransition } from "./cloudTransition.js";
import { AmbientClouds } from "./ambientClouds.js";
import { PerfumeSequence } from "./perfume.js";
import { IntroVideo } from "./intro.js";
import { Loader } from "./loader.js";
import { Responsive, watchStage } from "./responsive.js";
import { navigation, bag } from "./nav.js";
import * as Story from "./story.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/* ------------------------------------------------------------------ *
 * 1 · DOM                                                             *
 * ------------------------------------------------------------------ */
Story.buildChapters();
Story.buildApproachCopy();
Story.buildProduct();
navigation();
bag();
Story.reveals();

const el = {
  stage:   document.querySelector("#stage"),
  gl:      document.querySelector("#gl"),
  glFg:    document.querySelector("#gl-fg"),
  bottle:  document.querySelector("#bottle"),
  veil:    document.querySelector("#veil"),
  loader:  document.querySelector("#loader"),
  approach: document.querySelector("#approach"),
  portal:  document.querySelector("#portal"),
  chapters: document.querySelector("#chapters")
};

/* Scene lengths come from CONFIG, so the scroll distance a scene occupies and
   the animation that distance drives can never disagree with each other. */
el.approach.style.setProperty("--span", CONFIG.approachVh);
el.portal.style.setProperty("--span", CONFIG.portal.vh);

/* ------------------------------------------------------------------ *
 * 2 · systems                                                         *
 * ------------------------------------------------------------------ */
const scroll  = new Scroll()
  .section("act1",   el.approach)
  .section("portal", el.portal)
  .section("story",  el.chapters);

const pointer = new Pointer();
const perfume = new PerfumeSequence(el.bottle);
const responsive = new Responsive();

let stage = null, hero = null, world = null, portal = null,
    ambient = null, particles = null;

try {
  stage     = new Stage(el.gl, el.glFg);
  hero      = new HeroScene(stage);
  world     = new WorldScene(stage);
  portal    = new CloudTransition(stage, el.veil);
  ambient   = new AmbientClouds(stage);
  particles = new ParticleSystem(stage, [
    ...CONFIG.particles.petals,
    CONFIG.particles.dust
  ]);
} catch (err) {
  /* No WebGL. The plate still stands as a CSS backdrop and the product still
     scrubs with scroll, so the page degrades rather than breaking. */
  console.warn("WebGL unavailable — falling back to a flat backdrop.", err);
  document.body.classList.add("no-gl");
}

responsive.onChange(({ crossed }) => {
  scroll.measure();
  perfume.resize();
  if (particles) particles.onResize();
  /* Crossing the phone/desktop boundary changes particle budgets, which live
     in buffers built at startup. Rebuilding them here would drop frames mid
     gesture; the honest fix is a reload, and only on a real crossing. */
  if (crossed) document.body.classList.toggle("is-mobile", MOBILE());
});
document.body.classList.toggle("is-mobile", MOBILE());

/* stop drawing entirely once the fixed stage is behind us */
let stageVisible = true;
watchStage(el.stage, (v) => { stageVisible = v; });

/* ------------------------------------------------------------------ *
 * 3 · opening: loader -> film -> live stage                           *
 * ------------------------------------------------------------------ */
const loader = new Loader(el.loader);

const intro = new IntroVideo({
  /* Late in the film, bring the interactive stage to full opacity BENEATH the
     still-opaque video. Nothing becomes visible — it only guarantees the scene
     is warm and painting, so the reveal cannot pop. */
  onHandoff: () => el.stage.classList.add("live"),

  /* The film has ended and faded to its own final frame. Dissolve that plate
     into the live environment — the join is between two identical images. */
  onDone: () => {
    scroll.measure();
    if (framesWarm) startDissolve(); else dissolvePending = true;
  }
});

let framesWarm = false, dissolvePending = false;
/* Deliberately not gated on requestAnimationFrame. rAF does not fire in a
   backgrounded or non-compositing tab, and a visitor who opens the site in a
   background tab must not come back to a page frozen on the plate. */
const startDissolve = () => document.body.classList.add("plate-out");

/* Stream the product frames. The plate must not leave before the rotation
   sequence can replace it, or the flacon would blink out mid-dissolve. */
perfume.load(
  () => {
    framesWarm = true;
    document.body.classList.add("product-ready");
    if (dissolvePending) startDissolve();
  },
  (p) => loader.set("product", p)
);

/* Hold the opening until the stills are decoded and the film can play through,
   then release both at once. */
Promise.all([
  loader.preload(),
  loader.film(document.querySelector("#intro-vid"))
]).then(() => loader.finish()).then(() => intro.begin());

/* ------------------------------------------------------------------ *
 * 4 · the frame                                                       *
 * ------------------------------------------------------------------ */
const px = (v) => v.toFixed(2) + "px";

/* ---------------------------------------------------------------------------
   Placing the product.

   The timeline asks for a position and a scale; this is what actually decides
   where the flacon lands, because two rules outrank the timeline:

   1. IT IS NEVER CROPPED. If a keyframe would push the canvas past an edge,
      the position is clamped — and if the product is simply too large for the
      viewport, the SCALE is reduced rather than the edges being cut. A hero
      product with its cap sliced off is worse than a slightly smaller one.

   2. ON A PHONE IT KEEPS ITS OWN BAND. Portrait layouts stack, so the product
      is confined to a band under the navigation and the copy owns everything
      below it. Without this, a chapter with a tall copy block (the note
      pyramid, in particular) collides with the flacon at some scroll positions
      and not others, which is exactly the kind of fault that only appears on
      one phone at one moment.
--------------------------------------------------------------------------- */
function placeProduct(s) {
  const m = MOBILE(), mp = CONFIG.mobileProduct;

  let ox = (m ? s.x * mp.xMul : s.x) * innerWidth  + pointer.x * -CONFIG.pointer.product;
  let oy = (s.y + (m ? mp.yOffset : 0)) * innerHeight + pointer.y * -CONFIG.pointer.product;
  let sc = s.scale * (m ? mp.scaleMul : 1);

  const navH = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue("--nav-h")) || 72;

  /* the vertical band the product may occupy, measured from the viewport top */
  const top    = m ? navH + 10 : 8;
  const bottom = m ? innerHeight * 0.50 : innerHeight - 8;
  const band   = Math.max(80, bottom - top);

  /* rule 1b: shrink to fit rather than crop */
  const maxScale = band / Math.max(perfume.cssH, 1);
  if (sc > maxScale) sc = maxScale;

  const halfH = (perfume.cssH * sc) / 2;
  const halfW = (perfume.cssW * sc) / 2;

  /* rule 1a: clamp the centre so the drawn canvas stays inside its band.
     Offsets are relative to the viewport centre, which is where the canvas
     is anchored. */
  const midBand = (top + bottom) / 2 - innerHeight / 2;
  const slack   = Math.max(0, band / 2 - halfH);
  oy = Math.max(midBand - slack, Math.min(midBand + slack, oy));

  const limX = Math.max(0, innerWidth / 2 - halfW - 8);
  ox = Math.max(-limX, Math.min(limX, ox));

  /* transform only — never width/height/top/left, which would reflow */
  el.bottle.style.transform =
    `translate3d(${px(ox)}, ${px(oy)}, 0) scale(${sc.toFixed(4)})`;
}

function frame() {
  requestAnimationFrame(frame);

  const gp = scroll.update();      /* global 0..1 — the product's whole turn */
  pointer.update();

  if (!stageVisible) return;       /* nothing on screen worth drawing */

  const t = stage ? stage.clock.getElapsedTime() : performance.now() / 1000;

  /* --- where are we in the film? ------------------------------------- */
  const act1P  = scroll.at("act1");
  const portP  = scroll.at("portal");
  const storyP = scroll.at("story");

  /* --- the cloud passage decides who owns the screen ------------------ */
  let masters = { heroMaster: 1, worldMaster: 0, airFade: 1 };
  if (portal) masters = portal.update(portP, t, pointer);

  /* --- camera + product, handed from Act I to Act II inside the cloud -- */
  const a = sampleTrack(CONFIG.approach, act1P);
  const b = sampleTrack(CONFIG.story, storyP);
  const s = blendState(a, b, masters.worldMaster);

  /* --- environments --------------------------------------------------- */
  if (hero)  hero.update(pointer, masters.heroMaster);
  if (world) world.update(pointer, masters.worldMaster, storyP);

  /* --- atmosphere ----------------------------------------------------- */
  if (particles) particles.update(t, gp, pointer, masters.airFade);
  if (ambient) {
    /* the ambient drift steps aside while the passage owns the foreground,
       and returns once we are through */
    const engaged = Math.min(1, portP / 0.18) * Math.min(1, (1 - portP) / 0.10);
    ambient.update(t, pointer, 1 - engaged);
  }

  /* --- the product ---------------------------------------------------- */
  perfume.update(gp);

  placeProduct(s);

  /* --- camera --------------------------------------------------------- */
  if (stage) {
    stage.aim(s.cam, pointer);
    stage.render();
  }
}
requestAnimationFrame(frame);

/* the cinematic run is measured against real document height, which only
   settles once fonts and images have landed */
addEventListener("load", () => scroll.measure());
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => scroll.measure());
}

if (REDUCED) document.body.classList.add("calm");
document.body.dataset.tier = TIER;
