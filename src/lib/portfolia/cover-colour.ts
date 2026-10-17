/** Dominant perimeter colour: match the cover trim without averaging central text/art. */
export function coverColourFromPixels(pixels:Uint8ClampedArray,width:number,height:number){
  const bins=new Map<number,{count:number;r:number;g:number;b:number}>();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(x>width*.12&&x<width*.88&&y>height*.12&&y<height*.88)continue;
    const i=(y*width+x)*4;if(pixels[i+3]!<128)continue;
    const r=pixels[i]!,g=pixels[i+1]!,b=pixels[i+2]!,key=(r>>4)*256+(g>>4)*16+(b>>4);
    const bin=bins.get(key)??{count:0,r:0,g:0,b:0};bin.count++;bin.r+=r;bin.g+=g;bin.b+=b;bins.set(key,bin);
  }
  const best=[...bins.values()].sort((a,b)=>b.count-a.count)[0];
  if(!best)return "#f4f1e9";
  return "#"+[best.r,best.g,best.b].map(v=>Math.round(v/best.count).toString(16).padStart(2,"0")).join("");
}
const sampled=new WeakMap<HTMLCanvasElement,string>();
export function sampleCoverColour(source:HTMLCanvasElement){
  const cached=sampled.get(source);if(cached)return cached;
  const canvas=document.createElement("canvas");canvas.width=canvas.height=32;
  const ctx=canvas.getContext("2d")!;ctx.drawImage(source,0,0,32,32);
  const colour=coverColourFromPixels(ctx.getImageData(0,0,32,32).data,32,32);sampled.set(source,colour);return colour;
}
