import type { ViewerSettings } from "./store";
export function photoLighting(viewer?:Partial<ViewerSettings>){return {hdri:viewer?.studioLighting??"4",finish:viewer?.finish??"satin",brightness:viewer?.studioBrightness??.5,strength:viewer?.studioLightingStrength??.75,topLight:viewer?.studioTopLight??0};}
export function photoSpreadPages(page:number,total:number):readonly [number|null,number|null]{
 const value=Math.max(1,Math.min(total,Math.round(page)));
 if(value===1)return [null,1];
 const left=value%2===0?value:value-1;return [left,left+1<=total?left+1:null];
}
