import * as THREE from "three";
export function naturalIntensity(value: boolean | number | undefined) {
  return value === true ? 1 : typeof value === "number" && Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0;
}
let paper: THREE.DataTexture | undefined;
/** One cached bitmap: visible fibres, flecks, mottling and worn edges. */
export function naturalPaperTexture() {
  if(paper)return paper;
  const size=512,data=new Uint8Array(size*size*4);
  let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const clouds=Float32Array.from({length:17*17},()=>random());
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const gx=x/32,gy=y/32,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
    const cloud=(clouds[iy*17+ix]!*(1-fx)+clouds[iy*17+ix+1]!*fx)*(1-fy)+(clouds[(iy+1)*17+ix]!*(1-fx)+clouds[(iy+1)*17+ix+1]!*fx)*fy;
    const edge=Math.min(x,y,size-1-x,size-1-y),wear=edge<5?(5-edge)*random()*2:0;
    const shade=cloud*13+random()*3+wear,i=(y*size+x)*4;
    data[i]=248-shade;data[i+1]=244-shade;data[i+2]=230-shade;data[i+3]=255;
  }
  // Short, irregular fibres and a few visible inclusions are baked once.
  for(let n=0;n<1100;n++){
    const x=random()*size,y=random()*size,a=random()*Math.PI*2,length=2+random()*17,shade=25+random()*55;
    for(let t=0;t<length;t++){
      const xx=Math.round(x+Math.cos(a)*t),yy=Math.round(y+Math.sin(a)*t);
      if(xx<0||yy<0||xx>=size||yy>=size)continue;
      const i=(yy*size+xx)*4;for(let c=0;c<3;c++)data[i+c]=Math.max(100,data[i+c]!-shade);
    }
  }
  paper=new THREE.DataTexture(data,size,size);paper.colorSpace=THREE.SRGBColorSpace;
  paper.generateMipmaps=true;paper.minFilter=THREE.LinearMipmapLinearFilter;paper.magFilter=THREE.LinearFilter;paper.anisotropy=4;paper.needsUpdate=true;
  return paper;
}
const effects=new WeakMap<THREE.Material,{value:number}>();
/** One texture read replaces all procedural per-pixel noise, trigonometry and derivatives. */
export function setNaturalImperfections(material: THREE.Material, enabled: boolean | number | undefined) {
  const value=naturalIntensity(enabled);material.userData["naturalEnabled"]=value;
  let amount=effects.get(material);
  if(!amount){
    if(!value)return;
    amount={value:0};effects.set(material,amount);
    const uniform=amount,previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);
      shader.uniforms["naturalAmount"]=uniform;shader.uniforms["naturalPaper"]={value:naturalPaperTexture()};
      shader.vertexShader="varying vec2 naturalUv;\n"+shader.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\nnaturalUv=uv;");
      shader.fragmentShader="uniform float naturalAmount;\nuniform sampler2D naturalPaper;\nvarying vec2 naturalUv;\n"+shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        if(naturalAmount>0.0){
          vec3 paperColour=texture2D(naturalPaper,naturalUv).rgb;
          float pale=smoothstep(.55,.92,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
          diffuseColor.rgb*=mix(vec3(1.0),paperColour,pale*naturalAmount);
        }`);
    };
    material.customProgramCacheKey=()=>key()+"_natural_paper_bitmap";material.needsUpdate=true;
  }
  amount.value=value;
}
/** A small static cloud of soft motes in front of the paper, drawn in one batch. */
export function createAirDust(scene: THREE.Scene) {
  const count=96,positions=new Float32Array(count*3),colours=new Float32Array(count*3);
  let seed=419;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){
    positions.set([(random()-.5)*6,(random()-.5)*6,.25+random()*.65],i*3);
    const grey=.55+random()*.4;colours.set([grey,grey*.98,grey*.91],i*3);
  }
  const pixels=new Uint8Array(32*32*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const i=(y*32+x)*4,d=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
    pixels.set([255,255,255,Math.round(255*Math.max(0,1-d)**2)],i);
  }
  const map=new THREE.DataTexture(pixels,32,32);map.magFilter=map.minFilter=THREE.LinearFilter;map.needsUpdate=true;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));geometry.setAttribute("color",new THREE.BufferAttribute(colours,3));
  const material=new THREE.PointsMaterial({size:.022,map,vertexColors:true,transparent:true,opacity:0,depthWrite:false});
  const points=new THREE.Points(geometry,material);points.visible=false;points.renderOrder=10;scene.add(points);
  return {setIntensity(value:boolean|number|undefined){const amount=naturalIntensity(value);points.visible=amount>0;material.opacity=.65*amount;},dispose(){scene.remove(points);geometry.dispose();material.dispose();map.dispose();}};
}
