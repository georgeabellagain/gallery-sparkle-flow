import { pageBlockGeometry, coverBoardGeometry, caseSpineGeometry } from "./book-model";
import { COVER_GAP, PAGE_TOP, coverArtZ, coverTurnPose, type CoverRest } from "./rigid-cover";
import * as THREE from "three";
import { bookStyleProfile, type BookStyle } from "./book-style";
import { applyCloth, disposeCloth, hasHeadbands, hasRibbon, headbandTexture, readableRibbonColour, ribbonGeometry, ribbonMaterial, ribbonPlacement, ribbonShadowGeometry, ribbonShadowMaterial, type RibbonPlacement } from "./book-details";
import { pageRelief } from "./page-relief";

/** What rests on one side of the spine. `share` is that side's fraction of the page block (0..1); `leaf` its index. */
export type BindingSide = { kind: "page" | CoverRest; share: number; leaf?: number };
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

const TABLE_Z=-.0675;
/** The board under the side the ribbon leaves from: its top height, thickness and how far it overhangs the foot. */
export type RibbonBoard = { top: number; thickness: number; overhang: number };
/**
 * The ribbon's centre line in book space and how much of it rests on paper or the table. `side` is the page it
 * leaves from; `z` is the height it leaves the block at (a tail) or the paper lift (lying open). From the foot it
 * lies over the board's overhang and round its edge before dropping, so it never passes through the cover.
 */
export function ribbonPath(placement:RibbonPlacement,ratio:number,side:number,z:number,board:RibbonBoard={top:PAGE_TOP-.006,thickness:0,overhang:0}){
  const h=(ratio-.004)/2,p=(x:number,y:number,height:number)=>new THREE.Vector3(side*x,y,height);
  const {top,thickness,overhang}=board,edge=-h-overhang;
  // Over the board's overhang, round its edge and out across the table, short enough to stay in the reader's frame.
  const drop=(x:number)=>[
    // Straight over the edge: a sideways drift here would tilt its width back under the board.
    p(x,-h-overhang*.45-.002,top+.0022),p(x,edge-.007,top+.0002),p(x,edge-.012,top-thickness*.6-.002),p(x+.002,edge-.016,top-thickness-.008),
    p(x+.016,edge-.026,TABLE_Z+.0035),p(x+.046,edge-.056,TABLE_Z),p(x+.086,edge-.078,TABLE_Z),p(x+.111,edge-.092,TABLE_Z),
  ];
  // Barely any twist where it rounds the board edge: a twisted edge would swing back under the board.
  const dropContact=[.85,.6,.5,.5,.85,1,1,1];
  if(placement.mode==="open"){
    // From under the headband, down the gutter's valley with a slight wander, then over the foot.
    const page=Array.from({length:9},(_,i)=>{const v=1-i/8,x=.008+.016*(1-v)+.004*Math.sin(v*5.2);return p(x,-h+(2*h+.002)*v,pageRelief(x,v,0)+z);});
    const out=.028;
    return {points:[...page,p(out+.001,-h-.002,Math.max(top+.003,pageRelief(out,0,0)+z-.003)),...drop(out)],contact:[...page.map(()=>1),.7,...dropContact]};
  }
  // Held flat between the leaves until it leaves the block, so it never twists up into the page area; its inner edge
  // stays clear of the spine, where an opposite cover board would begin.
  const held=Math.max(z,top+.0012);
  return {points:[p(.019,-h+.05,held),p(.021,-h+.004,held),p(.022,-h-.001,Math.max(top+.002,held-.0005)),...drop(.022)],contact:[1,1,1,...dropContact]};
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
  // Hardback headbands: small striped silk beads at the head and tail of the spine.
  const bandGeometry=new THREE.CylinderGeometry(1,1,1,12,1),bandMaterial=new THREE.MeshStandardMaterial({roughness:.45});
  let bandColour="";
  const bands=[1,-1].map(()=>{const band=mesh(bandGeometry,bandMaterial);band.name="Headband";band.visible=false;group.add(band);return band;});
  // The ribbon bookmark: across its marked spread, otherwise a tail from between the pages onto the table.
  const ribbon=mesh(new THREE.BufferGeometry(),ribbonMaterial());ribbon.visible=false;group.add(ribbon);
  const ribbonShadow=new THREE.Mesh(new THREE.BufferGeometry(),ribbonShadowMaterial());ribbonShadow.renderOrder=1;ribbonShadow.visible=false;group.add(ribbonShadow);
  let ribbonOn=false,ribbonColour:string=readableRibbonColour(undefined),ribbonStamp="",ribbonGutter:number|undefined;
  let style:BookStyle="flipbook",studio=false,coverColour:string|undefined,backColour:string|undefined,leaves=0;
  const colour=()=>{
    const value=coverColour??bookStyleProfile(style).colour,back=backColour??value;
    for(const [material,shade] of [[boardMaterial,value],[spineMaterial,value],[backBoardMaterial,back],[ribbon.material as THREE.MeshStandardMaterial,ribbonColour]] as const){material.color.set(studio?shade:"#000000");material.emissive.set(studio?"#000000":shade);}
    // Satin sheen only under Studio light; Simple shows the flat colour with its soft contact shadow.
    const silk=ribbon.material as THREE.MeshPhysicalMaterial;silk.sheen=studio?.8:0;silk.sheenColor.set(ribbonColour).lerp(new THREE.Color("#ffffff"),.55);
    (ribbonShadow.material as THREE.MeshBasicMaterial).opacity=studio?.3:.42;
    // Headbands carry a striped map: lit in Studio, shown flat (as emissive) in Simple.
    if(bandColour!==ribbonColour){bandMaterial.map?.dispose();bandMaterial.map=headbandTexture(ribbonColour);bandColour=ribbonColour;bandMaterial.needsUpdate=true;}
    bandMaterial.color.set(studio?"#ffffff":"#000000");bandMaterial.emissive.set(studio?"#000000":"#ffffff");
    const bandGlow=studio?null:bandMaterial.map;if(bandMaterial.emissiveMap!==bandGlow){bandMaterial.emissiveMap=bandGlow;bandMaterial.needsUpdate=true;}
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
    /** Ribbon bookmark (hardback and soft cover) and the colour shared by ribbon and headbands. */
    setDetails(details:{ribbon?:boolean;ribbonColour?:string;ribbonGutter?:number}){ribbonOn=details.ribbon===true;ribbonColour=readableRibbonColour(details.ribbonColour);ribbonGutter=details.ribbonGutter;colour();},
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
      // Hardback boards and spine are covered in book cloth; card covers stay smooth.
      if(style==="hardback"){applyCloth(boardMaterial,1+2*profile.overhang,ratio);applyCloth(backBoardMaterial,1+2*profile.overhang,ratio);applyCloth(spineMaterial,.08,ratio);}
      else for(const material of [boardMaterial,backBoardMaterial,spineMaterial])if(material.normalMap){disposeCloth(material);material.userData["cloth"]=undefined;material.normalMap=material.roughnessMap=null;material.roughness=.62;material.needsUpdate=true;}
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
      // In an open book the headband shows as a short striped roll lying across the head and foot of the gutter,
      // just proud of the page edges and tucked under the paper's rise at the spine.
      // Only an open book shows them; a closed one keeps them inside its case, where their ends would poke past the spine.
      const showBands=hasHeadbands(style)&&spine.visible&&visible[0]&&visible[1];
      bands.forEach((band,index)=>{band.visible=showBands;band.rotation.set(0,0,Math.PI/2);band.scale.set(.0055,.034,.0055);band.position.set(0,(index===0?1:-1)*((ratio-.004)/2+.0035),PAGE_TOP+.001);});
      // The ribbon lies across its marked spread; elsewhere it leaves the block it is held in at the foot of the gutter
      // and drapes onto the table. Resting pages straddle a turning sheet, so a turn only ever sees a tail.
      const showRibbon=hasRibbon(style,ribbonOn)&&spine.visible;
      const leafOf=(index:0|1)=>visible[index]?layout[index]!.leaf:undefined;
      const placement:RibbonPlacement=hard||style==="softcover"?ribbonPlacement(ribbonGutter,leafOf(0),leafOf(1),leaves):{mode:"default"};
      // The ribbon is held between paper, so it never leaves from (or lies on) a cover lying open with no pages under it.
      const paper=(index:0|1)=>visible[index]&&(!hard||layout[index]!.kind!=="open");
      let sideOf:1|-1=placement.mode==="tail"?placement.side:placement.mode==="open"?1:visible[1]?1:-1;
      if(!paper(sideOf<0?0:1)&&paper(sideOf<0?1:0))sideOf=sideOf<0?1:-1;
      const index=sideOf<0?0:1,held=sides[index]!.pages,under=sides[index]!.board;
      const ribbonBoard:RibbonBoard={top:held.visible?PAGE_TOP-held.scale.z:under.position.z+B/2,thickness:B,overhang:B>0?profile.overhang:0};
      const stamp=`${JSON.stringify(placement)}|${sideOf}|${ratio}|${held.scale.z.toFixed(4)}|${ribbonBoard.top.toFixed(4)}`;
      ribbon.visible=ribbonShadow.visible=showRibbon;
      if(showRibbon&&stamp!==ribbonStamp){
        ribbonStamp=stamp;
        const depth=placement.mode==="tail"&&paper(index)?placement.depth:0;
        // A tail always leaves from inside the paper block, just under the top leaf at least.
        const {points,contact}=ribbonPath(placement,ratio,sideOf,placement.mode==="open"?.0025:PAGE_TOP-.0006-depth*Math.max(0,held.scale.z-.0012),ribbonBoard);
        const shape={contact,twist:.3};
        ribbonGeometry(points,.03,new THREE.Vector3(0,0,1),ribbon.geometry,72,shape);
        ribbonShadowGeometry(points,.03,new THREE.Vector3(0,0,1),ribbonShadow.geometry,72,shape);
      }
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
    dispose(){parent.remove(group);box.dispose();boardGeometry.dispose();faceGeometry.dispose();bandGeometry.dispose();bandMaterial.map?.dispose();bandMaterial.dispose();ribbon.geometry.dispose();(ribbon.material as THREE.Material).dispose();ribbonShadow.geometry.dispose();(ribbonShadow.material as THREE.Material).dispose();[boardMaterial,backBoardMaterial,spineMaterial].forEach(disposeCloth);cylinder.dispose();edges.dispose();boardMaterial.dispose();backBoardMaterial.dispose();pageMaterial.dispose();spineMaterial.dispose();},
  };
}
