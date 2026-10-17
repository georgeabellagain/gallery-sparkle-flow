/** Shadow detail follows output size, independently of adaptive PDF/canvas quality. */
export function studioShadowSize(width:number,height:number,pixelRatio=1,maxTexture=4096,capture=false){
  const longest=Math.max(width,height)*Math.min(2,Math.max(1,pixelRatio));
  const desired=capture||longest>1600?2048:1024;
  const cap=Number.isFinite(maxTexture)?Math.max(1,maxTexture):1024;
  return Math.min(desired,2**Math.floor(Math.log2(cap)));
}
/** Preserve the preset's world-space softness when increasing shadow resolution. */
export function studioShadowRadius(radius:number,size:number){return radius*size/512;}
