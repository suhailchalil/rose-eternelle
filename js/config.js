/* ---------------------------------------------------------------------------
   ROSE ETERNELLE — central configuration.

   Every tunable in the experience lives here: asset paths, depths, timings,
   particle counts, the cloud transition, the chapter copy. No other module
   hardcodes a position, a duration or a count, so the whole film can be
   re-timed from this one file.

   ASSET POLICY
   The supplied artwork is the source of truth. Some supplied assets are
   deliberately NOT referenced anywhere in this build:
     - assets/bg.webp and assets/env/rays.webp both carry baked sun shafts, and
       the direction forbids artificial sunlight in this scene.
     - frames/b_*.webp is a 240-frame sequence of a ROUND bottle from an earlier
       concept. The product is the rectangular ROSE ETERNELLE flacon only.
     - assets/env/tree.webp is a second, complete tree. The direction is a
       single branch, so only assets/env/branch.webp is used.
--------------------------------------------------------------------------- */

export const CONFIG = {

  /* ------------------------------------------------------------------ *
   * ACT I — the film, and the hand-off into the live scene              *
   * ------------------------------------------------------------------ */

  intro: {
    src:   "assets/intro.mp4",
    /* The film's own final frame. It is the crossfade target, which is what
       makes the join invisible: we dissolve between two identical images. */
    plate: "assets/env/hero_plate.webp",
    warmAt:    0.62,   /* progress at which the live stage is faded up BENEATH
                          the still-opaque video, so it is warm before reveal */
    handoffMs: 1400,   /* crossfade length — long enough to read as one shot */
    /* Safety is measured against playback PROGRESS, never wall time: a fixed
       timeout truncates the film on any device decoding slower than realtime.
       This only fires if playback genuinely stops advancing. */
    stallMs:   4500
  },

  /* the minimal loading state that covers the first paint */
  loader: {
    minMs:  900,    /* never flash by faster than this — a 200ms loader reads
                       as a glitch rather than as an opening */
    fadeMs: 900,
    /* what must be decoded before the film is allowed to begin */
    critical: [
      "assets/env/hero_plate.webp",
      "assets/env/sky.webp",
      "assets/env/branch.webp",
      "assets/rot/r_000.webp"
    ]
  },

  /* ------------------------------------------------------------------ *
   * THE PRODUCT — 192 alpha frames of the real flacon, scrubbed          *
   * ------------------------------------------------------------------ */

  perfume: {
    dir: "assets/rot/", count: 192, pad: 3, ext: ".webp",
    aspect: 366 / 660,
    smoothing: 0.085,   /* scroll -> frame lerp. lower = heavier, more filmic */
    warmup: 24,         /* frames fetched before the hero may be revealed */
    /* Scroll drives rotation across BOTH acts as one continuous turn, so the
       flacon never resets: front -> 3/4 -> side -> rear -> back toward front. */
    turns: 1.0,

    /* DEFECTIVE SOURCE FRAMES — see the note to the art director.
       In these frames the cap renders as a flat neutral-black slab instead of
       the gold lattice. The fault is in the supplied rotation render itself
       (it is present in the original PNGs inside
       Perfume_bottle_rotation_video_..._inspyrenet.zip, so it is not a
       conversion artifact). They are skipped rather than retouched: the
       artwork is the source of truth, and inventing a cap would change the
       product. The sequence holds on the nearest good frame across the gap,
       which is at most five frames — under ten degrees of a 360 turn, and
       invisible in motion. Delete this list once the frames are re-rendered. */
    skip: [96, 97, 98, 126, 127, 128, 129, 130]
  },

  /* ------------------------------------------------------------------ *
   * ACT I SCENE — background / branch / (product) / atmosphere           *
   * ------------------------------------------------------------------ *
   * The supplied art is 2D, so depth is manufactured: each plate becomes a
   * textured plane at its own z inside a real perspective frustum. Parallax,
   * scale falloff and occlusion then fall out of the camera for free, which
   * is what sells flat plates as a space.
   *
   * z is three.js depth; the camera sits at z = 18 looking toward -6.
   * `anchor: "right"` keeps a plate off the left third, which typography owns.
   */
  hero: {
    layers: [
      /* BACKGROUND — the soft pink cloud atmosphere. No sun, no rays.
         Scale is kept close to 1 deliberately: the plate carries blossom at its
         own left edge, and over-zooming it magnifies that into the column the
         typography needs to stay quiet. */
      { key: "sky",    tex: "assets/env/sky.webp",     z: -21, scale: 1.18, opacity: 1.00 },
      /* a deeper cloud bank, purely for parallax separation against the sky */
      { key: "haze",   tex: "assets/env/cloud_c.webp", z: -15, scale: 1.22, opacity: 0.22 },
      /* TREE — ONE branch, entering from the right exactly as it sits in the
         reference plate, seated behind the product. assets/env/tree.webp is a
         second, complete tree and is deliberately unused: the direction is a
         single branch, and two of them read as two trees. */
      /* `lift` is negative so the plate's own bottom edge — where the artwork
         is cut off square — sits below the frame. A straight cut across the
         lower right was the one thing giving away that this is a flat plate. */
      { key: "branch", tex: "assets/env/branch.webp",  z:  -7, scale: 0.66, opacity: 0.92,
        anchor: "right", push: 0.28, lift: -0.17 },
      /* the low cloud bank the product stands in, per the reference plate */
      { key: "bank",   tex: "assets/cloud_w.webp",     z:  -4, scale: 0.92, opacity: 0.42,
        anchor: "bottom", push: 0.26, shift: 0.12 }
    ]
  },

  /* ------------------------------------------------------------------ *
   * ACT II SCENE — the world beyond the cloud                            *
   * ------------------------------------------------------------------ */
  world: {
    layers: [
      { key: "wSky",    tex: "assets/env/world.webp",    z: -20, scale: 1.40, opacity: 0.00 },
      { key: "wBank",   tex: "assets/cloud_s.webp",      z: -12, scale: 1.10, opacity: 0.00, anchor: "bottom" },
      { key: "wRoses",  tex: "assets/env/roses_b.webp",  z:  -8, scale: 0.60, opacity: 0.00, anchor: "right" },
      { key: "wLiquid", tex: "assets/env/liquid_b.webp", z:  -5, scale: 0.95, opacity: 0.00 },
      { key: "wGlow",   tex: "assets/env/glitter.webp",  z:   2, scale: 0.95, opacity: 0.00, blend: "add" }
    ]
  },

  /* ------------------------------------------------------------------ *
   * THE CLOUD TRANSITION — the signature interaction                     *
   * ------------------------------------------------------------------ *
   * Not a fade. A stack of real cloud planes strung along z, which the camera
   * genuinely travels through: each plane rushes from depth toward the lens,
   * growing by perspective rather than by an animated scale, until the nearest
   * ones are wider than the frustum and the screen is inside the cloud. The
   * environment underneath is swapped at that blind moment, so the visitor
   * emerges into Act II having never seen a cut.
   *
   * `enter` is a plane's z at portal progress 0, `exit` its z at progress 1.
   * Anything ending up behind the camera (z > 18) has been passed through.
   * `front: true` mounts it in the canvas ABOVE the product, so it genuinely
   * occludes the flacon rather than sliding behind it.
   */
  portal: {
    vh: 260,              /* how far the pinned transition runs, in viewports */
    /* the window in which the two environments trade places, chosen to sit
       inside the densest part of the cloud */
    swap: [0.48, 0.62],
    /* the full-frame veil carrying the last of the density — the instant the
       visitor is inside the cloud rather than looking at it */
    veil: { peak: 0.55, width: 0.18, max: 0.90 },
    planes: [
      { tex: "assets/env/cloud_fg_soft.webp", enter: -30, exit:  -2, scale: 0.70, opacity: 0.50, x: -0.34, y: -0.30, front: false, at: 0.00 },
      { tex: "assets/cloud_s.webp",           enter: -26, exit:   4, scale: 0.80, opacity: 0.62, x:  0.30, y: -0.36, front: false, at: 0.02 },
      { tex: "assets/cloud_w.webp",           enter: -20, exit:  12, scale: 1.00, opacity: 0.78, x: -0.18, y: -0.42, front: true,  at: 0.06 },
      { tex: "assets/env/cloud_fg.webp",      enter: -14, exit:  21, scale: 1.15, opacity: 0.88, x:  0.16, y: -0.30, front: true,  at: 0.12 },
      /* the corridor plate: cloud around the frame with a genuine alpha hole
         through the middle. Passing through this is the breakthrough beat. */
      { tex: "assets/env/cloud_portal.webp",  enter: -18, exit:  30, scale: 1.30, opacity: 1.00, x:  0.00, y:  0.00, front: true,  at: 0.16, corridor: true },
      { tex: "assets/cloud_w.webp",           enter:  -9, exit:  27, scale: 1.35, opacity: 0.92, x: -0.10, y: -0.14, front: true,  at: 0.20 },
      { tex: "assets/env/cloud_fg.webp",      enter:  -5, exit:  33, scale: 1.60, opacity: 0.95, x:  0.08, y:  0.04, front: true,  at: 0.28 }
    ],
    /* planes kept on mid/low tier, in the order listed above */
    tierPlanes: { high: 7, mid: 5, low: 4 }
  },

  /* ambient foreground cloud drifting past the lens outside the transition.
     Kept low in frame and well under full opacity, so it brushes the base of
     the flacon without ever masking the hero. */
  ambientCloud: {
    tex: "assets/env/cloud_fg.webp", texSoft: "assets/env/cloud_fg_soft.webp",
    aspect: 2.569,
    travel: { from: -0.92, to: 1.04 },
    instances: [
      { z: 7.6, scale: 1.30, opacity: 0.42, y: -0.48, dur: 132, phase: 0.00, soft: false, spin: 1.4, depthSwing: 0.9 },
      { z: 5.2, scale: 0.92, opacity: 0.30, y: -0.38, dur: 171, phase: 0.55, soft: true,  spin: -1.0, depthSwing: 0.7 }
    ],
    mobileScale: 0.78, mobileYDrop: -0.06, mobileInstances: 1
  },

  /* ------------------------------------------------------------------ *
   * PARTICLES — supplied petal / droplet cut-outs, given depth           *
   * ------------------------------------------------------------------ */
  particles: {
    /* z bands straddle the product: `far` sits behind it, `near` crosses in
       front of it, which is what makes flat plates read as a volume. */
    petals: [
      { key: "far",  tex: "assets/env/petal_far.webp",  count: 24, z: [-15, -9],   size: [24, 50],  speed: [0.10, 0.22], opacity: 0.32, spin: 0.30, front: false },
      { key: "mid",  tex: "assets/env/petal_mid.webp",  count: 18, z: [-8, -3],    size: [38, 74],  speed: [0.16, 0.32], opacity: 0.58, spin: 0.45, front: false },
      { key: "near", tex: "assets/env/petal_near.webp", count:  9, z: [-1.5, 2.0], size: [66, 106], speed: [0.24, 0.46], opacity: 0.66, spin: 0.60, front: true  }
    ],
    dust: { key: "dust", tex: "assets/env/dust.webp", count: 200, z: [-16, 2], size: [3, 14], speed: [0.04, 0.14], opacity: 0.46, spin: 0, front: false, additive: true },
    /* particle budget multiplier per device tier */
    tierScale: { high: 1, mid: 0.6, low: 0.38 }
  },

  /* ------------------------------------------------------------------ *
   * MOTION                                                               *
   * ------------------------------------------------------------------ *
   * Pointer parallax is layered by depth, never a uniform follow: the
   * background barely moves, the foreground moves most. Values are px of
   * travel at full deflection; everything is lerped, never mapped directly.
   */
  pointer: { bg: 2, tree: 6, particles: 11, foreground: 16, product: 4, ease: 0.055 },
  scroll:  { ease: 0.085 },

  /* how far the Act I "approach" beat runs, in viewport heights */
  approachVh: 180,

  /* Act I camera drift — the "approach" beat before the cloud arrives.
     Keyframes on Act I progress 0..1. x/y are viewport fractions from centre. */
  approach: [
    { p: 0.00, x: 0.215, y:  0.030, scale: 0.86, cam: [ 0.0, 0.0, 0.0] },
    { p: 0.45, x: 0.190, y: -0.010, scale: 0.96, cam: [ 0.5, 0.1, 1.0] },
    { p: 1.00, x: 0.120, y: -0.030, scale: 1.06, cam: [-0.2, 0.2, 2.1] }
  ],
  /* Act II camera — the product travels as the story unfolds, but never far
     enough left to sit under the chapter copy. */
  story: [
    { p: 0.00, x: 0.180, y:  0.00, scale: 1.00, cam: [ 0.0,  0.0, 0.4] },
    { p: 0.22, x: 0.210, y:  0.02, scale: 0.94, cam: [ 0.6,  0.1, 0.0] },
    { p: 0.44, x: 0.150, y: -0.02, scale: 1.12, cam: [-0.4,  0.2, 1.6] },
    { p: 0.66, x: 0.230, y:  0.01, scale: 0.98, cam: [ 0.8, -0.1, 0.6] },
    { p: 0.86, x: 0.140, y: -0.01, scale: 1.20, cam: [-0.3,  0.1, 2.4] },
    { p: 1.00, x: 0.200, y:  0.02, scale: 1.02, cam: [ 0.2,  0.0, 0.8] }
  ],

  /* On a portrait viewport the layout stacks: the product takes the upper
     ~40% and the copy sits beneath it. These numbers are set so the flacon's
     lower edge clears the top of the copy block at 390x844 — the tightest
     common phone — rather than being merely "smaller". The product is still
     the hero; it is just no longer sharing a column with the type. */
  mobileProduct: { xMul: 0.10, yOffset: -0.31, scaleMul: 0.54 },

  /* ------------------------------------------------------------------ *
   * COPY                                                                 *
   * ------------------------------------------------------------------ */

  /* Act I: one editorial beat while the product turns, before the cloud. */
  approachCopy: {
    kicker: "The Approach",
    lines: ["Turn it slowly.", "The light never falls the same way twice."]
  },

  /* Act II — the story beyond the cloud. Chapter 04 carries the note pyramid,
     which the navigation links to; the brief's chapter list skips 04, so the
     notes take that slot rather than leaving a hole in the numbering. */
  chapters: [
    { id: "rosebud",   kicker: "Chapter 01", title: "The Rosebud",   lines: ["A rose, held still", "at the moment it opens."], vh: 300 },
    { id: "essence",   kicker: "Chapter 02", title: "The Essence",   lines: ["Bergamot first — bright,", "then the skin beneath it."], vh: 320 },
    { id: "rose",      kicker: "Chapter 03", title: "The Rose",      lines: ["Rose de Mai, picked", "before the heat of the day."], vh: 320 },
    { id: "notes",     kicker: "Chapter 04", title: "The Notes",     lines: [], vh: 420, notes: true },
    { id: "liquid",    kicker: "Chapter 05", title: "The Liquid",    lines: ["Poured slowly, so nothing", "of the flower is lost."], vh: 320 },
    { id: "signature", kicker: "Chapter 06", title: "The Signature", lines: ["Hours later, still there —", "warm, close, unmistakable."], vh: 300 }
  ],

  notes: [
    { group: "Top",   items: ["Bergamot", "Pink Pepper", "Lychee"] },
    { group: "Heart", items: ["Rose de Mai", "Peony", "Magnolia"] },
    { group: "Base",  items: ["Oud Wood", "Amber", "Musk"] }
  ],

  product: {
    name: "Rose Éternelle", kind: "Eau de Parfum", size: "50 ML", price: "₹6,999",
    blurb: "A rose captured at full bloom — bergamot and pink pepper over a heart of Rose de Mai, settling into oud, amber and musk."
  }
};

/* ------------------------------------------------------------------ *
 * ENVIRONMENT                                                         *
 * ------------------------------------------------------------------ */
export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const MOBILE  = () => innerWidth < 820;

/* A coarse device tier. Particle counts, pixel ratio and portal plane count
   all scale off this, so a weak GPU gets a lighter scene rather than a
   stuttering one. Evaluated once: it drives buffer sizes built at startup. */
export const TIER = (() => {
  const mem = navigator.deviceMemory || 8;
  const cpu = navigator.hardwareConcurrency || 8;
  if (innerWidth < 820 || mem <= 3) return "low";
  if (mem <= 4 || cpu <= 4) return "mid";
  return "high";
})();
