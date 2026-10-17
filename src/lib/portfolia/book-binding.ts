import { pageBlockGeometry, coverBoardGeometry, caseSpineGeometry } from "./book-model";
import { COVER_GAP, PAGE_TOP, coverArtZ, coverTurnPose, type CoverRest } from "./rigid-cover";
import * as THREE from "three";
import { bookStyleProfile, type BookStyle } from "./book-style";

/** What rests on one side of the spine. `share` is that side's fraction of the page block (0..1). */
export type BindingSide = { kind: "page" | CoverRest; share: number };
const PAGE_SIDE: BindingSide = { kind: "page", share: 1 };

/** Page-block thickness grows with the number of leaves, within believable limits. */
export function stackDepth(style: BookStyle, leaves: number) {
  const profile = bookStyleProfile(style);
  if (!leaves) return profile.stack;
  return THREE.MathUtils.clamp(.006 + leaves * (style === "hardback" ? .0009 : .0007), profile.stack * .6, profile.stack * 2.2);
}
/** The fraction of the block lying under a face, from its leaf position. Never zero, so a side never vanishes. */
export function sideShare(side: 0 | 1, leaf: number, leaves: number) {
  if (!leaves || !Number.isFinite(leaf)) return 1;
  const read = THREE.MathUtils.clamp(leaf / Math.max(1, leaves - 1), 0, 1);
  return THREE.MathUtils.clamp(side === 0 ? read : 1 - read, .06, 1);
}

/** A lightweight, renderer-owned shell below the PDF artwork. No per-frame allocations. */
export function createBookBinding(parent:THREE.Group,ratio:number){
  const group=new THREE.Group();group.name="Book binding";parent.add(group);
  const pixels=new Uint8Array(128*4);
  for(let i=0;i<128;i++){const shade=i%4===0?222:246;pixels.set([shade,shade-3,shade-10,255],i*4);}
  const edges=new THREE.DataTexture(pixels,1,128);edges.colorSpace=THREE.SRGBColorSpace;edges.magFilter=THREE.LinearFilter;edges.needsUpdate=true;
  // Front and back boards take their colours from their own cover artwork.
  const boardMaterial=new THREE.MeshStandardMaterial({roughness:.62}),backBoardMaterial=new THREE.MeshStandardMaterial({roughness:.62});
  const pageMaterial=new THREE.MeshStandardMaterial({map:edges,roughness:.98});
  const spineMaterial=new THREE.MeshStandardMaterial({roughness:.6,envMapIntensity:1.15});
  const box=pageBlockGeometry(),cylinder=caseSpineGeometry();
  let boardGeometry:THREE.BufferGeometry=coverBoardGeometry(1,ratio,.018);
  const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=m.receiveShadow=true;return m;};
  const sides=([-1,1] as const).map(side=>{
    // `board` lies under the block (or alone, for an open cover); `top` is the front board of a closed book.
    // The left side rests on the front board and the right on the back board; a closed book shows the other board on top.
    const root=new THREE.Group(),board=mesh(boardGeometry,side<0?boardMaterial:backBoardMaterial),top=mesh(boardGeometry,side<0?backBoardMaterial:boardMaterial),pages=mesh(box,pageMaterial);
    root.position.x=side*.5;root.add(board,pages,top);group.add(root);
    return {root,board,top,pages};
  });
  const spine=mesh(cylinder,spineMaterial);group.add(spine);
  // The board that turns with a hardback cover. Its two faces carry the cover artwork.
  const turning=new THREE.Group();turning.visible=false;group.add(turning);
  const turningBoard=mesh(boardGeometry,boardMaterial);turning.add(turningBoard);
  const faceGeometry=new THREE.PlaneGeometry(1,1),faces:THREE.Mesh[]=[];
  let style:BookStyle="flipbook",studio=false,coverColour:string|undefined,backColour:string|undefined,leaves=0;
  const colour=()=>{
    const value=coverColour??bookStyleProfile(style).colour,back=backColour??value;
    for(const [material,shade] of [[boardMaterial,value],[spineMaterial,value],[backBoardMaterial,back]] as const){material.color.set(studio?shade:"#000000");material.emissive.set(studio?"#000000":shade);}
  };
  const setBoardGeometry=(next:THREE.BufferGeometry)=>{
    const old=boardGeometry;boardGeometry=next;
    for(const {board,top} of sides){board.geometry=next;top.geometry=next;}
    turningBoard.geometry=next;old.dispose();
  };
  return {
    setCoverColour(value:string,board:"front"|"back"="front"){if(board==="back")backColour=value;else coverColour=value;colour();},
    /** Leaf count of the open document, for block thickness. */
    setLeaves(count:number){leaves=Math.max(0,count|0);},
    set(value:unknown,lit:boolean){
      studio=lit;
      const profile=bookStyleProfile(value),changed=profile.id!==style;style=profile.id;
      group.visible=style!=="flipbook";
      if(changed&&profile.board>0)setBoardGeometry(coverBoardGeometry(1+2*profile.overhang,ratio+2*profile.overhang,profile.board));
      for(const {board,top,pages} of sides){
        board.scale.set(1+2*profile.overhang,ratio+2*profile.overhang,profile.board);top.scale.copy(board.scale);
        pages.scale.set(.997,ratio-.004,1);
      }
      turningBoard.scale.set(1+2*profile.overhang,ratio+2*profile.overhang,profile.board);
      colour();
      pageMaterial.color.set(studio?"#ffffff":"#000000");pageMaterial.emissive.set(studio?"#000000":"#ffffff");
      const emissiveMap=studio?null:edges;
      if(pageMaterial.emissiveMap!==emissiveMap){pageMaterial.emissiveMap=emissiveMap;pageMaterial.needsUpdate=true;}
    },
    /**
     * Lays out each side from what rests there. Every side keeps its block top at PAGE_TOP and its lowest board
     * at the same depth, so a cover leaving or landing never makes the rest of the book jump.
     */
    sync(visible:readonly [boolean,boolean],layout:readonly [BindingSide,BindingSide]=[PAGE_SIDE,PAGE_SIDE]){
      const profile=bookStyleProfile(style),hard=style==="hardback",depth=stackDepth(style,leaves),B=profile.board;
      let deepest=0;
      sides.forEach(({root,board,top,pages},index)=>{
        root.visible=visible[index]!;
        const sign=index===0?-1:1,info=hard?layout[index]!:{...layout[index]!,kind:"page" as const};
        const block=info.kind==="open"?0:info.kind==="closed"?depth:Math.max(.002,depth*info.share);
        board.position.x=top.position.x=hard?sign*profile.overhang:0;
        pages.visible=block>0;pages.scale.z=Math.max(block,1e-4);pages.position.z=PAGE_TOP-block/2;
        top.visible=info.kind==="closed";top.position.z=PAGE_TOP+B/2;
        // An open cover is just its board, directly beneath the artwork.
        board.position.z=info.kind==="open"?coverArtZ("open",B)-COVER_GAP-B/2:PAGE_TOP-block-B/2;
        if(root.visible)deepest=Math.max(deepest,info.kind==="open"?-coverArtZ("open",B)+COVER_GAP+B:-PAGE_TOP+block+B);
      });
      // The case spine wraps the deepest side, from the block top down.
      spine.scale.set(profile.spine*.65,ratio+2*profile.overhang,Math.max(profile.spine,deepest+.002));
      // It reaches the front board only while a closed or turning cover needs it, otherwise it stays below the paper.
      const raised=hard&&(turning.visible||sides.some(({root},index)=>root.visible&&layout[index]!.kind==="closed"));
      spine.position.z=PAGE_TOP+(raised?B:0)-.001;
      spine.visible=style!=="flipbook"&&(visible[0]||visible[1]);
    },
    /**
     * Shows the turning hardback board, carrying `front` (the face up at the start) and `back` (up at the end).
     * `progress` is the eased turn position; null hides it.
     */
    turnCover(progress:number|null,dir:1|-1,from:CoverRest,to:CoverRest,front?:THREE.Material,back?:THREE.Material,board:"front"|"back"="front"){
      if(progress===null||style!=="hardback"){turning.visible=false;return;}
      const profile=bookStyleProfile(style),B=profile.board,width=1+2*profile.overhang,height=ratio+2*profile.overhang,offset=B/2+COVER_GAP;
      if(!faces.length){
        for(let i=0;i<2;i++){const face=new THREE.Mesh(faceGeometry,front!);face.castShadow=face.receiveShadow=true;faces.push(face);turning.add(face);}
        faces[1]!.rotation.y=Math.PI;
      }
      if(front)faces[0]!.material=front;
      if(back)faces[1]!.material=back;
      turningBoard.material=board==="back"?backBoardMaterial:boardMaterial;
      const centre=dir*width/2;
      turningBoard.position.set(centre,0,0);
      faces[0]!.scale.set(width,height,1);faces[0]!.position.set(centre,0,offset);
      faces[1]!.scale.set(width,height,1);faces[1]!.position.set(centre,0,-offset);
      const pose=coverTurnPose(progress,coverArtZ(from,B),coverArtZ(to,B));
      turning.position.set(0,0,pose.z-offset);
      turning.rotation.y=-dir*pose.angle;
      turning.visible=true;
    },
    dispose(){parent.remove(group);box.dispose();boardGeometry.dispose();faceGeometry.dispose();cylinder.dispose();edges.dispose();boardMaterial.dispose();backBoardMaterial.dispose();pageMaterial.dispose();spineMaterial.dispose();},
  };
}
