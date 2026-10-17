import { pageBlockGeometry, coverBoardGeometry, caseSpineGeometry } from "./book-model";
import { COVER_HEIGHT } from "./rigid-cover";
import * as THREE from "three";
import { bookStyleProfile, type BookStyle } from "./book-style";

/** A lightweight, renderer-owned shell below the PDF artwork. No per-frame allocations. */
export function createBookBinding(parent:THREE.Group,ratio:number){
  const group=new THREE.Group();group.name="Book binding";parent.add(group);
  const pixels=new Uint8Array(128*4);
  for(let i=0;i<128;i++){const shade=i%4===0?222:246;pixels.set([shade,shade-3,shade-10,255],i*4);}
  const edges=new THREE.DataTexture(pixels,1,128);edges.colorSpace=THREE.SRGBColorSpace;edges.magFilter=THREE.LinearFilter;edges.needsUpdate=true;
  const boardMaterial=new THREE.MeshStandardMaterial({roughness:.62});
  const pageMaterial=new THREE.MeshStandardMaterial({map:edges,roughness:.98});
  const spineMaterial=new THREE.MeshStandardMaterial({roughness:.6,envMapIntensity:1.15});
  const box=pageBlockGeometry(),cylinder=caseSpineGeometry();
  const sides=([-1,1] as const).map(side=>{
    const root=new THREE.Group(),board=new THREE.Mesh(coverBoardGeometry(1,ratio,.018),boardMaterial),pages=new THREE.Mesh(box,pageMaterial);
    root.position.x=side*.5;root.add(board,pages);group.add(root);
    board.castShadow=pages.castShadow=true;board.receiveShadow=pages.receiveShadow=true;
    return {root,board,pages};
  });
  const spine=new THREE.Mesh(cylinder,spineMaterial);spine.castShadow=spine.receiveShadow=true;group.add(spine);
  let boardStamp="";
  let style:BookStyle="flipbook",studio=false,coverColour:string|undefined;
  const colour=()=>{
    const value=coverColour??bookStyleProfile(style).colour;
    for(const material of [boardMaterial,spineMaterial]){material.color.set(studio?value:"#000000");material.emissive.set(studio?"#000000":value);}
  };
  return {
    setCoverColour(value:string){coverColour=value;colour();},
    set(value:unknown,lit:boolean){
      studio=lit;
      const profile=bookStyleProfile(value);style=profile.id;
      group.visible=style!=="flipbook";
      const stamp=profile.id;
      sides.forEach(({board,pages})=>{
        if(stamp!==boardStamp&&profile.board>0){board.geometry.dispose();board.geometry=coverBoardGeometry(1+2*profile.overhang,ratio+2*profile.overhang,profile.board);}
        board.scale.set(1+2*profile.overhang,ratio+2*profile.overhang,profile.board);
        board.position.z=-.005-profile.stack-profile.board/2;
        pages.scale.set(.997,ratio-.004,profile.stack);pages.position.z=-.005-profile.stack/2;
      });
      boardStamp=stamp;
      spine.scale.set(profile.spine*.65,ratio+2*profile.overhang,profile.spine*1.8);
      spine.position.z=-.006;
      colour();
      pageMaterial.color.set(studio?"#ffffff":"#000000");pageMaterial.emissive.set(studio?"#000000":"#ffffff");
      const emissiveMap=studio?null:edges;
      if(pageMaterial.emissiveMap!==emissiveMap){pageMaterial.emissiveMap=emissiveMap;pageMaterial.needsUpdate=true;}
    },
    sync(visible:readonly [boolean,boolean],covers:readonly [boolean,boolean]=[false,false]){
      sides.forEach(({root,board,pages},index)=>{
        root.visible=visible[index]!;
        const profile=bookStyleProfile(style),rise=style==="hardback"&&covers[index]?COVER_HEIGHT+.005:0;
        board.position.x=style==="hardback"&&covers[index]?(index===0?-1:1)*profile.overhang:0;
        board.position.z=-.005-profile.stack-profile.board/2+rise+ (rise?profile.stack:0);
        pages.scale.z=profile.stack+(rise?rise-profile.board:0);
        pages.position.z=-.005-profile.stack/2+(rise?(rise-profile.board)/2:0);
      });
      const profile=bookStyleProfile(style);
      spine.position.z=(style==="hardback"&&(covers[0]||covers[1])?COVER_HEIGHT:-.005)-.001;
      spine.visible=style!=="flipbook" && (visible[0]||visible[1]);
    },
    dispose(){parent.remove(group);box.dispose();sides.forEach(({board})=>board.geometry.dispose());cylinder.dispose();edges.dispose();boardMaterial.dispose();pageMaterial.dispose();spineMaterial.dispose();},
  };
}
