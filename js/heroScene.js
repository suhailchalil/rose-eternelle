/* ---------------------------------------------------------------------------
   HeroScene — Act I's environment.

   Three supplied layers, rebuilt as depth:

       BACKGROUND   assets/env/sky.webp      the soft pink cloud atmosphere
       TREE         assets/env/branch.webp   the branch, entering from the right
                    assets/env/tree.webp     a deeper, dimmer copy for separation
       (PRODUCT)     — not here: the flacon is the 2D canvas above this one
       BANK         assets/cloud_w.webp      the low cloud the product stands in

   The branch is anchored right and seated at z = -7, between the sky and the
   product, so the flacon occludes it and it occludes the sky. That ordering,
   plus its own parallax rate, is what makes it read as standing IN the scene
   rather than being pasted over it.

   No sun, no rays, no bloom: assets/bg.webp and assets/env/rays.webp both bake
   in light shafts and are deliberately unused.
--------------------------------------------------------------------------- */
import { CONFIG } from "./config.js";

export class HeroScene {
  constructor(stage) {
    this.stage = stage;
    this.plates = {};
    for (const def of CONFIG.hero.layers) {
      const m = stage.plate(def, false);
      m.userData.baseOpacity = def.opacity;
      this.plates[def.key] = m;
    }
    this.master = 1;    /* driven down to 0 as the cloud swallows Act I */
  }

  /* master: 1 while Act I owns the screen, 0 once the world has replaced it.
     ptr: eased pointer. Depth-scaled parallax comes from the stage so every
     layer in the site shares one parallax law. */
  update(ptr, master) {
    this.master = master;
    for (const k in this.plates) {
      const m = this.plates[k];
      m.material.opacity = m.userData.baseOpacity * master;
      m.visible = m.material.opacity > 0.004;
      if (m.visible) this.stage.parallax(m, ptr);
    }
  }
}
