import type * as THREE from "three";
export function naturalIntensity(value: boolean | number | undefined) {
  return value === true ? 1 : typeof value === "number" && Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0;
}
const effects = new WeakMap<THREE.Material, { value: number }>();
/** A fixed, subtle surface treatment: no extra geometry, lights or frame loop. */
export function setNaturalImperfections(material: THREE.Material, enabled: boolean | number | undefined, kind: "paper" | "backdrop" = "paper") {
  material.userData["naturalEnabled"] = naturalIntensity(enabled);
  let amount = effects.get(material);
  if (!amount) {
    amount = { value: 0 }; effects.set(material, amount);
    const uniform = amount, previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms["naturalAmount"] = uniform;
      shader.vertexShader = "varying vec2 naturalUv;\n" + shader.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nnaturalUv = uv;");
      shader.fragmentShader = "uniform float naturalAmount;\nvarying vec2 naturalUv;\nfloat naturalHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }\n" + shader.fragmentShader;
      if (kind === "paper") shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        if (naturalAmount > 0.0) {
          vec2 p = naturalUv;
          float fibre = sin(p.x*2400.0 + sin(p.y*270.0)*2.0) * sin(p.y*850.0);
          fibre *= 1.0-smoothstep(.2,1.0,max(fwidth(p.x)*2400.0,fwidth(p.y)*850.0));
          float variation = sin(p.x*19.0+p.y*13.0)*sin(p.y*27.0-p.x*7.0);
          float edge = min(min(p.x,1.0-p.x),min(p.y,1.0-p.y));
          float wear = (1.0-smoothstep(.001,.007,edge))*(.3+.7*naturalHash(floor(p*256.0)));
          float pale = smoothstep(.55,.92,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
          diffuseColor.rgb *= mix(vec3(1.0),vec3(.995,.991,.982)+vec3(fibre*.002+variation*.002-wear*.018),pale*naturalAmount);
        }`);
      else shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
        if (naturalAmount > 0.0) {
          vec2 grid = naturalUv*64.0, cell = floor(grid);
          vec2 centre = vec2(naturalHash(cell+2.0),naturalHash(cell+7.0));
          float speck = step(.985,naturalHash(cell))*(1.0-smoothstep(.015,.07,length(fract(grid)-centre)));
          outgoingLight *= 1.0-speck*.12*naturalAmount;
        }
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => key() + "_natural_" + kind;
    material.needsUpdate = true;
  }
  amount.value = naturalIntensity(enabled);
}
