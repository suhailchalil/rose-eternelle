/* ---------------------------------------------------------------------------
   AmbientClouds — the nearest layer, outside the transition.

   One or two isolated clouds drifting slowly across the lower foreground,
   mounted in the canvas ABOVE the product so they genuinely pass in front of
   the flacon's base. Kept low in frame and well under full opacity: they are
   atmosphere brushing the lens, not a shape competing with the hero.

   They also do the quiet job of introducing the cloud BEFORE the passage
   begins, so when the transition starts the cloud is already part of the
   world rather than an effect that suddenly arrives.

   Their z drifts, so they grow and shrink through the lens rather than by an
   animated scale — the same principle as the transition, at a whisper.
--------------------------------------------------------------------------- */
import * as THREE from "three";
import { CONFIG, REDUCED, MOBILE } from "./config.js";

const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);

export class AmbientClouds {
  constructor(stage) {
    const C = CONFIG.ambientCloud;
    this.stage = stage;
    this.cfg = C;

    const tex = {
      sharp: stage.texture(C.tex),
      soft:  stage.texture(C.texSoft)
    };

    const list = MOBILE() ? C.instances.slice(0, C.mobileInstances) : C.instances;
    this.items = list.map((I) => {
      const mat = new THREE.MeshBasicMaterial({
        map: I.soft ? tex.soft : tex.sharp,
        transparent: true, opacity: 0,
        depthWrite: false, depthTest: false
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.position.z = I.z;
      mesh.frustumCulled = false;
      mesh.renderOrder = 400;
      stage.front.add(mesh);
      return { mesh, mat, I, phase: Math.random() * 6.283 };
    });

    this.resize();
    addEventListener("resize", () => this.resize(), { passive: true });
  }

  resize() {
    const mob = MOBILE();
    for (const it of this.items) {
      const { w } = this.stage.frustum(it.I.z);
      const s = it.I.scale * (mob ? this.cfg.mobileScale : 1);
      const pw = w * s;
      it.mesh.scale.set(pw, pw / this.cfg.aspect, 1);
    }
  }

  /* t: elapsed seconds. ptr: eased pointer.
     master: faded to 0 while the transition owns the foreground, so the two
     cloud systems never stack up into mush. */
  update(t, ptr, master = 1) {
    const C = this.cfg, mob = MOBILE();

    for (const it of this.items) {
      const I = it.I;
      const { w, h } = this.stage.frustum(I.z);

      /* one very slow traversal, eased at both ends */
      const p = REDUCED ? 0.5 : ((t / I.dur) + I.phase) % 1;
      const e = smoother(p);

      let x = (C.travel.from + (C.travel.to - C.travel.from) * e) * w;
      let y = (I.y + (mob ? C.mobileYDrop : 0)) * h + Math.sin(t * 0.11 + it.phase) * 0.42;
      const z = I.z + Math.sin(t * 0.07 + it.phase) * I.depthSwing;

      x -= ptr.x * (CONFIG.pointer.foreground / 100) * 7;
      y -= ptr.y * (CONFIG.pointer.foreground / 100) * 3.5;

      /* fade in and out at the extremes so entry and exit are never a pop */
      const edge = Math.min(p / 0.14, 1) * Math.min((1 - p) / 0.16, 1);

      it.mesh.position.set(x, y, z);
      it.mesh.rotation.z = Math.sin(t * 0.05 + it.phase) * I.spin * Math.PI / 180;
      it.mat.opacity = I.opacity * Math.max(edge, 0) * master;
      it.mesh.visible = it.mat.opacity > 0.004;
    }
  }
}
