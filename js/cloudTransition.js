/* ---------------------------------------------------------------------------
   CloudTransition — the passage between the two worlds.

   THE IDEA
   This is not a cloud that fades in while the page changes underneath. It is a
   stack of real cloud planes strung along the z axis, and the camera genuinely
   travels through them. Each plane is given a FIXED size in world units and
   then flown toward the lens; because the frustum narrows as it approaches,
   the same plane subtends more and more of the frame until it is wider than
   the screen. Nothing animates a scale value — the growth is perspective, the
   same way a real cloud grows as you fly into it.

   Planes are staggered by `at`, so they arrive one after another: you pass
   through cloud, then more cloud, then the corridor plate — a cloud wall with
   a genuine alpha hole in its middle — and out the far side.

   THE SWAP
   Around the densest moment (CONFIG.portal.swap) the screen is effectively
   inside the cloud: a full-frame veil sits above every canvas, and the layers
   behind it are unreadable. That blind window is where Act I's environment is
   faded out and Act II's is faded in. The visitor never sees a cut, only an
   emergence — which is the whole point of the transition.

   FRONT AND BACK
   Planes flagged `front: true` are mounted in the canvas ABOVE the product, so
   the cloud truly occludes the flacon as it passes. Planes flagged false stay
   behind it, so early in the passage cloud is building up behind the product
   while the product is still clear. That ordering is what gives the passage
   its depth.
--------------------------------------------------------------------------- */
import * as THREE from "three";
import { CONFIG, REDUCED, TIER } from "./config.js";
import { CAM_Z } from "./stage.js";

/* slow -> a little more -> slow. Never linear, never a bounce. */
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const clamp01  = (x) => Math.min(1, Math.max(0, x));
/* smoothstep between two edges */
const between  = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export class CloudTransition {
  constructor(stage, veilEl) {
    this.stage = stage;
    this.veil  = veilEl;
    this.p     = 0;

    const keep = CONFIG.portal.tierPlanes[TIER] ?? CONFIG.portal.planes.length;
    /* Planes are listed far-to-near, so trimming from the end on weaker
       hardware removes the largest, most overdraw-heavy layers first. */
    const defs = CONFIG.portal.planes.slice(0, keep);

    this.items = defs.map((D) => {
      const mat = new THREE.MeshBasicMaterial({
        map: stage.texture(D.tex),
        transparent: true, opacity: 0,
        depthWrite: false, depthTest: false
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      /* nearer planes must paint over further ones within the same scene */
      mesh.renderOrder = 500 + Math.round(D.at * 100);
      (D.front ? stage.front : stage.back).add(mesh);
      return { mesh, mat, D, phase: Math.random() * 6.283 };
    });

    this.resize();
    addEventListener("resize", () => this.resize(), { passive: true });
  }

  /* Size each plane ONCE, in world units, against the frustum at the depth it
     starts from. It then keeps that world size for the whole flight, which is
     what lets perspective — and only perspective — grow it. */
  resize() {
    for (const it of this.items) {
      const { D, mesh } = it;
      const f = this.stage.frustum(D.enter);
      const ar = mesh.material.map?.image
        ? mesh.material.map.image.width / mesh.material.map.image.height
        : 2.4;
      /* cover the frame at the entry depth, then apply the plane's own scale */
      let w = f.w * D.scale, h = w / ar;
      if (h < f.h * D.scale) { h = f.h * D.scale; w = h * ar; }
      mesh.scale.set(w, h, 1);
      it.baseW = w; it.baseH = h;
      it.fx = D.x * f.w;
      it.fy = D.y * f.h;
    }
  }

  /* p: 0..1 through the pinned transition. t: elapsed seconds. ptr: pointer.
     Returns the master weights the rest of the site needs, so the environment
     swap and the transition can never disagree about where we are. */
  update(p, t, ptr) {
    this.p = p;
    const C = CONFIG.portal;

    for (const it of this.items) {
      const { D, mesh, mat } = it;

      /* Each plane runs its own flight from `at` to the end of the passage. */
      const lp = clamp01((p - D.at) / Math.max(1 - D.at, 0.001));
      const e  = smoother(lp);
      const z  = D.enter + (D.exit - D.enter) * e;

      /* idle breath, so the deep planes are alive before the passage starts
         and the whole stack never looks like a frozen diagram */
      const breath = REDUCED ? 0 : Math.sin(t * 0.09 + it.phase);

      mesh.position.set(
        it.fx + breath * 0.6 - ptr.x * (CONFIG.pointer.foreground / 100) * 7,
        it.fy + breath * 0.4 - ptr.y * (CONFIG.pointer.foreground / 100) * 3.5,
        z
      );
      mesh.rotation.z = breath * 0.012;

      /* Opacity has two gates.
         `rise`  — the plane resolves out of the distance rather than popping.
         `pass`  — as it reaches the lens it is fading, because a cloud you are
                   inside of stops being a shape and becomes atmosphere. The
                   veil takes over exactly here, which is what hides the swap. */
      const rise = between(lp, 0.00, 0.14);
      const pass = 1 - between(z, CAM_Z - 6, CAM_Z + 1);
      mat.opacity = D.opacity * rise * pass;
      mesh.visible = mat.opacity > 0.004;
    }

    /* ---- the veil: the moment of being inside the cloud ---------------- */
    const V = CONFIG.portal.veil;
    const veil = V.max * Math.max(0, 1 - Math.abs(p - V.peak) / V.width);
    this.veil.style.opacity = veil.toFixed(3);
    /* a touch of scale keeps the veil from reading as a flat colour wash */
    this.veil.style.transform = `scale(${(1 + veil * 0.06).toFixed(4)})`;

    /* ---- what the rest of the site should be doing ---------------------- */
    const worldMaster = between(p, C.swap[0], C.swap[1]);
    return {
      worldMaster,
      heroMaster: 1 - worldMaster,
      /* thin the petals out inside the cloud — air you cannot see through
         should not have crisp petals crossing it */
      airFade: 1 - veil * 0.9
    };
  }

  /* Nothing of the passage should be on screen outside it. */
  rest() {
    for (const it of this.items) { it.mat.opacity = 0; it.mesh.visible = false; }
    this.veil.style.opacity = "0";
  }
}
