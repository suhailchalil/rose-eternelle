/* ---------------------------------------------------------------------------
   ParticleSystem — petals, droplets and dust.

   The supplied petal cut-outs are flat PNGs. What makes them read as a volume
   rather than as confetti on glass is that each band lives in its own z range
   inside the same frustum as the environment plates: the far band sits behind
   the branch, the near band crosses IN FRONT of the product. Perspective then
   does the rest — near petals are larger, faster and blur past the lens while
   far ones barely creep.

   THREE.Points is used rather than meshes because a few hundred sprites must
   cost one draw call, not a few hundred. PointsMaterial cannot rotate a
   sprite, and tumbling petals were a requirement, so the fragment shader
   rotates gl_PointCoord per particle instead.
--------------------------------------------------------------------------- */
import * as THREE from "three";
import { CONFIG, REDUCED, TIER } from "./config.js";

const SPAN = 44;   /* height of the wrap band, in world units */

const VERT = /* glsl */`
uniform float uTime, uScroll, uPixel, uWind;
attribute float aSeed, aSize, aSpin, aFall, aDrift;
varying float vRot, vAlpha;
void main(){
  vec3 p = position;
  float t = uTime;

  /* Fall, wrapped through the band so the system never empties. Scroll adds
     to the fall, so pushing down the page also pushes the petals past you. */
  p.y = mod(p.y - t * aFall - uScroll * 6.0 * aFall + SPAN * 0.5, SPAN) - SPAN * 0.5;

  /* lateral drift plus a slow sway, so no two petals trace the same path */
  p.x += sin(t * 0.28 + aSeed * 6.283) * aDrift + uWind * (1.0 + aSeed);
  p.z += cos(t * 0.21 + aSeed * 4.100) * 0.4;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  /* size attenuates with distance — this is the whole illusion of depth */
  gl_PointSize = aSize * uPixel * (14.0 / max(-mv.z, 0.6));

  vRot = t * aSpin + aSeed * 6.283;
  /* fade in at the top and out at the bottom so wrapping is never visible */
  vAlpha = smoothstep(0.0, 6.0, SPAN * 0.5 - abs(p.y));
}`.replace(/SPAN/g, SPAN.toFixed(1));

const FRAG = /* glsl */`
uniform sampler2D uTex;
uniform float uOpacity, uFade;
varying float vRot, vAlpha;
void main(){
  /* rotate the sprite's own UVs about its centre */
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vRot), co = cos(vRot);
  vec2 uv = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  vec4 t = texture2D(uTex, uv);
  float a = t.a * uOpacity * uFade * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(t.rgb, a);
}`;

export class ParticleSystem {
  /* `defs` is a list of CONFIG.particles entries. Each becomes one Points
     object, mounted into the front or back scene per its `front` flag. */
  constructor(stage, defs) {
    this.stage = stage;
    this.units = [];
    const budget = CONFIG.particles.tierScale[TIER] ?? 1;
    for (const d of defs) this.units.push(this._build(d, budget));
  }

  _build(D, budget) {
    const n = Math.max(4, Math.round(D.count * budget));
    const g = new THREE.BufferGeometry();

    const pos   = new Float32Array(n * 3);
    const seed  = new Float32Array(n), size  = new Float32Array(n);
    const spin  = new Float32Array(n), fall  = new Float32Array(n);
    const drift = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      pos[i * 3]     = (Math.random() * 2 - 1) * 28;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * (SPAN / 2);
      pos[i * 3 + 2] = D.z[0] + Math.random() * (D.z[1] - D.z[0]);
      seed[i]  = Math.random();
      size[i]  = D.size[0]  + Math.random() * (D.size[1]  - D.size[0]);
      fall[i]  = D.speed[0] + Math.random() * (D.speed[1] - D.speed[0]);
      spin[i]  = (Math.random() * 2 - 1) * (D.spin || 0);
      drift[i] = 0.5 + Math.random() * 2.4;
    }

    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed",  new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aSize",  new THREE.BufferAttribute(size, 1));
    g.setAttribute("aSpin",  new THREE.BufferAttribute(spin, 1));
    g.setAttribute("aFall",  new THREE.BufferAttribute(fall, 1));
    g.setAttribute("aDrift", new THREE.BufferAttribute(drift, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:    { value: 0 },
        uScroll:  { value: 0 },
        uWind:    { value: 0 },
        uPixel:   { value: this.stage.rBack.getPixelRatio() },
        uTex:     { value: this.stage.texture(D.tex) },
        uOpacity: { value: D.opacity },
        uFade:    { value: 1 }
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      /* additive suits fine dust; petals must stay normal or they glow */
      blending: D.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });

    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = Math.round((D.z[0] + D.z[1]) * 5);
    (D.front ? this.stage.front : this.stage.back).add(pts);
    return { pts, mat, def: D };
  }

  /* t: elapsed seconds. scrollP: 0..1 global. ptr: eased pointer.
     fade: master multiplier, used to thin the air out inside the cloud. */
  update(t, scrollP, ptr, fade = 1) {
    for (const u of this.units) {
      const uni = u.mat.uniforms;
      uni.uTime.value   = REDUCED ? 0 : t;
      uni.uScroll.value = scrollP;
      uni.uWind.value   = ptr.x * 0.9;
      uni.uFade.value   = fade;
    }
  }

  onResize() {
    const px = this.stage.rBack.getPixelRatio();
    for (const u of this.units) u.mat.uniforms.uPixel.value = px;
  }

  dispose() {
    for (const u of this.units) {
      u.pts.removeFromParent();
      u.pts.geometry.dispose();
      u.mat.dispose();
    }
    this.units.length = 0;
  }
}
