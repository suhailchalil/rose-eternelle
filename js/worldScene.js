/* ---------------------------------------------------------------------------
   WorldScene — Act II's environment, the world beyond the cloud.

   Same visual identity, deeper into the fragrance: the pink cloud field over
   still water (assets/env/world.webp), with the rose and liquid plates rising
   and falling as the chapters pass.

   Every plate starts at opacity 0. They are brought up by the cloud transition
   while the screen is inside the cloud, which is why the visitor never sees a
   swap — only an emergence. After that, `chapter` drives which accents are lit,
   so the world keeps changing under the story without ever cutting.
--------------------------------------------------------------------------- */
import { CONFIG } from "./config.js";

/* Accent curves across Act II progress 0..1. The base sky and bank stay up the
   whole time; the rest breathe in and out around particular chapters. */
const bump = (p, centre, width) =>
  Math.max(0, 1 - Math.abs(p - centre) / width);

export class WorldScene {
  constructor(stage) {
    this.stage = stage;
    this.plates = {};
    for (const def of CONFIG.world.layers) {
      this.plates[def.key] = stage.plate(def, false);
    }
    this.master = 0;
  }

  /* master: 0 before the cloud, 1 once the world owns the screen.
     storyP: 0..1 through Act II. */
  update(ptr, master, storyP) {
    this.master = master;
    const P = this.plates;

    /* the ground of the world — always present once revealed */
    this._set(P.wSky,  1.00 * master, ptr);
    this._set(P.wBank, 0.62 * master, ptr);

    /* accents, tied to the chapters they belong to.
       roses peak around "The Rose", liquid around "The Liquid", and the
       glitter plate lifts only at the very end for "The Signature". */
    this._set(P.wRoses,  0.70 * bump(storyP, 0.34, 0.30) * master, ptr);
    this._set(P.wLiquid, 0.55 * bump(storyP, 0.70, 0.26) * master, ptr);
    this._set(P.wGlow,   0.34 * bump(storyP, 0.93, 0.22) * master, ptr);
  }

  _set(mesh, opacity, ptr) {
    if (!mesh) return;
    mesh.material.opacity = opacity;
    mesh.visible = opacity > 0.004;
    if (mesh.visible) this.stage.parallax(mesh, ptr);
  }
}
