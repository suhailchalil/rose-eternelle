/* ---------------------------------------------------------------------------
   The stage: shared WebGL plumbing for every 3D layer in the site.

   WHY TWO RENDERERS
   The product is a 2D canvas of pre-rendered alpha frames, stacked in the DOM
   between two WebGL canvases. Nothing inside a single three.js scene could
   ever draw in front of that canvas, and the cloud transition depends on cloud
   planes genuinely passing IN FRONT of the flacon. So the scene is split:

       #gl      (back)  — environment plates, far/mid petals, dust
       #bottle  (2D)    — the product
       #gl-fg   (front) — near petals, droplets, the cloud transition

   Both renderers share ONE camera object. That is the important part: a single
   camera means the two halves cannot drift out of parallax with each other,
   and a plane at z = -7 and a plane at z = +7 belong to the same space even
   though they live in different GL contexts.

   Everything here is depth-and-frustum maths. What moves the camera and what
   fades the plates lives in the scene modules that own them.
--------------------------------------------------------------------------- */
import * as THREE from "three";
import { CONFIG, MOBILE, TIER } from "./config.js";

const CAM_Z    = 18;            /* the lens sits here; scenes are built around it */
const CAM_FOV  = 38;
const LOOK_AT  = new THREE.Vector3(0, 0, -6);
const PLATE_AR = 1280 / 853;    /* the supplied plates share this aspect */

export class Stage {
  constructor(backCanvas, frontCanvas) {
    this.camera = new THREE.PerspectiveCamera(CAM_FOV, innerWidth / innerHeight, 0.1, 140);
    this.camera.position.set(0, 0, CAM_Z);

    this.back  = new THREE.Scene();
    this.front = new THREE.Scene();

    const ratio = Math.min(devicePixelRatio || 1, TIER === "high" ? 2 : 1.5);
    this.rBack  = this._renderer(backCanvas,  ratio);
    this.rFront = this._renderer(frontCanvas, ratio);

    this.loader = new THREE.TextureLoader();
    this.clock  = new THREE.Clock();
    this._plates = [];       /* everything needing a re-fit on resize */
    this._textures = [];     /* everything needing disposal */
    this.paused = false;

    this.resize();
    addEventListener("resize", () => this.resize(), { passive: true });

    /* A hidden tab must not burn GPU on an animation nobody is watching. */
    document.addEventListener("visibilitychange", () => {
      this.paused = document.hidden;
      if (!this.paused) this.clock.getDelta();   /* swallow the gap */
    });
  }

  _renderer(canvas, ratio) {
    const r = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: false, powerPreference: "high-performance"
    });
    r.setPixelRatio(ratio);
    r.setSize(innerWidth, innerHeight, false);
    r.setClearColor(0x000000, 0);
    return r;
  }

  /* ---- geometry helpers ------------------------------------------------ */

  /* The visible width/height of the frustum at a given depth. Every plate is
     sized against this, so "scale: 1.0" always means "exactly fills frame"
     no matter how deep the plate sits or how wide the viewport is. */
  frustum(z) {
    const d = this.camera.position.z - z;
    const h = 2 * Math.tan((CAM_FOV * Math.PI / 180) / 2) * Math.max(d, 0.001);
    return { h, w: h * this.camera.aspect };
  }

  texture(url) {
    const t = this.loader.load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    this._textures.push(t);
    return t;
  }

  /* ---- plates ---------------------------------------------------------- *
   * A plate is one supplied image as a textured plane at its own depth.
   * `def` is a layer entry from CONFIG. Returns the mesh; its rest position
   * is stored on the mesh so pointer parallax can offset from it without
   * accumulating drift.
   */
  plate(def, front = false) {
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture(def.tex),
      transparent: true,
      opacity: def.opacity ?? 1,
      depthWrite: false,
      depthTest: false,
      blending: def.blend === "add" ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.z = def.z ?? 0;
    mesh.frustumCulled = false;
    /* Render order follows depth so painter's-algorithm ordering is stable
       even with depthTest off, which alpha plates require. */
    mesh.renderOrder = Math.round((def.z ?? 0) * 10);
    mesh.userData = { def, ax: 0, ay: 0, aspect: def.aspect || PLATE_AR };
    (front ? this.front : this.back).add(mesh);
    this._plates.push(mesh);
    this.fit(mesh);
    return mesh;
  }

  /* Size and anchor a plate inside its frustum.

     Unanchored plates COVER the frame (never letterbox, whatever the viewport).
     Anchored plates are sized as a fraction of the frame and pushed to an edge
     — that is what keeps the branch and the cloud bank on the right, off the
     left third the typography owns. */
  fit(mesh) {
    const { def, aspect } = mesh.userData;
    const { w, h } = this.frustum(mesh.position.z);
    const s = def.scale ?? 1;

    if (def.anchor === "right") {
      const pw = w * s, ph = pw / aspect;
      mesh.scale.set(pw, ph, 1);
      /* `push` is how much of the plate hangs off the right edge, as a
         fraction of its own width. Lower values pull it further out of frame,
         which is how the branch is kept clear of the typography column. */
      mesh.userData.ax = w * 0.5 - pw * (def.push ?? 0.34);
      mesh.userData.ay = h * (def.lift ?? 0.04);
    } else if (def.anchor === "bottom") {
      const pw = w * s, ph = pw / aspect;
      mesh.scale.set(pw, ph, 1);
      mesh.userData.ax = w * (def.shift ?? 0.08);
      mesh.userData.ay = -h * 0.5 + ph * (def.push ?? 0.34);
    } else {
      /* cover: grow whichever axis falls short */
      let pw = w * s, ph = pw / aspect;
      if (ph < h * s) { ph = h * s; pw = ph * aspect; }
      mesh.scale.set(pw, ph, 1);
      mesh.userData.ax = 0;
      mesh.userData.ay = 0;
    }
    mesh.position.x = mesh.userData.ax;
    mesh.position.y = mesh.userData.ay;
  }

  /* Pointer parallax for a plate, applied as an offset from its rest position
     so repeated frames cannot accumulate drift. Strength scales with depth:
     the sky barely moves, the nearest layer moves most. */
  parallax(mesh, ptr) {
    const P = CONFIG.pointer;
    const depth = Math.min(Math.max((mesh.position.z + 21) / 28, 0), 1);  /* 0 far .. 1 near */
    const k = (P.bg + (P.foreground - P.bg) * depth) / 100;
    mesh.position.x = mesh.userData.ax - ptr.x * k * 6;
    mesh.position.y = mesh.userData.ay - ptr.y * k * 3;
  }

  /* ---- frame ----------------------------------------------------------- */

  /* Camera offsets come from the timeline; pointer adds a small extra swing.
     lookAt is a fixed point ahead of the scene, so moving the camera orbits
     the space slightly rather than panning it flatly. */
  aim(cam, ptr) {
    this.camera.position.x =  cam[0] - ptr.x * 0.5;
    this.camera.position.y = -cam[1] + ptr.y * 0.3;
    this.camera.position.z =  CAM_Z - cam[2];
    this.camera.lookAt(LOOK_AT);
  }

  render() {
    if (this.paused) return;
    this.rBack.render(this.back, this.camera);
    this.rFront.render(this.front, this.camera);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    const ratio = Math.min(devicePixelRatio || 1, TIER === "high" && !MOBILE() ? 2 : 1.5);
    for (const r of [this.rBack, this.rFront]) {
      r.setPixelRatio(ratio);
      r.setSize(innerWidth, innerHeight, false);
    }
    for (const m of this._plates) this.fit(m);
  }

  dispose() {
    const kill = (scene) => scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    kill(this.back); kill(this.front);
    for (const t of this._textures) t.dispose();
    this.rBack.dispose(); this.rFront.dispose();
  }
}

export { CAM_Z, PLATE_AR };
