import { paperLayerPlan, paperLayerShade } from "./paper-layers";
import { pageBlockGeometry, coverBoardGeometry, caseSpineGeometry, closedSpineGeometry } from "./book-model";
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
/** How far the ribbon lies above the paper it rests on. */
const RIBBON_LIFT=.0032;
export type RibbonTurn = { carried: boolean; sign: 1 | -1; revealing: boolean };
/** The board under the side the ribbon leaves from: its top height, thickness and how far it overhangs the foot. */
export type RibbonBoard = { top: number; thickness: number; overhang: number; /** Where it comes to rest; the reader's table by default. */ table?: number };
export type RibbonShapePath = { points: THREE.Vector3[]; contact: number[]; facing: THREE.Vector3[] };
const UP = new THREE.Vector3(0, 0, 1), OUT = new THREE.Vector3(0, -1, 0);
/**
 * Where the ribbon lies down an open page, head (v 1) to foot (v 0): `x` from the spine. It ends far enough from
 * the gutter to hang clear of the headband at the foot.
 */
export const RIBBON_PAGE = Array.from({ length: 9 }, (_, i) => { const v = 1 - i / 8; return { x: .0105 + .026 * Math.pow(1 - v, 1.3) + .003 * Math.sin(v * 5.2), v }; });
/**
 * From `foot` (where the ribbon leaves the paper): past the paper edge, hanging in front of the page block, over the
 * board's overhang and round its edge (straight and barely twisted, so its width never swings under the board),
 * then out across the table, short enough to stay inside the reader's frame.
 */
function footRun(foot: THREE.Vector3, ratio: number, board: RibbonBoard): RibbonShapePath {
  const h = (ratio - .004) / 2, { top, thickness, overhang } = board, table = board.table ?? TABLE_Z, edge = -h - overhang, x = foot.x, s = x < 0 ? -1 : 1;
  const v = (dx: number, y: number, z: number) => new THREE.Vector3(x + s * dx, y, z);
  const out: RibbonShapePath = { points: [v(0, -h - .0035, foot.z)], contact: [.9], facing: [UP] };
  // From raised paper (the open page) it drapes off the edge in one slope that clears the board's corner, so it stays
  // in view from above; held low between the leaves (a tail), it lies on the board's overhang first.
  const falls = foot.z > top + .01 && thickness > 0;
  if (falls) {
    const steps: Array<[THREE.Vector3, number, THREE.Vector3]> = [
      [v(0, -h - .006, foot.z - .006), .6, UP],
      [v(0, edge - .006, top + .004), .4, OUT],
      [v(0, edge - .01, top - thickness * .6 - .002), .5, OUT],
      [v(.002, edge - .014, Math.max(table + .0025, top - thickness - .008)), .5, OUT],
      [v(.016, edge - .026, table + .0035), .85, UP],
      [v(.046, edge - .056, table), 1, UP], [v(.086, edge - .078, table), 1, UP], [v(.111, edge - .092, table), 1, UP],
    ];
    for (const [point, contact, facing] of steps) { out.points.push(point); out.contact.push(contact); out.facing.push(facing); }
    return out;
  }
  // With no board to round (a photo flat lay rests its pages on the floor), it settles straight onto the floor.
  const rest: Array<[THREE.Vector3, number, THREE.Vector3]> = thickness <= 0 ? [
    [v(0, -h - .008, table + .0025), .7, UP],
    [v(.012, -h - .02, table + .0012), .9, UP],
    [v(.046, -h - .056, table), 1, UP], [v(.086, -h - .078, table), 1, UP], [v(.111, -h - .092, table), 1, UP],
  ] : [
    [v(0, -h - Math.max(overhang * .5, .002) - .004, top + .0022), .85, UP],
    [v(0, edge - .007, top + .0002), .6, UP],
    [v(0, edge - .012, Math.max(table + .004, top - thickness * .6 - .002)), .5, OUT],
    [v(.002, edge - .016, Math.max(table + .0025, top - thickness - .008)), .5, OUT],
    [v(.016, edge - .026, table + .0035), .85, UP],
    [v(.046, edge - .056, table), 1, UP], [v(.086, edge - .078, table), 1, UP], [v(.111, edge - .092, table), 1, UP],
  ];
  for (const [point, contact, facing] of rest) { out.points.push(point); out.contact.push(contact); out.facing.push(facing); }
  return out;
}
/**
 * The highest paper under the ribbon's width at (x, v): the strip is flat across, so it rests on the highest point
 * beneath it (the paper is drawn as a coarse grid, so the margin above it must not be razor thin).
 */
export function underRibbon(x: number, v: number) {
  return Math.max(...[-.016, -.008, 0, .008, .016].map((dx) => pageRelief(Math.abs(x + dx), v, 0)));
}
/** A ribbon lying along `page` points (each with the paper's face direction), then off the foot. */
export function ribbonFromPage(page: THREE.Vector3[], faces: THREE.Vector3[], ratio: number, board: RibbonBoard): RibbonShapePath {
  const run = footRun(page[page.length - 1]!, ratio, board);
  return { points: [...page, ...run.points], contact: [...page.map(() => 1), ...run.contact], facing: [...faces, ...run.facing] };
}
/**
 * The ribbon's centre line in book space, how much of it rests on a surface, and which way its face turns. `side` is
 * the page it leaves from; `z` is the paper lift (lying open) or the height it leaves the block at (a tail).
 */
/** How far an open ribbon moves away from the spine when the opposite side is a hardback cover lying open. */
export const RIBBON_COVER_INSET = .011;
export function ribbonPath(placement: RibbonPlacement, ratio: number, side: number, z: number, board: RibbonBoard = { top: PAGE_TOP - .006, thickness: 0, overhang: 0 }, inset = 0): RibbonShapePath {
  const h = (ratio - .004) / 2;
  if (placement.mode === "open") {
    // From under the headband, down the gutter's valley with a slight wander, then over the foot. `inset` keeps its
    // inner edge on this page when the other side is an open cover (which lies lower and must not show the silk).
    const page = RIBBON_PAGE.map(({ x, v }) => new THREE.Vector3(side * (x + inset), -h + 2 * h * v, underRibbon(x + inset, v) + z));
    return ribbonFromPage(page, page.map(() => UP), ratio, board);
  }
  // Held flat between the leaves until it leaves the block, so it never twists up into the page area; its inner edge
  // stays clear of the spine, where an opposite cover board would begin, and of the headband at the foot.
  const held = Math.max(z, board.top + .0012), page = [new THREE.Vector3(side * .03, -h + .05, held), new THREE.Vector3(side * .034, -h + .004, held), new THREE.Vector3(side * .036, -h, held)];
  return ribbonFromPage(page, page.map(() => UP), ratio, board);
}
/** Points used for the part that leaves the foot, so drapes of different shapes can blend point for point. */
const HANG_POINTS = 12;
/** The part of a ribbon path from control point `from` (its foot) onwards, resampled evenly along its length. */
export function ribbonHang(path: RibbonShapePath, from: number): RibbonShapePath {
  const points = path.points.slice(from), contact = path.contact.slice(from), facing = path.facing.slice(from);
  const curve = new THREE.CatmullRomCurve3(points.map((p) => p.clone()), false, "centripetal");
  const out: RibbonShapePath = { points: [], contact: [], facing: [] };
  for (let i = 0; i < HANG_POINTS; i++) {
    const u = i / (HANG_POINTS - 1), x = curve.getUtoTmapping(u, 0) * (points.length - 1), j = Math.min(points.length - 2, Math.floor(x)), f = x - j;
    out.points.push(curve.getPointAt(u));
    out.contact.push(THREE.MathUtils.lerp(contact[j]!, contact[j + 1]!, f));
    out.facing.push(facing[j]!.clone().lerp(facing[j + 1]!, f).normalize());
  }
  return out;
}
/**
 * Between two hangs (`k` 0 is `from`, 1 is `to`), hanging from `foot`: near the foot it keeps the blended shape
 * relative to wherever the foot now is, further out it slides between the two absolute drapes on the table.
 */
export function blendHang(from: RibbonShapePath, to: RibbonShapePath, k: number, foot: THREE.Vector3): RibbonShapePath {
  const f0 = from.points[0]!, t0 = to.points[0]!, n = from.points.length;
  return {
    points: from.points.map((p, i) => {
      const relative = foot.clone().add(p.clone().sub(f0).lerp(to.points[i]!.clone().sub(t0), k)), absolute = p.clone().lerp(to.points[i]!, k);
      const out = THREE.MathUtils.clamp((i - 1) / (n - 4), 0, 1);
      return relative.lerp(absolute, out * out * (3 - 2 * out));
    }),
    contact: from.contact.map((c, i) => THREE.MathUtils.lerp(c, to.contact[i]!, k)),
    facing: from.facing.map((f, i) => { const d = f.clone().lerp(to.facing[i]!, k); return d.lengthSq() > 1e-6 ? d.normalize() : UP.clone(); }),
  };
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
  // Printed contact shading also works in Simple, without extra shadow passes.
  const shadePixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const value=Math.round(255*paperLayerShade(x/63,y/63));
    shadePixels.set([value,value,value,255],(y*64+x)*4);
  }
  const layerShade=new THREE.DataTexture(shadePixels,64,64);
  layerShade.colorSpace=THREE.SRGBColorSpace;layerShade.magFilter=layerShade.minFilter=THREE.LinearFilter;layerShade.needsUpdate=true;
  const layerMaterial=new THREE.MeshStandardMaterial({map:layerShade,roughness:.98});
  const layerBox=new THREE.BoxGeometry(1,1,1);
  const spineMaterial=new THREE.MeshStandardMaterial({roughness:.6,envMapIntensity:1.15});
  const box=pageBlockGeometry(),cylinder=caseSpineGeometry();
  let boardGeometry:THREE.BufferGeometry=coverBoardGeometry(1,ratio,.018);
  const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=m.receiveShadow=true;return m;};
  const sides=([-1,1] as const).map(side=>{
    // `board` lies under the block (or alone, for an open cover); `top` is the front board of a closed book.
    // The left side rests on the front board and the right on the back board; a closed book shows the other board on top.
    const root=new THREE.Group(),board=mesh(boardGeometry,side<0?boardMaterial:backBoardMaterial),top=mesh(boardGeometry,side<0?backBoardMaterial:boardMaterial),pages=mesh(box,pageMaterial);
    const layers=new THREE.InstancedMesh(layerBox,layerMaterial,24);
    layers.name="Layered paper";layers.count=0;layers.castShadow=layers.receiveShadow=true;
    layers.frustumCulled=false;
    root.position.x=side*.5;root.add(board,pages,top,layers);group.add(root);
    return {root,board,top,pages,layers};
  });
  const spine=mesh(cylinder,spineMaterial);group.add(spine);
  // The board that turns with a hardback cover. Its two faces carry the cover artwork.
  const turning=new THREE.Group();turning.visible=false;group.add(turning);
  const turningBoard=mesh(boardGeometry,boardMaterial);turning.add(turningBoard);
  const faceGeometry=new THREE.PlaneGeometry(1,1),faces:THREE.Mesh[]=[];
  // Hardback headbands: small striped silk beads at the head and tail of the spine.
  const bandGeometry=new THREE.CylinderGeometry(1,1,1,12,1),bandMaterial=new THREE.MeshStandardMaterial({roughness:.45});
  let bandColour="";
  const bands=[1,-1].map(()=>{const band=mesh(bandGeometry,bandMaterial);band.name="Headband";band.visible=false;group.add(band);return band;});let bandsOn=true;
  // The ribbon bookmark: across its marked spread, otherwise a tail from between the pages onto the table.
  const ribbon=mesh(new THREE.BufferGeometry(),ribbonMaterial());ribbon.visible=false;group.add(ribbon);
  const ribbonShadow=new THREE.Mesh(new THREE.BufferGeometry(),ribbonShadowMaterial());ribbonShadow.renderOrder=1;ribbonShadow.visible=false;group.add(ribbonShadow);
  // A closed book's outer spine (added last, after the parts above).
  const closedSpineShape=closedSpineGeometry(),closedSpine=mesh(closedSpineShape,spineMaterial);closedSpine.visible=false;group.add(closedSpine);
  let ribbonOn=false,ribbonColour:string=readableRibbonColour(undefined),ribbonStamp="",ribbonGutter:number|undefined;
  let ribbonTurn:RibbonTurn|null=null,ribbonBoard:RibbonBoard={top:PAGE_TOP-.006,thickness:0,overhang:0},ribbonBoards:RibbonBoard[]=[ribbonBoard,ribbonBoard],ribbonInset=0,ribbonOpenSide:1|-1=1;
  let turnShapes:{page:THREE.Vector3[];from:RibbonShapePath;to:RibbonShapePath;carried:boolean}|null=null;
  /**
   * Moves every vertex of the resting ribbon with the turning sheet, the way notes ride on it: a point on the page
   * keeps its height above the paper along the sheet's own normal, so the strip bends with the page across its width
   * and never cuts into it. Beyond the foot the hanging end follows the sheet's foot, fading out to the table.
   */
  const carryRibbon=(sample:(u:number,v:number)=>{position:THREE.Vector3;normal:THREE.Vector3},sign:number,rest:Float32Array[],foot:THREE.Vector3)=>{
    const half=ratio/2;
    [ribbon,ribbonShadow].forEach((mesh,m)=>{
      const from=rest[m]!,positions=mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      for(let i=0;i<positions.count;i++){
        const x=from[i*3]!,y=from[i*3+1]!,z=from[i*3+2]!,u=Math.max(.0005,x);
        // The page part (its inner edge may cross the spine a little near the head) rides on the sheet.
        if(y>=-half&&x>-.02){
          const v=y/ratio+.5,s=sample(u,v),above=z-pageRelief(u,v,0);
          positions.setXYZ(i,s.position.x+s.normal.x*sign*above,s.position.y+s.normal.y*sign*above,s.position.z+s.normal.z*sign*above);
        }else{
          // Near the foot it hangs from the sheet; further down it keeps its (sliding) drape.
          const w=THREE.MathUtils.clamp(1-Math.hypot(x-foot.x,y-foot.y,z-foot.z)/.03,0,1),s=sample(Math.max(.0005,foot.x),0),above=Math.max(0,z-pageRelief(u,0,0));
          positions.setXYZ(i,x+(s.position.x+s.normal.x*sign*above-x)*w,y+(s.position.y-(-half))*w,z+(s.position.z+s.normal.z*sign*above-z)*w);
        }
      }
      positions.needsUpdate=true;
      if(mesh===ribbon)mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();
    });
  };
  const drawRibbon=({points,contact,facing}:RibbonShapePath)=>{
    const shape={contact,twist:.3};
    ribbonGeometry(points,.03,facing,ribbon.geometry,72,shape);
    ribbonShadowGeometry(points,.03,facing,ribbonShadow.geometry,72,shape);
  };
  let layered=false;
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
    /** `headbands: false` leaves them off (the photo shoot shows none). */
    setDetails(details:{ribbon?:boolean;ribbonColour?:string;ribbonGutter?:number;headbands?:boolean}){ribbonOn=details.ribbon===true;bandsOn=details.headbands!==false;ribbonColour=readableRibbonColour(details.ribbonColour);ribbonGutter=details.ribbonGutter;colour();},
    set(value:unknown,lit:boolean,showLayers=false){
      studio=lit;layered=showLayers;
      const profile=bookStyleProfile(value),changed=profile.id!==style;style=profile.id;
      group.visible=style!=="flipbook"||layered;
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
      layerMaterial.color.set(studio?"#ffffff":"#000000");layerMaterial.emissive.set(studio?"#000000":"#ffffff");
      const layerEmissive=studio?null:layerShade;
      if(layerMaterial.emissiveMap!==layerEmissive){layerMaterial.emissiveMap=layerEmissive;layerMaterial.needsUpdate=true;}
      pageMaterial.color.set(studio?"#ffffff":"#000000");pageMaterial.emissive.set(studio?"#000000":"#ffffff");
      const emissiveMap=studio?null:edges;
      if(pageMaterial.emissiveMap!==emissiveMap){pageMaterial.emissiveMap=emissiveMap;pageMaterial.needsUpdate=true;}
    },
    /**
     * Lays out each side from what rests there. Every side keeps its block top at PAGE_TOP and its lowest board
     * at the same depth, so a cover leaving or landing never makes the rest of the book jump.
     */
    sync(visible:readonly [boolean,boolean],layout:readonly [BindingSide,BindingSide]=[PAGE_SIDE,PAGE_SIDE]){
      const profile=bookStyleProfile(style),hard=style==="hardback",depth=stackDepth(layered&&style==="flipbook"?"softcover":style,leaves),B=profile.board;
      let deepest=0;
      const infoOf=(index:number)=>hard?layout[index]!:{...layout[index]!,kind:"page" as const};
      const blockOf=(index:number)=>{const info=infoOf(index);return info.kind==="open"?0:info.kind==="closed"?depth:Math.max(.002,depth*info.share);};
      // An open book lies level: both boards rest at the same depth and meet the spine there, the thinner side's
      // page block reaching down to it (seen only from the side, in the 3D view). Page tops stay at PAGE_TOP.
      const level=Math.max(0,...([0,1] as const).filter(index=>visible[index]&&infoOf(index).kind==="page").map(blockOf));
      sides.forEach(({root,board,top,pages,layers},index)=>{
        root.visible=visible[index]!;
        const sign=index===0?-1:1,info=infoOf(index);
        const block=info.kind==="page"?Math.max(blockOf(index),level):blockOf(index);
        board.position.x=top.position.x=hard?sign*profile.overhang:0;
        pages.visible=block>0;pages.scale.z=Math.max(block,1e-4);pages.position.z=PAGE_TOP-block/2;
        const plan=paperLayerPlan(leaves,info.share,block,layered&&block>0,info.leaf);
        layers.count=plan.length;layers.visible=plan.length>0;
        const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
        plan.forEach((layer,i)=>{
          matrix.compose(new THREE.Vector3(sign*layer.offset,layer.offset*.3,PAGE_TOP-layer.z),rotation,new THREE.Vector3(.997,ratio-.004,layer.thickness));
          layers.setMatrixAt(i,matrix);
        });
        layers.instanceMatrix.needsUpdate=true;
        if(plan.length>0||(layered&&style==="flipbook"))pages.visible=false;
        top.visible=info.kind==="closed";top.position.z=PAGE_TOP+B/2;
        // An open cover is just its board, directly beneath the artwork; beside a page block it reaches down to the
        // same level as the board under that block, so the two lie flat together at the spine.
        if(info.kind==="open"){
          const boardTop=coverArtZ("open",B)-COVER_GAP,boardBottom=Math.min(boardTop-B,level>0?PAGE_TOP-level-B:boardTop-B);
          board.scale.z=boardTop-boardBottom;board.position.z=(boardTop+boardBottom)/2;
        }else{board.scale.z=B;board.position.z=PAGE_TOP-block-B/2;}
        if(root.visible)deepest=Math.max(deepest,-(board.position.z-board.scale.z/2));
      });
      // The case spine wraps the deepest side, from the block top down.
      spine.scale.set(profile.spine*.65,ratio+2*profile.overhang,Math.max(profile.spine,deepest+.002));
      // It reaches the front board only while a closed or turning cover needs it, otherwise it stays below the paper.
      const raised=hard&&(turning.visible||sides.some(({root},index)=>root.visible&&layout[index]!.kind==="closed"));
      spine.position.z=PAGE_TOP+(raised?B:0)-.001;
      // A closed book (not mid-turn) shows its spine on the outside: the case wraps round the whole edge, from the
      // top of the front board to the bottom of the back board, bulging outward like a real rounded spine. Its
      // inner face reaches in past the page edges, so no sliver of paper shows between it and the covers.
      // (A soft cover has no closed board: it is closed when only one side shows and it holds the whole block. Its
      // cover is paper, which rises to pageRelief's height at the spine, so the spine reaches up to meet it.)
      const closedIndex=([0,1] as const).find(index=>visible[index]&&(layout[index]!.kind==="closed"||(!hard&&!visible[1-index]&&layout[index]!.share>=.999)));
      const shown=style!=="flipbook"&&(visible[0]||visible[1]),closed=shown&&closedIndex!==undefined&&!turning.visible;
      if(closed){
        const sign=closedIndex===0?-1:1,topZ=hard?PAGE_TOP+B+.0003:pageRelief(0,.5,0)-.0003,bottomZ=-deepest-.0004;
        closedSpine.scale.set(sign*Math.max(.007,profile.spine*.8),ratio+2*profile.overhang,(topZ-bottomZ)/2);
        closedSpine.position.set(sign*.0025,0,(topZ+bottomZ)/2);
      }
      closedSpine.visible=closed;
      spine.visible=shown&&!closed;
      // In an open book the headband shows as a short striped roll lying across the head and foot of the gutter,
      // just proud of the page edges and tucked under the paper's rise at the spine.
      // Only an open book shows them; a closed one keeps them inside its case, where their ends would poke past the spine.
      // Beside a hardback cover lying open (first and last spreads) they would sit on the cover's inside, so they hide.
      const openCover=(index:0|1)=>hard&&visible[index]&&layout[index]!.kind==="open";
      const showBands=bandsOn&&hasHeadbands(style)&&shown&&visible[0]&&visible[1]&&!openCover(0)&&!openCover(1);
      bands.forEach((band,index)=>{band.visible=showBands;band.rotation.set(0,0,Math.PI/2);band.scale.set(.0042,.03,.0042);band.position.set(0,(index===0?1:-1)*((ratio-.004)/2+.003),PAGE_TOP);});
      // The ribbon lies across its marked spread; elsewhere it leaves the block it is held in at the foot of the gutter
      // and drapes onto the table. A turn that leaves or reaches the marked spread drives it frame by frame (turnRibbon).
      const showRibbon=hasRibbon(style,ribbonOn)&&shown;
      const leafOf=(index:0|1)=>visible[index]?layout[index]!.leaf:undefined;
      const placement:RibbonPlacement=ribbonTurn?{mode:"open"}:hard||style==="softcover"?ribbonPlacement(ribbonGutter,leafOf(0),leafOf(1),leaves):{mode:"default"};
      // The ribbon is held between paper, so it never leaves from (or lies on) a cover lying open with no pages under it.
      const paper=(index:0|1)=>visible[index]&&(!hard||layout[index]!.kind!=="open");
      let sideOf:1|-1=placement.mode==="tail"?placement.side:placement.mode==="open"?1:visible[1]?1:-1;
      if(!paper(sideOf<0?0:1)&&paper(sideOf<0?1:0))sideOf=sideOf<0?1:-1;
      const index=sideOf<0?0:1,held=sides[index]!.pages,under=sides[index]!.board;
      const boardOf=(i:0|1):RibbonBoard=>({top:sides[i]!.pages.visible?PAGE_TOP-sides[i]!.pages.scale.z:sides[i]!.board.position.z+B/2,thickness:B,overhang:B>0?profile.overhang:0});
      ribbonBoards=[boardOf(0),boardOf(1)];ribbonBoard=ribbonBoards[index]!;void under;
      // Lying open beside a cover, the ribbon keeps clear of it.
      ribbonInset=placement.mode==="open"&&openCover(index===1?0:1)?RIBBON_COVER_INSET:0;ribbonOpenSide=sideOf;
      const stamp=`${JSON.stringify(placement)}|${sideOf}|${ratio}|${held.scale.z.toFixed(4)}|${ribbonBoard.top.toFixed(4)}|${ribbonInset}`;
      ribbon.visible=ribbonShadow.visible=showRibbon;
      if(showRibbon&&!ribbonTurn&&stamp!==ribbonStamp){
        ribbonStamp=stamp;
        const depth=placement.mode==="tail"&&paper(index)?placement.depth:0;
        // A tail always leaves from inside the paper block, just under the top leaf at least.
        drawRibbon(ribbonPath(placement,ratio,sideOf,placement.mode==="open"?RIBBON_LIFT:PAGE_TOP-.0006-depth*Math.max(0,held.scale.z-.0012),ribbonBoard,ribbonInset));
      }
    },
    /**
     * A turn leaving or reaching the marked spread: `carried` puts the ribbon on the turning sheet (its front face,
     * sign 1, when leaving forward; its back face, sign -1, when arriving backward); otherwise it stays on the resting
     * right-hand page, sinking under the sheet that covers it or rising as the sheet lifts away (`revealing`).
     */
    setRibbonTurn(turn:RibbonTurn|null){
      ribbonTurn=turn;ribbonStamp="";turnShapes=null;
      if(!turn||!ribbon.visible)return;
      // Where the hanging end starts and finishes: lying open on the marked spread, or as a tail from the block that
      // holds it afterwards (the left one when the marked page turns away, the right one when a page covers it).
      const open=ribbonPath({mode:"open"},ratio,ribbonOpenSide,RIBBON_LIFT,ribbonBoards[ribbonOpenSide<0?0:1]!,ribbonInset);
      const tailSide:1|-1=turn.carried?-1:1,tail=ribbonPath({mode:"tail",side:tailSide,depth:0},ratio,tailSide,PAGE_TOP-.0006,ribbonBoards[tailSide<0?0:1]!);
      const openHang=ribbonHang(open,RIBBON_PAGE.length-1),tailHang=ribbonHang(tail,2);
      const leaving=turn.carried?turn.sign===1:!turn.revealing;
      turnShapes={page:open.points.slice(0,RIBBON_PAGE.length),from:leaving?openHang:tailHang,to:leaving?tailHang:openHang,carried:turn.carried&&ribbonOpenSide===1};
    },
    /** Shapes the ribbon for this frame of the turn; `sample` gives the turning sheet's surface at (u, v). */
    turnRibbon(progress:number,sample:(u:number,v:number)=>{position:THREE.Vector3;normal:THREE.Vector3}){
      if(!ribbonTurn||!ribbon.visible||!turnShapes)return;
      const h=(ratio-.004)/2,smooth=(t:number)=>{const x=THREE.MathUtils.clamp(t,0,1);return x*x*(3-2*x);};
      // The hanging end slides from its starting drape to its finishing one as the page goes over.
      const k=smooth(progress),shapes=turnShapes;
      const join=(page:THREE.Vector3[]):RibbonShapePath=>{const hang=blendHang(shapes.from,shapes.to,k,page[page.length-1]!);return {points:[...page,...hang.points.slice(1)],contact:[...page.map(()=>1),...hang.contact.slice(1)],facing:[...page.map(()=>UP),...hang.facing.slice(1)]};};
      if(turnShapes.carried){
        // Drawn as it lies on the page, then every vertex rides on the sheet (the hanging end only near the foot).
        drawRibbon(join(turnShapes.page));
        const rest=[ribbon,ribbonShadow].map(mesh=>(mesh.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array);
        carryRibbon(sample,ribbonTurn.sign,rest,turnShapes.page[turnShapes.page.length-1]!);
        return;
      }
      const page:THREE.Vector3[]=[];
      for(const point of turnShapes.page){
        const x=Math.abs(point.x),v=(point.y+h)/(2*h),s=sample(x,v);
        // Under the sheet while it covers this page: sink into the paper (hidden) as it lands, rise as it lifts away.
        const inside=PAGE_TOP-.0006,k=ribbonTurn.revealing?1-smooth((progress-.05)/.35):smooth((progress-.55)/.4);
        let z=THREE.MathUtils.lerp(point.z,inside,k);
        if(s.position.x*point.x>0)z=Math.min(z,Math.max(inside,s.position.z-.003));
        page.push(new THREE.Vector3(point.x,point.y,z));
      }
      drawRibbon(join(page));
    },    /**
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
    dispose(){sides.forEach(({layers})=>layers.dispose());parent.remove(group);layerBox.dispose();layerMaterial.dispose();layerShade.dispose();box.dispose();closedSpineShape.dispose();boardGeometry.dispose();faceGeometry.dispose();bandGeometry.dispose();bandMaterial.map?.dispose();bandMaterial.dispose();ribbon.geometry.dispose();(ribbon.material as THREE.Material).dispose();ribbonShadow.geometry.dispose();(ribbonShadow.material as THREE.Material).dispose();[boardMaterial,backBoardMaterial,spineMaterial].forEach(disposeCloth);cylinder.dispose();edges.dispose();boardMaterial.dispose();backBoardMaterial.dispose();pageMaterial.dispose();spineMaterial.dispose();},
  };
}
