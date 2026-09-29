import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// "Tiny diorama" look: tilt-shift blur (sharp band around the focus line, soft top & bottom),
// gentle pastel colour grade, bloom-ish glow on bright highlights and a soft pink vignette.

const common = /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uFocus; uniform float uBand; uniform float uAmount;
varying vec2 vUv;
float blurAmt(vec2 uv) {
  float d = abs(uv.y - uFocus);
  return smoothstep(uBand, uBand + 0.32, d) * uAmount;
}`;

const vert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function tiltPass(dir: [number, number], grade: boolean) {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
      uDir: { value: new THREE.Vector2(...dir) },
      uFocus: { value: 0.46 },
      uBand: { value: 0.16 },
      uAmount: { value: 2.6 },
      uSat: { value: 1.12 },
      uVig: { value: 0.28 },
      uGlow: { value: 0.0 },
    },
    vertexShader: vert,
    fragmentShader: /* glsl */ `
      ${common}
      uniform vec2 uDir; uniform float uSat; uniform float uVig; uniform float uGlow;
      void main() {
        float a = blurAmt(vUv);
        vec2 st = uDir * uTexel * a;
        vec4 c = texture2D(tDiffuse, vUv) * 0.2270270270;
        c += texture2D(tDiffuse, vUv + st * 1.3846153846) * 0.3162162162;
        c += texture2D(tDiffuse, vUv - st * 1.3846153846) * 0.3162162162;
        c += texture2D(tDiffuse, vUv + st * 3.2307692308) * 0.0702702703;
        c += texture2D(tDiffuse, vUv - st * 3.2307692308) * 0.0702702703;
        ${grade ? `
        // soft glow: lift bright pastel highlights a touch
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb += c.rgb * smoothstep(0.75, 1.2, l) * uGlow;
        // pastel grade: gentle saturation + warm lift in the shadows
        vec3 g = vec3(dot(c.rgb, vec3(0.299, 0.587, 0.114)));
        c.rgb = mix(g, c.rgb, uSat);

        // soft pink vignette
        vec2 q = vUv - 0.5;
        float v = smoothstep(0.35, 0.95, length(q * vec2(1.25, 1.0)));
        c.rgb = mix(c.rgb, c.rgb * vec3(1.0, 0.86, 0.9), v * uVig);
        ` : ''}
        gl_FragColor = c;
      }`,
  });
}

export class Post {
  composer: EffectComposer;
  private render: RenderPass;
  private h: ShaderPass;
  private v: ShaderPass;
  enabled = true;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.render = new RenderPass(scene, camera);
    this.h = tiltPass([1, 0], false);
    this.v = tiltPass([0, 1], true);
    this.composer.addPass(this.render);
    this.composer.addPass(this.h);
    this.composer.addPass(this.v);
    this.composer.addPass(new OutputPass());
  }

  setScene(scene: THREE.Scene) {
    this.render.scene = scene;
  }

  /** Focus line (0 = bottom, 1 = top of the screen) and blur strength; scenes may tune it. */
  setFocus(focus = 0.46, band = 0.16, amount = 2.6) {
    for (const p of [this.h, this.v]) {
      p.uniforms.uFocus.value = focus;
      p.uniforms.uBand.value = band;
      p.uniforms.uAmount.value = amount;
    }
  }

  setSize(w: number, h: number, dpr: number) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    const tw = 1 / Math.max(1, w * dpr), th = 1 / Math.max(1, h * dpr);
    for (const p of [this.h, this.v]) p.uniforms.uTexel.value.set(tw, th);
  }

  draw(dt: number) {
    this.composer.render(dt);
  }
}
